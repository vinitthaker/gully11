// Currency formatting utility
// INR: ₹1,00,000.00 (Indian grouping: last 3, then 2s)
// USD: $100,000.00 (Western grouping: 3s)

export function formatAmount(amount: number, currency: string = '₹'): string {
  const abs = Math.abs(amount);
  const fixed = abs.toFixed(2);

  if (currency === '₹') {
    return `${currency}${formatIndian(fixed)}`;
  }
  // Default: western format
  return `${currency}${formatWestern(fixed)}`;
}

// Returns just the formatted number (no currency symbol)
export function formatNumber(amount: number, currency: string = '₹'): string {
  const abs = Math.abs(amount);
  const fixed = abs.toFixed(2);

  if (currency === '₹') {
    return formatIndian(fixed);
  }
  return formatWestern(fixed);
}

// Indian format: 1,00,00,000.00
function formatIndian(numStr: string): string {
  const [intPart, decPart] = numStr.split('.');
  if (intPart.length <= 3) {
    return `${intPart}.${decPart}`;
  }

  // Last 3 digits
  const last3 = intPart.slice(-3);
  let remaining = intPart.slice(0, -3);

  // Group remaining in 2s from right
  const groups: string[] = [];
  while (remaining.length > 0) {
    groups.unshift(remaining.slice(-2));
    remaining = remaining.slice(0, -2);
  }

  return `${groups.join(',')},${last3}.${decPart}`;
}

// Western format: 1,000,000.00
function formatWestern(numStr: string): string {
  const [intPart, decPart] = numStr.split('.');
  const formatted = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return `${formatted}.${decPart}`;
}
