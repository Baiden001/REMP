import { createClient } from "@/lib/supabase/server";
import DashboardCharts from "./dashboard-charts";
import Icon from "@/components/icon";
import { formatMoney } from "@/lib/listing";

async function getData() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  let userName = "User";

  if (user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("full_name")
      .eq("id", user.id)
      .single();

    userName = profile?.full_name || "User";
  }

  const [projects, units, leads, viewings, sales, payments] =
    await Promise.all([
      supabase.from("projects").select("id, status"),
      supabase.from("units").select("id, availability, price, currency"),
      supabase.from("leads").select("id, stage, source, created_at"),
      supabase.from("viewings").select("id, scheduled_at"),
      supabase.from("sales").select("id, sale_price, sale_date, currency"),
      supabase.from("payments").select("id, amount, paid_date, status, currency"),
    ]);

  const allLeads = leads.data ?? [];
  const allSales = sales.data ?? [];
  const allUnits = units.data ?? [];
  const allPayments = payments.data ?? [];

  const activeProjects = (projects.data ?? []).filter(
    (p) => p.status !== "completed"
  ).length;

  const availableUnits = allUnits.filter(
    (u) => u.availability === "available"
  ).length;

  const soldUnits = allUnits.filter(
    (u) => u.availability === "sold"
  ).length;

  const newLeads = allLeads.filter(
    (l) => l.stage === "new"
  ).length;

  const upcomingViewings = (viewings.data ?? []).filter(
    (v) => new Date(v.scheduled_at).getTime() >= Date.now()
  ).length;

  const sumCurrency = <T extends { currency: string | null }>(
    rows: T[],
    value: (row: T) => number,
    currency: "GHS" | "USD"
  ) =>
    rows
      .filter((row) =>
        currency === "USD"
          ? row.currency === "USD"
          : row.currency !== "USD"
      )
      .reduce((sum, row) => sum + value(row), 0);

  const portfolioGHS = sumCurrency(
    allUnits,
    (u) => Number(u.price || 0),
    "GHS"
  );

  const portfolioUSD = sumCurrency(
    allUnits,
    (u) => Number(u.price || 0),
    "USD"
  );

  const salesGHS = sumCurrency(
    allSales,
    (s) => Number(s.sale_price || 0),
    "GHS"
  );

  const salesUSD = sumCurrency(
    allSales,
    (s) => Number(s.sale_price || 0),
    "USD"
  );

  const paidPayments = allPayments.filter((p) => p.status === "paid");

  const collectedGHS = sumCurrency(
    paidPayments,
    (p) => Number(p.amount || 0),
    "GHS"
  );

  const collectedUSD = sumCurrency(
    paidPayments,
    (p) => Number(p.amount || 0),
    "USD"
  );

  const months: {
    month: string;
    revenueGHS: number;
    revenueUSD: number;
    count: number;
  }[] = [];

  for (let i = 5; i >= 0; i--) {
    const d = new Date();
    d.setMonth(d.getMonth() - i);

    const label = d.toLocaleDateString("en-GB", {
      month: "short",
      year: "2-digit",
    });

    const y = d.getFullYear();
    const m = d.getMonth();

    const monthSales = allSales.filter((s) => {
      if (!s.sale_date) return false;
      const sd = new Date(s.sale_date);
      return sd.getFullYear() === y && sd.getMonth() === m;
    });

    months.push({
      month: label,
      revenueGHS: sumCurrency(
        monthSales,
        (s) => Number(s.sale_price || 0),
        "GHS"
      ),
      revenueUSD: sumCurrency(
        monthSales,
        (s) => Number(s.sale_price || 0),
        "USD"
      ),
      count: monthSales.length,
    });
  }

  const sourceMap: Record<string, number> = {};

  allLeads.forEach((l) => {
    sourceMap[l.source] = (sourceMap[l.source] ?? 0) + 1;
  });

  const leadSources = Object.entries(sourceMap).map(([name, value]) => ({
    name,
    value,
  }));

  const STAGES = [
    "new",
    "contacted",
    "qualified",
    "viewing_scheduled",
    "negotiation",
    "sale",
  ];

  const pipeline = STAGES.map((stage) => ({
    stage: stage.replace("_", " "),
    count: allLeads.filter((l) => l.stage === stage).length,
  }));

  const unitBreakdown = [
    { name: "Available", value: availableUnits },
    {
      name: "Reserved",
      value: allUnits.filter((u) => u.availability === "reserved").length,
    },
    { name: "Sold", value: soldUnits },
  ];

  return {
    userName,
    kpis: {
      activeProjects,
      availableUnits,
      soldUnits,
      newLeads,
      upcomingViewings,
      portfolioGHS,
      portfolioUSD,
      salesGHS,
      salesUSD,
      collectedGHS,
      collectedUSD,
    },
    salesTrend: months,
    leadSources,
    pipeline,
    unitBreakdown,
  };
}

export default async function DashboardPage() {
  const {
    userName,
    kpis,
    salesTrend,
    leadSources,
    pipeline,
    unitBreakdown,
  } = await getData();

  return (
    <div>
      <div className="hero-row">
        <div>
          <p className="eyebrow">EXECUTIVE OVERVIEW</p>
          <h1>Good day, {userName}</h1>
          <p className="subtitle">
            Here's how Resilience Estate is performing.
          </p>
        </div>
      </div>

      <div className="kpi-grid" style={{ marginBottom: 20 }}>
        <article className="kpi-card">
          <div className="kpi-icon navy"><Icon name="wallet" /></div>
          <div>
            <p>Portfolio value · GHS</p>
            <h2>{formatMoney(kpis.portfolioGHS, "GHS")}</h2>
            <small className="muted-stat">All GHS units</small>
            <h2 style={{ fontSize: 17, marginTop: 8 }}>
              {formatMoney(kpis.portfolioUSD, "USD")}
            </h2>
            <small className="muted-stat">All USD units</small>
          </div>
        </article>

        <article className="kpi-card">
          <div className="kpi-icon blue"><Icon name="trendingUp" /></div>
          <div>
            <p>Total sales value</p>
            <h2 style={{ fontSize: 17 }}>{formatMoney(kpis.salesGHS, "GHS")}</h2>
            <small className="muted-stat">GHS sales</small>
            <h2 style={{ fontSize: 17, marginTop: 8 }}>{formatMoney(kpis.salesUSD, "USD")}</h2>
            <small className="muted-stat">USD sales</small>
            <p style={{ marginTop: 10 }}>Collected</p>
            <b>{formatMoney(kpis.collectedGHS, "GHS")}</b>
            <br />
            <b>{formatMoney(kpis.collectedUSD, "USD")}</b>
          </div>
        </article>

        <article className="kpi-card">
          <div className="kpi-icon warm"><Icon name="target" /></div>
          <div>
            <p>Active leads</p>
            <h2>{kpis.newLeads}</h2>
            <small className="muted-stat">in new-lead stage</small>
          </div>
        </article>

        <article className="kpi-card">
          <div className="kpi-icon green"><Icon name="calendarCheck" /></div>
          <div>
            <p>Upcoming site tour</p>
            <h2>{kpis.upcomingViewings}</h2>
            <small className="muted-stat">scheduled ahead</small>
          </div>
        </article>

        <article className="kpi-card">
          <div className="kpi-icon navy"><Icon name="building" /></div>
          <div>
            <p>Active projects</p>
            <h2>{kpis.activeProjects}</h2>
          </div>
        </article>

        <article className="kpi-card">
          <div className="kpi-icon blue"><Icon name="home" /></div>
          <div>
            <p>Available units</p>
            <h2>{kpis.availableUnits}</h2>
            <small className="muted-stat">{kpis.soldUnits} sold</small>
          </div>
        </article>
      </div>

      <DashboardCharts
        salesTrend={salesTrend}
        leadSources={leadSources}
        pipeline={pipeline}
        unitBreakdown={unitBreakdown}
      />
    </div>
  );
}
