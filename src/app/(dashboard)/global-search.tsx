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

export default function GlobalSearch() {
  const router = useRouter();
  const supabase = createClient();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Result[]>([]);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 50);
  }, [open]);

  useEffect(() => {
    if (!query.trim()) { setResults([]); return; }
    const timer = setTimeout(async () => {
      setLoading(true);

      const q = `%${query}%`;
      const [{ data: projects }, { data: units }, { data: clients }] = await Promise.all([
        supabase.from("projects").select("id, name, location").ilike("name", q).limit(4),
        supabase.from("units").select("id, unit_code, unit_type, projects(name)").ilike("unit_code", q).limit(4),
        supabase.from("clients").select("id, full_name, phone").ilike("full_name", q).limit(4),
      ]);

      const mapped: Result[] = [
        ...(projects ?? []).map((p) => ({
          id: p.id, type: "project" as const,
          label: p.name, sub: p.location ?? "No location",
          href: `/dashboard/projects`,
        })),
        ...(units ?? []).map((u) => ({
          id: u.id, type: "unit" as const,
          label: u.unit_code,
         sub: `${u.projects?.[0]?.name ?? "—"} · ${u.unit_type ?? ""}`,
          href: `/dashboard/units`,
        })),
        ...(clients ?? []).map((c) => ({
          id: c.id, type: "client" as const,
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
      <button
        onClick={() => setOpen(true)}
        style={{
          width: 34, height: 34, borderRadius: "50%",
          border: "1px solid #e7ebf1", background: "#fff",
          display: "grid", placeItems: "center",
          cursor: "pointer", fontSize: 14,
        }}
        aria-label="Search"
      >
        🔍
      </button>

      {open && (
        <div style={{
          position: "fixed", inset: 0, zIndex: 50,
          background: "rgba(6,30,58,.45)",
          display: "grid", placeItems: "start center",
          paddingTop: 100,
        }}
          onClick={(e) => e.target === e.currentTarget && setOpen(false)}
        >
          <div style={{
            width: "100%", maxWidth: 520,
            background: "#fff", borderRadius: 14,
            boxShadow: "0 20px 60px rgba(6,30,58,.22)",
            overflow: "hidden",
          }}>
            <div style={{
              display: "flex", alignItems: "center", gap: 10,
              padding: "14px 16px", borderBottom: "1px solid #f0f3f7",
            }}>
              <span style={{ fontSize: 15 }}>🔍</span>
              <input
                ref={inputRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search projects, units, clients…"
                style={{
                  flex: 1, border: "none", outline: "none",
                  fontSize: 13, color: "#10233e", background: "transparent",
                }}
                onKeyDown={(e) => e.key === "Escape" && setOpen(false)}
              />
              {loading && <span style={{ fontSize: 10, color: "#8794a5" }}>Searching…</span>}
              <button
                onClick={() => setOpen(false)}
                style={{ fontSize: 16, background: "none", border: "none", cursor: "pointer", color: "#8794a5" }}
              >
                ×
              </button>
            </div>

            <div style={{ maxHeight: 380, overflowY: "auto" }}>
              {results.length === 0 && query.trim() && !loading && (
                <p style={{ padding: "20px 16px", fontSize: 12, color: "#8794a5", textAlign: "center" }}>
                  No results for "{query}"
                </p>
              )}
              {results.length === 0 && !query.trim() && (
                <p style={{ padding: "20px 16px", fontSize: 12, color: "#8794a5", textAlign: "center" }}>
                  Type to search across projects, units, and clients
                </p>
              )}
              {results.map((r) => (
                <div
                  key={r.id}
                  onClick={() => handleSelect(r.href)}
                  style={{
                    display: "flex", alignItems: "center", gap: 12,
                    padding: "11px 16px", borderBottom: "1px solid #f5f7fa",
                    cursor: "pointer",
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = "#f5f8ff")}
                  onMouseLeave={(e) => (e.currentTarget.style.background = "")}
                >
                  <span style={{
                    width: 30, height: 30, borderRadius: "50%",
                    background: "#edf4ff", display: "grid", placeItems: "center",
                    fontSize: 13, flexShrink: 0,
                  }}>
                    {TYPE_ICON[r.type]}
                  </span>
                  <div>
                    <b style={{ fontSize: 12, display: "block" }}>{r.label}</b>
                    <small style={{ fontSize: 10, color: "#8794a5" }}>{r.sub}</small>
                  </div>
                  <span style={{ marginLeft: "auto", fontSize: 9, color: "#b0bbc8", textTransform: "uppercase" }}>
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
