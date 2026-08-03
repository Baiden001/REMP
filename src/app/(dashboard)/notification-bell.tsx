"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";

type Notification = {
  id: string;
  title: string;
  body: string | null;
  is_read: boolean;
  created_at: string;
};

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.round(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return new Date(iso).toLocaleDateString("en-GB");
}

export default function NotificationBell() {
  const supabase = createClient();
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const unread = notifications.filter((n) => !n.is_read).length;

  const load = useCallback(async () => {
    const { data } = await supabase
      .from("notifications")
      .select("id, title, body, is_read, created_at")
      .order("created_at", { ascending: false })
      .limit(20);
    setNotifications(data ?? []);
  }, [supabase]);

  useEffect(() => { load(); }, [load]);

  async function markAllRead() {
    await supabase
      .from("notifications")
      .update({ is_read: true })
      .eq("is_read", false);
    load();
  }

  async function markRead(id: string) {
    await supabase.from("notifications").update({ is_read: true }).eq("id", id);
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, is_read: true } : n))
    );
  }

  return (
    <div style={{ position: "relative" }}>
      <button
        onClick={() => setOpen((o) => !o)}
        style={{
          width: 34, height: 34, borderRadius: "50%",
          border: "1px solid #e7ebf1", background: "#fff",
          display: "grid", placeItems: "center", cursor: "pointer",
          fontSize: 15, position: "relative",
        }}
        aria-label="Notifications"
      >
        🔔
        {unread > 0 && (
          <span style={{
            position: "absolute", top: 3, right: 3,
            width: 8, height: 8, borderRadius: "50%",
            background: "#e74c3c", border: "1.5px solid #fff",
          }} />
        )}
      </button>

      {open && (
        <>
          {/* backdrop */}
          <div
            style={{ position: "fixed", inset: 0, zIndex: 39 }}
            onClick={() => setOpen(false)}
          />
          <div style={{
            position: "absolute", top: 42, right: 0, zIndex: 40,
            width: 320, background: "#fff", border: "1px solid #e7ebf1",
            borderRadius: 12, boxShadow: "0 8px 24px rgba(19,42,77,.12)",
            overflow: "hidden",
          }}>
            <div style={{
              display: "flex", alignItems: "center", justifyContent: "space-between",
              padding: "12px 16px", borderBottom: "1px solid #f0f3f7",
            }}>
              <b style={{ fontSize: 12 }}>Notifications</b>
              {unread > 0 && (
                <button
                  onClick={markAllRead}
                  style={{ fontSize: 10, color: "#2775e6", background: "none", border: "none", cursor: "pointer" }}
                >
                  Mark all read
                </button>
              )}
            </div>

            <div style={{ maxHeight: 360, overflowY: "auto" }}>
              {notifications.length === 0 ? (
                <p style={{ padding: "20px 16px", fontSize: 12, color: "#8794a5", textAlign: "center" }}>
                  No notifications yet
                </p>
              ) : (
                notifications.map((n) => (
                  <div
                    key={n.id}
                    onClick={() => markRead(n.id)}
                    style={{
                      padding: "12px 16px",
                      borderBottom: "1px solid #f5f7fa",
                      background: n.is_read ? "#fff" : "#f0f6ff",
                      cursor: "pointer",
                      display: "flex", gap: 10, alignItems: "flex-start",
                    }}
                  >
                    <span style={{
                      width: 7, height: 7, borderRadius: "50%", flexShrink: 0, marginTop: 5,
                      background: n.is_read ? "#d1d9e3" : "#2775e6",
                    }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <b style={{ fontSize: 11, display: "block" }}>{n.title}</b>
                      {n.body && <p style={{ fontSize: 10, color: "#566a83", margin: "2px 0 0" }}>{n.body}</p>}
                      <small style={{ fontSize: 9, color: "#9ea9b8" }}>{timeAgo(n.created_at)}</small>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
