// Centralized financial minor-unit (2-decimal) rounding utility (FIN-008)
export function roundMoney(amount: number): number {
  if (!Number.isFinite(amount)) return 0
  return Math.round((amount + Number.EPSILON) * 100) / 100
}

export function toCents(amount: number): number {
  return Math.round(roundMoney(amount) * 100)
}

export function fromCents(cents: number): number {
  return Math.round(cents) / 100
}
