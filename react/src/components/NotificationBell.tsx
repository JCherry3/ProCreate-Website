import { useRef, useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useNotifications, AppNotification } from "../hooks/useNotifications";
import { useUnreadMessages } from "../hooks/useUnreadMessages";

interface Props {
  isAuthenticated: boolean;
}

const TYPE_ICONS: Record<string, string> = {
  request_accepted:      "✅",
  request_accepted_self: "🤝",
  request_completed:     "🎉",
  request_reopened:      "↩️",
  completion_allowed:    "🔓",
  deadline_reminder:     "⏰",
};

function notifIcon(n: AppNotification): string {
  if (n.type === "deadline_reminder") {
    return n.urgency === "soon" ? "🚨" : "⏰";
  }
  return TYPE_ICONS[n.type] ?? "🔔";
}

export default function NotificationBell({ isAuthenticated }: Props) {
  const navigate = useNavigate();
  const { notifications, unreadCount, markRead, markAllRead, deleteNotification, deleteAll, refetch } =
    useNotifications(isAuthenticated);
  const { unreadCount: unreadMessages } = useUnreadMessages(isAuthenticated);

  const totalUnread = unreadCount + unreadMessages;

  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const handleOpen = () => {
    const opening = !open;
    setOpen(opening);
    if (opening) refetch();
  };

  const handleClick = (n: AppNotification) => {
    markRead(n.id);
    setOpen(false);
    navigate(n.link);
  };

  const handleDelete = useCallback((e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    deleteNotification(id);
  }, [deleteNotification]);

  if (!isAuthenticated) return null;

  const hasAnyUnread = totalUnread > 0;
  const hasAny = notifications.length > 0;

  return (
    <div ref={ref} style={{ position: "relative", display: "inline-block" }}>
      {/* Bell button */}
      <button
        onClick={handleOpen}
        aria-label={`Notifications${totalUnread > 0 ? ` (${totalUnread} unread)` : ""}`}
        style={{
          background: "none",
          border: "none",
          cursor: "pointer",
          position: "relative",
          padding: "6px",
          fontSize: "22px",
          lineHeight: 1,
          color: "inherit",
        }}
      >
        🔔
        {totalUnread > 0 && (
          <span
            style={{
              position: "absolute",
              top: 0,
              right: 0,
              background: "#ef4444",
              color: "#fff",
              borderRadius: "9999px",
              fontSize: "10px",
              fontWeight: 700,
              minWidth: "16px",
              height: "16px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: "0 3px",
              lineHeight: 1,
            }}
          >
            {totalUnread > 99 ? "99+" : totalUnread}
          </span>
        )}
      </button>

      {/* Dropdown */}
      {open && (
        <div
          style={{
            position: "absolute",
            right: 0,
            top: "calc(100% + 8px)",
            width: 340,
            background: "#fff",
            border: "1px solid #e5e7eb",
            borderRadius: 12,
            boxShadow: "0 8px 24px rgba(0,0,0,0.12)",
            zIndex: 1000,
            overflow: "hidden",
          }}
        >
          {/* Header */}
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              padding: "12px 16px",
              borderBottom: "1px solid #f3f4f6",
              gap: 8,
            }}
          >
            <span style={{ fontWeight: 700, fontSize: 14, color: "#111827", flexShrink: 0 }}>
              Notifications
            </span>
            <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
              {hasAnyUnread && (
                <button
                  onClick={markAllRead}
                  style={{
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    fontSize: 12,
                    color: "#6366f1",
                    fontWeight: 600,
                    padding: 0,
                    whiteSpace: "nowrap",
                  }}
                >
                  Mark all read
                </button>
              )}
              {hasAny && (
                <button
                  onClick={deleteAll}
                  style={{
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    fontSize: 12,
                    color: "#ef4444",
                    fontWeight: 600,
                    padding: 0,
                    whiteSpace: "nowrap",
                  }}
                >
                  Clear all
                </button>
              )}
            </div>
          </div>

          {/* List */}
          <div style={{ maxHeight: 420, overflowY: "auto" }}>
            {notifications.length === 0 ? (
              <div
                style={{
                  padding: "32px 16px",
                  textAlign: "center",
                  color: "#9ca3af",
                  fontSize: 14,
                }}
              >
                No notifications
              </div>
            ) : (
              notifications.map((n) => (
                <div
                  key={n.id}
                  style={{
                    display: "flex",
                    alignItems: "flex-start",
                    gap: 10,
                    width: "100%",
                    padding: "11px 12px 11px 16px",
                    background: n.read ? "#fff" : "#f0f0ff",
                    borderBottom: "1px solid #f3f4f6",
                    transition: "background 0.15s",
                  }}
                >
                  {/* Clickable main area */}
                  <button
                    onClick={() => handleClick(n)}
                    style={{
                      display: "flex",
                      alignItems: "flex-start",
                      gap: 10,
                      flex: 1,
                      background: "none",
                      border: "none",
                      cursor: "pointer",
                      textAlign: "left",
                      padding: 0,
                      minWidth: 0,
                    }}
                  >
                    <span style={{ fontSize: 18, flexShrink: 0, marginTop: 2 }}>
                      {notifIcon(n)}
                    </span>

                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div
                        style={{
                          fontWeight: n.read ? 500 : 700,
                          fontSize: 13,
                          color: "#111827",
                          marginBottom: 2,
                        }}
                      >
                        {n.title}
                      </div>
                      <div
                        style={{
                          fontSize: 12,
                          color: "#6b7280",
                          lineHeight: 1.4,
                          whiteSpace: "normal",
                        }}
                      >
                        {n.message}
                      </div>
                      {n.type === "deadline_reminder" && (
                        <div
                          style={{
                            marginTop: 4,
                            fontSize: 11,
                            color: n.urgency === "soon" ? "#ef4444" : "#f59e0b",
                            fontWeight: 600,
                          }}
                        >
                          {n.urgency === "soon" ? "Due very soon!" : "Upcoming deadline"}
                        </div>
                      )}
                      {n.created_at && (
                        <div style={{ marginTop: 3, fontSize: 10, color: "#d1d5db" }}>
                          {new Date(n.created_at).toLocaleDateString(undefined, {
                            month: "short",
                            day: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </div>
                      )}
                    </div>

                    {!n.read && (
                      <span
                        style={{
                          width: 8,
                          height: 8,
                          borderRadius: "50%",
                          background: "#6366f1",
                          flexShrink: 0,
                          marginTop: 5,
                        }}
                      />
                    )}
                  </button>

                  {/* Delete button */}
                  <button
                    onClick={(e) => handleDelete(e, n.id)}
                    aria-label="Delete notification"
                    title="Delete"
                    style={{
                      background: "none",
                      border: "none",
                      cursor: "pointer",
                      color: "#d1d5db",
                      fontSize: 16,
                      lineHeight: 1,
                      padding: "2px 4px",
                      flexShrink: 0,
                      borderRadius: 4,
                      transition: "color 0.15s",
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.color = "#ef4444")}
                    onMouseLeave={(e) => (e.currentTarget.style.color = "#d1d5db")}
                  >
                    ×
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}