import { useState, useEffect, useCallback } from "react";

export interface UnreadConversation {
  id: number;
  type: "dm" | "group";
  // DM-only
  other_user?: {
    id: number;
    username: string;
    display_name: string;
    pic?: string;
  };
  // Group-only
  group_name?: string;
  project_id?: number | null;
  members?: Array<{
    id: number;
    username: string;
    display_name: string;
    pic?: string;
  }>;
  last_message: string;
  unread_count: number;
}

export function useUnreadMessages(isAuthenticated: boolean) {
  const [unreadConversations, setUnreadConversations] = useState<UnreadConversation[]>([]);

  const fetchUnread = useCallback(async () => {
    if (!isAuthenticated) return;
    try {
      const res = await fetch("api/get_conversations.php", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const data = await res.json();
      if (Array.isArray(data.conversations)) {
        const unread = data.conversations.filter(
          (c: UnreadConversation) => c.unread_count > 0
        );
        setUnreadConversations(unread);
      }
    } catch {
      // silently fail
    }
  }, [isAuthenticated]);

  useEffect(() => {
    if (!isAuthenticated) return;

    fetchUnread();

    const interval = setInterval(fetchUnread, 5_000);
    window.addEventListener("focus", fetchUnread);
    window.addEventListener("messages-read", fetchUnread);
    const handleVisibility = () => {
      if (document.visibilityState === "visible") fetchUnread();
    };
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      clearInterval(interval);
      window.removeEventListener("focus", fetchUnread);
      window.removeEventListener("messages-read", fetchUnread);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [isAuthenticated, fetchUnread]);

  const unreadCount = unreadConversations.reduce(
    (sum, c) => sum + c.unread_count,
    0
  );

  return { unreadCount, unreadConversations, refetch: fetchUnread };
}
