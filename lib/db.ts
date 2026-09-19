import * as SQLite from "expo-sqlite";

export type SyncStatus = "pending" | "syncing" | "synced" | "rejected";

let dbPromise: Promise<SQLite.SQLiteDatabase> | null = null;

function getDb() {
  if (!dbPromise) {
    dbPromise = SQLite.openDatabaseAsync("vatflow-sales.db").then(async (db) => {
      await db.execAsync(`
        CREATE TABLE IF NOT EXISTS catalog_cache (
          id TEXT PRIMARY KEY NOT NULL,
          data TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS pending_sales (
          client_id TEXT PRIMARY KEY NOT NULL,
          server_id TEXT,
          vat_receipt_number TEXT NOT NULL,
          sale_date TEXT NOT NULL,
          buyer_tin TEXT,
          buyer_name TEXT,
          status TEXT NOT NULL DEFAULT 'pending',
          fail_reason TEXT,
          created_at TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS pending_sale_items (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          sale_client_id TEXT NOT NULL,
          product_id TEXT,
          description TEXT NOT NULL,
          unit_of_measure TEXT NOT NULL,
          quantity REAL NOT NULL,
          unit_price REAL NOT NULL
        );
        CREATE TABLE IF NOT EXISTS sync_state (
          id INTEGER PRIMARY KEY CHECK (id = 1),
          issue TEXT,
          issue_at TEXT
        );
        CREATE TABLE IF NOT EXISTS profile_cache (
          id INTEGER PRIMARY KEY CHECK (id = 1),
          data TEXT NOT NULL
        );
      `);
      return db;
    });
  }
  return dbPromise;
}

export type CachedProduct = {
  id: string;
  name: string;
  unitPriceBeforeVat: number;
  unitOfMeasure: string;
  unitShortCode: string;
};

/** Replaces the whole cached catalog — called after every successful fetch
 * so the last-known snapshot is always what's shown offline. */
export async function cacheCatalog(items: CachedProduct[]) {
  const db = await getDb();
  await db.withTransactionAsync(async () => {
    await db.runAsync("DELETE FROM catalog_cache");
    for (const item of items) {
      await db.runAsync("INSERT INTO catalog_cache (id, data) VALUES (?, ?)", [
        item.id,
        JSON.stringify(item),
      ]);
    }
  });
}

export async function getCachedCatalog(): Promise<CachedProduct[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<{ data: string }>("SELECT data FROM catalog_cache");
  return rows.map((r) => JSON.parse(r.data));
}

export type SaleCartItem = {
  productId: string | null;
  description: string;
  unitOfMeasure: string;
  /** Display-only label (e.g. "KG"), set while building the cart from the live catalog.
   * Not persisted in `pending_sale_items` — undefined when a queued sale is reloaded from storage. */
  unitShortCode?: string;
  quantity: number;
  unitPrice: number;
};

export type PendingSale = {
  clientId: string;
  serverId: string | null;
  vatReceiptNumber: string;
  saleDate: string;
  buyerTin: string | null;
  buyerName: string | null;
  status: SyncStatus;
  failReason: string | null;
  createdAt: string;
  items: SaleCartItem[];
};

type PendingSaleRow = {
  client_id: string;
  server_id: string | null;
  vat_receipt_number: string;
  sale_date: string;
  buyer_tin: string | null;
  buyer_name: string | null;
  status: SyncStatus;
  fail_reason: string | null;
  created_at: string;
};

type PendingSaleItemRow = {
  id: number;
  sale_client_id: string;
  product_id: string | null;
  description: string;
  unit_of_measure: string;
  quantity: number;
  unit_price: number;
};

function rowToSale(row: PendingSaleRow, items: SaleCartItem[]): PendingSale {
  return {
    clientId: row.client_id,
    serverId: row.server_id,
    vatReceiptNumber: row.vat_receipt_number,
    saleDate: row.sale_date,
    buyerTin: row.buyer_tin,
    buyerName: row.buyer_name,
    status: row.status,
    failReason: row.fail_reason,
    createdAt: row.created_at,
    items,
  };
}

/** Queues a sale for sync — this device's only write path. The receipt is
 * already issued on paper by the time this is called, so there's no admin
 * approval step; sync writes straight to `sales` + `sale_items`. */
export async function enqueueSale(input: {
  clientId: string;
  vatReceiptNumber: string;
  saleDate: string;
  buyerTin: string | null;
  buyerName: string | null;
  items: SaleCartItem[];
}) {
  const db = await getDb();
  await db.withTransactionAsync(async () => {
    await db.runAsync(
      `INSERT INTO pending_sales
        (client_id, vat_receipt_number, sale_date, buyer_tin, buyer_name, status, created_at)
       VALUES (?, ?, ?, ?, ?, 'pending', ?)`,
      [
        input.clientId,
        input.vatReceiptNumber,
        input.saleDate,
        input.buyerTin,
        input.buyerName,
        new Date().toISOString(),
      ]
    );
    for (const item of input.items) {
      await db.runAsync(
        `INSERT INTO pending_sale_items
          (sale_client_id, product_id, description, unit_of_measure, quantity, unit_price)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [input.clientId, item.productId, item.description, item.unitOfMeasure, item.quantity, item.unitPrice]
      );
    }
  });
}

async function attachSaleItems(
  db: SQLite.SQLiteDatabase,
  sales: PendingSaleRow[]
): Promise<PendingSale[]> {
  const result: PendingSale[] = [];
  for (const row of sales) {
    const itemRows = await db.getAllAsync<PendingSaleItemRow>(
      "SELECT * FROM pending_sale_items WHERE sale_client_id = ?",
      [row.client_id]
    );
    result.push(
      rowToSale(
        row,
        itemRows.map((r) => ({
          productId: r.product_id,
          description: r.description,
          unitOfMeasure: r.unit_of_measure,
          quantity: r.quantity,
          unitPrice: r.unit_price,
        }))
      )
    );
  }
  return result;
}

export async function getAllSales(): Promise<PendingSale[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<PendingSaleRow>(
    "SELECT * FROM pending_sales ORDER BY created_at DESC"
  );
  return attachSaleItems(db, rows);
}

export async function getPendingSales(): Promise<PendingSale[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<PendingSaleRow>(
    "SELECT * FROM pending_sales WHERE status IN ('pending', 'syncing') ORDER BY created_at ASC"
  );
  return attachSaleItems(db, rows);
}

export async function markSalesSyncing(clientIds: string[]) {
  if (clientIds.length === 0) return;
  const db = await getDb();
  const placeholders = clientIds.map(() => "?").join(",");
  await db.runAsync(
    `UPDATE pending_sales SET status = 'syncing' WHERE client_id IN (${placeholders})`,
    clientIds
  );
}

export async function markSaleSynced(clientId: string, serverId: string | null) {
  const db = await getDb();
  await db.runAsync(
    "UPDATE pending_sales SET status = 'synced', fail_reason = NULL, server_id = COALESCE(?, server_id) WHERE client_id = ?",
    [serverId, clientId]
  );
}

export async function markSaleRejected(clientId: string, reason: string) {
  const db = await getDb();
  await db.runAsync("UPDATE pending_sales SET status = 'rejected', fail_reason = ? WHERE client_id = ?", [
    reason,
    clientId,
  ]);
}

export async function resetSalesSyncingToPending() {
  const db = await getDb();
  await db.runAsync("UPDATE pending_sales SET status = 'pending' WHERE status = 'syncing'");
}

export async function discardSale(clientId: string) {
  const db = await getDb();
  await db.withTransactionAsync(async () => {
    await db.runAsync("DELETE FROM pending_sale_items WHERE sale_client_id = ?", [clientId]);
    await db.runAsync("DELETE FROM pending_sales WHERE client_id = ?", [clientId]);
  });
}

export type SyncIssue = { message: string; at: string };

/** Records a blocking sync problem (e.g. dead session) so it survives app
 * restarts and can be surfaced in the History screen — cleared once a sync
 * actually succeeds. Not for per-sale failures, which use fail_reason. */
export async function setSyncIssue(message: string | null) {
  const db = await getDb();
  await db.runAsync(
    `INSERT INTO sync_state (id, issue, issue_at) VALUES (1, ?, ?)
     ON CONFLICT (id) DO UPDATE SET issue = excluded.issue, issue_at = excluded.issue_at`,
    [message, message ? new Date().toISOString() : null]
  );
}

export async function getSyncIssue(): Promise<SyncIssue | null> {
  const db = await getDb();
  const row = await db.getFirstAsync<{ issue: string | null; issue_at: string | null }>(
    "SELECT issue, issue_at FROM sync_state WHERE id = 1"
  );
  if (!row?.issue) return null;
  return { message: row.issue, at: row.issue_at ?? new Date().toISOString() };
}

export type CachedProfile = {
  email: string | null;
  fullName: string;
  role: "admin" | "seller";
  shop: { businessName: string; tin: string | null; vatRate: number };
};

/** Last-known account/shop details so the Profile screen has something to
 * show offline — refreshed opportunistically whenever the screen is focused. */
export async function cacheProfile(profile: CachedProfile) {
  const db = await getDb();
  await db.runAsync(
    `INSERT INTO profile_cache (id, data) VALUES (1, ?)
     ON CONFLICT (id) DO UPDATE SET data = excluded.data`,
    [JSON.stringify(profile)]
  );
}

export async function getCachedProfile(): Promise<CachedProfile | null> {
  const db = await getDb();
  const row = await db.getFirstAsync<{ data: string }>("SELECT data FROM profile_cache WHERE id = 1");
  return row ? JSON.parse(row.data) : null;
}
