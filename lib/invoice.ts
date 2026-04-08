/**
 * Generate invoice number: INV-YYYYMMDD-XXXXX
 * XXXXX = random 5-digit alphanumeric (uppercase)
 */
export function generateInvoiceNumber(): string {
  const now = new Date();
  const date = [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, "0"),
    String(now.getDate()).padStart(2, "0"),
  ].join("");

  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let rand = "";
  for (let i = 0; i < 5; i++) {
    rand += chars[Math.floor(Math.random() * chars.length)];
  }

  return `INV-${date}-${rand}`;
}
