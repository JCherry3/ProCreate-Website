import React from "react";
import { Navbar } from "../components/Navbar";
import { Button } from "../components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/tabs";
import { Badge } from "../components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "../components/ui/dialog";
import { Calendar, DollarSign, Clock, CheckCircle, MessageSquare, Plus, User, Tag, Trash2, Users } from "lucide-react";
import { Link, useNavigate, useSearchParams } from "react-router";
import { toast } from "sonner";

function pickImplementerFromApiRow(row: Request & Record<string, unknown>): string | undefined {
  const keys = [
    "implementerUsername",
    "implementer_username",
    "acceptedByUsername",
    "accepted_by_username",
    "freelancer_username",
    "assignee_username",
    "assigneeUsername",
  ] as const;
  for (const k of keys) {
    const v = row[k];
    const s = String(v ?? "").trim();
    if (s) return s;
  }
  return undefined;
}

function normalizeRequestStatus(status: unknown): Request["status"] {
  if (status === "pending" || status === "accepted" || status === "completed") {
    return status;
  }
  return "pending";
}

interface Request {
  id: string;
  title: string;
  client: string;
  budget: string;
  deadline: string;
  status: "pending" | "accepted" | "completed";
  description: string;
  category: string;
  submittedAt: string;
  implementerUsername?: string;
  assigneeApproved?: boolean | number | string;
  publisherId?: string | number;
  publisher_id?: string | number;
  acceptedBy?: string | number; 
  accepted_by?: string | number;
  requesterId?: string | number;
  requester_id?: string | number;
  applicantId?: string | number;
  applicant_id?: string | number;
  project_type?: "individual" | "group" | string;
  sharedDraftId?: string | number | null;
  roles?: Array<{
    roleId?: number | null;
    role?: string;
    status?: "open" | "filled" | "completed" | string;
    assignedUserId?: string | number | null;
    assignedUsername?: string | null;
  }>;
}

function normalizeApproval(value: unknown): boolean {
  return value === true || value === 1 || value === "1";
}

function isGroupRequest(request: Request | null | undefined): boolean {
  return String(request?.project_type ?? "").trim().toLowerCase() === "group";
}

function getGroupRoleProgress(request: Request) {
  const roles = Array.isArray(request.roles) ? request.roles : [];
  const total = roles.length;
  let open = 0;
  let filled = 0;
  let completed = 0;

  roles.forEach((roleEntry) => {
    const roleStatus = String(roleEntry.status ?? "").trim().toLowerCase();
    if (roleStatus === "completed") {
      completed += 1;
      return;
    }
    if (roleStatus === "filled") {
      filled += 1;
      return;
    }
    open += 1;
  });

  const completionPercent = total === 0 ? 0 : Math.round((completed / total) * 100);
  return { total, open, filled, completed, completionPercent };
}

function getGroupDashboardStatus(request: Request): Request["status"] {
  if (!isGroupRequest(request)) {
    return request.status;
  }
  const progress = getGroupRoleProgress(request);
  if (progress.total > 0 && progress.completed === progress.total) {
    return "completed";
  }
  if (progress.completed > 0 || progress.filled > 0) {
    return "accepted";
  }
  return "pending";
}

function getGroupDraftRoute(request: Request): string {
  const raw = String(request.sharedDraftId ?? "").trim();
  if (raw !== "" && /^\d+$/.test(raw)) {
    return `/in-progress/${raw}`;
  }
  return "/upload";
}

interface CurrentUser {
  userId: string;
  username: string;
  fullName: string;
}

export default function ProjectRequests() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [isCheckingAuth, setIsCheckingAuth] = React.useState(true);
  const [isAuthed, setIsAuthed] = React.useState(false);
  const [currentUser, setCurrentUser] = React.useState<CurrentUser | null>(null);
  const [currentUserSkills, setCurrentUserSkills] = React.useState<string[]>([]);
  const [projectDashboardTab, setProjectDashboardTab] = React.useState<"individual" | "group">("individual");
  const [individualStatusFilter, setIndividualStatusFilter] = React.useState<"all" | "pending" | "active" | "completed" | "public">("all");
  const [groupStatusFilter, setGroupStatusFilter] = React.useState<"all" | Request["status"]>(() => {
    if (typeof window === "undefined") {
      return "all";
    }
    const savedFilter = window.localStorage.getItem("group-dashboard-status-filter");
    if (savedFilter === "pending" || savedFilter === "accepted" || savedFilter === "completed" || savedFilter === "all") {
      return savedFilter;
    }
    return "all";
  });
  const [requests, setRequests] = React.useState<Request[]>([]);
  const [selectedRequest, setSelectedRequest] = React.useState<Request | null>(null);
  const [isDialogOpen, setIsDialogOpen] = React.useState(false);
  React.useEffect(() => {
    const checkAuth = async () => {
      try {
        const authResponse = await fetch("api/isauthed.php", { credentials: "include" });
        const authData = await authResponse.json();

        if (!authResponse.ok || !authData?.isAuthed) {
          navigate("/signin", { replace: true });
          return;
        }

        const profileResponse = await fetch("api/get_profile.php", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({}),
        });

        if (!profileResponse.ok) {
          navigate("/signin", { replace: true });
          return;
        }

        const profileData = await profileResponse.json();
        const userId =
          String(authData?.user_id ?? authData?.userId ?? "").trim() ||
          String(profileData?.user_id ?? profileData?.id ?? "").trim();
        const username = String(profileData?.username ?? "").trim();
        const fullName = `${String(profileData?.first_name ?? "").trim()} ${String(profileData?.last_name ?? "").trim()}`.trim();

        setCurrentUser({ userId, username, fullName });
        setIsAuthed(true);
      } catch {
        navigate("/signin", { replace: true });
      } finally {
        setIsCheckingAuth(false);
      }
    };

    checkAuth();
  }, [navigate]);

  React.useEffect(() => {
    if (isCheckingAuth || !isAuthed || !currentUser?.userId) {
      return;
    }

    fetch("api/getskills.php", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ userid: Number(currentUser.userId) }),
    })
      .then((res) => res.json())
      .then((data: unknown) => {
        if (Array.isArray(data)) {
          setCurrentUserSkills(data.map((s) => String(s ?? "").trim()).filter(Boolean));
          return;
        }
        setCurrentUserSkills([]);
      })
      .catch((err) => {
        console.error("Failed to load user skills", err);
        setCurrentUserSkills([]);
      });
  }, [isCheckingAuth, isAuthed, currentUser?.userId]);

  React.useEffect(() => {
    if (isCheckingAuth || !isAuthed) {
      return;
    }

    fetch("api/get_project_requests.php")
      .then((res) => res.json())
      .then((data: Request[]) => {
        if (Array.isArray(data)) {
          const normalized = data.map((row) => {
            const ext = row as Request & Record<string, unknown>;
            const fromApi = pickImplementerFromApiRow(ext);
            return {
              ...row,
              status: normalizeRequestStatus(row.status),
              assigneeApproved: normalizeApproval((row as Request & Record<string, unknown>).assigneeApproved),
              implementerUsername: fromApi ?? row.implementerUsername,
            };
          });
          setRequests(normalized);
        }
      })
      .catch((err) => {
        console.error("Failed to load project requests", err);
      });
  }, [isCheckingAuth, isAuthed]);

  React.useEffect(() => {
    setSelectedRequest((prev) => {
      if (!prev) return prev;
      const next = requests.find((r) => r.id === prev.id);
      return next ?? prev;
    });
  }, [requests]);

  // Deep-link: /requests?open=PROJECT_ID — auto-open the matching dialog
  React.useEffect(() => {
    const openId = searchParams.get("open");
    if (!openId || requests.length === 0) return;
    const target = requests.find((r) => r.id === openId);
    if (target) {
      setSelectedRequest(target);
      setIsDialogOpen(true);
    }
  }, [requests, searchParams]);

  const normalize = (value: unknown) => String(value ?? "").trim().toLowerCase();

  const budgetAmountLabel = (budget: string | undefined) =>
    String(budget ?? "").replace(/^\$\s*/, "").trim();

  const isPostedByCurrentUser = (request: Request) => {
    if (!currentUser) {
      return false;
    }

    const currentUserId = normalize(currentUser.userId);
    const publisherId = normalize(request.publisherId ?? request.publisher_id);
    if (publisherId !== "" && currentUserId !== "") {
      return publisherId === currentUserId;
    }

    const clientName = normalize(request.client);
    const username = normalize(currentUser.username);
    const fullName = normalize(currentUser.fullName);
    if (clientName === "") {
      return false;
    }
    if (username !== "" && clientName === username) {
      return true;
    }
    if (fullName !== "" && clientName === fullName) {
      return true;
    }
    return false;
  };

  const isImplementerForCurrentUser = (request: Request) => {
    if (!currentUser) {
      return false;
    }
    const impl = normalize(request.implementerUsername);
    if (impl === "") {
      return false;
    }
    const uname = normalize(currentUser.username);
    return uname !== "" && impl === uname;
  };

  const isRequestForCurrentUser = (request: Request) => {
    if (!currentUser) {
      return false;
    }

    if (isPostedByCurrentUser(request)) {
      return true;
    }

    if (isImplementerForCurrentUser(request)) {
      return true;
    }

    if (Array.isArray(request.roles)) {
      const currentUserId = normalize(currentUser.userId);
      const isAssignedToAnyRole = request.roles.some(
        (roleEntry) => normalize(roleEntry.assignedUserId) !== "" && normalize(roleEntry.assignedUserId) === currentUserId
      );
      if (isAssignedToAnyRole) {
        return true;
      }
    }

    const currentUserId = normalize(currentUser.userId);
    const participantIds = [
      request.acceptedBy,
      request.accepted_by,
      request.requesterId,
      request.requester_id,
      request.applicantId,
      request.applicant_id,
    ];

    return participantIds.some((id) => normalize(id) !== "" && normalize(id) === currentUserId);
  };

  const isAssigneeApproved = (request: Request) => normalizeApproval(request.assigneeApproved);
  const userHasSkillForRole = (roleName: string) =>
    currentUserSkills.some((skill) => normalize(skill) === normalize(roleName));
  const hasAppliedToAnyGroupRole = (request: Request) => {
    if (!currentUser || !Array.isArray(request.roles)) {
      return false;
    }
    const currentId = normalize(currentUser.userId);
    return request.roles.some((roleEntry) => normalize(roleEntry.assignedUserId) === currentId);
  };
  const getMyGroupRole = (request: Request) => {
    if (!currentUser || !Array.isArray(request.roles)) {
      return null;
    }
    const currentId = normalize(currentUser.userId);
    return request.roles.find((roleEntry) => normalize(roleEntry.assignedUserId) === currentId) ?? null;
  };

  const myRequests = requests.filter(isRequestForCurrentUser);
  const publicRequests = requests.filter((request) => request.status === "pending");
  const myIndividualRequests = myRequests.filter((request) => !isGroupRequest(request));
  const publicIndividualRequests = publicRequests.filter((request) => !isGroupRequest(request));
  const myGroupRequests = myRequests.filter((request) => isGroupRequest(request));
  const publicGroupRequests = publicRequests.filter((request) => isGroupRequest(request));
  const groupDashboardRequests = React.useMemo(() => {
    const deduped = new Map<string, Request>();
    [...myGroupRequests, ...publicGroupRequests].forEach((request) => {
      deduped.set(request.id, request);
    });
    return Array.from(deduped.values());
  }, [myGroupRequests, publicGroupRequests]);
  const filteredGroupDashboardRequests = React.useMemo(() => {
    if (groupStatusFilter === "all") {
      return groupDashboardRequests;
    }
    return groupDashboardRequests.filter((request) => getGroupDashboardStatus(request) === groupStatusFilter);
  }, [groupDashboardRequests, groupStatusFilter]);
  const filteredIndividualRequests = React.useMemo(() => {
    if (individualStatusFilter === "public") {
      return publicIndividualRequests;
    }
    if (individualStatusFilter === "all") {
      return myIndividualRequests;
    }
    if (individualStatusFilter === "active") {
      return myIndividualRequests.filter((request) => request.status === "accepted");
    }
    return myIndividualRequests.filter((request) => request.status === individualStatusFilter);
  }, [individualStatusFilter, myIndividualRequests, publicIndividualRequests]);

  React.useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    window.localStorage.setItem("group-dashboard-status-filter", groupStatusFilter);
  }, [groupStatusFilter]);

  const handleAcceptRequest = async (requestId: string, roleName?: string) => {
    try {
      const target = requests.find((r) => r.id === requestId);
      if (target && isPostedByCurrentUser(target)) {
        toast.error("You cannot accept your own project request");
        return;
      }
      if (target && isGroupRequest(target) && !roleName) {
        toast.error("Choose a role to apply for this group request.");
        return;
      }
      if (target && isGroupRequest(target) && roleName && !userHasSkillForRole(roleName)) {
        toast.error(`You cannot apply for "${roleName}" because it is not in your skills.`);
        return;
      }

      // Check if user is authenticated via backend
      const authResponse = await fetch("api/isauthed.php", { credentials: "include" });
      const authData = await authResponse.json();

      if (!authData.isAuthed) {
        toast.error("You must be logged in to accept a project request");
        navigate("/signin");
        return;
      }

      const isGroup = !!(target && isGroupRequest(target));
      const response = await fetch("api/accept_project_request.php", {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          project_id: requestId,
          ...(isGroup ? { action: "apply_role" } : {}),
          ...(roleName ? { role: roleName } : {}),
        }),
      });

      // Handle 401 Unauthorized
      if (response.status === 401) {
        toast.error("Your session has expired. Please log in again.");
        navigate("/signin");
        return;
      }

      if (!response.ok) {
        const errorData = await response.json();
        toast.error(errorData.error || "Failed to accept request");
        return;
      }

      const payload = await response.json().catch(() => ({} as Record<string, unknown>));
      const nextStatus =
        payload?.status === "pending" || payload?.status === "accepted" || payload?.status === "completed"
          ? payload.status
          : "accepted";

      const implName = (currentUser?.username ?? "").trim();
      const implUserId = (currentUser?.userId ?? "").trim();

      // Respect backend status for group requests:
      // they remain pending until every role has at least one applicant.
      setRequests(prevRequests =>
        prevRequests.map(req =>
          req.id === requestId
            ? {
                ...req,
                status: nextStatus as Request["status"],
                assigneeApproved: nextStatus === "accepted" ? false : req.assigneeApproved,
                acceptedBy: nextStatus === "accepted" ? (implUserId || req.acceptedBy) : req.acceptedBy,
                implementerUsername: nextStatus === "accepted" ? (implName || req.implementerUsername) : req.implementerUsername,
                roles:
                  roleName && Array.isArray(req.roles)
                    ? (() => {
                        let applied = false;
                        return req.roles.map((entry) => {
                          if (
                            !applied &&
                            String(entry.role ?? "").trim().toLowerCase() === roleName.trim().toLowerCase() &&
                            String(entry.status ?? "").trim().toLowerCase() === "open"
                          ) {
                            applied = true;
                            return {
                              ...entry,
                              status: "open",
                              assignedUserId: implUserId || entry.assignedUserId,
                              assignedUsername: implName || entry.assignedUsername,
                            };
                          }
                          return entry;
                        });
                      })()
                    : req.roles,
              }
            : req
        )
      );

      toast.success(
        typeof payload?.message === "string" ? payload.message : "Project request updated!"
      );

    } catch (error) {
      console.error("Error accepting request:", error);
      toast.error("An error occurred while accepting the request");
    }
  };

  const handleCompleteRequest = async (requestId: string) => {
    try {
      const targetRequest = requests.find((r) => r.id === requestId);
      if (!targetRequest) {
        toast.error("Project request not found.");
        return;
      }
      const authResponse = await fetch("api/isauthed.php", { credentials: "include" });
      const authData = await authResponse.json();

      if (!authData.isAuthed) {
        toast.error("You must be logged in to complete a project request");
        navigate("/signin");
        return;
      }

      const myGroupRole = isGroupRequest(targetRequest) ? getMyGroupRole(targetRequest) : null;
      const myGroupRoleStatus = String(myGroupRole?.status ?? "").trim().toLowerCase();
      if (isGroupRequest(targetRequest) && !myGroupRole) {
        toast.error("You are not assigned to a role on this group request.");
        return;
      }
      if (isGroupRequest(targetRequest) && myGroupRoleStatus === "completed") {
        toast.info("You already marked your role complete.");
        return;
      }

      const response = await fetch("api/accept_project_request.php", {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(
          isGroupRequest(targetRequest)
            ? {
                project_id: requestId,
                action: "complete_role",
                role: String(myGroupRole?.role ?? ""),
                role_id: Number(myGroupRole?.roleId ?? 0) || undefined,
              }
            : { project_id: requestId, action: "complete" }
        ),
      });

      if (response.status === 401) {
        toast.error("Your session has expired. Please log in again.");
        navigate("/signin");
        return;
      }

      if (!response.ok) {
        const errorData = await response.json();
        toast.error(errorData.error || "Failed to complete request");
        return;
      }

      const payload = await response.json().catch(() => ({} as Record<string, unknown>));
      const nextStatus =
        payload?.status === "pending" || payload?.status === "accepted" || payload?.status === "completed"
          ? payload.status
          : "accepted";
      const shouldAutoPublishGroupDraft = isGroupRequest(targetRequest) && nextStatus === "completed";

      setRequests((prevRequests) =>
        prevRequests.map((req) => {
          if (req.id !== requestId) {
            return req;
          }
          if (!isGroupRequest(req)) {
            return { ...req, status: "completed" as const };
          }
          const myRoleId = Number(myGroupRole?.roleId ?? 0);
          return {
            ...req,
            status: nextStatus as Request["status"],
            roles: (req.roles ?? []).map((entry) =>
              Number(entry.roleId ?? 0) === myRoleId ? { ...entry, status: "completed" } : entry
            ),
          };
        })
      );

      let autoPublished = false;
      if (shouldAutoPublishGroupDraft) {
        const sharedDraftId = Number(targetRequest.sharedDraftId ?? 0);
        if (sharedDraftId > 0) {
          const csrfResponse = await fetch("api/get_csrf_token.php", {
            method: "GET",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
          });

          const csrfData = await csrfResponse.json().catch(() => ({} as Record<string, unknown>));
          const csrfToken = String(csrfData?.csrfToken ?? "").trim();
          if (!csrfResponse.ok || csrfToken === "") {
            toast.error("All roles are complete, but failed to auto-publish: CSRF token error.");
          } else {
            const draftResponse = await fetch("api/get_in_progress.php", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              credentials: "include",
              body: JSON.stringify({ project_id: sharedDraftId, limit: 1 }),
            });

            const draftPayload = await draftResponse.json().catch(() => ([] as unknown[]));
            const draft = Array.isArray(draftPayload) ? draftPayload[0] as Record<string, unknown> | undefined : undefined;
            if (!draftResponse.ok || !draft) {
              toast.error("All roles are complete, but the shared draft could not be loaded for auto-publish.");
            } else {
              const publishResponse = await fetch("api/publish_project.php", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                credentials: "include",
                body: JSON.stringify({
                  csrf_token: csrfToken,
                  project_id: sharedDraftId,
                  post: 1,
                  title: String(draft.title ?? ""),
                  description: String(draft.description ?? ""),
                  category: String(draft.category ?? ""),
                  tags: String(draft.tags ?? ""),
                  materials_used: String(draft.materials_used ?? ""),
                  software_used: String(draft.software_used ?? ""),
                  difficulty_level: String(draft.difficulty ?? ""),
                  allow_comments: Number(draft.allow_comments ?? 1) ? "1" : "0",
                  enable_downloads: Number(draft.enable_downloads ?? 0) ? "1" : "0",
                  images: Array.isArray(draft.images) ? draft.images : [],
                }),
              });

              const publishPayload = await publishResponse.json().catch(() => ({} as Record<string, unknown>));
              if (!publishResponse.ok || publishPayload?.error || !publishPayload?.success) {
                const publishMessage =
                  typeof publishPayload?.error === "string" && publishPayload.error.trim() !== ""
                    ? publishPayload.error
                    : "publish failed";
                toast.error(`All roles are complete, but auto-publish failed: ${publishMessage}`);
              } else {
                autoPublished = true;
              }
            }
          }
        } else {
          toast.error("All roles are complete, but no shared draft was found to auto-publish.");
        }
      }

      toast.success(
        autoPublished
          ? "All roles are complete and the shared project was published automatically!"
          : typeof payload?.message === "string"
          ? payload.message
          : isGroupRequest(targetRequest)
            ? "Role marked as complete!"
            : "Project marked as completed!"
      );
    } catch (error) {
      console.error("Error completing request:", error);
      toast.error("An error occurred while completing the request");
    }
  };

  const handleViewProject = async (requestTitle: string) => {
    try {
      const res = await fetch("api/get_projects.php", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });

      if (!res.ok) {
        throw new Error("Failed to load projects");
      }

      const projects = (await res.json()) as Array<{ id?: string; title?: string }>;
      if (!Array.isArray(projects)) {
        throw new Error("Invalid projects response");
      }

      const match = projects.find(
        (p) => (p.title ?? "").trim() === requestTitle.trim()
      );

      if (!match?.id) {
        toast.error("Could not find the uploaded project for this request yet.");
        return;
      }

      navigate(`/project/${match.id}`);
    } catch (error) {
      console.error("Error viewing project:", error);
      toast.error("Failed to open project");
    }
  };

  const handlePosterAllowImplementer = async (requestId: string) => {
    try {
      const req = requests.find((r) => r.id === requestId);
      if (!req || !isPostedByCurrentUser(req)) {
        toast.error("Only the request owner can allow completion.");
        return;
      }

      const response = await fetch("api/accept_project_request.php", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ project_id: requestId, action: "allow" }),
      });

      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        toast.error(typeof payload?.error === "string" ? payload.error : "Failed to allow completion");
        return;
      }

      setRequests((prev) =>
        prev.map((r) =>
          r.id === requestId ? { ...r, assigneeApproved: true, status: "accepted" as const } : r
        )
      );
      setSelectedRequest((prev) =>
        prev?.id === requestId ? { ...prev, assigneeApproved: true, status: "accepted" as const } : prev
      );
      toast.success("Assignee can now upload and complete this request.");
    } catch (error) {
      console.error("Error allowing assignee:", error);
      toast.error("Failed to allow completion");
    }
  };

  const handlePosterRevokeAssignee = async (requestId: string) => {
    try {
      const req = requests.find((r) => r.id === requestId);
      if (!req || !isPostedByCurrentUser(req)) {
        toast.error("Only the request owner can remove the assignee.");
        return;
      }

      const authResponse = await fetch("api/isauthed.php", { credentials: "include" });
      const authData = await authResponse.json();

      if (!authData.isAuthed) {
        toast.error("You must be logged in");
        navigate("/signin");
        return;
      }

      const response = await fetch("api/accept_project_request.php", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ project_id: requestId, action: "reopen" }),
      });

      if (response.status === 401) {
        toast.error("Your session has expired. Please log in again.");
        navigate("/signin");
        return;
      }

      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        toast.error(
          typeof payload?.error === "string" ? payload.error : "Could not set this request back to pending."
        );
        return;
      }

      if (payload?.status === "pending") {
        setRequests((prev) =>
          prev.map((r) =>
            r.id === requestId
              ? {
                  ...r,
                  status: "pending" as const,
                  assigneeApproved: false,
                  acceptedBy: undefined,
                  implementerUsername: undefined,
                }
              : r
          )
        );
        setSelectedRequest((prev) =>
          prev?.id === requestId
            ? {
                ...prev,
                status: "pending" as const,
                assigneeApproved: false,
                acceptedBy: undefined,
                implementerUsername: undefined,
              }
            : prev
        );
        toast.success(
          typeof payload?.message === "string" ? payload.message : "Request is pending again."
        );
        return;
      }

      toast.error("Unexpected response from server.");
    } catch (error) {
      console.error("Error revoking assignee:", error);
      toast.error("Something went wrong.");
    }
  };

  // Creates (or re-opens) a group chat with all members of an accepted project request.
  // Called from "Open Group Chat" button on accepted requests.
  const handleOpenGroupChat = async (request: Request) => {
    try {
      // Gather participant IDs: publisher + all assigned role members
      const publisherId = String(request.publisherId ?? request.publisher_id ?? "").trim();

      const participantSet = new Set<number>();

      if (publisherId) {
        const pid = Number(publisherId);
        if (!isNaN(pid) && pid > 0) participantSet.add(pid);
      }

      // For group requests, collect every filled/completed role's assignedUserId
      if (isGroupRequest(request) && Array.isArray(request.roles)) {
        for (const role of request.roles) {
          const uid = Number(role.assignedUserId ?? "");
          const st  = String(role.status ?? "").trim().toLowerCase();
          if (!isNaN(uid) && uid > 0 && (st === "filled" || st === "completed")) {
            participantSet.add(uid);
          }
        }
      } else {
        // Individual request — fall back to single implementer
        const implementerId = String(request.acceptedBy ?? request.accepted_by ?? "").trim();
        const iid = Number(implementerId);
        if (!isNaN(iid) && iid > 0) participantSet.add(iid);
      }

      const participants = Array.from(participantSet);

      if (participants.length < 2) {
        navigate(`/messages?compose=${request.implementerUsername ?? request.client}`);
        return;
      }

      // Get CSRF token
      const csrfRes = await fetch("api/get_csrf_token.php", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const csrfData = await csrfRes.json();
      const csrf_token = csrfData.csrfToken ?? csrfData.csrf_token ?? "";

      const groupName = request.title.trim() || "Project Chat";

      const res = await fetch("api/create_group_conversation.php", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ csrf_token, group_name: groupName, participants, project_id: Number(request.id) }),
      });
      const data = await res.json();

      if (data.conversation_id) {
        // Navigate to the group chat (new or existing)
        navigate(`/messages?group_conversation_id=${data.conversation_id}`);
      } else if (res.status === 409) {
        // Group already exists — navigate directly if we got back the existing ID
        if (data.conversation_id) {
          navigate(`/messages?group_conversation_id=${data.conversation_id}`);
        } else {
          toast.info("Group chat already exists — opening it now.");
          navigate("/messages");
        }
      } else {
        toast.error(data.error || "Could not open group chat");
      }
    } catch {
      toast.error("Failed to open group chat");
    }
  };

  const handleDeleteRequest = async (requestId: string) => {
    const req = requests.find((r) => r.id === requestId);
    if (!req || !isPostedByCurrentUser(req)) {
      toast.error("Only the request owner can delete this request.");
      return;
    }

    if (!window.confirm("Delete this request permanently? This cannot be undone.")) {
      return;
    }

    try {
      const authResponse = await fetch("api/isauthed.php", { credentials: "include" });
      const authData = await authResponse.json();

      if (!authData.isAuthed) {
        toast.error("You must be logged in");
        navigate("/signin");
        return;
      }

      const csrfRes = await fetch("api/get_csrf_token.php", {
        method: "GET",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
      });
      const csrfData = await csrfRes.json();
      const csrfToken = csrfData.csrfToken;
      if (!csrfRes.ok || !csrfToken) {
        toast.error("Failed to get CSRF token");
        return;
      }

      const response = await fetch("api/delete_project_request.php", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ project_id: requestId, csrf_token: csrfToken }),
      });

      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        toast.error(
          typeof payload?.error === "string" ? payload.error : "Failed to delete request"
        );
        return;
      }

      setRequests((prev) => prev.filter((r) => r.id !== requestId));
      setSelectedRequest((prev) => (prev?.id === requestId ? null : prev));
      setIsDialogOpen(false);
      toast.success("Request deleted.");
    } catch (error) {
      console.error("Error deleting request:", error);
      toast.error("Failed to delete request");
    }
  };

  const handlePosterReviewGroupApplicant = async (
    requestId: string,
    roleName: string,
    roleId: number,
    action: "approve_role" | "reject_role"
  ) => {
    try {
      const req = requests.find((r) => r.id === requestId);
      if (!req || !isPostedByCurrentUser(req)) {
        toast.error("Only the request owner can review applicants.");
        return;
      }

      const response = await fetch("api/accept_project_request.php", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          project_id: requestId,
          action,
          role: roleName,
          role_id: roleId,
        }),
      });

      const payload = await response.json().catch(() => ({} as Record<string, unknown>));
      if (!response.ok) {
        toast.error(typeof payload?.error === "string" ? payload.error : "Failed to review applicant");
        return;
      }

      const nextStatus =
        payload?.status === "pending" || payload?.status === "accepted" || payload?.status === "completed"
          ? payload.status
          : "pending";

      setRequests((prev) =>
        prev.map((request) =>
          request.id !== requestId
            ? request
            : {
                ...request,
                status: nextStatus as Request["status"],
                roles: (request.roles ?? []).map((entry) => {
                  if (Number(entry.roleId ?? 0) !== roleId) {
                    return entry;
                  }
                  if (action === "approve_role") {
                    return { ...entry, status: "filled" };
                  }
                  return { ...entry, status: "open", assignedUserId: null, assignedUsername: null };
                }),
              }
        )
      );

      toast.success(typeof payload?.message === "string" ? payload.message : "Applicant review saved.");
    } catch (error) {
      console.error("Error reviewing group applicant:", error);
      toast.error("Failed to review applicant");
    }
  };

  const getStatusBadge = (status: Request["status"]) => {
    const statusStyles = {
      pending: "bg-[#efe6b4] text-[#8c4a00] hover:bg-[#efe6b4]",
      accepted: "bg-[#efe6b4] text-[#8c4a00] hover:bg-[#efe6b4]",
      completed: "bg-[#efe6b4] text-[#8c4a00] hover:bg-[#efe6b4]",
    };

    const labels = {
      pending: "Pending Review",
      accepted: "In Progress",
      completed: "Completed",
    };

    return (
      <Badge className={statusStyles[status]}>
        {labels[status]}
      </Badge>
    );
  };

  const getStatusLabel = (status: Request["status"]) => {
    const labels = {
      pending: "Pending Review",
      accepted: "In Progress",
      completed: "Completed",
    };
    return labels[status];
  };

  const RequestCard = ({
    request,
    onAcceptRequest,
    onCompleteRequest,
    onDeleteRequest,
    onOpenGroupChat,
    canAcceptPending = true,
    isPoster = false,
    isAssignedImplementer = false,
    showGroupProgress = false,
    statusOverride,
  }: {
    request: Request;
    onAcceptRequest: (id: string) => void;
    onCompleteRequest: (id: string) => Promise<void>;
    onDeleteRequest: (id: string) => void | Promise<void>;
    onOpenGroupChat?: (request: Request) => void;
    canAcceptPending?: boolean;
    isPoster?: boolean;
    isAssignedImplementer?: boolean;
    showGroupProgress?: boolean;
    statusOverride?: Request["status"];
  }) => {
    const myGroupRole = isGroupRequest(request) ? getMyGroupRole(request) : null;
    const myGroupRoleStatus = String(myGroupRole?.status ?? "").trim().toLowerCase();
    const isAcceptedGroupMember = !!myGroupRole && (myGroupRoleStatus === "filled" || myGroupRoleStatus === "completed");
    const isRoleCompleted = myGroupRoleStatus === "completed";
    const effectiveStatus = statusOverride ?? request.status;
    const roleProgress = isGroupRequest(request) ? getGroupRoleProgress(request) : null;

    const handleCardClick = (e: React.MouseEvent) => {
      // Prevent opening dialog if clicking on the button
      if ((e.target as HTMLElement).closest('button')) {
        return;
      }
      setSelectedRequest(request);
      setIsDialogOpen(true);
    };

    return (
      <div
        className="bg-white rounded-lg p-4 sm:p-6 shadow-sm hover:shadow-md transition-shadow cursor-pointer"
        onClick={handleCardClick}
      >
        <div className="mb-4">
          <h3 className="text-lg sm:text-xl mb-2 break-words">{request.title}</h3>
          <p className="text-sm text-gray-600 break-words">from {request.client}</p>
          <div className="mt-2">{getStatusBadge(effectiveStatus)}</div>
        </div>

        {showGroupProgress && roleProgress && (
          <div className="mb-4 rounded-lg border border-gray-200 bg-[#faf9f6] p-3">
            <div className="mb-2 flex items-center justify-between text-xs text-gray-600">
              <span>Role progress</span>
              <span>{roleProgress.completed}/{roleProgress.total} completed</span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-gray-200">
              <div
                className="h-full rounded-full bg-[var(--color-procreate-accent)] transition-all"
                style={{ width: `${roleProgress.completionPercent}%` }}
              />
            </div>
            <div className="mt-2 flex flex-wrap gap-2 text-xs text-gray-600">
              <span>Open: {roleProgress.open}</span>
              <span>Filled: {roleProgress.filled}</span>
              <span>Completed: {roleProgress.completed}</span>
            </div>
          </div>
        )}

        <p className="text-gray-700 mb-4 break-words">{request.description}</p>

        <div className="flex flex-wrap gap-3 sm:gap-4 mb-4 pb-4 border-b text-sm">
          <div className="flex items-center gap-2 text-gray-600">
            <DollarSign className="w-4 h-4 flex-shrink-0" />
            <span className="break-words">{budgetAmountLabel(request.budget)}</span>
          </div>
          <div className="flex items-center gap-2 text-gray-600">
            <Calendar className="w-4 h-4 flex-shrink-0" />
            <span>{request.deadline}</span>
          </div>
          <div className="flex items-center gap-2 text-gray-600">
            <Clock className="w-4 h-4 flex-shrink-0" />
            <span>{request.submittedAt}</span>
          </div>
        </div>

        <div className="space-y-3" onClick={(e) => e.stopPropagation()}>
          <div className="flex flex-col sm:flex-row gap-3">
            {request.status === "pending" && canAcceptPending && (
              isGroupRequest(request) ? (
                <p className="w-full text-center text-sm text-gray-500 py-2">
                  Open this request to apply for a specific role.
                </p>
              ) : (
                <Button className="w-full sm:w-auto" onClick={() => onAcceptRequest(request.id)}>
                  <CheckCircle className="w-4 h-4 mr-2" />
                  Accept Request
                </Button>
              )
            )}
            {request.status === "pending" && !canAcceptPending && (
              <p className="w-full text-center text-sm text-gray-500 py-2">
                You posted this request — someone else can accept it here.
              </p>
            )}
            {(request.status === "accepted" && (isAssignedImplementer || isAcceptedGroupMember)) && (
              <>
                <Button
                  className="flex-1"
                  onClick={() => onOpenGroupChat ? onOpenGroupChat(request) : navigate(`/messages?compose=${request.client}`)}
                >
                  <Users className="w-4 h-4 mr-2" />
                  Group Chat
                </Button>
                {isGroupRequest(request) ? (
                  <>
                    <Button asChild variant="outline" className="flex-1">
                      <Link to={getGroupDraftRoute(request)}>Upload Project</Link>
                    </Button>
                    {isRoleCompleted ? (
                      <p className="w-full text-center text-sm text-gray-500 py-2">
                        You marked your role as complete.
                      </p>
                    ) : (
                      <Button
                        variant="outline"
                        className="flex-1"
                        onClick={() => onCompleteRequest(request.id)}
                      >
                        Complete
                      </Button>
                    )}
                  </>
                ) : (
                  isAssigneeApproved(request) ? (
                    <>
                      <Button asChild variant="outline" className="flex-1">
                        <Link to="/upload">Upload Project</Link>
                      </Button>
                      <Button
                        variant="outline"
                        className="flex-1"
                        onClick={() => onCompleteRequest(request.id)}
                      >
                        Complete
                      </Button>
                    </>
                  ) : (
                    <p className="w-full text-center text-sm text-gray-500 py-2">
                      Waiting for the client to allow you to upload and complete this request.
                    </p>
                  )
                )}
              </>
            )}
            {request.status === "accepted" && isPoster && (
              <Button
                className="w-full"
                onClick={() => onOpenGroupChat ? onOpenGroupChat(request) : navigate("/messages")}
              >
                <Users className="w-4 h-4 mr-2" />
                Group Chat
              </Button>
            )}
            {request.status === "completed" && (
              <Button
                variant="outline"
                className="w-full"
                onClick={() => handleViewProject(request.title)}
              >
                View Project
              </Button>
            )}
          </div>
          {isPoster && (
            <Button
              type="button"
              variant="outline"
              className="w-full border-red-200 text-red-700 hover:bg-red-50 hover:text-red-800"
              onClick={() => onDeleteRequest(request.id)}
            >
              <Trash2 className="w-4 h-4 mr-2" />
              Delete request
            </Button>
          )}
        </div>
      </div>
    );
  };

  if (isCheckingAuth || !isAuthed) {
    return null;
  }

  return (
    <div className="min-h-screen bg-[#faf9f6] overflow-x-hidden">
      <Navbar isAuthenticated={true} />

      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl mb-2 break-words">Project Requests</h1>
            <p className="text-[#1c110a] text-sm sm:text-base break-words">
              Manage commission requests and freelance opportunities
            </p>
          </div>
          <Button asChild className="w-full sm:w-auto">
            <Link to="/post-request" className="flex items-center justify-center gap-2">
              <Plus className="w-4 h-4" />
              Post Request
            </Link>
          </Button>
        </div>

        {/* Dashboard Tabs */}
        <Tabs
          value={projectDashboardTab}
          onValueChange={(value) => setProjectDashboardTab(value as "individual" | "group")}
          className="space-y-6"
        >
          <TabsList className="w-full grid grid-cols-2 h-auto gap-1 rounded-xl border border-gray-200/80 bg-white/90 p-1 shadow-sm">
            <TabsTrigger
              value="individual"
              className="text-xs sm:text-sm px-2 sm:px-4 py-2 text-[var(--color-procreate-primary)] data-[state=active]:bg-[var(--color-procreate-accent)] data-[state=active]:text-white data-[state=active]:shadow-sm"
            >
              Individual Requests
            </TabsTrigger>
            <TabsTrigger
              value="group"
              className="text-xs sm:text-sm px-2 sm:px-4 py-2 text-[var(--color-procreate-primary)] data-[state=active]:bg-[var(--color-procreate-accent)] data-[state=active]:text-white data-[state=active]:shadow-sm"
            >
              Group Projects Dashboard
            </TabsTrigger>
          </TabsList>

          <TabsContent value="individual" className="space-y-4">
            <div className="rounded-xl border border-gray-200/80 bg-white p-4 shadow-sm">
              <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <h2 className="text-lg text-[#1c110a]">Individual Requests</h2>
                <p className="text-sm text-gray-600">
                  {filteredIndividualRequests.length} requests shown
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                {(
                  [
                    {
                      value: "all",
                      label: "My Requests",
                    },
                    {
                      value: "pending",
                      label: "Pending",
                    },
                    {
                      value: "active",
                      label: "In Progress",
                    },
                    {
                      value: "completed",
                      label: "Completed",
                    },
                    {
                      value: "public",
                      label: "Public Requests",
                    },
                  ] as const
                ).map(({ value, label }) => (
                  <Button
                    key={value}
                    type="button"
                    size="sm"
                    variant={individualStatusFilter === value ? "default" : "outline"}
                    onClick={() => setIndividualStatusFilter(value)}
                  >
                    {label}
                  </Button>
                ))}
              </div>
            </div>

            {individualStatusFilter === "all" && (
              <div className="space-y-4">
                {myIndividualRequests.map((request) => (
                  <RequestCard
                    key={request.id}
                    request={request}
                    onAcceptRequest={handleAcceptRequest}
                    onCompleteRequest={handleCompleteRequest}
                    onDeleteRequest={handleDeleteRequest}
                    onOpenGroupChat={handleOpenGroupChat}
                    canAcceptPending={!isPostedByCurrentUser(request)}
                    isPoster={isPostedByCurrentUser(request)}
                    isAssignedImplementer={isImplementerForCurrentUser(request)}
                  />
                ))}
              </div>
            )}

            {individualStatusFilter === "pending" && (
              <div className="space-y-4">
                {myIndividualRequests
                  .filter((r) => r.status === "pending")
                  .map((request) => (
                    <RequestCard
                      key={request.id}
                      request={request}
                      onAcceptRequest={handleAcceptRequest}
                      onCompleteRequest={handleCompleteRequest}
                      onDeleteRequest={handleDeleteRequest}
                      onOpenGroupChat={handleOpenGroupChat}
                      canAcceptPending={!isPostedByCurrentUser(request)}
                      isPoster={isPostedByCurrentUser(request)}
                      isAssignedImplementer={isImplementerForCurrentUser(request)}
                    />
                  ))}
              </div>
            )}

            {individualStatusFilter === "active" && (
              <div className="space-y-4">
                {myIndividualRequests
                  .filter((r) => r.status === "accepted")
                  .map((request) => (
                    <RequestCard
                      key={request.id}
                      request={request}
                      onAcceptRequest={handleAcceptRequest}
                      onCompleteRequest={handleCompleteRequest}
                      onDeleteRequest={handleDeleteRequest}
                      onOpenGroupChat={handleOpenGroupChat}
                      canAcceptPending={!isPostedByCurrentUser(request)}
                      isPoster={isPostedByCurrentUser(request)}
                      isAssignedImplementer={isImplementerForCurrentUser(request)}
                    />
                  ))}
              </div>
            )}

            {individualStatusFilter === "completed" && (
              <div className="space-y-4">
                {myIndividualRequests
                  .filter((r) => r.status === "completed")
                  .map((request) => (
                    <RequestCard
                      key={request.id}
                      request={request}
                      onAcceptRequest={handleAcceptRequest}
                      onCompleteRequest={handleCompleteRequest}
                      onDeleteRequest={handleDeleteRequest}
                      onOpenGroupChat={handleOpenGroupChat}
                      canAcceptPending={!isPostedByCurrentUser(request)}
                      isPoster={isPostedByCurrentUser(request)}
                      isAssignedImplementer={isImplementerForCurrentUser(request)}
                    />
                  ))}
              </div>
            )}

            {individualStatusFilter === "public" && (
              <div className="space-y-4">
                {publicIndividualRequests.map((request) => (
                  <RequestCard
                    key={request.id}
                    request={request}
                    onAcceptRequest={handleAcceptRequest}
                    onCompleteRequest={handleCompleteRequest}
                    onDeleteRequest={handleDeleteRequest}
                    onOpenGroupChat={handleOpenGroupChat}
                    canAcceptPending={!isPostedByCurrentUser(request)}
                    isPoster={isPostedByCurrentUser(request)}
                    isAssignedImplementer={isImplementerForCurrentUser(request)}
                  />
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="group" className="space-y-4">
            <div className="rounded-xl border border-gray-200/80 bg-white p-4 shadow-sm">
              <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <h2 className="text-lg text-[#1c110a]">Group Project Progress</h2>
                <p className="text-sm text-gray-600">
                  {filteredGroupDashboardRequests.length} group projects shown
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                {(["all", "pending", "accepted", "completed"] as const).map((statusValue) => (
                  <Button
                    key={statusValue}
                    type="button"
                    size="sm"
                    variant={groupStatusFilter === statusValue ? "default" : "outline"}
                    onClick={() => setGroupStatusFilter(statusValue)}
                  >
                    {statusValue === "all" ? "All Statuses" : getStatusLabel(statusValue)}
                  </Button>
                ))}
              </div>
            </div>

            {filteredGroupDashboardRequests.map((request) => (
              <RequestCard
                key={request.id}
                request={request}
                onAcceptRequest={handleAcceptRequest}
                onCompleteRequest={handleCompleteRequest}
                onDeleteRequest={handleDeleteRequest}
                onOpenGroupChat={handleOpenGroupChat}
                canAcceptPending={!isPostedByCurrentUser(request)}
                isPoster={isPostedByCurrentUser(request)}
                isAssignedImplementer={isImplementerForCurrentUser(request)}
                showGroupProgress={true}
                statusOverride={getGroupDashboardStatus(request)}
              />
            ))}
          </TabsContent>
        </Tabs>

        {/* Empty State */}
        {myIndividualRequests.length === 0 && publicIndividualRequests.length === 0 && groupDashboardRequests.length === 0 && (
          <div className="bg-white rounded-lg p-12 text-center">
            <div className="w-16 h-16 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <MessageSquare className="w-8 h-8 text-purple-600" />
            </div>
            <h3 className="text-xl mb-2">No project requests yet</h3>
            <p className="text-gray-600 mb-6">
              Enable freelance work in your profile to start receiving project requests
            </p>
            <Link to="/profile/settings">
              <Button>Update Profile Settings</Button>
            </Link>
          </div>
        )}
      </div>

      {/* Project Details Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={(open) => {
          setIsDialogOpen(open);
          if (!open && searchParams.has("open")) {
            setSearchParams((prev) => {
              const next = new URLSearchParams(prev);
              next.delete("open");
              return next;
            }, { replace: true });
          }
        }}>
        <DialogContent className="w-[99vw] max-w-[calc(100vw-1rem)] sm:max-w-[1400px] lg:max-w-[1700px] max-h-[98vh] overflow-y-auto bg-white">
          <DialogHeader>
            <DialogTitle className="text-2xl text-[#1c110a]">{selectedRequest?.title}</DialogTitle>
          </DialogHeader>
          
          <div className="grid grid-cols-1 lg:grid-cols-[3fr_1fr] gap-8 mt-6">
            {/* Left side - Description */}
            <div className="space-y-6 min-w-0">
              <div>
                <h3 className="text-lg font-semibold text-[#1c110a] mb-3">Project Description</h3>
                <div className="flex items-start gap-3 p-4 bg-[#faf9f6] rounded-lg">
                  <MessageSquare className="w-5 h-5 text-[#c2350a] flex-shrink-0 mt-0.5" />
                  <div className="min-w-0">
                    <p className="text-sm text-gray-600">Description</p>
                    <p className="font-medium text-[#1c110a] leading-relaxed whitespace-pre-wrap break-words">
                      {selectedRequest?.description}
                    </p>
                  </div>
                </div>
              </div>

              {(selectedRequest?.status === "accepted" || selectedRequest?.status === "completed") && !isGroupRequest(selectedRequest) && (
                <div>
                  <h3 className="text-lg font-semibold text-[#1c110a] mb-3">Assigned creator</h3>
                  <div className="flex flex-col gap-3 rounded-lg border border-gray-100 bg-[#faf9f6] p-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0 flex-1">
                      {(selectedRequest.implementerUsername ?? "").trim() ? (
                        <Link
                          to={`/profile/${encodeURIComponent((selectedRequest.implementerUsername ?? "").trim())}`}
                          className="inline-block font-medium text-[var(--color-procreate-accent)] hover:underline break-all"
                          onClick={(e) => e.stopPropagation()}
                        >
                          @{(selectedRequest.implementerUsername ?? "").trim()}
                        </Link>
                      ) : (
                        <p className="text-sm text-gray-600">
                          Assignee username is not available yet.
                        </p>
                      )}
                      {currentUser &&
                        normalize(currentUser.username) ===
                          normalize(selectedRequest.implementerUsername) &&
                        !isPostedByCurrentUser(selectedRequest) && (
                          <p className="mt-2 text-xs text-gray-500">You are assigned to this request.</p>
                        )}
                    </div>
                    {isPostedByCurrentUser(selectedRequest) &&
                      (selectedRequest.implementerUsername ?? "").trim() !== "" && (
                        <div className="flex flex-shrink-0 flex-wrap items-center justify-end gap-2">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="border-[var(--color-procreate-secondary)] text-[var(--color-procreate-primary)]"
                            disabled={normalizeApproval(selectedRequest?.assigneeApproved)}
                            onClick={() =>
                              selectedRequest?.id &&
                              handlePosterAllowImplementer(selectedRequest.id)
                            }
                          >
                            {normalizeApproval(selectedRequest?.assigneeApproved)
                              ? "Allowed"
                              : "Allow to complete"}
                          </Button>
                          <Button
                            type="button"
                            variant="destructive"
                            size="sm"
                            onClick={() =>
                              selectedRequest?.id &&
                              handlePosterRevokeAssignee(selectedRequest.id)
                            }
                          >
                            Remove assignee
                          </Button>
                        </div>
                      )}
                  </div>
                </div>
              )}

              {selectedRequest && isGroupRequest(selectedRequest) && (
                <div>
                  <h3 className="text-lg font-semibold text-[#1c110a] mb-3">Assigned creators</h3>
                  <div className="rounded-lg border border-gray-100 bg-[#faf9f6] p-4 space-y-3">
                    {(selectedRequest.roles ?? []).length === 0 ? (
                      <p className="text-sm text-gray-600">No role applications yet.</p>
                    ) : (
                      selectedRequest.roles?.map((roleEntry, idx) => {
                        const roleName = String(roleEntry.role ?? "").trim() || "Unspecified role";
                        const assignedUsername = String(roleEntry.assignedUsername ?? "").trim();
                        const roleStatus = String(roleEntry.status ?? "").trim().toLowerCase();
                        const isFilled = roleStatus === "filled" || roleStatus === "completed";
                        const hasApplicant = assignedUsername !== "";
                        const canApply =
                          !isPostedByCurrentUser(selectedRequest) &&
                          (selectedRequest.status === "pending" || selectedRequest.status === "accepted") &&
                          !isFilled &&
                          !hasApplicant &&
                          !hasAppliedToAnyGroupRole(selectedRequest);
                        const hasSkill = userHasSkillForRole(roleName);
                        const canPosterReview =
                          isPostedByCurrentUser(selectedRequest) &&
                          !isFilled &&
                          hasApplicant &&
                          Number(roleEntry.roleId ?? 0) > 0;

                        return (
                          <div
                            key={`${selectedRequest.id}-role-${idx}`}
                            className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-gray-200 last:border-b-0 pb-3 last:pb-0"
                          >
                            <div className="min-w-0">
                              <p className="text-sm text-gray-600">Role</p>
                              <p className="font-medium text-[#1c110a] break-words">{roleName}</p>
                            </div>
                            <div className="min-w-0 text-left sm:text-right">
                              <p className="text-sm text-gray-600">Creator</p>
                              {isFilled && assignedUsername !== "" ? (
                                <Link
                                  to={`/profile/${encodeURIComponent(assignedUsername)}`}
                                  className="inline-block font-medium text-[var(--color-procreate-accent)] hover:underline break-all"
                                >
                                  @{assignedUsername}
                                </Link>
                              ) : hasApplicant ? (
                                <div className="space-y-1">
                                  <Link
                                    to={`/profile/${encodeURIComponent(assignedUsername)}`}
                                    className="inline-block font-medium text-[var(--color-procreate-accent)] hover:underline break-all"
                                  >
                                    @{assignedUsername}
                                  </Link>
                                  <p className="text-xs text-gray-500">Pending owner approval</p>
                                </div>
                              ) : (
                                <p className="font-medium text-gray-500">Waiting for applicant</p>
                              )}
                              {canApply && (
                                <Button
                                  type="button"
                                  size="sm"
                                  className="mt-2"
                                  disabled={!hasSkill}
                                  onClick={() =>
                                    selectedRequest?.id && handleAcceptRequest(selectedRequest.id, roleName)
                                  }
                                >
                                  Apply for this role
                                </Button>
                              )}
                              {canApply && !hasSkill && (
                                <p className="mt-1 text-xs text-red-600">
                                  Missing required skill for this role.
                                </p>
                              )}
                              {canPosterReview && (
                                <div className="mt-2 flex flex-wrap gap-2 sm:justify-end">
                                  <Button
                                    type="button"
                                    size="sm"
                                    variant="outline"
                                    onClick={() =>
                                      selectedRequest?.id &&
                                      handlePosterReviewGroupApplicant(
                                        selectedRequest.id,
                                        roleName,
                                        Number(roleEntry.roleId),
                                        "approve_role"
                                      )
                                    }
                                  >
                                    Accept user
                                  </Button>
                                  <Button
                                    type="button"
                                    size="sm"
                                    variant="destructive"
                                    onClick={() =>
                                      selectedRequest?.id &&
                                      handlePosterReviewGroupApplicant(
                                        selectedRequest.id,
                                        roleName,
                                        Number(roleEntry.roleId),
                                        "reject_role"
                                      )
                                    }
                                  >
                                    Reject user
                                  </Button>
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              )}
            </div>
            
            {/* Right side - Project Information */}
            <div className="space-y-6 min-w-0">
              <h3 className="text-lg font-semibold text-[#1c110a] mb-4">Project Information</h3>
              
              <div className="space-y-4">
                {selectedRequest && (
                  <div className="flex items-center gap-3 p-4 bg-[#faf9f6] rounded-lg">
                    <CheckCircle className="w-5 h-5 text-[#c2350a] flex-shrink-0" />
                    <div>
                      <p className="text-sm text-gray-600">Current Status</p>
                      <div className="mt-1">{getStatusBadge(selectedRequest.status)}</div>
                    </div>
                  </div>
                )}

                <div className="flex items-center gap-3 p-4 bg-[#faf9f6] rounded-lg">
                  <User className="w-5 h-5 text-[#c2350a] flex-shrink-0" />
                  <div>
                    <p className="text-sm text-gray-600">Requester</p>
                    <p className="font-medium text-[#1c110a]">{selectedRequest?.client}</p>
                  </div>
                </div>
                
                <div className="flex items-center gap-3 p-4 bg-[#faf9f6] rounded-lg">
                  <Clock className="w-5 h-5 text-[#c2350a] flex-shrink-0" />
                  <div>
                    <p className="text-sm text-gray-600">Date Requested</p>
                    <p className="font-medium text-[#1c110a]">{selectedRequest?.submittedAt}</p>
                  </div>
                </div>
                
                <div className="flex items-center gap-3 p-4 bg-[#faf9f6] rounded-lg">
                  <Tag className="w-5 h-5 text-[#c2350a] flex-shrink-0" />
                  <div>
                    <p className="text-sm text-gray-600">Category</p>
                    <p className="font-medium text-[#1c110a]">{selectedRequest?.category}</p>
                  </div>
                </div>
                
                <div className="flex items-center gap-3 p-4 bg-[#faf9f6] rounded-lg">
                  <DollarSign className="w-5 h-5 text-[#c2350a] flex-shrink-0" />
                  <div>
                    <p className="text-sm text-gray-600">Budget</p>
                    <p className="font-medium text-[#1c110a]">{budgetAmountLabel(selectedRequest?.budget)}</p>
                  </div>
                </div>
                
                <div className="flex items-center gap-3 p-4 bg-[#faf9f6] rounded-lg">
                  <Calendar className="w-5 h-5 text-[#c2350a] flex-shrink-0" />
                  <div>
                    <p className="text-sm text-gray-600">Due Date</p>
                    <p className="font-medium text-[#1c110a]">{selectedRequest?.deadline}</p>
                  </div>
                </div>

                {selectedRequest && isPostedByCurrentUser(selectedRequest) && (
                  <div className="pt-4 border-t border-gray-200">
                    <Button
                      type="button"
                      variant="outline"
                      className="w-full border-red-200 text-red-700 hover:bg-red-50 hover:text-red-800"
                      onClick={() => handleDeleteRequest(selectedRequest.id)}
                    >
                      <Trash2 className="w-4 h-4 mr-2" />
                      Delete this request
                    </Button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}