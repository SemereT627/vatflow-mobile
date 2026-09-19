export const DEFAULT_VAT_RATE = 0.15;

export function lineTotal(quantity: number, unitPrice: number): number {
  return Math.round(quantity * unitPrice * 100) / 100;
}

export type LineTotals = { totalValue: number; vat: number; valueAfterVat: number };

/** Mirrors vatflow-web's calcLine — used to preview VAT before a sale is saved.
 * The server (sync route) recomputes this from the shop's real vat_rate at
 * write time, so this is a preview only, not the value actually stored. */
export function calcLine(quantity: number, unitPrice: number, vatRate = DEFAULT_VAT_RATE): LineTotals {
  const totalValue = lineTotal(quantity, unitPrice);
  const vat = Math.round(totalValue * vatRate * 100) / 100;
  return { totalValue, vat, valueAfterVat: Math.round((totalValue + vat) * 100) / 100 };
}
