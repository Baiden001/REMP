import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import SignOutButton from "./sign-out-button";
import NotificationBell from "./notification-bell";
import GlobalSearch from "./global-search";
import MobileMenuButton from "./mobile-menu-button";
import ProfileMenu from "./profile-menu";
import TableLabels from "./table-labels";
import { BRAND_ASSETS, COMPANY } from "@/lib/brand";
import Icon, { type IconName } from "@/components/icon";

const NAV = [
  {
    section: "OVERVIEW",
    items: [
      {
        label: "Dashboard",
        icon: "dashboard" as IconName,
        href: "/dashboard",
        roles: [
          "ceo",
          "management",
          "sales",
          "marketing",
          "finance",
          "it",
          "legal",
          "administration",
        ],
      },
    ],
  },
  {
    section: "OPERATIONS",
    items: [
      {
        label: "Projects",
        icon: "building" as IconName,
        href: "/dashboard/projects",
        roles: [
          "ceo",
          "management",
          "sales",
          "marketing",
          "finance",
          "it",
          "legal",
          "administration",
        ],
      },
      {
        label: "Properties & units",
        icon: "home" as IconName,
        href: "/dashboard/units",
        roles: [
          "ceo",
          "management",
          "sales",
          "marketing",
          "finance",
          "it",
          "legal",
          "administration",
        ],
      },
      {
        label: "CRM",
        icon: "users" as IconName,
        href: "/dashboard/crm",
        roles: [
          "ceo",
          "management",
          "sales",
          "marketing",
          "finance",
          "it",
          "legal",
          "administration",
        ],
      },
      {
        label: "Site Tours",
        icon: "calendarCheck" as IconName,
        href: "/dashboard/viewings",
        roles: [
          "ceo",
          "management",
          "sales",
          "marketing",
          "finance",
          "it",
          "legal",
          "administration",
        ],
      },
      {
        label: "Sales & payments",
        icon: "banknote" as IconName,
        href: "/dashboard/sales",
        roles: [
          "ceo",
          "management",
          "sales",
          "finance",
          "it",
        ],
      },
      {
        label: "Rentals",
        icon: "key" as IconName,
        href: "/dashboard/rentals",
        roles: ["ceo", "management", "sales", "finance", "it"],
      },
      {
        label: "Invoices",
        icon: "fileText" as IconName,
        href: "/dashboard/invoices",
        roles: ["ceo", "management", "finance", "it"],
      },
      {
        label: "Reports",
        icon: "chart" as IconName,
        href: "/dashboard/reports",
        roles: ["ceo", "management", "finance", "it"],
      },
    ],
  },
  {
    section: "GROWTH",
    items: [
      {
        label: "Marketing center",
        icon: "megaphone" as IconName,
        href: "/dashboard/marketing",
        roles: [
          "ceo",
          "management",
          "marketing",
          "administration",
          "it",
        ],
      },
      {
        label: "Documents",
        icon: "folder" as IconName,
        href: "/dashboard/documents",
        roles: [
          "ceo",
          "management",
          "sales",
          "marketing",
          "finance",
          "legal",
          "administration",
          "it",
        ],
      },
    ],
  },
  {
    section: "SYSTEM",
    items: [
      {
        label: "Team & access",
        icon: "shieldUser" as IconName,
        href: "/dashboard/team",
        roles: ["ceo", "it"],
      },
      {
        label: "Activity",
        icon: "history" as IconName,
        href: "/dashboard/activity",
        roles: ["ceo", "management", "it"],
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
  .select("full_name, role, phone, avatar_url")
  .eq("id", user.id)
  .single();

  const displayName = profile?.full_name ?? user.email ?? "User";

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <a className="brand" href="/dashboard" aria-label="REMP dashboard">
  <img
    src={BRAND_ASSETS.markLight}
    alt="Resilience Estates"
    className="brand-logo"
  />

  <span className="brand-text">
    <strong>REMP</strong>
    <small>{COMPANY.portalName.toUpperCase()}</small>
  </span>
</a>

        <div className="workspace-switcher">
          <span className="workspace-icon">R</span>
          <span>
            <b>{COMPANY.name}</b>
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
                  <span className="nav-icon">
                    <Icon name={item.icon} />
                  </span>
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
            <b>{COMPANY.portalName}</b>
          </div>
          <div className="top-actions" style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <GlobalSearch />
            <NotificationBell />
<ProfileMenu
  userId={user.id}
  fullName={displayName}
  role={profile?.role ?? "staff"}
  phone={profile?.phone ?? ""}
  avatarUrl={profile?.avatar_url ?? null}
/>          </div>
        </header>

        <section className="view active-view">{children}</section>
        <TableLabels />
      </main>
    </div>
  );
}