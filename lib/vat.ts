export const UNIT_OF_MEASURE_LABELS: Record<number, string> = {
  2: "KG",
  3: "ML",
  4: "GM",
  5: "LIT",
  6: "MT",
  7: "PCS",
  8: "CT",
  9: "OTHER",
  10: "PC",
};

export function lineTotal(quantity: number, unitPrice: number): number {
  return Math.round(quantity * unitPrice * 100) / 100;
}
