import { useParams, Link, useNavigate } from "react-router";
import { useEffect, useState } from "react";
import { Navbar } from "../components/Navbar";
import { Button } from "../components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/tabs";
import { ProjectCard } from "../components/ProjectCard";
import { InProgressProjectCard } from "../components/InProgressProjectCard";
import { MapPin, Link as Calendar, Bookmark, LogOut, Briefcase, Mail, Flag } from "lucide-react";

export default function Profile() {
  const { username } = useParams();
  const navigate = useNavigate();
  const isOwnProfile = !username;

  const [profileData, setProfileData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [inProgressProjects, setInProgressProjects] = useState<any[]>([]);
  const [sharedWorkspaceProjects, setSharedWorkspaceProjects] = useState<any[]>([]);
  const [loadingInProgress, setLoadingInProgress] = useState(false);
  const [loadingSharedWorkspace, setLoadingSharedWorkspace] = useState(false);
  const [savedProjects, setSavedProjects] = useState<any[]>([]);
  const [uploadedProjects, setUploadedProjects] = useState<any[]>([]);
  const [loadingUploadedProjects, setLoadingUploadedProjects] = useState(false);

  // ── Auth state ────────────────────────────────────────────────────────────
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  // ── Follow state ──────────────────────────────────────────────────────────
  const [isFollowing, setIsFollowing] = useState(false);
  const [followerCount, setFollowerCount] = useState(0);
  const [followLoading, setFollowLoading] = useState(false);

  // ── Skills state ───────────────────────────────────────────────────────────
  const [skills, setSkills] = useState<string[]>([]);
  const [loadingSkills, setLoadingSkills] = useState(false);
  // ── Report state ──────────────────────────────────────────────────────────
  const [reportLoading, setReportLoading] = useState(false);
  const [reportedUser, setReportedUser] = useState(false);

  // ── Wallet state ───────────────────────────────────────────────────────────
  const [walletBalance, setWalletBalance] = useState<number>(0);
  const [showWalletModal, setShowWalletModal] = useState(false);
  const [walletAction, setWalletAction] = useState<"deposit" | "withdraw" | null>(null);
  const [walletAmount, setWalletAmount] = useState<string>("");
  const MAX_WALLET = 1_000_000_000;
  const normalizeAmount = (val: string) => {
    // keep digits only
    let digits = val.replace(/\D/g, "");

    // limit to 10 digits max
    digits = digits.slice(0, 10);

    // remove leading zeros but keep single zero if needed
    digits = digits.replace(/^0+(?=\d)/, "");

    return digits;
  };

  const formatWithCommas = (val: string) => {
    if (!val) return "";
    const num = val.replace(/\D/g, "");
    return num.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  };

  // ── Check auth status ─────────────────────────────────────────────────────
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const res = await fetch("api/isauthed.php", { credentials: "include" });
        const data = await res.json();
        setIsAuthenticated(data.isAuthed === true);
      } catch {
        setIsAuthenticated(false);
      }
    };
    checkAuth();
  }, []);

  const handleLogout = async () => {
    const confirmed = window.confirm("Are you sure you would like to sign out?");
    if (confirmed) {
      try {
        // Call the logout endpoint to destroy the server session
        await fetch("api/logout.php", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
        });
      } catch (error) {
        console.error("Error during logout:", error);
      }
      navigate("/");
    }
  };

  // ── Fetch profile ─────────────────────────────────────────────────────────
  useEffect(() => {
    const fetchProfile = async () => {
      try {
        if (username) {
          const res = await fetch("/CSE442/2026-Spring/cse-442y/api/get_profile.php", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ username }),
            credentials: "include",
          });
          if (res.status === 401) { navigate("/signin"); return; }
          const data = await res.json();
          if (data) { setProfileData(data); }
        } else {
          const authRes = await fetch("api/isauthed.php", {
            method: "GET",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
          });
          if (!authRes.ok) { navigate("/signin"); return; }

          const res = await fetch("/CSE442/2026-Spring/cse-442y/api/get_profile.php", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
          });
          if (res.status === 401) { navigate("/signin"); return; }
          const data = await res.json();
          if (data) { setProfileData(data); }
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    fetchProfile();
  }, [username, navigate]);

  // ── Fetch Wallet Balance ─────────────────────────────────────────────────────────
  useEffect(() => {
    const fetchWallet = async () => {
      try {
        const csrfRes = await fetch("api/get_csrf_token.php", {
        method: "GET",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
      });

      const csrfData = await csrfRes.json();
      const csrfToken = csrfData.csrfToken;
      if (!csrfRes.ok || !csrfToken) {
        throw new Error("Failed to get CSRF token");
      }
        const res = await fetch("api/wallet.php", {
          method: "POST",
          credentials: "include",
          body: JSON.stringify({ csrf_token: csrfToken }),
        });
        if (!res.ok) return;
        const data = await res.json();
        setWalletBalance(Number(data.balance) || 0);
      } catch (err) {
        console.error("Error fetching wallet:", err);
      }
    };
    fetchWallet();
  }, []);

  // Fetch in-progress projects for this profile user
  useEffect(() => {
    const fetchInProgressProjects = async () => {
      if (!profileData?.username) return;

      setLoadingInProgress(true);
      try {
        const res = await fetch("api/get_in_progress.php", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ shared_mode: "personal" }),
          credentials: "include",
        });

        if (!res.ok) {
          throw new Error("Failed to fetch in-progress projects");
        }

        const data = await res.json();
        setInProgressProjects(Array.isArray(data) ? data : []);
      } catch (err) {
        console.error("Error fetching in-progress projects:", err);
        setInProgressProjects([]);
      } finally {
        setLoadingInProgress(false);
      }
    };

    fetchInProgressProjects();
  }, [profileData?.username]);

  // Fetch shared workspace drafts for this profile user
  useEffect(() => {
    const fetchSharedWorkspaceProjects = async () => {
      if (!isOwnProfile || !profileData?.username) return;

      setLoadingSharedWorkspace(true);
      try {
        const res = await fetch("api/get_in_progress.php", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ shared_mode: "shared" }),
          credentials: "include",
        });

        if (!res.ok) {
          throw new Error("Failed to fetch shared workspace projects");
        }

        const data = await res.json();
        setSharedWorkspaceProjects(Array.isArray(data) ? data : []);
      } catch (err) {
        console.error("Error fetching shared workspace projects:", err);
        setSharedWorkspaceProjects([]);
      } finally {
        setLoadingSharedWorkspace(false);
      }
    };

    fetchSharedWorkspaceProjects();
  }, [isOwnProfile, profileData?.username]);

  // Fetch saved projects for this profile user
  useEffect(() => {
    const fetchSavedProjects = async () => {
      if (!profileData?.username) return;

      try {
        const res = await fetch("api/get_saved_projects.php", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ username: profileData.username }),
          credentials: "include",
        });

        if (!res.ok) {
          throw new Error("Failed to fetch saved projects");
        }

        const data = await res.json();
        setSavedProjects(Array.isArray(data) ? data.map(project => ({
          ...project,
          isLiked: project.isLiked ?? false,
          isSaved: true
        })) : []);
      } catch (err) {
        console.error("Error fetching saved projects:", err);
        setSavedProjects([]);
      }
    };

    fetchSavedProjects();
  }, [profileData?.username]);

  // Fetch uploaded projects for this profile user
  useEffect(() => {
    const fetchUploadedProjects = async () => {
      if (!profileData?.username) return;

      setLoadingUploadedProjects(true);
      try {
        const res = await fetch("api/get_projects.php", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({}),
          credentials: "include",
        });

        if (!res.ok) {
          throw new Error("Failed to fetch uploaded projects");
        }

        const data = await res.json();
        const profileUsername = String(profileData.username).toLowerCase();
        const filtered = Array.isArray(data)
          ? data.filter(
              (project) =>
                String(project?.author?.username ?? "").toLowerCase() === profileUsername
            )
          : [];
        setUploadedProjects(filtered);
      } catch (err) {
        console.error("Error fetching uploaded projects:", err);
        setUploadedProjects([]);
      } finally {
        setLoadingUploadedProjects(false);
      }
    };

    fetchUploadedProjects();
  }, [profileData?.username]);

  // ── Fetch follow status once we know the target username ──────────────────
  useEffect(() => {
    if (!username || !profileData) return; // don't fetch on own profile

    const fetchFollowStatus = async () => {
      try {
        const res = await fetch("api/get_follow_status.php", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ target_username: username }),
          credentials: "include",
        });
        if (!res.ok) return;
        const data = await res.json();
        setIsFollowing(data.is_following ?? false);
        setFollowerCount(data.follower_count ?? profileData.followers ?? 0);
      } catch (err) {
        console.error("Failed to fetch follow status", err);
        // Fall back to value from profile data
        setFollowerCount(profileData.followers ?? 0);
      }
    };

    fetchFollowStatus();
  }, [username, profileData]);

  // ── Fetch skills ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (!profileData?.user_id) return;

    const fetchSkills = async () => {
      setLoadingSkills(true);
      try {
        const res = await fetch("api/getskills.php", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ userid: profileData.user_id }),
          credentials: "include",
        });
        if (!res.ok) {
          throw new Error("Failed to fetch skills");
        }
        const data = await res.json();
        setSkills(Array.isArray(data) ? data : []);
      } catch (err) {
        console.error("Error fetching skills:", err);
        setSkills([]);
      } finally {
        setLoadingSkills(false);
      }
    };

    fetchSkills();
  }, [profileData?.user_id]);

  // ── Follow / unfollow ─────────────────────────────────────────────────────
  const handleFollow = async () => {
    if (followLoading || !username) return;
    setFollowLoading(true);

    const action = isFollowing ? "unfollow" : "follow";

    // Optimistic update
    setIsFollowing(!isFollowing);
    setFollowerCount((c) => (action === "follow" ? c + 1 : Math.max(0, c - 1)));

    try {
      const res = await fetch("api/follow.php", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ target_username: username, action }),
        credentials: "include",
      });
      const data = await res.json();

      if (!res.ok || data.error) {
        // Revert on failure
        setIsFollowing(isFollowing);
        setFollowerCount((c) => (action === "follow" ? c - 1 : c + 1));
        console.error(data.error);
      } else {
        // Sync server truth
        setIsFollowing(data.is_following);
        setFollowerCount(data.follower_count);
      }
    } catch (err) {
      // Revert on network error
      setIsFollowing(isFollowing);
      setFollowerCount((c) => (action === "follow" ? c - 1 : c + 1));
      console.error(err);
    } finally {
      setFollowLoading(false);
    }
  };

  // ── Report user ───────────────────────────────────────────────────────────
  const handleReport = async () => {
    if (reportLoading || reportedUser || !profileData?.username) return;
    const confirmed = window.confirm(`Report @${profileData.username}? Are you sure you want to report this user? This action cannot be undone.`);
    if (!confirmed) return;
    setReportLoading(true);
    try {
      const res = await fetch("api/report_user.php", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ target_username: profileData.username }),
        credentials: "include",
      });
      const data = await res.json();
      if (res.status === 409) {
        alert("You have already reported this user.");
      } else if (!res.ok || data.error) {
        alert(data.error || "Failed to submit report.");
      } else {
        setReportedUser(true);
        if (data.account_deleted) {
          alert("This account has been removed due to multiple reports.");
          navigate("/home");
        } else {
          alert("Report submitted successfully.");
        }
      }
    } catch (err) {
      console.error(err);
      alert("Failed to submit report. Please try again.");
    } finally {
      setReportLoading(false);
    }
  };

  const userProjects = uploadedProjects;

  if (loading)        return <div className="p-10">Loading...</div>;
  if (!profileData)   return <div className="p-10">User not found</div>;
  if ((profileData as any).error) return <div className="p-10">User not found</div>;

  const firstName =
    profileData.first_name ??
    profileData["first name"] ??
    profileData.firstname ??
    profileData.firstName ??
    "";

  const lastName =
    profileData.last_name ??
    profileData["last name"] ??
    profileData.lastname ??
    profileData.lastName ??
    "";

  const fullName =
    [firstName, lastName].filter(Boolean).join(" ") ||
    profileData.username ||
    "Unknown User";

  const avatarInitial = (
    firstName || lastName || profileData.username || "U"
  ).charAt(0).toUpperCase();

  // Use live followerCount if we fetched it, otherwise fall back to profile data
  const displayFollowers = !isOwnProfile ? followerCount : (profileData.followers ?? 0);

  const handleWalletSubmit = async () => {
    if (!walletAction || !walletAmount) return;

    const amount = Number(walletAmount);
    if (isNaN(amount) || amount <= 0) return;

    // Client-side bounds checks
    if (walletAction === "deposit" && walletBalance + amount > MAX_WALLET) {
      alert("Deposit would exceed maximum wallet balance (1,000,000,000).");
      return;
    }
    if (walletAction === "withdraw" && walletBalance - amount < 0) {
      alert("Insufficient funds.");
      return;
    }

    const value = walletAction === "deposit" ? amount : -amount;

    try {
      const csrfRes = await fetch("api/get_csrf_token.php", {
        method: "GET",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
      });

      const csrfData = await csrfRes.json();
      const csrfToken = csrfData.csrfToken;
      if (!csrfRes.ok || !csrfToken) {
        throw new Error("Failed to get CSRF token");
      }
      const res = await fetch("api/wallet.php", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount: value, csrf_token: csrfToken,}),
        credentials: "include",
      });

      const data = await res.json();
      if (res.ok && data.balance !== undefined) {
        setWalletBalance(Number(data.balance));
      }
    } catch (err) {
      console.error("Wallet update failed:", err);
    }

    setShowWalletModal(false);
    setWalletAmount("");
    setWalletAction(null);
  };

  return (
    <div className="min-h-screen bg-[#faf9f6]">
      <Navbar isAuthenticated={isAuthenticated || isOwnProfile} />

      {/* Profile Header */}
      <div className="bg-white border-b">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex flex-col md:flex-row gap-6 items-start">
            {/* Avatar */}
            <div className="flex-shrink-0">
              {profileData.pic && profileData.pic.trim() ? (
                <img
                  src={`api/profile_pics/${profileData.pic.replace(/^profile_pics\//, "")}`}
                  alt={fullName}
                  className="w-24 h-24 sm:w-32 sm:h-32 rounded-full object-cover border-4 border-white shadow-lg"
                />
              ) : (
                <div className="w-24 h-24 sm:w-32 sm:h-32 rounded-full bg-gradient-to-br from-[#c2350a] to-[#1c3738] flex items-center justify-center text-white text-3xl sm:text-4xl">
                  {avatarInitial}
                </div>
              )}
            </div>

            {/* Profile Info */}
            <div className="flex-1 min-w-0 w-full">
              <div className="mb-2">
                <div>
                  <h1 className="text-2xl sm:text-3xl mb-1">{fullName}</h1>
                  <p className="text-[#1c110a]">@{profileData.username}</p>

                  {(profileData.company || profileData.role) && (
                    <div className="flex items-center gap-2 text-sm text-gray-600 mt-2">
                      <Briefcase className="w-4 h-4" />
                      <span>
                        {profileData.role && <span>{profileData.role}</span>}
                        {profileData.role && profileData.company && <span> at </span>}
                        {profileData.company && (
                          <span className="font-medium">{profileData.company}</span>
                        )}
                      </span>
                    </div>
                  )}
                </div>

                {/* Other user's profile: Follow + Message (only if authed) + Report */}
                {!isOwnProfile && (
                  <div className="flex gap-2 flex-wrap">
                    {isAuthenticated && (
                      <>
                        <Button
                          size="sm"
                          variant={isFollowing ? "outline" : "default"}
                          onClick={handleFollow}
                          disabled={followLoading}
                          className={
                            isFollowing
                              ? "border-[#c2350a] text-[#c2350a] hover:bg-red-50"
                              : "bg-[#c2350a] hover:bg-[#a02d08] text-white"
                          }
                        >
                          {followLoading
                            ? "..."
                            : isFollowing
                            ? "Following"
                            : "Follow"}
                        </Button>
                        <Link to={`/messages?compose=${profileData.username}`}>
                          <Button size="sm" variant="outline">Message</Button>
                        </Link>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={handleReport}
                          disabled={reportLoading || reportedUser}
                          className="border-red-400 text-red-500 hover:bg-red-50"
                          title="Report this account"
                        >
                          <Flag className="w-4 h-4 mr-1" />
                          {reportedUser ? "Reported" : "Report"}
                        </Button>
                      </>
                    )}
                  </div>
                )}
              </div>

              <p className="text-gray-700 mb-2 max-w-2xl">{profileData.bio}</p>

              <div className="flex flex-wrap gap-4 text-sm text-gray-600 mb-4">
                {profileData.location && (
                  <div className="flex items-center gap-1">
                    <MapPin className="w-4 h-4" />
                    {profileData.location}
                  </div>
                )}

                {profileData.website && (
                  <div className="flex items-center gap-1">
                    <Calendar className="w-4 h-4" />
                    <a
                      href={`https://${profileData.website}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:underline"
                    >
                      {profileData.website}
                    </a>
                  </div>
                )}

                <div className="flex items-center gap-1">
                  <Calendar className="w-4 h-4" />
                  Joined{" "}
                  {profileData.date
                    ? new Date(Number(profileData.date) * 1000).toLocaleDateString("en-US", {
                        year: "numeric",
                        month: "long",
                        day: "numeric",
                      })
                    : ""}
                </div>

                {Number(profileData.showEmail) === 1 && profileData.email && (
                  <div className="flex items-center gap-1 text-gray-600">
                    <Mail className="w-4 h-4" />
                    <a href={`mailto:${profileData.email}`} className="hover:underline">
                      {profileData.email}
                    </a>
                  </div>
                )}
              </div>

              {/* Stats */}
              <div className="flex gap-6 text-sm sm:text-base">
                <div>
                  <span className="font-semibold">{userProjects.length}</span>
                  <span className="ml-1">Projects</span>
                </div>
                <div>
                  <span className="font-semibold">{displayFollowers}</span>
                  <span className="ml-1">Followers</span>
                </div>
                <div>
                  <span className="font-semibold">{profileData.following}</span>
                  <span className="ml-1">Following</span>
                </div>
              </div>

              {/* Skills */}
              <div className="mt-4">
                {loadingSkills ? (
                  <div className="text-sm text-gray-500">Loading skills...</div>
                ) : skills.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {skills.map((skill, index) => (
                      <div
                        key={index}
                        className="inline-block px-3 py-1 bg-gradient-to-r from-[#c2350a] to-[#a02d08] text-white text-xs font-medium rounded-full"
                      >
                        {skill}
                      </div>
                    ))}
                  </div>
                ) : null}
              </div>
            </div>
            {/* End Profile Info */}

            {/* Right Column: Actions + Wallet */}
            {isOwnProfile && (
              <div className="flex flex-col gap-3 w-full md:w-auto">
                <div className="flex gap-2">
                  <Link to="/profile/edit">
                    <Button variant="outline" size="sm">Edit</Button>
                  </Link>
                  <Button
                    size="sm"
                    className="bg-red-600 hover:bg-red-700 text-white"
                    onClick={handleLogout}
                  >
                    <LogOut className="w-4 h-4 mr-1" />
                    Log Out
                  </Button>
                </div>

                <div className="border rounded-lg p-3 bg-gray-50 w-fit">
                  <div className="text-sm text-gray-600">Wallet Balance</div>
                  <div className="font-semibold text-lg">${walletBalance.toFixed(2)}</div>
                  <div className="flex gap-2 mt-2">
                    <Button
                      size="sm"
                      onClick={() => {
                        setWalletAction("deposit");
                        setWalletAmount("");
                        setShowWalletModal(true);
                      }}
                    >
                      Deposit
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setWalletAction("withdraw");
                        setWalletAmount("");
                        setShowWalletModal(true);
                      }}
                    >
                      Withdraw
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Profile Content */}
      <div className="max-w-6xl mx-auto px-4 py-8">
        <Tabs defaultValue="projects" className="space-y-6">
          <TabsList>
            <TabsTrigger value="projects">Projects</TabsTrigger>
            {isOwnProfile && (
              <TabsTrigger value="inProgress">
                <Briefcase className="w-4 h-4 mr-2" />
                In Progress
              </TabsTrigger>
            )}
            {isOwnProfile && (
              <TabsTrigger value="sharedWorkspace">
                <Briefcase className="w-4 h-4 mr-2" />
                Shared Workspace
              </TabsTrigger>
            )}
            {isOwnProfile && (
              <TabsTrigger value="saved">
                <Bookmark className="w-4 h-4 mr-2" />
                Saved
              </TabsTrigger>
            )}
          </TabsList>

          <TabsContent value="projects">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {loadingUploadedProjects ? (
                <div>Loading...</div>
              ) : userProjects.length > 0 ? (
                userProjects.map((project) => (
                  <ProjectCard key={project.id} {...project} isAuthenticated={isAuthenticated} />
                ))
              ) : (
                <div>No uploaded projects</div>
              )}
            </div>
          </TabsContent>

          {isOwnProfile && (
            <TabsContent value="inProgress">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {loadingInProgress ? (
                  <div>Loading...</div>
                ) : inProgressProjects.length > 0 ? (
                  inProgressProjects.map((project) => (
                    <InProgressProjectCard
                      key={project.id}
                      id={project.id}
                      title={project.title}
                      image={project.image}
                      category={project.category}
                      dateUpdated={project.date_updated}
                    />
                  ))
                ) : (
                  <div>No in-progress projects</div>
                )}
              </div>
            </TabsContent>
          )}

          {isOwnProfile && (
            <TabsContent value="sharedWorkspace">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {loadingSharedWorkspace ? (
                  <div>Loading...</div>
                ) : sharedWorkspaceProjects.length > 0 ? (
                  sharedWorkspaceProjects.map((project) => (
                    <InProgressProjectCard
                      key={project.id}
                      id={project.id}
                      title={project.title}
                      image={project.image}
                      category={project.category}
                      dateUpdated={project.date_updated}
                    />
                  ))
                ) : (
                  <div>No shared workspace drafts</div>
                )}
              </div>
            </TabsContent>
          )}

          {isOwnProfile && (
            <TabsContent value="saved">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {savedProjects.map((project) => (
                  <ProjectCard key={project.id} {...project} isAuthenticated={isAuthenticated} />
                ))}
              </div>
            </TabsContent>
          )}

          {showWalletModal && (
  <div className="fixed inset-0 z-50 flex items-center justify-center bg-white/10 backdrop-blur-md">
    <div className="w-80 rounded-lg bg-white p-6 shadow-xl">
      <h2 className="text-lg font-semibold mb-4 capitalize">
        {walletAction}
      </h2>

      <input
        type="text"
        value={formatWithCommas(walletAmount)}
        onChange={(e) => setWalletAmount(normalizeAmount(e.target.value))}
        className="w-full border p-2 mb-4"
        placeholder="Enter amount"
      />

      <div className="grid grid-cols-3 gap-2 mb-4">
        {[1,2,3,4,5,6,7,8,9,0].map((num) => (
          <button
            key={num}
            className="border p-2"
            onClick={() =>
              setWalletAmount((prev) => {
                const next = (prev || "") + num.toString();
                return normalizeAmount(next);
              })
            }
          >
            {num}
          </button>
        ))}
      </div>

      <div className="flex gap-2">
        <Button onClick={handleWalletSubmit} className="flex-1">
          Confirm
        </Button>
        <Button
          variant="outline"
          onClick={() => setShowWalletModal(false)}
          className="flex-1"
        >
          Cancel
        </Button>
      </div>
    </div>
  </div>
)}
        </Tabs>
      </div>
    </div>
  );
}
