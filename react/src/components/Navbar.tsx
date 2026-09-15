import { useState, useCallback } from "react";
import { Link, useLocation, useNavigate } from "react-router";
import { Bell, Menu, Upload, User, X, MessageSquare } from "lucide-react";
import { Button } from "./ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "./ui/popover";
import { useUnreadMessages, UnreadConversation } from "../hooks/useUnreadMessages";
import { useNotifications, AppNotification } from "../hooks/useNotifications";
import logoImage from "../../public/logo.png";

interface NavbarProps {
  isAuthenticated?: boolean;
}

function Avatar({
  pic,
  name,
  size = "sm",
}: {
  pic?: string;
  name: string;
  size?: "sm" | "md";
}) {
  const dims = size === "sm" ? "w-8 h-8 text-xs" : "w-9 h-9 text-sm";
  const imgSrc = pic ? `api/profile_pics/${pic.replace(/^profile_pics\//, "")}` : null;

  return imgSrc ? (
    <img src={imgSrc} alt={name} className={`${dims} rounded-full object-cover flex-shrink-0`} />
  ) : (
    <div
      className={`${dims} rounded-full bg-gradient-to-br from-[#c2350a] to-[#1c3738] flex items-center justify-center text-white font-semibold flex-shrink-0`}
    >
      {name.charAt(0).toUpperCase()}
    </div>
  );
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
  if (n.type === "deadline_reminder") return n.urgency === "soon" ? "🚨" : "⏰";
  return TYPE_ICONS[n.type] ?? "🔔";
}

export function Navbar({ isAuthenticated = false }: NavbarProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();

  const { unreadCount: msgUnreadCount, unreadConversations } =
    useUnreadMessages(isAuthenticated);

  const {
    notifications,
    unreadCount: notiUnreadCount,
    markRead,
    markAllRead,
    deleteNotification,
    deleteAll,
    refetch,
  } = useNotifications(isAuthenticated);

  const totalUnread = msgUnreadCount + notiUnreadCount;

  const handleBellOpen = useCallback((open: boolean) => {
    if (open) refetch();
  }, [refetch]);

  const handleMarkAllRead = useCallback(async () => {
    markAllRead();
    // For DMs: hitting get_messages.php marks them read as a side-effect
    // For group convos: get_group_messages.php marks them read when opened — skip here
    await Promise.all(
      unreadConversations
        .filter((c) => c.type === "dm" && c.other_user)
        .map((c) => {
          const form = new FormData();
          form.append("other_user_id", String(c.other_user!.id));
          return fetch("api/get_messages.php", {
            method: "POST",
            credentials: "include",
            body: form,
          }).catch(() => {});
        })
    );
    window.dispatchEvent(new Event("messages-read"));
  }, [markAllRead, unreadConversations]);

  const handleClearAll = useCallback(async () => {
    deleteAll();
    await Promise.all(
      unreadConversations
        .filter((c) => c.type === "dm" && c.other_user)
        .map((c) => {
          const form = new FormData();
          form.append("other_user_id", String(c.other_user!.id));
          return fetch("api/get_messages.php", {
            method: "POST",
            credentials: "include",
            body: form,
          }).catch(() => {});
        })
    );
    window.dispatchEvent(new Event("messages-read"));
  }, [deleteAll, unreadConversations]);

  const hasAnyUnread = notiUnreadCount > 0 || msgUnreadCount > 0;
  const hasAnyNotifs = notifications.length > 0 || unreadConversations.length > 0;

  return (
    <nav className="border-b bg-[#faf9f6] sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">

          {/* Logo */}
          <Link to="/" className="flex items-center gap-2">
            <img src={logoImage} alt="ProCreate Logo" className="h-10 w-10" />
            <span className="text-xl font-semibold text-[#1c110a]">ProCreate</span>
          </Link>

          {/* Desktop Navigation */}
          {isAuthenticated ? (
            <>
              <div className="hidden md:flex items-center gap-6">
                <Link
                  to="/home"
                  className={`text-sm transition-colors ${
                    location.pathname === "/home"
                      ? "text-[#c2350a] font-medium"
                      : "text-[#1c110a] hover:text-[#c2350a]"
                  }`}
                >
                  Home
                </Link>
                <Link
                  to="/search"
                  className={`text-sm transition-colors ${
                    location.pathname === "/search"
                      ? "text-[#c2350a] font-medium"
                      : "text-[#1c110a] hover:text-[#c2350a]"
                  }`}
                >
                  Search
                </Link>
                <Link
                  to="/requests"
                  className={`text-sm transition-colors ${
                    location.pathname === "/requests"
                      ? "text-[#c2350a] font-medium"
                      : "text-[#1c110a] hover:text-[#c2350a]"
                  }`}
                >
                  Requests
                </Link>
              </div>

              <div className="hidden md:flex items-center gap-3">

                {/* Notifications Bell */}
                <Popover onOpenChange={handleBellOpen}>
                  <PopoverTrigger asChild>
                    <Button variant="ghost" size="icon" className="relative">
                      <Bell className="h-5 w-5" />
                      {totalUnread > 0 && (
                        <span className="absolute top-1 right-1 w-2 h-2 bg-[#c2350a] rounded-full pointer-events-none" />
                      )}
                    </Button>
                  </PopoverTrigger>

                  <PopoverContent align="end" className="w-80 bg-white p-0 overflow-hidden">

                    {/* Header row with action buttons */}
                    <div className="px-4 py-3 border-b border-[#f0ede8] flex items-center justify-between gap-2">
                      <h3 className="font-semibold text-sm text-[#1c110a] flex-shrink-0">Notifications</h3>
                      <div className="flex items-center gap-3 flex-shrink-0">
                        {hasAnyUnread && (
                          <button
                            onClick={handleMarkAllRead}
                            className="text-[11px] font-semibold text-[#6366f1] hover:text-[#4f46e5] transition-colors"
                          >
                            Mark all read
                          </button>
                        )}
                        {hasAnyNotifs && (
                          <button
                            onClick={handleClearAll}
                            className="text-[11px] font-semibold text-[#c2350a] hover:text-[#a02d08] transition-colors"
                          >
                            Clear all
                          </button>
                        )}
                      </div>
                    </div>

                    <div className="divide-y divide-[#f8f6f2] max-h-96 overflow-y-auto">

                      {/* ── Messages section ── */}
                      {unreadConversations.length > 0 && (
                        <div className="px-4 pt-2 pb-1">
                          <p className="text-[10px] font-semibold tracking-wider text-gray-400 uppercase">
                            Messages
                          </p>
                        </div>
                      )}
                      {unreadConversations.map((convo) => (
                        <Link
                          key={convo.id}
                          to={
                            convo.type === "group"
                              ? `/messages?group_conversation_id=${convo.id}`
                              : `/messages?compose=${convo.other_user?.username}`
                          }
                          className="flex items-center gap-3 px-4 py-3 hover:bg-[#faf9f6] transition-colors bg-[#fdf5f3]"
                          onClick={() => window.dispatchEvent(new Event("messages-read"))}
                        >
                          {convo.type === "group" ? (
                            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#1c3738] to-[#2a5456] flex items-center justify-center text-white flex-shrink-0 text-xs font-semibold">
                              {(convo.group_name ?? "G").charAt(0).toUpperCase()}
                            </div>
                          ) : (
                            <Avatar
                              pic={convo.other_user?.pic}
                              name={convo.other_user?.display_name || convo.other_user?.username || "?"}
                            />
                          )}
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-[#1c110a] truncate">
                              {convo.type === "group"
                                ? convo.group_name ?? "Group"
                                : convo.other_user?.display_name || convo.other_user?.username}
                            </p>
                            <p className="text-xs text-gray-500 truncate mt-0.5">
                              {convo.last_message}
                            </p>
                          </div>
                          <span className="w-5 h-5 bg-[#c2350a] text-white text-[10px] font-bold rounded-full flex items-center justify-center flex-shrink-0">
                            {convo.unread_count > 9 ? "9+" : convo.unread_count}
                          </span>
                        </Link>
                      ))}

                      {/* ── Projects section ── */}
                      {notifications.length > 0 && (
                        <div className="px-4 pt-2 pb-1">
                          <p className="text-[10px] font-semibold tracking-wider text-gray-400 uppercase">
                            Projects
                          </p>
                        </div>
                      )}

                      {notifications.map((n) => (
                        <div
                          key={n.id}
                          className={`flex items-start gap-0 ${!n.read ? "bg-[#fdf5f3]" : ""}`}
                        >
                          {/* Clickable area */}
                          <button
                            onClick={() => {
                              markRead(n.id);
                              navigate(n.link);
                            }}
                            className="flex items-start gap-3 flex-1 px-4 py-3 hover:bg-[#faf9f6] transition-colors text-left min-w-0"
                          >
                            <span className="text-base flex-shrink-0 mt-0.5">
                              {notifIcon(n)}
                            </span>
                            <div className="flex-1 min-w-0">
                              <p className={`text-sm truncate ${!n.read ? "font-semibold text-[#1c110a]" : "font-medium text-[#1c110a]"}`}>
                                {n.title}
                              </p>
                              <p className="text-xs text-gray-500 truncate mt-0.5">
                                {n.message}
                              </p>
                              {n.type === "deadline_reminder" && (
                                <p className={`text-[10px] font-semibold mt-1 ${
                                  n.urgency === "soon" ? "text-[#c2350a]" : "text-amber-500"
                                }`}>
                                  {n.urgency === "soon" ? "Due very soon!" : "Upcoming deadline"}
                                </p>
                              )}
                              {n.created_at && (
                                <p className="text-[10px] text-gray-300 mt-0.5">
                                  {new Date(n.created_at).toLocaleDateString(undefined, {
                                    month: "short", day: "numeric",
                                    hour: "2-digit", minute: "2-digit",
                                  })}
                                </p>
                              )}
                            </div>
                            {!n.read && (
                              <span className="w-2 h-2 rounded-full bg-[#c2350a] flex-shrink-0 mt-1.5" />
                            )}
                          </button>

                          {/* Per-item delete */}
                          <button
                            onClick={(e) => { e.stopPropagation(); deleteNotification(n.id); }}
                            aria-label="Delete notification"
                            className="px-3 py-3 text-gray-300 hover:text-[#c2350a] transition-colors text-lg leading-none flex-shrink-0 self-stretch flex items-center"
                          >
                            ×
                          </button>
                        </div>
                      ))}

                      {/* Empty state */}
                      {notifications.length === 0 && unreadConversations.length === 0 && (
                        <div className="py-10 text-center">
                          <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-3">
                            <Bell className="h-6 w-6 text-gray-400" />
                          </div>
                          <p className="text-sm text-gray-600 mb-1">No notifications yet</p>
                          <p className="text-xs text-gray-500">
                            We'll notify you when something happens
                          </p>
                        </div>
                      )}
                    </div>
                  </PopoverContent>
                </Popover>

                {/* Messages icon */}
                <Button
                  variant="ghost"
                  size="icon"
                  asChild
                  className={
                    location.pathname.startsWith("/messages") ? "text-[#c2350a]" : ""
                  }
                >
                  <Link to="/messages" aria-label="Messages" className="relative">
                    <MessageSquare className="h-5 w-5" />
                    {msgUnreadCount > 0 && (
                      <span className="absolute -top-1 -right-1 w-4 h-4 bg-[#c2350a] text-white text-[10px] font-bold rounded-full flex items-center justify-center leading-none pointer-events-none">
                        {msgUnreadCount > 9 ? "9+" : msgUnreadCount}
                      </span>
                    )}
                  </Link>
                </Button>

                {/* Upload */}
                <Button asChild>
                  <Link to="/upload" className="flex items-center gap-2">
                    <Upload className="h-4 w-4" />
                    Upload
                  </Link>
                </Button>

                {/* Profile */}
                <Button variant="ghost" size="icon" asChild>
                  <Link to="/profile" aria-label="Profile">
                    <User className="h-5 w-5" />
                  </Link>
                </Button>
              </div>
            </>
          ) : (
            <>
              <div className="hidden md:flex items-center gap-6">
                <Link
                  to="/about"
                  className="text-sm text-[#1c110a] hover:text-[#c2350a] transition-colors"
                >
                  About
                </Link>
                <Link
                  to="/learn-more"
                  className="text-sm text-[#1c110a] hover:text-[#c2350a] transition-colors"
                >
                  Learn More
                </Link>
                <Link
                  to="/search"
                  className="text-sm text-[#1c110a] hover:text-[#c2350a] transition-colors"
                >
                  Explore
                </Link>
              </div>

              <div className="hidden md:flex items-center gap-3">
                <Button variant="ghost" asChild>
                  <Link to="/signin">Sign In</Link>
                </Button>
                <Button asChild>
                  <Link to="/signup">Sign Up</Link>
                </Button>
              </div>
            </>
          )}

          {/* Mobile top-bar icons: Bell + Hamburger */}
          <div className="md:hidden flex items-center gap-1">
            {isAuthenticated && (
              <Popover onOpenChange={handleBellOpen}>
                <PopoverTrigger asChild>
                  <Button variant="ghost" size="icon" className="relative">
                    <Bell className="h-5 w-5" />
                    {totalUnread > 0 && (
                      <span className="absolute top-1 right-1 w-2 h-2 bg-[#c2350a] rounded-full pointer-events-none" />
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent align="end" className="w-80 bg-white p-0 overflow-hidden">
                  <div className="px-4 py-3 border-b border-[#f0ede8] flex items-center justify-between gap-2">
                    <h3 className="font-semibold text-sm text-[#1c110a] flex-shrink-0">Notifications</h3>
                    <div className="flex items-center gap-3 flex-shrink-0">
                      {hasAnyUnread && (
                        <button onClick={handleMarkAllRead} className="text-[11px] font-semibold text-[#6366f1] hover:text-[#4f46e5] transition-colors">Mark all read</button>
                      )}
                      {hasAnyNotifs && (
                        <button onClick={handleClearAll} className="text-[11px] font-semibold text-[#c2350a] hover:text-[#a02d08] transition-colors">Clear all</button>
                      )}
                    </div>
                  </div>
                  <div className="divide-y divide-[#f8f6f2] max-h-96 overflow-y-auto">
                    {unreadConversations.length > 0 && (
                      <div className="px-4 pt-2 pb-1"><p className="text-[10px] font-semibold tracking-wider text-gray-400 uppercase">Messages</p></div>
                    )}
                    {unreadConversations.map((convo) => {
                      const isGroup = convo.type === "group" || !!convo.group_name;
                      const href = isGroup ? `/messages?group_conversation_id=${convo.id}` : `/messages?compose=${convo.other_user!.username}`;
                      const displayName = isGroup ? (convo.group_name || "Group Chat") : (convo.other_user!.display_name || convo.other_user!.username);
                      const pic = isGroup ? undefined : convo.other_user!.pic;
                      return (
                        <Link key={convo.id} to={href} className="flex items-center gap-3 px-4 py-3 hover:bg-[#faf9f6] transition-colors bg-[#fdf5f3]" onClick={() => window.dispatchEvent(new Event("messages-read"))}>
                          <Avatar pic={pic} name={displayName} />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-[#1c110a] truncate">{displayName}</p>
                            <p className="text-xs text-gray-500 truncate mt-0.5">{convo.last_message}</p>
                          </div>
                          <span className="w-5 h-5 bg-[#c2350a] text-white text-[10px] font-bold rounded-full flex items-center justify-center flex-shrink-0">
                            {convo.unread_count > 9 ? "9+" : convo.unread_count}
                          </span>
                        </Link>
                      );
                    })}
                    {notifications.length > 0 && (
                      <div className="px-4 pt-2 pb-1"><p className="text-[10px] font-semibold tracking-wider text-gray-400 uppercase">Projects</p></div>
                    )}
                    {notifications.map((n) => (
                      <div key={n.id} className={`flex items-start gap-0 ${!n.read ? "bg-[#fdf5f3]" : ""}`}>
                        <button onClick={() => { markRead(n.id); navigate(n.link); }} className="flex items-start gap-3 flex-1 px-4 py-3 hover:bg-[#faf9f6] transition-colors text-left min-w-0">
                          <span className="text-base flex-shrink-0 mt-0.5">{notifIcon(n)}</span>
                          <div className="flex-1 min-w-0">
                            <p className={`text-sm truncate ${!n.read ? "font-semibold text-[#1c110a]" : "font-medium text-[#1c110a]"}`}>{n.title}</p>
                            <p className="text-xs text-gray-500 truncate mt-0.5">{n.message}</p>
                          </div>
                          {!n.read && <span className="w-2 h-2 rounded-full bg-[#c2350a] flex-shrink-0 mt-1.5" />}
                        </button>
                        <button onClick={(e) => { e.stopPropagation(); deleteNotification(n.id); }} aria-label="Delete notification" className="px-3 py-3 text-gray-300 hover:text-[#c2350a] transition-colors text-lg leading-none flex-shrink-0 self-stretch flex items-center">×</button>
                      </div>
                    ))}
                    {notifications.length === 0 && unreadConversations.length === 0 && (
                      <div className="py-10 text-center">
                        <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-3"><Bell className="h-6 w-6 text-gray-400" /></div>
                        <p className="text-sm text-gray-600 mb-1">No notifications yet</p>
                        <p className="text-xs text-gray-500">We'll notify you when something happens</p>
                      </div>
                    )}
                  </div>
                </PopoverContent>
              </Popover>
            )}
            <button
              className="p-2"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            >
              {mobileMenuOpen ? (
                <X className="h-6 w-6" />
              ) : (
                <Menu className="h-6 w-6" />
              )}
            </button>
          </div>
        </div>

        {/* Mobile menu */}
        {mobileMenuOpen && (
          <div className="md:hidden py-4 border-t">
            {isAuthenticated ? (
              <div className="flex flex-col gap-3">
                <Link
                  to="/home"
                  className="px-4 py-2 text-sm text-[#1c110a] hover:text-[#c2350a] hover:bg-[#faf9f6] rounded-lg transition-colors"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  Home
                </Link>
                <Link
                  to="/search"
                  className="px-4 py-2 text-sm text-[#1c110a] hover:text-[#c2350a] hover:bg-[#faf9f6] rounded-lg transition-colors"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  Search
                </Link>
                <Link
                  to="/requests"
                  className="px-4 py-2 text-sm text-[#1c110a] hover:text-[#c2350a] hover:bg-[#faf9f6] rounded-lg transition-colors"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  Requests
                </Link>
                <Link
                  to="/messages"
                  className={`px-4 py-2 text-sm hover:bg-[#faf9f6] rounded-lg transition-colors flex items-center ${
                    location.pathname.startsWith("/messages")
                      ? "text-[#c2350a] font-medium"
                      : "text-[#1c110a] hover:text-[#c2350a]"
                  }`}
                  onClick={() => setMobileMenuOpen(false)}
                >
                  Messages
                  {msgUnreadCount > 0 && (
                    <span className="ml-auto text-[10px] bg-[#c2350a] text-white px-1.5 py-0.5 rounded-full font-bold">
                      {msgUnreadCount > 9 ? "9+" : msgUnreadCount}
                    </span>
                  )}
                </Link>
                {/* Mobile Notifications */}
                {(notifications.length > 0 || unreadConversations.length > 0) && (
                  <div className="px-4 py-2 border-t border-[#f0ede8]">
                    <p className="text-[10px] font-semibold tracking-wider text-gray-400 uppercase mb-2">Notifications</p>
                    <div className="flex flex-col gap-1 max-h-48 overflow-y-auto">
                      {unreadConversations.map((convo) => (
                        <Link
                          key={convo.id}
                          to={
                            convo.type === "group"
                              ? `/messages?group_conversation_id=${convo.id}`
                              : `/messages?compose=${convo.other_user?.username}`
                          }
                          className="flex items-center gap-2 px-2 py-2 rounded-lg hover:bg-[#faf9f6] bg-[#fdf5f3] transition-colors"
                          onClick={() => { setMobileMenuOpen(false); window.dispatchEvent(new Event("messages-read")); }}
                        >
                          <MessageSquare className="h-4 w-4 text-[#c2350a] flex-shrink-0" />
                          <span className="text-sm text-[#1c110a] truncate flex-1">
                            {convo.type === "group" ? convo.group_name ?? "Group" : convo.other_user?.display_name || convo.other_user?.username}
                          </span>
                          <span className="w-4 h-4 bg-[#c2350a] text-white text-[9px] font-bold rounded-full flex items-center justify-center flex-shrink-0">
                            {convo.unread_count > 9 ? "9+" : convo.unread_count}
                          </span>
                        </Link>
                      ))}
                      {notifications.slice(0, 3).map((n) => (
                        <button
                          key={n.id}
                          onClick={() => { markRead(n.id); navigate(n.link); setMobileMenuOpen(false); }}
                          className={`flex items-center gap-2 px-2 py-2 rounded-lg hover:bg-[#faf9f6] transition-colors text-left ${!n.read ? "bg-[#fdf5f3]" : ""}`}
                        >
                          <span className="text-sm flex-shrink-0">{notifIcon(n)}</span>
                          <span className={`text-sm truncate flex-1 ${!n.read ? "font-semibold text-[#1c110a]" : "text-[#1c110a]"}`}>
                            {n.title}
                          </span>
                          {!n.read && <span className="w-2 h-2 rounded-full bg-[#c2350a] flex-shrink-0" />}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                <Link
                  to="/upload"
                  className="px-4 py-2 text-sm text-[#1c110a] hover:text-[#c2350a] hover:bg-[#faf9f6] rounded-lg transition-colors"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  Upload Project
                </Link>
                <Link
                  to="/profile"
                  className="px-4 py-2 text-sm text-[#1c110a] hover:text-[#c2350a] hover:bg-[#faf9f6] rounded-lg transition-colors"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  Profile
                </Link>
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                <Link
                  to="/about"
                  className="px-4 py-2 text-sm text-[#1c110a] hover:text-[#c2350a] hover:bg-[#faf9f6] rounded-lg transition-colors"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  About
                </Link>
                <Link
                  to="/learn-more"
                  className="px-4 py-2 text-sm text-[#1c110a] hover:text-[#c2350a] hover:bg-[#faf9f6] rounded-lg transition-colors"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  Learn More
                </Link>
                <Link
                  to="/search"
                  className="px-4 py-2 text-sm text-[#1c110a] hover:text-[#c2350a] hover:bg-[#faf9f6] rounded-lg transition-colors"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  Explore
                </Link>
                <Link
                  to="/signin"
                  className="px-4 py-2 text-sm text-[#1c110a] hover:text-[#c2350a] hover:bg-[#faf9f6] rounded-lg transition-colors"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  Sign In
                </Link>
                <Link
                  to="/signup"
                  className="px-4 py-2 text-sm bg-[#c2350a] text-white hover:bg-[#a02d08] rounded-lg transition-colors text-center"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  Sign Up
                </Link>
              </div>
            )}
          </div>
        )}
      </div>
    </nav>
  );
}