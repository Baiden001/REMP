import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { redirect } from "next/navigation";
import Icon, { type IconName } from "@/components/icon";
import { formatMoney } from "@/lib/listing";
import { isRentPayment } from "@/lib/listing";
import { invoiceTotal, isOpenInvoice } from "@/lib/invoices";

const REPORT_ROLES = ["ceo", "management", "finance", "it"];

const SOURCE_LABEL: Record<string, string> = {
  website: "Website",
  instagram: "Instagram",
  facebook: "Facebook",
  tiktok: "TikTok",
  referral: "Referral",
  walk_in: "Walk-in",
  advertisement: "Advertisement",
  other: "Other",
};

const EXPORTS: {
  kind: string;
  label: string;
  icon: IconName;
  ranged: boolean;
}[] = [
  { kind: "payments", label: "Payments", icon: "banknote", ranged: true },
  { kind: "sales", label: "Sales", icon: "trendingUp", ranged: true },
  { kind: "rentals", label: "Rentals", icon: "key", ranged: true },
  { kind: "invoices", label: "Invoices", icon: "fileText", ranged: true },
  { kind: "clients", label: "Clients", icon: "users", ranged: false },
];

function monthStart(ym: string) {
  return `${ym}-01`;
}

function monthEnd(ym: string) {
  const [y, m] = ym.split("-").map(Number);
  return new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10);
}

function shiftMonth(ym: string, delta: number) {
  const [y, m] = ym.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  return d.toISOString().slice(0, 7);
}

function monthName(ym: string, short = false) {
  const [y, m] = ym.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString("en-GB", {
    month: short ? "short" : "long",
    year: short ? undefined : "numeric",
    timeZone: "UTC",
  });
}

type Currency = "GHS" | "USD";

type PaidRow = {
  amount: number;
  tax: number | null;
  paid_date: string;
  sale_id: string | null;
  rental_id: string | null;
  payment_for: string | null;
  currency: string | null;
};

function currencyOf(value: string | null | undefined): Currency {
  return value === "USD" ? "USD" : "GHS";
}

function sumCurrency<T>(
  rows: T[],
  currency: Currency,
  getCurrency: (row: T) => string | null | undefined,
  getAmount: (row: T) => number
) {
  return rows
    .filter((row) => currencyOf(getCurrency(row)) === currency)
    .reduce((sum, row) => sum + getAmount(row), 0);
}

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: { month?: string };
}) {
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: me } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (!me || !REPORT_ROLES.includes(me.role)) redirect("/dashboard");

  const thisMonth = new Date().toISOString().slice(0, 7);

  const month = /^\d{4}-(0[1-9]|1[0-2])$/.test(
    searchParams.month ?? ""
  )
    ? searchParams.month!
    : thisMonth;

  const from = monthStart(month);
  const to = monthEnd(month);
  const trendFrom = monthStart(shiftMonth(month, -5));
  const today = new Date().toISOString().slice(0, 10);

  const [
    { data: paid },
    { data: sales },
    { data: allSales },
    { data: overdue },
    { data: invoices },
    { data: leads },
    { data: rentals },
  ] = await Promise.all([
    supabase
      .from("payments")
      .select("amount, tax, paid_date, sale_id, rental_id, payment_for, currency")
      .eq("status", "paid")
      .gte("paid_date", trendFrom)
      .lte("paid_date", to),

    supabase
      .from("sales")
      .select("sale_price, currency")
      .gte("sale_date", from)
      .lte("sale_date", to),

    supabase
      .from("sales")
      .select("sale_price, currency, payments(amount, status)"),

    supabase
      .from("payments")
      .select("amount, tax, currency")
      .eq("status", "pending")
      .lt("due_date", today),

    supabase
      .from("invoices")
      .select("invoice_date, status, tax, amount_paid, currency, invoice_items(amount)"),

    supabase
      .from("leads")
      .select("source")
      .gte("created_at", from)
      .lte("created_at", `${to}T23:59:59.999Z`),

    supabase
      .from("rentals")
      .select("total_amount, currency")
      .gte("start_date", from)
      .lte("start_date", to),
  ]);

  const paidRows = (paid ?? []) as PaidRow[];
  const inMonth = paidRows.filter((p) => p.paid_date >= from);
  const gross = (p: PaidRow) =>
    Number(p.amount || 0) + Number(p.tax || 0);

  const currencies: Currency[] = ["GHS", "USD"];

  const figures = currencies.map((currency) => {
    const saleCollections = sumCurrency(
      inMonth.filter((p) => p.sale_id),
      currency,
      (p) => p.currency,
      gross
    );

    const rentCollected = sumCurrency(
      inMonth.filter((p) => p.rental_id && isRentPayment(p)),
      currency,
      (p) => p.currency,
      gross
    );

    const otherRental = sumCurrency(
      inMonth.filter((p) => p.rental_id && !isRentPayment(p)),
      currency,
      (p) => p.currency,
      gross
    );

    const salesValue = sumCurrency(
      sales ?? [],
      currency,
      (s) => s.currency,
      (s) => Number(s.sale_price || 0)
    );

    const rentalValue = sumCurrency(
      rentals ?? [],
      currency,
      (r) => r.currency,
      (r) => Number(r.total_amount || 0)
    );

    const saleBalance = sumCurrency(
      allSales ?? [],
      currency,
      (s) => s.currency,
      (s) => {
        const received = (
          (s.payments ?? []) as { amount: number; status: string }[]
        )
          .filter((p) => p.status === "paid")
          .reduce((total, p) => total + Number(p.amount || 0), 0);

        return Math.max(Number(s.sale_price || 0) - received, 0);
      }
    );

    const overdueTotal = sumCurrency(
      overdue ?? [],
      currency,
      (p) => p.currency,
      (p) => Number(p.amount || 0) + Number(p.tax || 0)
    );

    const openInvoices = (invoices ?? []).filter(
      (i) =>
        isOpenInvoice(i.status) &&
        currencyOf(i.currency) === currency
    );

    const invoiceBalance = openInvoices.reduce(
      (sum, invoice) =>
        sum +
        Math.max(
          invoiceTotal(
            invoice as {
              tax: number;
              invoice_items: { amount: number }[];
            }
          ) - Number(invoice.amount_paid || 0),
          0
        ),
      0
    );

    return {
      currency,
      saleCollections,
      rentCollected,
      otherRental,
      collected: saleCollections + rentCollected + otherRental,
      salesValue,
      rentalValue,
      saleBalance,
      overdueTotal,
      invoiceBalance,
      openInvoiceCount: openInvoices.length,
    };
  });

  const trend = Array.from({ length: 6 }, (_, i) => {
    const ym = shiftMonth(month, i - 5);
    const rows = paidRows.filter((p) => p.paid_date.startsWith(ym));

    return {
      ym,
      ghs: rows
        .filter((p) => currencyOf(p.currency) === "GHS")
        .reduce((sum, p) => sum + gross(p), 0),
      usd: rows
        .filter((p) => currencyOf(p.currency) === "USD")
        .reduce((sum, p) => sum + gross(p), 0),
    };
  });

  const trendMaxGHS = Math.max(...trend.map((t) => t.ghs), 1);
  const trendMaxUSD = Math.max(...trend.map((t) => t.usd), 1);

  const sourceCounts = Object.entries(
    (leads ?? []).reduce<Record<string, number>>((acc, lead) => {
      acc[lead.source] = (acc[lead.source] ?? 0) + 1;
      return acc;
    }, {})
  ).sort((a, b) => b[1] - a[1]);

  const leadTotal = leads?.length ?? 0;

  const invoicedInMonth = (invoices ?? []).filter(
    (i) =>
      i.invoice_date >= from &&
      i.invoice_date <= to &&
      i.status !== "cancelled"
  );

  const exportHref = (
    kind: string,
    ranged: boolean,
    whole = false
  ) =>
    ranged && !whole
      ? `/api/export/${kind}?from=${from}&to=${to}`
      : `/api/export/${kind}`;

  return (
    <div>
      <div className="view-heading">
        <div>
          <p className="eyebrow">FINANCE</p>
          <h1>Reports</h1>
          <p className="subtitle">
            Monthly summary of sales, rent and money still owed, with spreadsheet downloads.
          </p>
        </div>

        <div className="report-month">
          <Link
            className="button ghost"
            href={`/dashboard/reports?month=${shiftMonth(month, -1)}`}
            aria-label="Previous month"
          >
            <Icon name="arrowLeft" size={15} />
          </Link>

          <form action="/dashboard/reports">
            <input
              type="month"
              name="month"
              defaultValue={month}
              max={thisMonth}
              aria-label="Month"
            />
            <button className="button ghost" type="submit">Show</button>
          </form>

          {month < thisMonth && (
            <Link
              className="button ghost"
              href={`/dashboard/reports?month=${shiftMonth(month, 1)}`}
              aria-label="Next month"
            >
              <Icon name="arrowRight" size={15} />
            </Link>
          )}
        </div>
      </div>

      <p className="report-caption">{monthName(month)}</p>

      {figures.map((f) => (
        <section key={f.currency} style={{ marginBottom: 24 }}>
          <h2 style={{ fontSize: 16, marginBottom: 12 }}>
            {f.currency === "GHS" ? "Ghana Cedis (GH₵)" : "US Dollars ($)"}
          </h2>

          <div className="kpi-grid" style={{ marginBottom: 18 }}>
            <article className="kpi-card">
              <div className="kpi-icon green"><Icon name="wallet" /></div>
              <div>
                <p>Money received</p>
                <h2>{formatMoney(f.collected, f.currency)}</h2>
                <small className="muted-stat">
                  {inMonth.filter((p) => currencyOf(p.currency) === f.currency).length} payments, incl. tax
                </small>
              </div>
            </article>

            <article className="kpi-card">
              <div className="kpi-icon navy"><Icon name="trendingUp" /></div>
              <div>
                <p>New sales</p>
                <h2>{formatMoney(f.salesValue, f.currency)}</h2>
                <small className="muted-stat">Sales recorded this month</small>
              </div>
            </article>

            <article className="kpi-card">
              <div className="kpi-icon blue"><Icon name="key" /></div>
              <div>
                <p>Rent collected</p>
                <h2>{formatMoney(f.rentCollected, f.currency)}</h2>
                <small className="muted-stat">
                  New rentals worth {formatMoney(f.rentalValue, f.currency)}
                </small>
              </div>
            </article>

            <article className="kpi-card">
              <div className="kpi-icon warm"><Icon name="fileText" /></div>
              <div>
                <p>Unpaid invoices</p>
                <h2>{formatMoney(f.invoiceBalance, f.currency)}</h2>
                <small className="muted-stat">
                  {f.openInvoiceCount} unpaid or part-paid
                </small>
              </div>
            </article>
          </div>

          <div className="report-grid">
            <section className="panel">
              <div className="panel-head">
                <div>
                  <h3>Money received, last 6 months</h3>
                  <p>{f.currency} collections, including tax.</p>
                </div>
              </div>

              <div className="report-bars">
                {trend.map((t) => {
                  const value = f.currency === "GHS" ? t.ghs : t.usd;
                  const max = f.currency === "GHS" ? trendMaxGHS : trendMaxUSD;

                  return (
                    <div key={t.ym} className={t.ym === month ? "current" : ""}>
                      <strong>
                        {value > 0
                          ? formatMoney(value, f.currency).replace(/\.00$/, "")
                          : "–"}
                      </strong>
                      <span
                        className="stack"
                        style={{ height: `${(value / max) * 100}%` }}
                      >
                        <i className="sale" style={{ flexGrow: value }} />
                      </span>
                      <b>{monthName(t.ym, true)}</b>
                    </div>
                  );
                })}
              </div>
            </section>

            <section className="panel">
              <div className="panel-head">
                <div>
                  <h3>Still owed today</h3>
                  <p>Balances as of {new Date().toLocaleDateString("en-GB")}.</p>
                </div>
              </div>

              <ul className="report-list">
                <li>
                  <span>Sale balances</span>
                  <b>{formatMoney(f.saleBalance, f.currency)}</b>
                </li>
                <li>
                  <span>
                    Overdue installments
                    <small>Scheduled payments past due</small>
                  </span>
                  <b className={f.overdueTotal > 0 ? "text-danger" : ""}>
                    {formatMoney(f.overdueTotal, f.currency)}
                  </b>
                </li>
                <li>
                  <span>
                    Unpaid invoices
                    <small>{f.openInvoiceCount} unpaid or part-paid</small>
                  </span>
                  <b>{formatMoney(f.invoiceBalance, f.currency)}</b>
                </li>
              </ul>

              <div className="report-links">
                <Link href="/dashboard/sales" className="text-button">Sales</Link>
                <Link href="/dashboard/invoices?filter=open" className="text-button">Unpaid invoices</Link>
              </div>
            </section>

            <section className="panel">
              <div className="panel-head">
                <div>
                  <h3>Money received by type</h3>
                  <p>{monthName(month)}</p>
                </div>
              </div>

              <ul className="report-list">
                <li>
                  <span>Sale payments</span>
                  <b>{formatMoney(f.saleCollections, f.currency)}</b>
                </li>
                <li>
                  <span>Rent</span>
                  <b>{formatMoney(f.rentCollected, f.currency)}</b>
                </li>
                <li>
                  <span>
                    Other rental charges
                    <small>Deposits, service charges and similar</small>
                  </span>
                  <b>{formatMoney(f.otherRental, f.currency)}</b>
                </li>
                <li className="total">
                  <span>Total</span>
                  <b>{formatMoney(f.collected, f.currency)}</b>
                </li>
              </ul>
            </section>
          </div>
        </section>
      ))}

      <section className="panel" style={{ marginBottom: 18 }}>
        <div className="panel-head">
          <div>
            <h3>Leads by source</h3>
            <p>
              {leadTotal} new lead{leadTotal === 1 ? "" : "s"} in {monthName(month)}
            </p>
          </div>
        </div>

        {sourceCounts.length > 0 ? (
          <div className="channel-bars" style={{ marginTop: 18 }}>
            {sourceCounts.map(([source, count]) => (
              <span key={source}>
                <b>{SOURCE_LABEL[source] ?? source}</b>
                <i>
                  <em
                    style={{
                      width: `${(count / sourceCounts[0][1]) * 100}%`,
                    }}
                  />
                </i>
                <strong>{count}</strong>
              </span>
            ))}
          </div>
        ) : (
          <p className="field-hint" style={{ marginTop: 18 }}>
            No leads were added this month.
          </p>
        )}

        <p className="field-hint" style={{ marginTop: 16 }}>
          {invoicedInMonth.length} invoice{invoicedInMonth.length === 1 ? "" : "s"} issued this month.
        </p>
      </section>

      <section className="panel">
        <div className="panel-head">
          <div>
            <h3>Download as Excel</h3>
            <p>
              CSV files that open in Excel or Google Sheets. Choose {monthName(month)} only or everything.
            </p>
          </div>
        </div>

        <div className="export-grid">
          {EXPORTS.map((e) => (
            <div key={e.kind} className="export-item">
              <span className="export-name">
                <Icon name={e.icon} size={16} /> {e.label}
              </span>

              <span className="export-actions">
                {e.ranged && (
                  <a
                    className="button ghost small"
                    href={exportHref(e.kind, true)}
                    download
                  >
                    <Icon name="download" size={14} /> {monthName(month, true)}
                  </a>
                )}

                <a
                  className="button ghost small"
                  href={exportHref(e.kind, e.ranged, true)}
                  download
                >
                  <Icon name="download" size={14} /> All
                </a>
              </span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
