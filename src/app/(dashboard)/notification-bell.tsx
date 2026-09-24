"use client";
import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import Icon, { type IconName } from "@/components/icon";
type Notification = {
  id: string;
  title: string;
  body: string | null;
  type: string | null;
  is_read: boolean;
  created_at: string;
};
function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.round(diff / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.round(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
  });
}
function notificationIcon(type: string | null): IconName {
  if (!type) return "bell";
  if (type.startsWith("payment")) return "banknote";
  if (type.startsWith("viewing")) return "calendarCheck";
  if (type === "follow_up_due" || type === "follow_up") return "alert";
  if (type === "follow_up_upcoming") return "clock";
  return "bell";
}
export default function NotificationBell() {
  const supabase = createClient();
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const unread = notifications.filter((n) => !n.is_read).length;
  const load = useCallback(async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setNotifications([]);
      setLoading(false);
      return;
    }
    const { data, error } = await supabase
      .from("notifications")
      .select(
        "id, title, body, type, is_read, created_at"
      )
      .eq("recipient_id", user.id)
      .order("created_at", { ascending: false })
      .limit(30);
    if (!error) {
      setNotifications(data ?? []);
    }
    setLoading(false);
  }, [supabase]);
  useEffect(() => {
    load();
    const interval = setInterval(load, 30000);
    return () => clearInterval(interval);
  }, [load]);
  async function markAllRead() {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;
    await supabase
      .from("notifications")
      .update({ is_read: true })
      .eq("recipient_id", user.id)
      .eq("is_read", false);
    setNotifications((prev) =>
      prev.map((n) => ({
        ...n,
        is_read: true,
      }))
    );
  }
  async function markRead(id: string) {
    await supabase
      .from("notifications")
      .update({ is_read: true })
      .eq("id", id);
    setNotifications((prev) =>
      prev.map((n) =>
        n.id === id
          ? { ...n, is_read: true }
          : n
      )
    );
  }
  return (
    <div
      style={{
        position: "relative",
      }}
    >
      {/* Notification button */}
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        aria-label={
          unread > 0
            ? `${unread} unread notifications`
            : "Notifications"
        }
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
      >
        {/* Professional outline bell */}
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          aria-hidden="true"
        >
          <path
            d="M18 8.5C18 5.46 15.76 3 12.5 3C9.24 3 7 5.46 7 8.5V12.2C7 13.15 6.68 14.08 6.1 14.83L5 16.25H20L18.9 14.83C18.32 14.08 18 13.15 18 12.2V8.5Z"
            stroke="currentColor"
            strokeWidth="1.7"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d="M10 19C10.55 20.05 11.43 20.6 12.5 20.6C13.57 20.6 14.45 20.05 15 19"
            stroke="currentColor"
            strokeWidth="1.7"
            strokeLinecap="round"
          />
        </svg>
        {/* Notification count */}
        {unread > 0 && (
          <span
            style={{
              position: "absolute",
              top: -4,
              right: -4,
              minWidth: 17,
              height: 17,
              padding: "0 4px",
              borderRadius: 20,
              background: "#c0392b",
              color: "#fff",
              border: "2px solid #fff",
              fontSize: 8,
              fontWeight: 700,
              lineHeight: "13px",
              display: "grid",
              placeItems: "center",
            }}
          >
            {unread > 99 ? "99+" : unread}
          </span>
        )}
      </button>
      {open && (
        <>
          {/* Backdrop */}
          <div
            onClick={() => setOpen(false)}
            style={{
              position: "fixed",
              inset: 0,
              zIndex: 39,
            }}
          />
          {/* Notification panel */}
          <div
            style={{
              position: "absolute",
              top: 46,
              right: 0,
              zIndex: 40,
              width: 360,
              maxWidth: "calc(100vw - 24px)",
              background: "#fff",
              border: "1px solid #e7ecea",
              borderRadius: 14,
              boxShadow:
                "0 18px 45px rgba(21,42,34, .14)",
              overflow: "hidden",
            }}
          >
            {/* Header */}
            <div
              style={{
                padding: "16px 18px",
                borderBottom: "1px solid #f0f3f2",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <div>
                <b
                  style={{
                    display: "block",
                    fontSize: 13,
                    color: "#162a22",
                  }}
                >
                  Notifications
                </b>
                <span
                  style={{
                    display: "block",
                    marginTop: 3,
                    fontSize: 10,
                    color: "#909d98",
                  }}
                >
                  {unread === 0
                    ? "You're all caught up"
                    : `${unread} unread`}
                </span>
              </div>
              {unread > 0 && (
                <button
                  type="button"
                  onClick={markAllRead}
                  style={{
                    border: "none",
                    background: "none",
                    color: "#1f5a44",
                    fontSize: 10,
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                >
                  Mark all read
                </button>
              )}
            </div>
            {/* Notification list */}
            <div
              style={{
                maxHeight: 390,
                overflowY: "auto",
              }}
            >
              {loading ? (
                <div
                  style={{
                    padding: 30,
                    textAlign: "center",
                    color: "#909d98",
                    fontSize: 11,
                  }}
                >
                  Loading notifications…
                </div>
              ) : notifications.length === 0 ? (
                <div
                  style={{
                    padding: "38px 20px",
                    textAlign: "center",
                  }}
                >
                  <div
                    style={{
                      width: 42,
                      height: 42,
                      margin: "0 auto 10px",
                      borderRadius: "50%",
                      background: "#f4f9f7",
                      display: "grid",
                      placeItems: "center",
                      color: "#92a09a",
                      fontSize: 18,
                    }}
                  >
                    <Icon name="checkCircle" size={20} />
                  </div>
                  <b
                    style={{
                      display: "block",
                      fontSize: 11,
                      color: "#4a6057",
                    }}
                  >
                    No notifications
                  </b>
                  <p
                    style={{
                      margin: "5px 0 0",
                      fontSize: 10,
                      color: "#a1aea9",
                    }}
                  >
                    Important updates will appear here.
                  </p>
                </div>
              ) : (
                notifications.map((notification) => (
                  <div
                    key={notification.id}
                    onClick={() =>
                      markRead(notification.id)
                    }
                    style={{
                      display: "flex",
                      gap: 12,
                      padding: "13px 18px",
                      borderBottom:
                        "1px solid #f2f5f4",
                      background: notification.is_read
                        ? "#fff"
                        : "#f9fdfb",
                      cursor: "pointer",
                    }}
                  >
                    {/* Type indicator */}
                    <div
                      style={{
                        width: 30,
                        height: 30,
                        flexShrink: 0,
                        borderRadius: 8,
                        background:
                          notification.is_read
                            ? "#f2f6f4"
                            : "#effaf6",
                        color:
                          notification.is_read
                            ? "#84938d"
                            : "#1f5a44",
                        display: "grid",
                        placeItems: "center",
                        fontSize: 11,
                        fontWeight: 700,
                      }}
                    >
                      <Icon name={notificationIcon(notification.type)} size={15} />
                    </div>
                    <div
                      style={{
                        minWidth: 0,
                        flex: 1,
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          alignItems: "flex-start",
                          gap: 7,
                        }}
                      >
                        <b
                          style={{
                            flex: 1,
                            fontSize: 11,
                            lineHeight: 1.4,
                            color: "#21352d",
                          }}
                        >
                          {notification.title}
                        </b>
                        {!notification.is_read && (
                          <span
                            style={{
                              width: 6,
                              height: 6,
                              flexShrink: 0,
                              marginTop: 4,
                              borderRadius: "50%",
                              background: "#1f5a44",
                            }}
                          />
                        )}
                      </div>
                      {notification.body && (
                        <p
                          style={{
                            margin: "3px 0 5px",
                            fontSize: 10,
                            lineHeight: 1.45,
                            color: "#6e8079",
                          }}
                        >
                          {notification.body}
                        </p>
                      )}
                      <small
                        style={{
                          fontSize: 9,
                          color: "#a2aea9",
                        }}
                      >
                        {timeAgo(
                          notification.created_at
                        )}
                      </small>
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