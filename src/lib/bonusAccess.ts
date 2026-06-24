// Shared Team Bonus access code. Set VITE_BONUS_PASSWORD in your env (e.g. Netlify)
// for production; defaults to "bonus" for local/demo. Soft client-side gate, not
// real access control — used by the BonusGate and by the Settings lock toggle.
export const BONUS_PASSWORD = import.meta.env.VITE_BONUS_PASSWORD || 'bonus'

export function verifyBonusPassword(input: string): boolean {
  return input.trim() === BONUS_PASSWORD
}
