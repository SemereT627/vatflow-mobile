import { supabase, API_BASE_URL } from "@/lib/supabase";
import {
  getPendingSales,
  markSalesSyncing,
  markSaleSynced,
  markSaleRejected,
  resetSalesSyncingToPending,
  setSyncIssue,
  cacheCatalog,
  getCachedCatalog,
  type CachedProduct,
} from "@/lib/db";

type SyncResult =
  | { clientId: string; status: "synced"; id: string }
  | { clientId: string; status: "rejected"; reason: string };

/**
 * Fetches the current session, flagging (and persisting) the "not signed
 * in" case as a sync-blocking issue instead of failing silently.
 */
async function getSessionForSync() {
  const {
    data: { session },
    error,
  } = await supabase.auth.getSession();
  if (!session) {
    console.error("sync: no session", error);
    await setSyncIssue(
      error?.message
        ? `Not signed in (${error.message}). Log out and log back in to resume syncing.`
        : "Not signed in. Log out and log back in to resume syncing."
    );
    return null;
  }
  return session;
}

let saleSyncing = false;

/**
 * Pushes all locally-queued sales to POST /api/sales/sync. Safe to call
 * repeatedly (NetInfo reconnect, app foreground, pull-to-refresh) — a sync
 * already in flight is skipped rather than run twice, and the server dedupes
 * by client_id.
 */
export async function runSaleSync(): Promise<{ synced: number; rejected: number }> {
  if (saleSyncing) return { synced: 0, rejected: 0 };
  saleSyncing = true;

  try {
    await resetSalesSyncingToPending();

    const pending = await getPendingSales();
    if (pending.length === 0) return { synced: 0, rejected: 0 };

    const session = await getSessionForSync();
    if (!session) return { synced: 0, rejected: 0 };

    await markSalesSyncing(pending.map((s) => s.clientId));

    const res = await fetch(`${API_BASE_URL}/api/sales/sync`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({
        sales: pending.map((s) => ({
          clientId: s.clientId,
          vatReceiptNumber: s.vatReceiptNumber,
          saleDate: s.saleDate,
          buyerTin: s.buyerTin,
          buyerName: s.buyerName,
          items: s.items.map((i) => ({
            productId: i.productId,
            description: i.description,
            unitOfMeasure: i.unitOfMeasure,
            quantity: i.quantity,
            unitPrice: i.unitPrice,
          })),
        })),
      }),
    });

    if (!res.ok) {
      console.error("runSaleSync: server responded", res.status, await res.text().catch(() => ""));
      if (res.status === 401) {
        await setSyncIssue("Session expired. Log out and log back in to resume syncing.");
      }
      await resetSalesSyncingToPending();
      return { synced: 0, rejected: 0 };
    }

    await setSyncIssue(null);
    const { results }: { results: SyncResult[] } = await res.json();

    let synced = 0;
    let rejected = 0;
    const seen = new Set<string>();
    for (const result of results) {
      seen.add(result.clientId);
      if (result.status === "synced") {
        await markSaleSynced(result.clientId, result.id || null);
        synced++;
      } else {
        await markSaleRejected(result.clientId, result.reason);
        rejected++;
      }
    }

    // The server is expected to report a result for every sale it received —
    // if it dropped one, reset it to 'pending' now rather than leaving it
    // stuck "Syncing…" until the next attempt's blanket reset catches it.
    const unmatched = pending.filter((s) => !seen.has(s.clientId)).map((s) => s.clientId);
    if (unmatched.length > 0) {
      console.error("runSaleSync: server omitted results for", unmatched);
      await resetSalesSyncingToPending();
    }

    return { synced, rejected };
  } catch (err) {
    console.error("runSaleSync: request failed", err);
    await resetSalesSyncingToPending();
    return { synced: 0, rejected: 0 };
  } finally {
    saleSyncing = false;
  }
}

/** Refreshes the local product catalog cache from the server. Best-effort —
 * silently keeps the last-known cache if offline. */
export async function refreshCatalog(): Promise<CachedProduct[]> {
  try {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session) return getCachedCatalog();

    const res = await fetch(`${API_BASE_URL}/api/products`, {
      headers: { Authorization: `Bearer ${session.access_token}` },
    });
    if (!res.ok) return getCachedCatalog();

    const { data }: { data: { id: string; name: string; unit_price_before_vat: number; unit_of_measure: number }[] } =
      await res.json();

    const products: CachedProduct[] = data.map((p) => ({
      id: p.id,
      name: p.name,
      unitPriceBeforeVat: p.unit_price_before_vat,
      unitOfMeasure: p.unit_of_measure,
    }));

    await cacheCatalog(products);
    return products;
  } catch (err) {
    console.error("refreshCatalog: failed, using cache", err);
    return getCachedCatalog();
  }
}
