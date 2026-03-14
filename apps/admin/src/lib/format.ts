/**
 * Format paise (integer) to INR currency string.
 * e.g., 150000 → "₹1,500.00"
 */
export function formatPaise(paise: number): string {
  const rupees = paise / 100;
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(rupees);
}

/**
 * Format ISO date string to readable date.
 * e.g., "2026-03-14T10:30:00Z" → "14 Mar 2026"
 */
export function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return new Intl.DateTimeFormat('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(date);
}

/**
 * Format basis points to percentage.
 * e.g., 1500 → "15.00%"
 */
export function formatBps(bps: number): string {
  return `${(bps / 100).toFixed(2)}%`;
}
