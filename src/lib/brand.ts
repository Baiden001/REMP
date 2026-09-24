// Company identity used across the portal, receipts and invoices.
export const COMPANY = {
  name: "Resilience Estate Ltd",
  shortName: "Resilience Estates",
  portalName: "Resilience Estate Management Portal",
  portalShortName: "REMP",
  slogan: "Strong Foundations. Enduring Legacies.",
  email: "info@resilienceghana.com",
  phone: "054 953 9092",
  address: "29 Augustus Akiwumi St, Airport West, Accra",
  supportEmail: "it@resilienceghana.com",
};

export const BRAND_ASSETS = {
  logo: "/images/logo-full.png",
  logoLight: "/images/logo-full-light.png",
  mark: "/images/logo-mark.png",
  markLight: "/images/logo-mark-light.png",
};

// Printed on invoices. Leave a field empty until it is confirmed; the invoice
// shows a "to be confirmed" note while any required field is missing.
export const BANK_DETAILS = {
  bankName: "",
  accountName: "",
  accountNumber: "",
  branch: "",
  swiftCode: "",
};

export function hasBankDetails() {
  return Boolean(BANK_DETAILS.bankName && BANK_DETAILS.accountName && BANK_DETAILS.accountNumber);
}
