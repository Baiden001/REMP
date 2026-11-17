"use client";

import {
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";

const COLORS = ["#1f5a44", "#b08d57", "#15946b", "#c8752b", "#11251d", "#8b5cf6"];

function formatGHS(value: number) {
  if (value >= 1_000_000) return `GH₵${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `GH₵${(value / 1_000).toFixed(0)}K`;
  return `GH₵${value.toLocaleString("en-GH")}`;
}

function formatUSD(value: number) {
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `$${(value / 1_000).toFixed(0)}K`;
  return `$${value.toLocaleString("en-US")}`;
}

function ChartCard({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="panel" style={{ flex: "1 1 280px", minWidth: 0 }}>
      <div className="panel-head">
        <div>
          <h3>{title}</h3>
          {subtitle && <p>{subtitle}</p>}
        </div>
      </div>
      <div style={{ marginTop: 16 }}>{children}</div>
    </div>
  );
}

export default function DashboardCharts({
  salesTrend,
  leadSources,
  pipeline,
  unitBreakdown,
}: {
  salesTrend: {
    month: string;
    revenueGHS: number;
    revenueUSD: number;
    count: number;
  }[];
  leadSources: { name: string; value: number }[];
  pipeline: { stage: string; count: number }[];
  unitBreakdown: { name: string; value: number }[];
}) {
  const hasAnySale = salesTrend.some(
    (s) => s.revenueGHS > 0 || s.revenueUSD > 0
  );
  const hasLeads = leadSources.some((s) => s.value > 0);
  const hasUnits = unitBreakdown.some((u) => u.value > 0);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      <ChartCard
        title="Sales trend · GHS"
        subtitle="GHS revenue closed per month — last 6 months"
      >
        {hasAnySale ? (
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={salesTrend} barSize={28}>
              <XAxis dataKey="month" tick={{ fontSize: 10, fill: "#8e9e98" }} axisLine={false} tickLine={false} />
              <YAxis tickFormatter={formatGHS} tick={{ fontSize: 10, fill: "#8e9e98" }} axisLine={false} tickLine={false} width={65} />
              <Tooltip formatter={(v) => [formatGHS(Number(v)), "GHS revenue"]} />
              <Bar dataKey="revenueGHS" name="GHS" fill="#1f5a44" radius={[5, 5, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <p className="subtitle" style={{ padding: "24px 0", textAlign: "center" }}>No sales recorded yet.</p>
        )}
      </ChartCard>

      <ChartCard
        title="Sales trend · USD"
        subtitle="USD revenue closed per month — last 6 months"
      >
        {hasAnySale ? (
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={salesTrend} barSize={28}>
              <XAxis dataKey="month" tick={{ fontSize: 10, fill: "#8e9e98" }} axisLine={false} tickLine={false} />
              <YAxis tickFormatter={formatUSD} tick={{ fontSize: 10, fill: "#8e9e98" }} axisLine={false} tickLine={false} width={65} />
              <Tooltip formatter={(v) => [formatUSD(Number(v)), "USD revenue"]} />
              <Bar dataKey="revenueUSD" name="USD" fill="#b08d57" radius={[5, 5, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <p className="subtitle" style={{ padding: "24px 0", textAlign: "center" }}>No sales recorded yet.</p>
        )}
      </ChartCard>

      <div style={{ display: "flex", gap: 18, flexWrap: "wrap" }}>
        <ChartCard title="Lead pipeline" subtitle="Leads by stage">
          {hasLeads ? (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={pipeline} layout="vertical" barSize={14}>
                <XAxis type="number" tick={{ fontSize: 10, fill: "#8e9e98" }} axisLine={false} tickLine={false} />
                <YAxis dataKey="stage" type="category" tick={{ fontSize: 10, fill: "#8e9e98" }} axisLine={false} tickLine={false} width={100} />
                <Tooltip />
                <Bar dataKey="count" fill="#11251d" radius={[0, 5, 5, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <p className="subtitle" style={{ padding: "24px 0", textAlign: "center" }}>No leads yet.</p>
          )}
        </ChartCard>

        <ChartCard title="Lead sources" subtitle="Where leads are coming from">
          {hasLeads ? (
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie data={leadSources} cx="50%" cy="50%" innerRadius={55} outerRadius={80} paddingAngle={3} dataKey="value">
                  {leadSources.map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 10, color: "#61786f" }} />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <p className="subtitle" style={{ padding: "24px 0", textAlign: "center" }}>No leads yet.</p>
          )}
        </ChartCard>
      </div>

      <ChartCard title="Unit availability" subtitle="Inventory breakdown across all projects">
        {hasUnits ? (
          <ResponsiveContainer width="100%" height={160}>
            <BarChart data={unitBreakdown} barSize={40}>
              <XAxis dataKey="name" tick={{ fontSize: 10, fill: "#8e9e98" }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 10, fill: "#8e9e98" }} axisLine={false} tickLine={false} />
              <Tooltip />
              <Bar dataKey="value" radius={[5, 5, 0, 0]}>
                {unitBreakdown.map((_, i) => (
                  <Cell key={i} fill={COLORS[i % COLORS.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <p className="subtitle" style={{ padding: "24px 0", textAlign: "center" }}>No units yet.</p>
        )}
      </ChartCard>
    </div>
  );
}
