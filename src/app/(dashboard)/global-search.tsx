"use client";
import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
type Result = {
  id: string;
  label: string;
  sub: string;
  href: string;
  type: "project" | "unit" | "client";
};
const TYPE_ICON: Record<string, string> = {
  project: "⌂",
  unit: "▧",
  client: "◎",
};
function SearchIcon({ size = 18 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <circle
        cx="10.8"
        cy="10.8"
        r="6.8"
        stroke="currentColor"
        strokeWidth="1.7"
      />
      <path
        d="M16 16L20.2 20.2"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
      />
    </svg>
  );
}
export default function GlobalSearch() {
  const router = useRouter();
  const supabase = createClient();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Result[]>([]);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);
  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      return;
    }
    const timer = setTimeout(async () => {
      setLoading(true);
      const q = `%${query}%`;
      const [{ data: projects }, { data: units }, { data: clients }] =
        await Promise.all([
          supabase
            .from("projects")
            .select("id, name, location")
            .ilike("name", q)
            .limit(4),
          supabase
            .from("units")
            .select("id, unit_code, unit_type, projects(name)")
            .ilike("unit_code", q)
            .limit(4),
          supabase
            .from("clients")
            .select("id, full_name, phone")
            .ilike("full_name", q)
            .limit(4),
        ]);
      const mapped: Result[] = [
        ...(projects ?? []).map((p) => ({
          id: p.id,
          type: "project" as const,
          label: p.name,
          sub: p.location ?? "No location",
          href: `/dashboard/projects`,
        })),
        ...(units ?? []).map((u) => ({
          id: u.id,
          type: "unit" as const,
          label: u.unit_code,
          sub: `${u.projects?.[0]?.name ?? "—"} · ${u.unit_type ?? ""}`,
          href: `/dashboard/units`,
        })),
        ...(clients ?? []).map((c) => ({
          id: c.id,
          type: "client" as const,
          label: c.full_name,
          sub: c.phone ?? "No phone",
          href: `/dashboard/crm`,
        })),
      ];
      setResults(mapped);
      setLoading(false);
    }, 280);
    return () => clearTimeout(timer);
  }, [query, supabase]);
  function handleSelect(href: string) {
    setOpen(false);
    setQuery("");
    setResults([]);
    router.push(href);
  }
  return (
    <>
      {/* Search button */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        style={{
          position: "relative",
          width: 38,
          height: 38,
          display: "grid",
          placeItems: "center",
          border: "1px solid #e6ecea",
          borderRadius: 10,
          background: "#ffffff",
          color: "#20382e",
          cursor: "pointer",
          transition: "all .18s ease",
          boxShadow: "0 1px 2px rgba(16,36,28, .04)",
        }}
        aria-label="Search"
      >
        <SearchIcon size={18} />
      </button>
      {open && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 50,
            background: "rgba(11,34,25,.45)",
            display: "grid",
            placeItems: "start center",
            paddingTop: 100,
          }}
          onClick={(e) =>
            e.target === e.currentTarget && setOpen(false)
          }
        >
          <div
            style={{
              width: "100%",
              maxWidth: 520,
              background: "#fff",
              borderRadius: 14,
              boxShadow:
                "0 20px 60px rgba(11,34,25,.22)",
              overflow: "hidden",
            }}
          >
            {/* Search header */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 11,
                padding: "14px 16px",
                borderBottom: "1px solid #f1f6f4",
              }}
            >
              <span
                style={{
                  display: "grid",
                  placeItems: "center",
                  color: "#60796f",
                }}
              >
                <SearchIcon size={17} />
              </span>
              <input
                ref={inputRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search projects, units, clients…"
                style={{
                  flex: 1,
                  border: "none",
                  outline: "none",
                  fontSize: 13,
                  color: "#11251d",
                  background: "transparent",
                }}
                onKeyDown={(e) => {
                  if (e.key === "Escape") {
                    setOpen(false);
                  }
                }}
              />
              {loading && (
                <span
                  style={{
                    fontSize: 10,
                    color: "#8e9e98",
                  }}
                >
                  Searching…
                </span>
              )}
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close search"
                style={{
                  width: 28,
                  height: 28,
                  display: "grid",
                  placeItems: "center",
                  border: "none",
                  borderRadius: 7,
                  background: "transparent",
                  color: "#8e9e98",
                  cursor: "pointer",
                  fontSize: 18,
                }}
              >
                ×
              </button>
            </div>
            {/* Results */}
            <div
              style={{
                maxHeight: 380,
                overflowY: "auto",
              }}
            >
              {results.length === 0 &&
                query.trim() &&
                !loading && (
                  <p
                    style={{
                      padding: "20px 16px",
                      fontSize: 12,
                      color: "#8e9e98",
                      textAlign: "center",
                    }}
                  >
                    No results for "{query}"
                  </p>
                )}
              {results.length === 0 &&
                !query.trim() && (
                  <p
                    style={{
                      padding: "20px 16px",
                      fontSize: 12,
                      color: "#8e9e98",
                      textAlign: "center",
                    }}
                  >
                    Type to search across projects, units,
                    and clients
                  </p>
                )}
              {results.map((r) => (
                <div
                  key={r.id}
                  onClick={() => handleSelect(r.href)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                    padding: "11px 16px",
                    borderBottom:
                      "1px solid #f6f9f8",
                    cursor: "pointer",
                  }}
                  onMouseEnter={(e) =>
                    (e.currentTarget.style.background =
                      "#f8fcfb")
                  }
                  onMouseLeave={(e) =>
                    (e.currentTarget.style.background = "")
                  }
                >
                  <span
                    style={{
                      width: 30,
                      height: 30,
                      borderRadius: 8,
                      background: "#f2fbf7",
                      color: "#1f5a44",
                      display: "grid",
                      placeItems: "center",
                      fontSize: 13,
                      flexShrink: 0,
                    }}
                  >
                    {TYPE_ICON[r.type]}
                  </span>
                  <div>
                    <b
                      style={{
                        fontSize: 12,
                        display: "block",
                      }}
                    >
                      {r.label}
                    </b>
                    <small
                      style={{
                        fontSize: 10,
                        color: "#8e9e98",
                      }}
                    >
                      {r.sub}
                    </small>
                  </div>
                  <span
                    style={{
                      marginLeft: "auto",
                      fontSize: 9,
                      color: "#b6c2bd",
                      textTransform: "uppercase",
                    }}
                  >
                    {r.type}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
}