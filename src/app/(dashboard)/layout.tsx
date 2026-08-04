import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import SignOutButton from "./sign-out-button";
import NotificationBell from "./notification-bell";
import GlobalSearch from "./global-search";
import MobileMenuButton from "./mobile-menu-button";

const NAV = [
  {
    section: "OVERVIEW",
    items: [
      {
        label: "Dashboard",
        icon: "▦",
        href: "/dashboard",
        roles: ["ceo", "management", "sales", "marketing", "finance", "it"],
      },
    ],
  },
  {
    section: "OPERATIONS",
    items: [
      {
        label: "Projects",
        icon: "⌂",
        href: "/dashboard/projects",
        roles: ["ceo", "management", "sales", "marketing", "finance", "it"],
      },
      {
        label: "Properties & units",
        icon: "▧",
        href: "/dashboard/units",
        roles: ["ceo", "management", "sales", "marketing", "finance", "it"],
      },
      {
        label: "CRM",
        icon: "◎",
        href: "/dashboard/crm",
        roles: ["ceo", "management", "sales", "marketing", "finance", "it"],
      },
      {
        label: "Site Tours",
        icon: "◷",
        href: "/dashboard/viewings",
        roles: ["ceo", "management", "sales", "marketing", "finance", "it"],
      },
      {
        label: "Sales & payments",
        icon: "◇",
        href: "/dashboard/sales",
        roles: ["ceo", "management", "sales", "finance", "it"],
      },
    ],
  },
  {
    section: "GROWTH",
    items: [
      {
        label: "Marketing center",
        icon: "✦",
        href: "/dashboard/marketing",
        roles: ["ceo", "management", "marketing", "it"],
      },
      {
        label: "Documents",
        icon: "▤",
        href: "/dashboard/documents",
        roles: ["ceo", "management", "sales", "marketing", "finance", "it"],
      },
    ],
  },
  {
    section: "SYSTEM",
    items: [
      {
        label: "Team & access",
        icon: "♙",
        href: "/dashboard/team",
        roles: ["ceo", "it"],
      },
    ],
  },
];

function initialsFor(name: string) {
  return name.trim().split(/\s+/).map((p) => p[0]).slice(0, 2).join("").toUpperCase();
}

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, role")
    .eq("id", user.id)
    .single();

  const displayName = profile?.full_name ?? user.email ?? "User";

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <a className="brand" href="/dashboard" aria-label="REMP dashboard">
  <img
    src="/images/resilience-logo-bg.png"
    alt="Resilience Estate"
    className="brand-logo"
  />

  <span className="brand-text">
    <strong>REMP</strong>
    <small>RESILIENCE ESTATE MANAGEMENT PORTAL</small>
  </span>
</a>

        <div className="workspace-switcher">
          <span className="workspace-icon">R</span>
          <span>
            <b>Resilience Estate Ltd</b>
            <small>{profile?.role ? `${profile.role} workspace` : "Workspace"}</small>
          </span>
        </div>

        <nav className="nav" aria-label="Main navigation">
          {NAV.map((group) => {
  const visibleItems = group.items.filter((item) =>
    item.roles.includes(profile?.role ?? "")
  );

  if (visibleItems.length === 0) return null;

  return (
            <div key={group.section}>
              <p className="nav-label">{group.section}</p>
              {visibleItems.map((item) => (
                <a key={item.href} className="nav-item" href={item.href}>
                  <span className="nav-icon">{item.icon}</span>
                  {item.label}
                </a>
              ))}
            </div>
            );
})}
        </nav>

        <div className="sidebar-bottom">
          <div className="profile">
            <span className="avatar avatar-ceo">{initialsFor(displayName)}</span>
            <span>
              <b>{displayName}</b>
              <small className="capitalize">{profile?.role ?? "staff"}</small>
            </span>
            <SignOutButton />
          </div>
        </div>
      </aside>

      <main className="main">
        <header className="topbar">
          <div className="page-crumb" style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <MobileMenuButton />
            <b>Resilience Estate Management Portal</b>
          </div>
          <div className="top-actions" style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <GlobalSearch />
            <NotificationBell />
            <button className="top-avatar avatar avatar-ceo">{initialsFor(displayName)}</button>
          </div>
        </header>

        <section className="view active-view">{children}</section>
      </main>
    </div>
  );
}