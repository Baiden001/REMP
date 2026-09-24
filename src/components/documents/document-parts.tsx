import { BRAND_ASSETS, COMPANY } from "@/lib/brand";

export function DocumentHeader({ kicker, title }: { kicker: string; title: string }) {
  return (
    <header className="payment-receipt-header">
      <div className="payment-receipt-brand">
        <img src={BRAND_ASSETS.logo} alt={COMPANY.shortName} className="payment-receipt-logo" />
      </div>

      <div className="payment-receipt-title">
        <p>{kicker}</p>
        <h1>{title}</h1>
      </div>
    </header>
  );
}

export function DocumentFooter({ note }: { note: string }) {
  return (
    <footer className="payment-receipt-footer">
      <strong>{COMPANY.name.toUpperCase()}</strong>
      <span className="payment-receipt-slogan">{COMPANY.slogan}</span>
      <address className="payment-receipt-contact">
        <span>{COMPANY.address}</span>
        <i aria-hidden="true">•</i>
        <span>{COMPANY.phone}</span>
        <i aria-hidden="true">•</i>
        <span>{COMPANY.email}</span>
      </address>
      <p>{note}</p>
    </footer>
  );
}
