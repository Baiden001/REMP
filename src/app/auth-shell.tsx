import { BRAND_ASSETS, COMPANY } from "@/lib/brand";

export default function AuthShell({
  eyebrow,
  title,
  subtitle,
  children,
}: {
  eyebrow: string;
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <main className="auth-page">
      <div className="auth-backdrop" aria-hidden="true">
        <img src={BRAND_ASSETS.markLight} alt="" className="auth-watermark" />
      </div>

      <header className="auth-header">
        <a href="/login" className="auth-brand" aria-label={COMPANY.shortName}>
          <img src={BRAND_ASSETS.markLight} alt="" className="auth-brand-mark" />
          <span>
            <strong>RESILIENCE</strong>
            <small>ESTATES</small>
          </span>
        </a>
      </header>

      <section className="auth-center">
        <div className="auth-card">
          <p className="auth-eyebrow">{eyebrow}</p>
          <h1 className="auth-title">{title}</h1>
          <p className="auth-subtitle">{subtitle}</p>

          {children}

          <p className="auth-help">
            Trouble signing in? Contact IT at{" "}
            <a href={`mailto:${COMPANY.supportEmail}`}>{COMPANY.supportEmail}</a>
          </p>
        </div>
      </section>

      <footer className="auth-footer">
        <span>
          © {new Date().getFullYear()} {COMPANY.name}
        </span>
        <span className="auth-footer-dot" aria-hidden="true">•</span>
        <span>{COMPANY.slogan}</span>
      </footer>
    </main>
  );
}
