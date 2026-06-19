/**
 * Localized formatter for Indonesian Rupiah
 */
export function formatRupiah(amount: number): string {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount).replace('IDR', 'Rp');
}

/**
 * Standard relative and absolute date formatting for Indonesian locale
 */
export function formatDate(isoString: string): string {
  const date = new Date(isoString);
  const indonesianMonths = [
    'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
    'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
  ];
  
  const day = date.getDate();
  const month = indonesianMonths[date.getMonth()];
  const year = date.getFullYear();
  
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  
  return `${day} ${month} ${year}, ${hours}:${minutes}`;
}

/**
 * Generates an incremented daily transaction ID
 * format: TR-YYYYMMDD-XXXX where XXXX is a unique random code or index
 */
export function generateTransactionId(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  
  // Random suffix
  const randomSuffix = Math.floor(1000 + Math.random() * 9000); // 4 digits
  
  return `TR-${year}${month}${day}-${randomSuffix}`;
}

/**
 * Generate a random SKU for newly created products if not filled
 */
export function generateSKU(category: string): string {
  const prefix = category.substring(0, 3).toUpperCase();
  const randomSuffix = Math.floor(100 + Math.random() * 900); // 3 digits
  return `${prefix}-${randomSuffix}`;
}
