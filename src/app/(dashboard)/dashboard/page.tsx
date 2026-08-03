import { createClient } from "@/lib/supabase/server";
import DashboardCharts from "./dashboard-charts";

function gh(v: number) {
  if (v >= 1_000_000) return `GH₵ ${(v / 1_000_000).toFixed(2)}M`;
  if (v >= 1_000) return `GH₵ ${(v / 1_000).toFixed(0)}K`;
  return `GH₵ ${v.toLocaleString("en-GH")}`;
}

async function getData() {
  const supabase = await createClient();

// Get logged in user
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

  const [projects, units, leads, viewings, sales, payments] = await Promise.all([
    supabase.from("projects").select("id, status"),
    supabase.from("units").select("id, availability, price"),
    supabase.from("leads").select("id, stage, source, created_at"),
    supabase.from("viewings").select("id, scheduled_at"),
    supabase.from("sales").select("id, sale_price, sale_date"),
    supabase.from("payments").select("id, amount, paid_date, status"),
  ]);

  const allLeads = leads.data ?? [];
  const allSales = sales.data ?? [];
  const allUnits = units.data ?? [];
  const allPayments = payments.data ?? [];

  // KPIs
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

  const totalRevenue = allSales.reduce(
    (s, r) => s + Number(r.sale_price),
    0
  );

  const totalCollected = allPayments
    .filter((p) => p.status === "paid")
    .reduce((s, p) => s + Number(p.amount), 0);

  const portfolioValue = allUnits.reduce(
    (s, u) => s + Number(u.price ?? 0),
    0
  );

  // Sales trend — last 6 months
  const months: { month: string; revenue: number; count: number }[] = [];

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
      const sd = new Date(s.sale_date);
      return sd.getFullYear() === y && sd.getMonth() === m;
    });

    months.push({
      month: label,
      revenue: monthSales.reduce((s, r) => s + Number(r.sale_price), 0),
      count: monthSales.length,
    });
  }

  // Lead sources
  const sourceMap: Record<string, number> = {};

  allLeads.forEach((l) => {
    sourceMap[l.source] = (sourceMap[l.source] ?? 0) + 1;
  });

  const leadSources = Object.entries(sourceMap).map(([name, value]) => ({
    name,
    value,
  }));

  // Pipeline stages
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

  // Unit availability breakdown
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
      totalRevenue,
      totalCollected,
      portfolioValue,
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
          <h1>
            Good day, {userName} <span>✦</span>
          </h1>
          <p className="subtitle">
            Here's how Resilience Estate is performing.
          </p>
        </div>
      </div>

      {/* KPI strip */}
      <div className="kpi-grid" style={{ marginBottom: 20 }}>
        <article className="kpi-card">
          <div className="kpi-icon navy">⌂</div>
          <div>
            <p>Portfolio value</p>
            <h2>{gh(kpis.portfolioValue)}</h2>
            <small className="muted-stat">All units combined</small>
          </div>
        </article>

        <article className="kpi-card">
          <div className="kpi-icon blue">◇</div>
          <div>
            <p>Total sales value</p>
            <h2>{gh(kpis.totalRevenue)}</h2>
            <small className="muted-stat">
              {gh(kpis.totalCollected)} collected
            </small>
          </div>
        </article>

        <article className="kpi-card">
          <div className="kpi-icon warm">◉</div>
          <div>
            <p>Active leads</p>
            <h2>{kpis.newLeads}</h2>
            <small className="muted-stat">in new-lead stage</small>
          </div>
        </article>

        <article className="kpi-card">
          <div className="kpi-icon green">◷</div>
          <div>
            <p>Upcoming site tour</p>
            <h2>{kpis.upcomingViewings}</h2>
            <small className="muted-stat">scheduled ahead</small>
          </div>
        </article>

        <article className="kpi-card">
          <div className="kpi-icon navy">▦</div>
          <div>
            <p>Active projects</p>
            <h2>{kpis.activeProjects}</h2>
          </div>
        </article>

        <article className="kpi-card">
          <div className="kpi-icon blue">▧</div>
          <div>
            <p>Available units</p>
            <h2>{kpis.availableUnits}</h2>
            <small className="muted-stat">
              {kpis.soldUnits} sold
            </small>
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