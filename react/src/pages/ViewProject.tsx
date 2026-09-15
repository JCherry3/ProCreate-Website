import { useParams, Link, useLocation, useNavigate } from "react-router";
import { Navbar } from "../components/Navbar";
import { Button } from "../components/ui/button";
import { ImageWithFallback } from "../components/ui/ImageWithFallback";
import { Heart, MessageCircle, Flag, Bookmark } from "lucide-react";
import { useEffect, useState } from "react";
import { Textarea } from "../components/ui/textarea";

interface Project {
  id: string;
  title: string;
  image: string;
  author: {
    name: string;
    username: string;
    avatar: string;
  };
  likes: number;
  comments: number;
  category: string;
  description?: string;
  materials?: string;
  software?: string;
  difficulty?: string;
  published?: string;
  views?: number | string;
  isLiked: boolean;
  isSaved?: boolean;
  allowComments: boolean;
}

interface Comment {
  id: string;
  author: string;
  username: string;
  content: string;
  timestamp: string;
}

export default function ViewProject() {
  const { id } = useParams();
  const location = useLocation();
  const navigate = useNavigate();

  // Determine where user came from
  const sourcePage = location.state?.from || "search";
  const backLink   = sourcePage === "home" ? "/home" : "/search";
  const backText   = sourcePage === "home" ? "← Back to home" : "← Back to search";

  const [project, setProject]             = useState<Project | null>(null);
  const [relatedProjects, setRelatedProjects] = useState<Project[]>([]);
  const [loading, setLoading]             = useState(true);
  const [error, setError]                 = useState<string | null>(null);

  const [isLiked, setIsLiked]             = useState(false);
  const [isSaved, setIsSaved]             = useState(false);
  const [saveLoading, setSaveLoading]     = useState(false);
  const [likeCount, setLikeCount]         = useState(0);
  const [comment, setComment]             = useState("");
  const [comments, setComments]           = useState<Comment[]>([]);
  const [commentsLoading, setCommentsLoading] = useState(false);

  // ── Auth state ────────────────────────────────────────────────────────────
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  // ── Report state ──────────────────────────────────────────────────────────
  const [reportedAuthor, setReportedAuthor] = useState(false);
  const [reportLoading, setReportLoading]   = useState(false);

  // ── Follow state ──────────────────────────────────────────────────────────
  const [isFollowing, setIsFollowing]     = useState(false);
  const [followerCount, setFollowerCount] = useState<number | null>(null);
  const [followLoading, setFollowLoading] = useState(false);

  // ── Check auth ────────────────────────────────────────────────────────────
  useEffect(() => {
    fetch("api/isauthed.php", { credentials: "include" })
      .then(r => r.json())
      .then(d => setIsAuthenticated(d.isAuthed === true))
      .catch(() => setIsAuthenticated(false));
  }, []);

  // ── Load project ──────────────────────────────────────────────────────────
  useEffect(() => {
    setLoading(true);
    setError(null);

    fetch("api/get_projects.php", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    })
      .then((res) => {
        if (!res.ok) throw new Error("Failed to load project");
        return res.json();
      })
      .then((data) => {
        const rawProjects = Array.isArray(data) ? data : [];
        const normalize = (p: any): Project => ({
          id:          String(p.id),
          title:       p.title ?? "",
          image:       p.image ?? "",
          author:      p.author ?? { name: "", username: "", avatar: "" },
          likes:       p.likes ?? 0,
          comments:    p.comments ?? 0,
          category:    p.category ?? "",
          description: p.description ?? "",
          materials:   p.materials ?? p.materials_used ?? "",
          software:    p.software ?? p.software_used ?? "",
          difficulty:  p.difficulty ?? p.difficulty_level ?? "",
          published:   p.date_posted || "Recent",
          views:       p.views ?? 0,
          isLiked:     p.isLiked ?? false,
          isSaved:     p.isSaved ?? false,
          allowComments:
            p.allow_comments === undefined || p.allow_comments === null
              ? true
              : Number(p.allow_comments) === 1,
        });

        const normalized = rawProjects.map(normalize);
        const byId       = normalized.find((p) => p.id === id);
        const current    = byId ?? (normalized.length > 0 ? normalized[0] : null);

        if (!current) {
          setError("Project not found");
          setLoading(false);
          return;
        }

        setProject(current);
        setLikeCount(current.likes);
        setIsLiked(current.isLiked);
        setIsSaved(Boolean(current.isSaved));

        const moreFromAuthor = normalized
          .filter((p) => p.id !== current.id && p.author?.username === current.author?.username)
          .slice(0, 4);

        setRelatedProjects(
          moreFromAuthor.length > 0 ? moreFromAuthor : normalized.slice(0, 4)
        );
        setLoading(false);
      })
      .catch((err) => {
        console.error(err);
        setError("Failed to load project");
        setLoading(false);
      });
  }, [id]);

  // ── Fetch follow status once project (and author username) is known ───────
  useEffect(() => {
    if (!project?.author?.username) return;

    const fetchFollowStatus = async () => {
      try {
        const res = await fetch("api/get_follow_status.php", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ target_username: project.author.username }),
          credentials: "include",
        });
        if (!res.ok) return;
        const data = await res.json();
        setIsFollowing(data.is_following ?? false);
        setFollowerCount(data.follower_count ?? null);
      } catch (err) {
        console.error("Failed to fetch follow status", err);
      }
    };

    fetchFollowStatus();
  }, [project?.author?.username]);

  // ── Comments ──────────────────────────────────────────────────────────────
  const fetchComments = async (projectId: string) => {
    setCommentsLoading(true);
    try {
      const response = await fetch("api/get_comments.php", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ project_id: parseInt(projectId) }),
      });
      if (!response.ok) throw new Error("Failed to load comments");
      const data = await response.json();
      setComments(data);
    } catch (error) {
      console.error("Error fetching comments:", error);
    } finally {
      setCommentsLoading(false);
    }
  };

  useEffect(() => {
    if (project) fetchComments(project.id);
  }, [project]);

  // ── Like ──────────────────────────────────────────────────────────────────
  const handleLike = async () => {
    const willLike  = !isLiked;
    const nextCount = willLike ? likeCount + 1 : Math.max(0, likeCount - 1);

    setIsLiked(willLike);
    setLikeCount(nextCount);

    try {
      const res = await fetch("api/update_project_likes.php", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ project_id: project?.id, action: willLike ? "like" : "unlike" }),
      });

      if (!res.ok) throw new Error("Failed to update like");
      const data = await res.json();
      if (typeof data.likes === "number") setLikeCount(data.likes);
    } catch (err) {
      console.error(err);
      setIsLiked(!willLike);
      setLikeCount(likeCount);
    }
  };

  // ── Save / unsave ─────────────────────────────────────────────────────────
  const handleSave = async () => {
    if (saveLoading || !project) return;
    const willSave = !isSaved;
    setIsSaved(willSave);
    setSaveLoading(true);
    try {
      const res = await fetch("api/save_project.php", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ project_id: project.id, remove: !willSave }),
      });
      const data = await res.json();
      if (!res.ok) {
        setIsSaved(!willSave);
        console.error(data.error || "Failed to save project");
      }
    } catch {
      setIsSaved(!willSave);
    } finally {
      setSaveLoading(false);
    }
  };

  // ── Report author ─────────────────────────────────────────────────────────
  const handleReport = async () => {
    if (reportLoading || reportedAuthor || !project?.author?.username) return;
    const confirmed = window.confirm(`Report @${project.author.username}? Are you sure you want to report this user? This action cannot be undone.`);
    if (!confirmed) return;
    setReportLoading(true);
    try {
      const res = await fetch("api/report_user.php", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ target_username: project.author.username }),
        credentials: "include",
      });
      const data = await res.json();
      if (res.status === 409) {
        alert("You have already reported this user.");
      } else if (!res.ok || data.error) {
        alert(data.error || "Failed to submit report.");
      } else {
        setReportedAuthor(true);
        if (data.account_deleted) {
          alert("This account has been removed due to multiple reports.");
          navigate("/home");
        } else {
          alert("Report submitted successfully.");
        }
      }
    } catch (err) {
      console.error(err);
      alert("Failed to submit report.");
    } finally {
      setReportLoading(false);
    }
  };

  // ── Follow / unfollow ─────────────────────────────────────────────────────
  const handleFollow = async () => {
    if (followLoading || !project?.author?.username) return;
    setFollowLoading(true);

    const action = isFollowing ? "unfollow" : "follow";

    // Optimistic update
    setIsFollowing(!isFollowing);
    setFollowerCount((c) => (c !== null ? (action === "follow" ? c + 1 : Math.max(0, c - 1)) : c));

    try {
      const res = await fetch("api/follow.php", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ target_username: project.author.username, action }),
        credentials: "include",
      });
      const data = await res.json();

      if (!res.ok || data.error) {
        // Revert
        setIsFollowing(isFollowing);
        setFollowerCount((c) =>
          c !== null ? (action === "follow" ? c - 1 : c + 1) : c
        );
        console.error(data.error);
      } else {
        setIsFollowing(data.is_following);
        setFollowerCount(data.follower_count);
      }
    } catch (err) {
      setIsFollowing(isFollowing);
      setFollowerCount((c) =>
        c !== null ? (action === "follow" ? c - 1 : c + 1) : c
      );
      console.error(err);
    } finally {
      setFollowLoading(false);
    }
  };

  // ── Comment submit ────────────────────────────────────────────────────────
  const handleSubmitComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!comment.trim() || !project || !project.allowComments) return;

    try {
      const response = await fetch("api/add_comment.php", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          project_id:    parseInt(project.id),
          feedback_text: comment.trim(),
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to add comment");
      }

      await fetchComments(project.id);
      setComment("");
    } catch (error) {
      console.error("Error adding comment:", error);
    }
  };

  if (loading) return <div className="p-10">Loading...</div>;
  if (error || !project) return <div className="p-10">Project not found</div>;

  return (
    <div className="min-h-screen bg-[#faf9f6]">
      <Navbar isAuthenticated={isAuthenticated} />

      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Back button */}
        <Link
          to={backLink}
          className="inline-flex items-center text-sm text-[#1c110a] hover:text-[#c2350a] mb-6"
        >
          {backText}
        </Link>

        <div className="grid lg:grid-cols-3 gap-8">
          {/* ── Main content ─────────────────────────────────────────────── */}
          <div className="lg:col-span-2 space-y-6">
            {/* Project Image */}
            <div className="bg-white rounded-lg overflow-hidden shadow-sm">
              <div className="aspect-video bg-gray-100">
                <ImageWithFallback
                  src={project.image}
                  alt={project.title}
                  className="w-full h-full object-cover"
                />
              </div>
            </div>

            {/* Project Details */}
            <div className="bg-white rounded-lg p-4 sm:p-6 shadow-sm">
              <div className="mb-4">
                <span className="inline-block px-3 py-1 bg-[#c2350a] bg-opacity-10 text-[#1c110a] rounded-full text-sm mb-3">
                  {project.category}
                </span>
                <h1 className="text-2xl sm:text-3xl mb-2 break-words">{project.title}</h1>
              </div>

              <p className="text-gray-600 mb-6 break-words">{project.description}</p>

              {/* Action buttons */}
              <div className="flex flex-wrap items-center gap-2 sm:gap-4 pb-6 border-b">
                <Button
                  variant={isLiked ? "default" : "outline"}
                  onClick={handleLike}
                  className="flex items-center gap-2"
                  size="sm"
                >
                  <Heart className={`w-4 h-4 ${isLiked ? "fill-white" : ""}`} />
                  <span>{likeCount}</span>
                </Button>
                <Button variant="outline" className="flex items-center gap-2" size="sm">
                  <MessageCircle className="w-4 h-4" />
                  <span>{comments.length}</span>
                </Button>
                <Button
                  variant={isSaved ? "default" : "outline"}
                  onClick={handleSave}
                  disabled={saveLoading}
                  className="flex items-center gap-2"
                  size="sm"
                  title={isSaved ? "Unsave project" : "Save project"}
                >
                  <Bookmark className={`w-4 h-4 ${isSaved ? "fill-white" : ""}`} />
                </Button>
              </div>

              {/* Comments Section */}
              <div className="mt-6">
                <h3 className="text-xl mb-4">Comments ({comments.length})</h3>

                <form onSubmit={handleSubmitComment} className="mb-6">
                  {!project.allowComments && (
                    <p className="text-sm text-gray-500 mb-3">
                      Comments are turned off for this project.
                    </p>
                  )}
                  <Textarea
                    placeholder={
                      project.allowComments
                        ? "Add a comment..."
                        : "Comments are disabled"
                    }
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                    className="mb-3"
                    disabled={!project.allowComments}
                  />
                  <Button type="submit" disabled={!project.allowComments || !comment.trim()}>
                    Post Comment
                  </Button>
                </form>

                {commentsLoading ? (
                  <div className="text-center py-4">Loading comments...</div>
                ) : (
                  <div className="space-y-4">
                    {comments.map((c) => (
                      <div key={c.id} className="flex gap-3">
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-400 to-pink-400 flex items-center justify-center text-white flex-shrink-0">
                          {c.author.charAt(0)}
                        </div>
                        <div className="flex-1">
                          <div className="bg-gray-50 rounded-lg p-3">
                            <div className="flex items-center gap-2 mb-1">
                              <Link
                                to={`/profile/${c.username}`}
                                className="font-medium text-sm hover:text-[#c2350a]"
                              >
                                {c.author}
                              </Link>
                              <span className="text-xs text-gray-500">{c.timestamp}</span>
                            </div>
                            <p className="text-sm text-gray-700">{c.content}</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* ── Sidebar ──────────────────────────────────────────────────── */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-lg p-6 shadow-sm sticky top-24">
              {/* Author info */}
              <div className="flex items-center gap-3 mb-6">
                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-[#c2350a] to-[#1c3738] flex items-center justify-center text-white text-lg">
                  {project.author.name.charAt(0)}
                </div>
                <div className="flex-1 min-w-0">
                  <Link
                    to={`/profile/${project.author.username}`}
                    className="font-medium hover:text-[#c2350a] block truncate"
                  >
                    {project.author.name}
                  </Link>
                  <p className="text-sm text-gray-600 truncate">@{project.author.username}</p>
                </div>
              </div>

              <div className="space-y-3">
                {isAuthenticated && (
                  <>
                    {/* Follow button */}
                    <Button
                      className={`w-full ${
                        isFollowing
                          ? "border border-[#c2350a] text-[#c2350a] bg-transparent hover:bg-red-50"
                          : "bg-[#c2350a] hover:bg-[#a02d08] text-white"
                      }`}
                      onClick={handleFollow}
                      disabled={followLoading}
                    >
                      {followLoading ? "..." : isFollowing ? "Following" : "Follow"}
                    </Button>

                    {/* Message button */}
                    <Button
                      variant="outline"
                      className="w-full"
                      onClick={() =>
                        navigate(`/messages?compose=${project.author.username}`)
                      }
                    >
                      Message
                    </Button>

                    {/* Report button */}
                    <Button
                      variant="outline"
                      className="w-full border-red-300 text-red-500 hover:bg-red-50"
                      onClick={handleReport}
                      disabled={reportLoading || reportedAuthor}
                    >
                      <Flag className="w-4 h-4 mr-2" />
                      {reportedAuthor ? "Reported" : "Report User"}
                    </Button>
                  </>
                )}
              </div>

              <div className="mt-6 pt-6 border-t">
                <h4 className="font-medium mb-3">Project Info</h4>
                <dl className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <dt className="text-gray-600">Published</dt>
                    <dd>
                      {project.published !== "Recent"
                        ? new Date(project.published!).toLocaleDateString("en-US", {
                            month: "short",
                            day:   "numeric",
                            year:  "numeric",
                          })
                        : "Recent"}
                    </dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-gray-600">Category</dt>
                    <dd>{project.category}</dd>
                  </div>
                </dl>
              </div>

              {(project.materials || project.software || project.difficulty) && (
                <div className="mt-6 pt-6 border-t">
                  <h4 className="font-medium mb-3">Details</h4>
                  <dl className="space-y-3 text-sm">
                    {project.difficulty && (
                      <div>
                        <dt className="text-gray-600 mb-1">Difficulty</dt>
                        <dd>
                          <span className="inline-block px-2 py-1 bg-[#1c3738] bg-opacity-10 text-[#faf9f6] rounded text-xs">
                            {project.difficulty}
                          </span>
                        </dd>
                      </div>
                    )}
                    {project.software && (
                      <div>
                        <dt className="text-gray-600 mb-1">Software Used</dt>
                        <dd className="text-[#1c110a]">{project.software}</dd>
                      </div>
                    )}
                    {project.materials && (
                      <div>
                        <dt className="text-gray-600 mb-1">Materials</dt>
                        <dd className="text-[#1c110a]">{project.materials}</dd>
                      </div>
                    )}
                  </dl>
                </div>
              )}

            </div>
          </div>
        </div>

        {/* More from author */}
        <div className="mt-12">
          <h2 className="text-2xl mb-6">More from {project.author.name}</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {relatedProjects.map((proj) => (
              <Link key={proj.id} to={`/project/${proj.id}`} className="group">
                <div className="bg-white rounded-lg overflow-hidden shadow-sm hover:shadow-md transition-shadow">
                  <div className="aspect-[4/3] overflow-hidden bg-gray-100">
                    <ImageWithFallback
                      src={proj.image}
                      alt={proj.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                  </div>
                  <div className="p-4">
                    <h3 className="font-medium truncate">{proj.title}</h3>
                    <div className="flex items-center gap-3 mt-2 text-sm text-gray-600">
                      <span className="flex items-center gap-1">
                        <Heart className="w-3 h-3" />
                        {proj.likes}
                      </span>
                      <span className="flex items-center gap-1">
                        <MessageCircle className="w-3 h-3" />
                        {proj.comments}
                      </span>
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}