import { useState, useEffect, useCallback, useRef } from "react";

export interface AppNotification {
  id: string;
  type:
    | "request_accepted"
    | "request_accepted_self"
    | "request_completed"
    | "request_reopened"
    | "completion_allowed"
    | "deadline_reminder";
  project_id: string | null;
  title: string;
  message: string;
  urgency?: "soon" | "upcoming" | null;
  link: string;
  read: boolean;
  created_at?: string;
}

export function useNotifications(isAuthenticated: boolean) {
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const isFetching = useRef(false);

  const fetchNotifications = useCallback(async () => {
    if (!isAuthenticated || isFetching.current) return;
    isFetching.current = true;
    try {
      const res = await fetch("api/get_notifications.php", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      if (!res.ok) return;
      const data = await res.json();
      if (Array.isArray(data.notifications)) {
        setNotifications(
          data.notifications.map((n: AppNotification) => ({
            ...n,
            read: Boolean(n.read),
          }))
        );
      }
    } catch {
      // silently fail
    } finally {
      isFetching.current = false;
    }
  }, [isAuthenticated]);

  useEffect(() => {
    if (!isAuthenticated) return;
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 60_000);
    const onFocus = () => fetchNotifications();
    const onVisibility = () => {
      if (document.visibilityState === "visible") fetchNotifications();
    };
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      clearInterval(interval);
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [isAuthenticated, fetchNotifications]);

  // Mark a single notification read (optimistic + persist)
  const markRead = useCallback(async (id: string) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: true } : n))
    );
    try {
      await fetch("api/mark_notifications_read.php", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: [parseInt(id, 10)] }),
      });
    } catch { /* silently fail */ }
  }, []);

  // Mark all read (optimistic + persist)
  const markAllRead = useCallback(async () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    window.dispatchEvent(new Event("messages-read"));
    try {
      await fetch("api/mark_notifications_read.php", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ all: true }),
      });
    } catch { /* silently fail */ }
  }, []);

  // Delete a single notification (optimistic + persist)
  const deleteNotification = useCallback(async (id: string) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
    try {
      await fetch("api/delete_notifications.php", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: [parseInt(id, 10)] }),
      });
    } catch { /* silently fail */ }
  }, []);

  // Delete ALL notifications (optimistic + persist)
  const deleteAll = useCallback(async () => {
    setNotifications([]);
    try {
      await fetch("api/delete_notifications.php", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ all: true }),
      });
    } catch { /* silently fail */ }
  }, []);

  const unreadCount = notifications.filter((n) => !n.read).length;

  return {
    notifications,
    unreadCount,
    markRead,
    markAllRead,
    deleteNotification,
    deleteAll,
    refetch: fetchNotifications,
  };
}