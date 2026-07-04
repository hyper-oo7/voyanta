export const CURRENCIES = [
  { code: 'INR', symbol: '₹', label: 'INR (₹) - Indian Rupee', locale: 'en-IN' },
  { code: 'USD', symbol: '$', label: 'USD ($) - US Dollar', locale: 'en-US' },
  { code: 'AED', symbol: 'AED', label: 'AED (AED) - UAE Dirham', locale: 'en-AE' },
  { code: 'EUR', symbol: '€', label: 'EUR (€) - Euro', locale: 'de-DE' },
  { code: 'GBP', symbol: '£', label: 'GBP (£) - British Pound', locale: 'en-GB' },
  { code: 'AUD', symbol: 'A$', label: 'AUD ($) - Australian Dollar', locale: 'en-AU' },
  { code: 'SGD', symbol: 'S$', label: 'SGD ($) - Singapore Dollar', locale: 'en-SG' },
  { code: 'THB', symbol: '฿', label: 'THB (฿) - Thai Baht', locale: 'th-TH' },
  { code: 'JPY', symbol: '¥', label: 'JPY (¥) - Japanese Yen', locale: 'ja-JP' },
];

export function getCurrencyMeta(currencyCode = 'INR') {
  const code = (currencyCode || 'INR').toUpperCase();
  return CURRENCIES.find(c => c.code === code) || { code, symbol: code, label: `${code}`, locale: 'en-US' };
}

export function getCurrencySymbol(currencyCode = 'INR') {
  return getCurrencyMeta(currencyCode).symbol;
}

export function formatPrice(amount, currencyCode = 'INR') {
  const num = Number(amount);
  if (isNaN(num) || !Number.isFinite(num)) {
    const sym = getCurrencySymbol(currencyCode);
    return `${sym}0.00`;
  }
  
  const meta = getCurrencyMeta(currencyCode);
  const maxDecimals = meta.code === 'JPY' ? 0 : 2;
  
  try {
    return new Intl.NumberFormat(meta.locale, {
      style: 'currency',
      currency: meta.code,
      maximumFractionDigits: maxDecimals,
    }).format(num);
  } catch {
    return `${meta.symbol}${num.toFixed(maxDecimals)}`;
  }
}

export function formatINR(amount) {
  return formatPrice(amount, 'INR');
}
