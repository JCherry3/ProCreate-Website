import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate, useSearchParams } from "react-router";
import { Navbar } from "../components/Navbar";
import {
  Send,
  Search,
  Edit,
  Paperclip,
  X,
  ChevronLeft,
  MessageSquare,
  AlertCircle,
  Users,
  Plus,
  UserPlus,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

interface GroupMember {
  id: number;
  username: string;
  display_name: string;
  pic?: string;
}

interface Conversation {
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
  members?: GroupMember[];
  project_id?: number | null;
  // Shared
  last_message: string;
  last_message_at: string;
  unread_count: number;
}

interface Attachment {
  id: number;
  original_name: string;
  url: string;
  mime_type: string;
  file_size: number;
}

interface Message {
  id: number;
  sender_id: number;
  sender_username?: string;
  sender_display_name?: string;
  sender_pic?: string;
  body: string;
  sent_at: string;
  is_read?: number;
  attachments?: Attachment[];
}

interface UserSuggestion {
  id: number;
  username: string;
  display_name: string;
  pic?: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1)  return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24)  return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7)  return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function shortTime(dateStr: string): string {
  return new Date(dateStr).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });
}

function Avatar({
  pic,
  name,
  size = "md",
  group = false,
}: {
  pic?: string;
  name: string;
  size?: "sm" | "md" | "lg";
  group?: boolean;
}) {
  const dims =
    size === "sm" ? "w-8 h-8 text-xs" : size === "lg" ? "w-11 h-11 text-base" : "w-9 h-9 text-sm";
  const imgSrc = pic ? `api/profile_pics/${pic.replace(/^profile_pics\//, "")}` : null;

  if (group) {
    return (
      <div
        className={`${dims} rounded-full bg-gradient-to-br from-[#1c3738] to-[#2a5456] flex items-center justify-center text-white flex-shrink-0`}
      >
        <Users className="w-4 h-4" />
      </div>
    );
  }

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

const MAX_BODY = 5000;
const POLL_INTERVAL_MS = 5000;

// ─── Drag Drop ────────────────────────────────────────────────────────────────
function DragDropZone({
  onDrop,
  children,
}: {
  onDrop: (files: File[]) => void;
  children: React.ReactNode;
}) {
  const [isDragging, setIsDragging] = useState(false);
  const dragCounterRef = useRef(0);

  function handleDragEnter(e: React.DragEvent) {
    e.preventDefault();
    dragCounterRef.current += 1;
    if (dragCounterRef.current === 1) setIsDragging(true);
  }
  function handleDragLeave(e: React.DragEvent) {
    e.preventDefault();
    dragCounterRef.current -= 1;
    if (dragCounterRef.current === 0) setIsDragging(false);
  }
  function handleDragOver(e: React.DragEvent) { e.preventDefault(); }
  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    dragCounterRef.current = 0;
    setIsDragging(false);
    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) onDrop(files);
  }

  return (
    <div
      className="relative flex flex-col flex-1 overflow-hidden"
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      {isDragging && (
        <div className="absolute inset-0 z-50 bg-[#c2350a]/10 border-2 border-dashed border-[#c2350a] rounded-lg pointer-events-none flex items-center justify-center">
          <div className="bg-white rounded-xl px-6 py-4 shadow-lg flex flex-col items-center gap-2">
            <Paperclip className="h-6 w-6 text-[#c2350a]" />
            <p className="text-sm font-semibold text-[#1c110a]">Drop files to attach</p>
          </div>
        </div>
      )}
      {children}
    </div>
  );
}

// ─── Create Group Modal ───────────────────────────────────────────────────────
function CreateGroupModal({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: (convoId: number, groupName: string) => void;
}) {
  const [groupName, setGroupName] = useState("");
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState<UserSuggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedUsers, setSelectedUsers] = useState<UserSuggestion[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const suggestionsRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  async function fetchSuggestions(q: string) {
    if (q.trim().length < 1) { setSuggestions([]); setShowSuggestions(false); return; }
    try {
      const res = await fetch("api/search_users.php", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: q }),
      });
      const data = await res.json();
      if (Array.isArray(data.users)) {
        const filtered = data.users.filter(
          (u: UserSuggestion) => !selectedUsers.find((s) => s.id === u.id)
        );
        setSuggestions(filtered.slice(0, 6));
        setShowSuggestions(filtered.length > 0);
      }
    } catch {
      setSuggestions([]);
    }
  }

  function handleQueryChange(e: React.ChangeEvent<HTMLInputElement>) {
    setQuery(e.target.value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => fetchSuggestions(e.target.value), 250);
  }

  function addUser(user: UserSuggestion) {
    if (!selectedUsers.find((u) => u.id === user.id)) {
      setSelectedUsers((prev) => [...prev, user]);
    }
    setQuery("");
    setSuggestions([]);
    setShowSuggestions(false);
    inputRef.current?.focus();
  }

  function removeUser(id: number) {
    setSelectedUsers((prev) => prev.filter((u) => u.id !== id));
  }

  async function handleCreate() {
    if (groupName.trim() === "") { setError("Group name is required"); return; }
    if (selectedUsers.length < 2) { setError("Please add at least 1 participants"); return; }

    setCreating(true);
    setError(null);
    try {
      // Get CSRF token
      const csrfRes = await fetch("api/get_csrf_token.php", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const csrfData = await csrfRes.json();
      const csrf_token = csrfData.csrfToken ?? csrfData.csrf_token ?? "";

      const res = await fetch("api/create_group_conversation.php", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          csrf_token,
          group_name: groupName.trim(),
          participants: selectedUsers.map((u) => u.id),
        }),
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        setError(data.error || "Failed to create group");
        return;
      }
      onCreated(data.conversation_id, data.group_name);
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setCreating(false);
    }
  }

  // Close suggestions on outside click
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (
        suggestionsRef.current && !suggestionsRef.current.contains(e.target as Node) &&
        inputRef.current && !inputRef.current.contains(e.target as Node)
      ) setShowSuggestions(false);
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Users className="h-5 w-5 text-[#1c3738]" />
            <h2 className="text-lg font-semibold text-[#1c110a]">New Group Chat</h2>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Group name */}
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Group Name</label>
          <input
            type="text"
            placeholder="e.g. Design Team, Project Alpha…"
            value={groupName}
            onChange={(e) => setGroupName(e.target.value)}
            className="w-full px-3 py-2.5 bg-[#faf9f6] border border-[#e8e2d9] rounded-xl text-sm text-[#1c110a] placeholder:text-gray-400 outline-none focus:border-[#c2350a] transition-colors"
          />
        </div>

        {/* Add participants */}
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">
            Add Participants (at least 1)
          </label>

          {/* Selected user chips */}
          {selectedUsers.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mb-2">
              {selectedUsers.map((u) => (
                <div
                  key={u.id}
                  className="flex items-center gap-1 bg-[#fff5f2] border border-[#f0c4b4] rounded-full px-2.5 py-1 text-xs text-[#c2350a] font-medium"
                >
                  {u.display_name || u.username}
                  <button onClick={() => removeUser(u.id)} className="hover:text-red-700">
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ))}
            </div>
          )}

          <div className="relative">
            <UserPlus className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
            <input
              ref={inputRef}
              type="text"
              placeholder="Search users to add…"
              value={query}
              onChange={handleQueryChange}
              onFocus={() => suggestions.length > 0 && setShowSuggestions(true)}
              autoComplete="off"
              className="w-full pl-8 pr-3 py-2.5 bg-[#faf9f6] border border-[#e8e2d9] rounded-xl text-sm text-[#1c110a] placeholder:text-gray-400 outline-none focus:border-[#c2350a] transition-colors"
            />
            {showSuggestions && (
              <div
                ref={suggestionsRef}
                className="absolute left-0 top-full mt-1 w-full bg-white rounded-xl shadow-xl border border-[#e8e2d9] z-50 overflow-hidden"
              >
                {suggestions.map((user) => (
                  <button
                    key={user.id}
                    onMouseDown={(e) => { e.preventDefault(); addUser(user); }}
                    className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-[#faf9f6] transition-colors text-left"
                  >
                    <Avatar pic={user.pic} name={user.display_name || user.username} size="sm" />
                    <div>
                      <p className="text-sm font-medium text-[#1c110a]">{user.display_name || user.username}</p>
                      <p className="text-xs text-gray-400">@{user.username}</p>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
          <p className="text-xs text-gray-400 mt-1">
            {selectedUsers.length}/1 minimum · you will be added automatically
          </p>
        </div>

        {error && (
          <div className="flex items-center gap-2 text-xs text-red-600 bg-red-50 rounded-lg px-3 py-2">
            <AlertCircle className="h-3.5 w-3.5 flex-shrink-0" />
            {error}
          </div>
        )}

        <div className="flex gap-2 pt-1">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2.5 border border-[#e8e2d9] rounded-xl text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleCreate}
            disabled={creating || groupName.trim() === "" || selectedUsers.length < 2}
            className="flex-1 px-4 py-2.5 bg-[#1c3738] hover:bg-[#2a5456] text-white text-sm font-medium rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {creating ? (
              <span className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full" />
            ) : (
              <>
                <Users className="h-4 w-4" />
                Create Group
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function Messages() {
  const navigate       = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const [currentUserId, setCurrentUserId] = useState<number>(0);

  // Sidebar
  const [conversations, setConversations]   = useState<Conversation[]>([]);
  const [convoLoading, setConvoLoading]     = useState(true);
  const [sidebarSearch, setSidebarSearch]   = useState("");

  // Active conversation
  const [activeConvoId, setActiveConvoId]   = useState<number | null>(null);
  const [activeConvo, setActiveConvo]       = useState<Conversation | null>(null);

  // Messages
  const [messages, setMessages]             = useState<Message[]>([]);
  const [messagesLoading, setMessagesLoading] = useState(false);

  // DM compose
  const [isComposing, setIsComposing]       = useState(false);
  const [newRecipient, setNewRecipient]     = useState("");
  const [newRecipientId, setNewRecipientId] = useState<number | null>(null);
  const [suggestions, setSuggestions]       = useState<UserSuggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [recipientError, setRecipientError] = useState<string | null>(null);

  // Group modal
  const [showGroupModal, setShowGroupModal] = useState(false);

  // Reply input
  const [replyBody, setReplyBody]           = useState("");
  const [isSending, setIsSending]           = useState(false);
  const [sendError, setSendError]           = useState<string | null>(null);
  const [sendWarnings, setSendWarnings]     = useState<string[]>([]);

  // Attachments (DM only)
  const [attachments, setAttachments]       = useState<File[]>([]);

  // Mobile
  const [mobilePanelView, setMobilePanelView] = useState<"sidebar" | "chat">("sidebar");

  // Refs
  const messagesEndRef      = useRef<HTMLDivElement>(null);
  const fileInputRef        = useRef<HTMLInputElement>(null);
  const recipientInputRef   = useRef<HTMLInputElement>(null);
  const debounceRef         = useRef<ReturnType<typeof setTimeout> | null>(null);
  const suggestionsRef      = useRef<HTMLDivElement>(null);
  const activeConvoRef      = useRef<Conversation | null>(null);
  const convoPollingRef     = useRef<ReturnType<typeof setInterval> | null>(null);
  const msgPollingRef       = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Load conversations ─────────────────────────────────────────────────────
  const loadConversations = useCallback(async (silent = false) => {
    if (!silent) setConvoLoading(true);
    try {
      const res  = await fetch("api/get_conversations.php", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const data = await res.json();
      if (data.current_user_id) setCurrentUserId(Number(data.current_user_id));
      if (Array.isArray(data.conversations)) {
        const activeId = activeConvoRef.current?.id;
        const convos = activeId
          ? data.conversations.map((c: Conversation) =>
              c.id === activeId ? { ...c, unread_count: 0 } : c
            )
          : data.conversations;
        setConversations(convos);
        if (activeConvoRef.current) {
          const refreshed = data.conversations.find(
            (c: Conversation) => c.id === activeConvoRef.current!.id
          );
          if (refreshed) {
            setActiveConvo((prev) => prev ? { ...refreshed, unread_count: 0 } : prev);
          }
        }
      }
    } catch { /* silent */ } finally {
      if (!silent) setConvoLoading(false);
    }
  }, []);

  // ── Load DM messages ──────────────────────────────────────────────────────
  const loadDMMessages = useCallback(async (otherUserId: number, silent = false) => {
    if (!silent) { setMessagesLoading(true); setMessages([]); }
    try {
      const formData = new FormData();
      formData.append("other_user_id", String(otherUserId));
      const res  = await fetch("api/get_messages.php", {
        method: "POST",
        credentials: "include",
        body: formData,
      });
      const data = await res.json();
      if (data.current_user_id) setCurrentUserId(Number(data.current_user_id));
      if (Array.isArray(data.messages)) {
        setMessages(data.messages.map((m: Record<string, unknown>) => ({
          ...m,
          sender_id: Number(m.sender_id),
          attachments: Array.isArray(m.attachments) ? m.attachments : [],
        })));
      }
    } catch {
      if (!silent) setMessages([]);
    } finally {
      if (!silent) setMessagesLoading(false);
    }
  }, []);

  // ── Load group messages ───────────────────────────────────────────────────
  const loadGroupMessages = useCallback(async (conversationId: number, silent = false) => {
    if (!silent) { setMessagesLoading(true); setMessages([]); }
    try {
      const res  = await fetch("api/get_group_messages.php", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ conversation_id: conversationId }),
      });
      const data = await res.json();
      if (data.current_user_id) setCurrentUserId(Number(data.current_user_id));
      if (Array.isArray(data.messages)) {
        setMessages(data.messages.map((m: Record<string, unknown>) => ({
          ...m,
          sender_id: Number(m.sender_id),
        })));
      }
      // Tell the navbar bell to refresh unread counts now that messages are marked read
      window.dispatchEvent(new Event("messages-read"));
    } catch {
      if (!silent) setMessages([]);
    } finally {
      if (!silent) setMessagesLoading(false);
    }
  }, []);

  const loadMessages = useCallback((convo: Conversation, silent = false) => {
    if (convo.type === "group") {
      loadGroupMessages(convo.id, silent);
    } else {
      loadDMMessages(convo.other_user!.id, silent);
    }
  }, [loadGroupMessages, loadDMMessages]);

  // ── Mark as read (DM only) ────────────────────────────────────────────────
  const markAsRead = useCallback(async (otherUserId: number) => {
    try {
      const formData = new FormData();
      formData.append("other_user_id", String(otherUserId));
      await fetch("api/mark_as_read.php", { method: "POST", credentials: "include", body: formData });
      window.dispatchEvent(new Event("messages-read"));
    } catch { /* silent */ }
  }, []);

  // ── Polling ───────────────────────────────────────────────────────────────
  useEffect(() => {
    convoPollingRef.current = setInterval(() => loadConversations(true), POLL_INTERVAL_MS);
    return () => { if (convoPollingRef.current) clearInterval(convoPollingRef.current); };
  }, [loadConversations]);

  useEffect(() => {
    activeConvoRef.current = activeConvo;
    if (msgPollingRef.current) clearInterval(msgPollingRef.current);
    if (activeConvo) {
      msgPollingRef.current = setInterval(() => {
        loadMessages(activeConvo, true);
        if (activeConvo.type === "dm") markAsRead(activeConvo.other_user!.id);
      }, POLL_INTERVAL_MS);
    }
    return () => { if (msgPollingRef.current) clearInterval(msgPollingRef.current); };
  }, [activeConvo, loadMessages, markAsRead]);

  // ── Initial load ──────────────────────────────────────────────────────────
  useEffect(() => { loadConversations(); }, [loadConversations]);

  // ── Restore last active convo from sessionStorage ────────────────────────
  useEffect(() => {
    if (convoLoading || conversations.length === 0) return;
    if (isComposing || activeConvoId !== null) return;
    const savedId = sessionStorage.getItem("activeConvoId");
    if (!savedId) return;
    const found = conversations.find((c) => c.id === parseInt(savedId, 10));
    if (found) selectConversation(found);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [convoLoading, conversations]);

  useEffect(() => {
    if (activeConvoId !== null) sessionStorage.setItem("activeConvoId", String(activeConvoId));
  }, [activeConvoId]);

  // ── Auto-open compose from ?compose=username ──────────────────────────────
  const composeTarget = searchParams.get("compose");
  const groupTarget   = searchParams.get("group_conversation_id");

  // Inside Messages component in Messages.tsx

useEffect(() => {
  if (!groupTarget) return;

  const clearParam = () =>
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.delete("group_conversation_id");
      return next;
    }, { replace: true });

  // Wait until initial load is done (convoLoading false means fetch completed)
  if (convoLoading) return;

  const groupId = parseInt(groupTarget, 10);
  const existing = conversations.find((c) => c.type === "group" && c.id === groupId);

  if (existing) {
    selectConversation(existing);
    // Also switch mobile view to chat panel
    setMobilePanelView("chat");
  }
  // Always clear the param after attempting, so it never lingers
  clearParam();
}, [groupTarget, convoLoading, conversations, setSearchParams]);

  useEffect(() => {
    if (!composeTarget || convoLoading) return;
    const existing = conversations.find(
      (c) => c.type === "dm" && c.other_user?.username.toLowerCase() === composeTarget.toLowerCase()
    );

    if (existing) { 
    selectConversation(existing); 
    // Clear the param
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.delete("compose");
      return next;
    }, { replace: true });
    return; 
    }
    setIsComposing(true);
    setActiveConvoId(null);
    setActiveConvo(null);
    setMessages([]);
    setNewRecipient(composeTarget);
    setNewRecipientId(null);
    setReplyBody("");
    setSendError(null);
    setRecipientError(null);
    setMobilePanelView("chat");
    fetch("api/search_users.php", {
      method: "POST", credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query: composeTarget }),
    })
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data.users)) {
          const match = data.users.find(
            (u: UserSuggestion) => u.username.toLowerCase() === composeTarget.toLowerCase()
          );
          if (match) { setNewRecipientId(match.id); setNewRecipient(match.username); }
        }
      })
      .catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [composeTarget, convoLoading]);

  // Scroll to bottom on new messages
  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  // ── Select a conversation ─────────────────────────────────────────────────
  function selectConversation(convo: Conversation) {
    setActiveConvoId(convo.id);
    setActiveConvo(convo);
    setIsComposing(false);
    setReplyBody("");
    setSendError(null);
    setAttachments([]);
    setMobilePanelView("chat");
    loadMessages(convo);
    if (convo.type === "dm") {
      markAsRead(convo.other_user!.id);
      setConversations((prev) =>
        prev.map((c) => (c.id === convo.id ? { ...c, unread_count: 0 } : c))
      );
    }
  }

  // ── Start DM compose ──────────────────────────────────────────────────────
  function startCompose() {
    setIsComposing(true);
    setActiveConvoId(null);
    setActiveConvo(null);
    setMessages([]);
    setNewRecipient("");
    setNewRecipientId(null);
    setReplyBody("");
    setSendError(null);
    setRecipientError(null);
    setAttachments([]);
    setMobilePanelView("chat");
    sessionStorage.removeItem("activeConvoId");
    setTimeout(() => recipientInputRef.current?.focus(), 50);
  }

  // ── Autocomplete ──────────────────────────────────────────────────────────
  async function fetchSuggestions(query: string) {
    if (query.trim().length < 1) { setSuggestions([]); setShowSuggestions(false); return; }
    try {
      const res  = await fetch("api/search_users.php", {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query }),
      });
      const data = await res.json();
      if (Array.isArray(data.users)) {
        setSuggestions(data.users.slice(0, 6));
        setShowSuggestions(data.users.length > 0);
      }
    } catch { setSuggestions([]); }
  }

  function handleRecipientChange(e: React.ChangeEvent<HTMLInputElement>) {
    const val = e.target.value;
    setNewRecipient(val);
    setNewRecipientId(null);
    setRecipientError(null);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => fetchSuggestions(val), 250);
  }

  function selectSuggestion(user: UserSuggestion) {
    setNewRecipient(user.username);
    setNewRecipientId(user.id);
    setSuggestions([]);
    setShowSuggestions(false);
    setRecipientError(null);
  }

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (
        suggestionsRef.current && !suggestionsRef.current.contains(e.target as Node) &&
        recipientInputRef.current && !recipientInputRef.current.contains(e.target as Node)
      ) setShowSuggestions(false);
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // ── Send message ──────────────────────────────────────────────────────────
  async function handleSend() {
    const body = replyBody.trim();
    if (!body && attachments.length === 0) return;

    if (isComposing && !newRecipientId) {
      setRecipientError("Please select a valid recipient from the suggestions.");
      return;
    }

    setIsSending(true);
    setSendError(null);
    setSendWarnings([]);

    try {
      // Group message — supports attachments via same chunked upload flow
      if (activeConvo?.type === "group") {
        const CHUNK_SIZE = 1.5 * 1024 * 1024;
        const uploadedAttachments: Array<{
          stored_name: string;
          original_name: string;
          mime_type: string;
          file_size: number;
        }> = [];

        for (const file of attachments) {
          const totalChunks = Math.ceil(file.size / CHUNK_SIZE);
          const uploadId    = Array.from(crypto.getRandomValues(new Uint8Array(8)))
                                .map((b) => b.toString(16).padStart(2, "0"))
                                .join("");
          let assembledResult = null;
          for (let i = 0; i < totalChunks; i++) {
            const start = i * CHUNK_SIZE;
            const end   = Math.min(start + CHUNK_SIZE, file.size);
            const chunk = file.slice(start, end);
            const fd    = new FormData();
            fd.append("upload_id", uploadId);
            fd.append("chunk_index", String(i));
            fd.append("total_chunks", String(totalChunks));
            fd.append("original_name", file.name);
            fd.append("chunk", chunk, file.name);
            fd.append("total_size", String(file.size));
            const res  = await fetch("api/upload_chunk.php", { method: "POST", credentials: "include", body: fd });
            const data = await res.json();
            if (!res.ok || data.error) throw new Error(data.error || `Chunk ${i} upload failed`);
            if (data.assembled) assembledResult = data;
          }
          if (assembledResult) {
            uploadedAttachments.push({
              stored_name:   assembledResult.stored_name,
              original_name: assembledResult.original_name,
              mime_type:     assembledResult.mime_type,
              file_size:     assembledResult.file_size,
            });
          }
        }

        const res  = await fetch("api/send_group_message.php", {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ conversation_id: activeConvo.id, body, attachments: uploadedAttachments }),
        });
        const data = await res.json();
        if (!res.ok || data.error) {
          setSendError(data.error || "Failed to send message.");
          return;
        }
        setReplyBody("");
        setAttachments([]);
        window.dispatchEvent(new Event("messages-read"));
        // Optimistic update
        setMessages((prev) => [
          ...prev,
          {
            id: data.message_id ?? Date.now(),
            sender_id: currentUserId,
            body,
            sent_at: new Date().toISOString(),
            attachments: uploadedAttachments.map((a, i) => ({ id: i, ...a })),
          },
        ]);
        setConversations((prev) =>
          prev.map((c) =>
            c.id === activeConvoId
              ? { ...c, last_message: body || "📎 Attachment", last_message_at: new Date().toISOString() }
              : c
          )
        );
        return;
      }

      // DM message — chunked upload flow
      const recipientId = isComposing ? newRecipientId! : activeConvo!.other_user!.id;
      const CHUNK_SIZE  = 1.5 * 1024 * 1024;
      const uploadedAttachments: Array<{
        stored_name: string;
        original_name: string;
        mime_type: string;
        file_size: number;
      }> = [];

      for (const file of attachments) {
        const totalChunks = Math.ceil(file.size / CHUNK_SIZE);
        const uploadId    = Array.from(crypto.getRandomValues(new Uint8Array(8)))
                              .map((b) => b.toString(16).padStart(2, "0"))
                              .join("");
        let assembledResult = null;
        for (let i = 0; i < totalChunks; i++) {
          const start = i * CHUNK_SIZE;
          const end   = Math.min(start + CHUNK_SIZE, file.size);
          const chunk = file.slice(start, end);
          const fd    = new FormData();
          fd.append("upload_id", uploadId);
          fd.append("chunk_index", String(i));
          fd.append("total_chunks", String(totalChunks));
          fd.append("original_name", file.name);
          fd.append("chunk", chunk, file.name);
          fd.append("total_size", String(file.size));
          const res  = await fetch("api/upload_chunk.php", { method: "POST", credentials: "include", body: fd });
          const data = await res.json();
          if (!res.ok || data.error) throw new Error(data.error || `Chunk ${i} upload failed`);
          if (data.assembled) assembledResult = data;
        }
        if (assembledResult) {
          uploadedAttachments.push({
            stored_name: assembledResult.stored_name,
            original_name: assembledResult.original_name,
            mime_type: assembledResult.mime_type,
            file_size: assembledResult.file_size,
          });
        }
      }

      const res  = await fetch("api/finalize_message.php", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ recipient_id: recipientId, body, attachments: uploadedAttachments }),
      });
      const data = await res.json();

      if (res.ok && !data.error) {
        setReplyBody("");
        setAttachments([]);
        window.dispatchEvent(new Event("messages-read"));
        if (isComposing) {
          await loadConversations();
          if (data.message_id) {
            setConversations((prev) => {
              const found = prev.find((c) => c.type === "dm" && c.other_user?.id === recipientId);
              const newConvo: Conversation = found ?? {
                id: data.message_id,
                type: "dm",
                other_user: {
                  id: newRecipientId!,
                  username: newRecipient,
                  display_name: newRecipient,
                },
                last_message: body,
                last_message_at: new Date().toISOString(),
                unread_count: 0,
              };
              setActiveConvoId(newConvo.id);
              setActiveConvo(newConvo);
              setIsComposing(false);
              loadDMMessages(newConvo.other_user!.id);
              return prev;
            });
          }
        } else if (activeConvo) {
          setMessages((prev) => [
            ...prev,
            { id: data.message_id ?? Date.now(), sender_id: currentUserId, body, sent_at: new Date().toISOString(), is_read: 0 },
          ]);
          setConversations((prev) =>
            prev.map((c) =>
              c.id === activeConvoId
                ? { ...c, last_message: body, last_message_at: new Date().toISOString() }
                : c
            )
          );
        }
      } else {
        setSendError(data.error || "Failed to send. Please try again.");
        if (data.warnings) setSendWarnings(data.warnings);
      }
    } catch (err: unknown) {
      setSendError(err instanceof Error ? err.message : "Network error. Please try again.");
    } finally {
      setIsSending(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); }
  }

  // ── Group modal created ───────────────────────────────────────────────────
  async function handleGroupCreated(convoId: number, groupName: string) {
    setShowGroupModal(false);
    await loadConversations();
    // Find and open the new group
    setConversations((prev) => {
      const found = prev.find((c) => c.type === "group" && c.id === convoId);
      if (found) {
        selectConversation(found);
      } else {
        // Create a placeholder while conversations reload
        const placeholder: Conversation = {
          id: convoId,
          type: "group",
          group_name: groupName,
          members: [],
          last_message: "",
          last_message_at: new Date().toISOString(),
          unread_count: 0,
        };
        selectConversation(placeholder);
      }
      return prev;
    });
  }

  // ── Filtered sidebar ──────────────────────────────────────────────────────
  const filteredConvos = conversations.filter((c) => {
    const q = sidebarSearch.toLowerCase();
    if (c.type === "group") {
      return (c.group_name ?? "").toLowerCase().includes(q);
    }
    return (
      (c.other_user?.username ?? "").toLowerCase().includes(q) ||
      (c.other_user?.display_name ?? "").toLowerCase().includes(q)
    );
  });

  function getConvoDisplayName(convo: Conversation): string {
    if (convo.type === "group") return convo.group_name ?? "Group";
    return convo.other_user?.display_name || convo.other_user?.username || "";
  }

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col h-screen bg-[#faf9f6] overflow-hidden">
      <Navbar isAuthenticated={true} />

      {showGroupModal && (
        <CreateGroupModal
          onClose={() => setShowGroupModal(false)}
          onCreated={handleGroupCreated}
        />
      )}

      <div className="flex flex-1 overflow-hidden">

        {/* ══ SIDEBAR ══════════════════════════════════════════════════════ */}
        <aside
          className={`
            ${mobilePanelView === "sidebar" ? "flex" : "hidden"}
            md:flex flex-col
            w-full md:w-80 lg:w-96
            bg-white border-r border-[#e8e2d9]
            flex-shrink-0
          `}
        >
          {/* Sidebar header */}
          <div className="px-4 pt-5 pb-3 border-b border-[#f0ede8]">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-lg font-semibold text-[#1c110a]">Messages</h2>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setShowGroupModal(true)}
                  className="p-2 rounded-lg hover:bg-[#faf9f6] text-gray-400 hover:text-[#1c3738] transition-colors"
                  title="New group chat"
                >
                  <Users className="h-4 w-4" />
                </button>
                <button
                  onClick={startCompose}
                  className="p-2 rounded-lg hover:bg-[#faf9f6] text-gray-400 hover:text-[#c2350a] transition-colors"
                  title="New direct message"
                >
                  <Edit className="h-4 w-4" />
                </button>
              </div>
            </div>

            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
              <input
                type="text"
                placeholder="Search conversations…"
                value={sidebarSearch}
                onChange={(e) => setSidebarSearch(e.target.value)}
                className="w-full pl-8 pr-3 py-2 bg-[#faf9f6] rounded-lg text-sm text-[#1c110a] placeholder:text-gray-400 border border-[#e8e2d9] outline-none focus:border-[#c2350a] transition-colors"
              />
            </div>
          </div>

          {/* Conversation list */}
          <div className="flex-1 overflow-y-auto">
            {convoLoading && (
              <div className="py-12 text-center text-sm text-gray-400">Loading…</div>
            )}

            {!convoLoading && filteredConvos.length === 0 && (
              <div className="py-16 px-6 text-center">
                <MessageSquare className="h-8 w-8 text-gray-300 mx-auto mb-3" />
                <p className="text-sm text-gray-500 mb-1">
                  {sidebarSearch ? "No results found." : "No messages yet."}
                </p>
                {!sidebarSearch && (
                  <div className="flex flex-col items-center gap-2 mt-3">
                    <button
                      onClick={startCompose}
                      className="text-xs text-[#c2350a] hover:underline"
                    >
                      Start a direct message
                    </button>
                    <button
                      onClick={() => setShowGroupModal(true)}
                      className="text-xs text-[#1c3738] hover:underline"
                    >
                      Create a group chat
                    </button>
                  </div>
                )}
              </div>
            )}

            {filteredConvos.map((convo) => {
              const isActive     = convo.id === activeConvoId;
              const displayName  = getConvoDisplayName(convo);
              const isGroup      = convo.type === "group";
              const memberCount  = convo.members?.length ?? 0;
              return (
                <button
                  key={`${convo.type}-${convo.id}`}
                  onClick={() => selectConversation(convo)}
                  className={`w-full flex items-center gap-3 px-4 py-3.5 transition-colors text-left border-b border-[#f8f6f2] ${
                    isActive
                      ? isGroup
                        ? "bg-[#f0f7f7] border-l-2 border-l-[#1c3738]"
                        : "bg-[#fff5f2] border-l-2 border-l-[#c2350a]"
                      : "hover:bg-[#faf9f6]"
                  }`}
                >
                  <Avatar pic={isGroup ? undefined : convo.other_user?.pic} name={displayName} group={isGroup} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-1">
                      <span className={`text-sm truncate ${convo.unread_count > 0 ? "font-semibold text-[#1c110a]" : "font-medium text-[#1c110a]"}`}>
                        {displayName}
                      </span>
                      <span className="text-[11px] text-gray-400 flex-shrink-0">
                        {timeAgo(convo.last_message_at)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-1 mt-0.5">
                      <p className={`text-xs truncate ${convo.unread_count > 0 ? "text-[#1c110a] font-medium" : "text-gray-400"}`}>
                        {isGroup
                          ? (convo.last_message ? convo.last_message : `${memberCount} members`)
                          : convo.last_message}
                      </p>
                      {convo.unread_count > 0 && (
                        <span className="flex-shrink-0 w-4 h-4 bg-[#c2350a] text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                          {convo.unread_count > 9 ? "9+" : convo.unread_count}
                        </span>
                      )}
                    </div>
                    {isGroup && (
                      <p className="text-[10px] text-[#1c3738] font-medium mt-0.5">Group · {memberCount} members</p>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </aside>

        {/* ══ CHAT PANEL ═══════════════════════════════════════════════════ */}
        <main
          className={`
            ${mobilePanelView === "chat" ? "flex" : "hidden"}
            md:flex flex-col flex-1 overflow-hidden
          `}
        >
          {/* Empty state */}
          {!activeConvo && !isComposing && (
            <div className="flex-1 flex flex-col items-center justify-center text-center px-6">
              <div className="w-16 h-16 bg-[#fff5f2] rounded-2xl flex items-center justify-center mb-4">
                <MessageSquare className="h-8 w-8 text-[#c2350a]" />
              </div>
              <h3 className="text-lg font-semibold text-[#1c110a] mb-1">Your Messages</h3>
              <p className="text-sm text-gray-500 mb-4 max-w-xs">
                Select a conversation or start a new one.
              </p>
              <div className="flex gap-2">
                <button
                  onClick={startCompose}
                  className="px-4 py-2 bg-[#c2350a] hover:bg-[#a02d08] text-white text-sm font-medium rounded-lg transition-colors flex items-center gap-1.5"
                >
                  <Edit className="h-3.5 w-3.5" />
                  New Message
                </button>
                <button
                  onClick={() => setShowGroupModal(true)}
                  className="px-4 py-2 bg-[#1c3738] hover:bg-[#2a5456] text-white text-sm font-medium rounded-lg transition-colors flex items-center gap-1.5"
                >
                  <Users className="h-3.5 w-3.5" />
                  New Group
                </button>
              </div>
            </div>
          )}

          {/* Compose DM */}
          {isComposing && (
            <>
              <div className="px-5 py-3.5 border-b border-[#e8e2d9] bg-white flex items-center gap-3 flex-shrink-0">
                <button
                  className="md:hidden p-1 text-gray-400 hover:text-[#1c110a]"
                  onClick={() => setMobilePanelView("sidebar")}
                >
                  <ChevronLeft className="h-5 w-5" />
                </button>
                <div className="flex-1 relative">
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-gray-400 font-medium flex-shrink-0">To:</span>
                    <input
                      ref={recipientInputRef}
                      type="text"
                      placeholder="Search for a user…"
                      value={newRecipient}
                      onChange={handleRecipientChange}
                      onFocus={() => suggestions.length > 0 && setShowSuggestions(true)}
                      autoComplete="off"
                      className={`flex-1 bg-transparent border-none outline-none text-sm placeholder:text-gray-300 ${newRecipientId ? "text-[#c2350a] font-semibold" : "text-[#1c110a]"}`}
                    />
                    {newRecipientId && (
                      <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium flex-shrink-0">✓</span>
                    )}
                  </div>
                  {showSuggestions && (
                    <div ref={suggestionsRef} className="absolute left-0 top-full mt-2 w-72 bg-white rounded-xl shadow-xl border border-[#e8e2d9] z-50 overflow-hidden">
                      {suggestions.map((user) => (
                        <button
                          key={user.id}
                          onMouseDown={(e) => { e.preventDefault(); selectSuggestion(user); }}
                          className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-[#faf9f6] transition-colors text-left"
                        >
                          <Avatar pic={user.pic} name={user.display_name || user.username} size="sm" />
                          <div>
                            <p className="text-sm font-medium text-[#1c110a]">{user.display_name || user.username}</p>
                            <p className="text-xs text-gray-400">@{user.username}</p>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
              {recipientError && (
                <div className="px-5 py-2 bg-red-50 border-b border-red-100 flex items-center gap-2">
                  <AlertCircle className="h-3.5 w-3.5 text-red-500 flex-shrink-0" />
                  <p className="text-xs text-red-600">{recipientError}</p>
                </div>
              )}
              <div className="flex-1 bg-[#faf9f6]" />
            </>
          )}

          {/* Active conversation */}
          {activeConvo && !isComposing && (
            <DragDropZone onDrop={(files) => setAttachments((prev) => [...prev, ...files])}>
              {/* Chat header */}
              <div className="px-5 py-3.5 border-b border-[#e8e2d9] bg-white flex items-center gap-3 flex-shrink-0">
                <button
                  className="md:hidden p-1 text-gray-400 hover:text-[#1c110a]"
                  onClick={() => setMobilePanelView("sidebar")}
                >
                  <ChevronLeft className="h-5 w-5" />
                </button>
                <Avatar
                  pic={activeConvo.type === "dm" ? activeConvo.other_user?.pic : undefined}
                  name={getConvoDisplayName(activeConvo)}
                  group={activeConvo.type === "group"}
                  size="md"
                />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-[#1c110a] truncate">
                    {getConvoDisplayName(activeConvo)}
                  </p>
                  {activeConvo.type === "dm" && (
                    <p className="text-xs text-gray-400">@{activeConvo.other_user?.username}</p>
                  )}
                  {activeConvo.type === "group" && (
                    <p className="text-xs text-gray-400">
                      {activeConvo.members?.map((m) => m.display_name || m.username).join(", ")}
                    </p>
                  )}
                </div>
                {activeConvo.type === "group" && (
                  <div className="flex items-center gap-1 bg-[#f0f7f7] text-[#1c3738] rounded-full px-2.5 py-1 text-xs font-medium flex-shrink-0">
                    <Users className="h-3 w-3" />
                    {activeConvo.members?.length ?? 0}
                  </div>
                )}
              </div>

              {/* Messages */}
              <div className="flex-1 overflow-y-auto overflow-x-hidden px-5 py-4 space-y-3 bg-[#faf9f6]">
                {messagesLoading && (
                  <div className="text-center text-sm text-gray-400 py-8">Loading messages…</div>
                )}
                {!messagesLoading && messages.length === 0 && (
                  <div className="text-center text-sm text-gray-400 py-8">
                    {activeConvo.type === "group"
                      ? "No messages yet. Say hello to the group!"
                      : "No messages yet. Say hello!"}
                  </div>
                )}

                {messages.map((msg) => {
                  const isMine = Number(msg.sender_id) === Number(currentUserId);
                  // Find sender info for group messages
                  const senderMember = activeConvo.type === "group"
                    ? activeConvo.members?.find((m) => m.id === msg.sender_id)
                    : null;
                  const senderName = msg.sender_display_name || senderMember?.display_name || senderMember?.username || "";
                  const senderPic  = msg.sender_pic || senderMember?.pic;

                  return (
                    <div key={msg.id} className={`flex ${isMine ? "justify-end" : "justify-start"} min-w-0`}>
                      <div className={`flex items-end gap-2 max-w-[70%] min-w-0 ${isMine ? "flex-row-reverse" : ""}`}>
                        {!isMine && (
                          <Avatar
                            pic={activeConvo.type === "dm" ? activeConvo.other_user?.pic : senderPic}
                            name={activeConvo.type === "dm" ? (activeConvo.other_user?.display_name || activeConvo.other_user?.username || "") : senderName}
                            size="sm"
                          />
                        )}
                        <div className="min-w-0">
                          {/* Sender name in group chats */}
                          {!isMine && activeConvo.type === "group" && senderName && (
                            <p className="text-[10px] text-gray-400 mb-0.5 ml-1">{senderName}</p>
                          )}

                          {/* DM attachments */}
                          {msg.attachments && msg.attachments.length > 0 && (
                            <div className="flex flex-col gap-2 mb-2">
                              {msg.attachments.map((att) =>
                                att.mime_type.startsWith("image/") ? (
                                  <img key={att.id} src={`api/${att.url}`} alt={att.original_name} className="max-w-full rounded-lg max-h-64 object-contain cursor-pointer" onClick={() => window.open(`api/${att.url}`, "_blank")} />
                                ) : att.mime_type.startsWith("video/") ? (
                                  <video key={att.id} src={`api/${att.url}`} controls className="max-w-full rounded-lg max-h-64" preload="metadata">
                                    <a href={`api/${att.url}`} target="_blank" rel="noreferrer">{att.original_name}</a>
                                  </video>
                                ) : att.mime_type.startsWith("audio/") ? (
                                  <div key={att.id} className="flex flex-col gap-1">
                                    <p className="text-xs text-gray-400 truncate max-w-[240px]">{att.original_name}</p>
                                    <audio src={`api/${att.url}`} controls preload="metadata" style={{ width: "240px", minWidth: "240px" }} />
                                  </div>
                                ) : (
                                  <a key={att.id} href={`api/${att.url}`} target="_blank" rel="noreferrer" className={`flex items-center gap-1.5 text-xs underline ${isMine ? "text-white/80" : "text-[#c2350a]"}`}>
                                    <Paperclip className="h-3 w-3 flex-shrink-0" />
                                    {att.original_name}
                                  </a>
                                )
                              )}
                            </div>
                          )}

                          {msg.body && (
                            <div
                              className={`px-4 py-2.5 rounded-2xl text-sm leading-relaxed break-words overflow-hidden ${
                                isMine
                                  ? activeConvo.type === "group"
                                    ? "bg-[#1c3738] text-white rounded-br-sm border border-[#0f2122]"
                                    : "bg-[#c2350a] text-white rounded-br-sm border border-[#a02d08]"
                                  : "bg-white text-[#1c110a] border border-[#e8e2d9] rounded-bl-sm shadow-sm"
                              }`}
                              style={{ overflowWrap: "break-word", wordBreak: "break-word" }}
                            >
                              {msg.body}
                            </div>
                          )}
                          <p className={`text-[10px] text-gray-400 mt-1 ${isMine ? "text-right" : "text-left"}`}>
                            {shortTime(msg.sent_at)}
                          </p>
                        </div>
                      </div>
                    </div>
                  );
                })}
                <div ref={messagesEndRef} />
              </div>
            </DragDropZone>
          )}

          {/* ── Message input ──────────────────────────────────────────────── */}
          {(activeConvo || isComposing) && (
            <div className="bg-white border-t border-[#e8e2d9] px-4 py-3 flex-shrink-0">
              {sendError && (
                <div className="flex items-center gap-2 mb-2 text-xs text-red-600">
                  <AlertCircle className="h-3.5 w-3.5" />
                  {sendError}
                </div>
              )}

              {sendWarnings.length > 0 && (
                <div className="mb-2 rounded-lg bg-amber-50 border border-amber-200 px-3 py-2 flex flex-col gap-1">
                  {sendWarnings.map((w, i) => (
                    <div key={i} className="flex items-start gap-1.5 text-xs text-amber-700">
                      <AlertCircle className="h-3.5 w-3.5 flex-shrink-0 mt-0.5" />
                      {w}
                    </div>
                  ))}
                </div>
              )}

              {attachments.length > 0 && (
                <div className="flex flex-wrap gap-2 mb-2">
                  {attachments.map((f, i) => (
                    <div key={i} className="flex items-center gap-1.5 bg-[#faf9f6] border border-[#e8e2d9] rounded-lg px-2.5 py-1 text-xs text-[#1c110a]">
                      <Paperclip className="h-3 w-3 text-gray-400" />
                      <span className="max-w-[120px] truncate">{f.name}</span>
                      <button onClick={() => setAttachments((prev) => prev.filter((_, j) => j !== i))} className="text-gray-400 hover:text-red-500 transition-colors">
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <div className="flex items-end gap-2">
                {/* Attach button — DMs and group chats */}
                {(true) && (
                  <>
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="p-2 text-gray-400 hover:text-[#c2350a] transition-colors flex-shrink-0 mb-0.5"
                      title="Attach file"
                    >
                      <Paperclip className="h-4 w-4" />
                    </button>
                    <input
                      ref={fileInputRef}
                      type="file"
                      multiple
                      accept="image/*,video/mp4,video/quicktime,video/x-msvideo,video/webm,audio/mpeg,audio/wav,audio/ogg,audio/aac,audio/mp4"
                      className="hidden"
                      onChange={(e) => {
                        const MAX_FILE_BYTES = 50 * 1024 * 1024;
                        const files = Array.from(e.target.files ?? []);
                        const tooBig = files.filter((f) => f.size > MAX_FILE_BYTES);
                        const valid  = files.filter((f) => f.size <= MAX_FILE_BYTES);
                        if (tooBig.length > 0) setSendError(`${tooBig.map((f) => f.name).join(", ")} exceeds the 50MB limit.`);
                        if (valid.length > 0) setAttachments((prev) => [...prev, ...valid]);
                        if (fileInputRef.current) fileInputRef.current.value = "";
                      }}
                    />
                  </>
                )}

                <textarea
                  value={replyBody}
                  onChange={(e) => { if (e.target.value.length <= MAX_BODY) setReplyBody(e.target.value); }}
                  onKeyDown={handleKeyDown}
                  placeholder={
                    activeConvo?.type === "group"
                      ? `Message ${activeConvo.group_name}…`
                      : "Type a message… (Enter to send)"
                  }
                  rows={1}
                  className="flex-1 bg-[#faf9f6] border border-[#e8e2d9] rounded-xl px-4 py-2.5 text-sm text-[#1c110a] placeholder:text-gray-400 outline-none focus:border-[#c2350a] resize-none leading-relaxed transition-colors"
                  style={{ maxHeight: "120px", overflowY: "auto" }}
                />

                <button
                  type="button"
                  onClick={handleSend}
                  disabled={(!replyBody.trim() && attachments.length === 0) || isSending || (isComposing && !newRecipientId)}
                  className={`p-2.5 rounded-xl flex-shrink-0 transition-all ${
                    (replyBody.trim() || attachments.length > 0) && !isSending && (!isComposing || newRecipientId)
                      ? activeConvo?.type === "group"
                        ? "bg-[#1c3738] hover:bg-[#2a5456] text-white shadow-sm"
                        : "bg-[#c2350a] hover:bg-[#a02d08] text-white shadow-sm"
                      : "bg-gray-100 text-gray-300 cursor-not-allowed"
                  }`}
                >
                  <Send className="h-4 w-4" />
                </button>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}