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

// Printed on invoices. Empty fields print as a blank line to fill in by hand.
export const BANK_DETAILS = {
  bankName: "",
  accountNumber: "",
  accountName: "",
};

// Printed at the bottom of every invoice. Edit to match company policy.
export const INVOICE_TERMS = [
  "Payment is due by the due date shown on this invoice.",
  "Please quote the invoice number as your payment reference.",
  "All amounts are in Ghana Cedis (GH₵).",
  "An official receipt will be issued once payment is received and confirmed.",
  "This invoice is not a receipt and does not confirm that payment has been made.",
];
