import { useState } from "react";
import { Link, useNavigate, useLocation } from "react-router";
import { Heart, MessageCircle, Bookmark } from "lucide-react";
import { ImageWithFallback } from "./ui/ImageWithFallback";

interface ProjectCardProps {
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
  isLiked: boolean;
  isSaved: boolean;
  difficulty: string;
  isAuthenticated?: boolean;
}

export function ProjectCard({ id, title, image, author, likes, comments, category, difficulty, isLiked: initialIsLiked, isSaved: initialIsSaved, isAuthenticated = false }: ProjectCardProps) {
  const [isLiked, setIsLiked] = useState(initialIsLiked);
  const [likeCount, setLikeCount] = useState(likes);
  const [isSaved, setIsSaved] = useState(initialIsSaved);
  const [saveLoading, setSaveLoading] = useState(false);

  const navigate = useNavigate();
  const location = useLocation();

  const getGradientStyle = () => {
    switch (difficulty?.toLowerCase()) {
      case 'beginner':
        return 'bg-gradient-to-b from-[#FAF9F6] to-[#1C3738]';
      case 'intermediate':
        return 'bg-gradient-to-b from-[#FAF9F6] to-[#C2350A]';
      case 'advanced':
        return 'bg-gradient-to-b from-[#FAF9F6] to-[#000000]';
      default:
        return 'bg-white';
    }
  };

  const handleLike = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    const willLike = !isLiked;
    const nextCount = willLike ? likeCount + 1 : Math.max(0, likeCount - 1);
    setIsLiked(willLike);
    setLikeCount(nextCount);

    try {
      const res = await fetch("api/update_project_likes.php", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ project_id: id, action: willLike ? "like" : "unlike" }),
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

  const handleSave = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (saveLoading) return;

    const willSave = !isSaved;
    setIsSaved(willSave);
    setSaveLoading(true);
    try {
      const res = await fetch("api/save_project.php", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ project_id: id, remove: !willSave }),
        credentials: "include",
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        setIsSaved(!willSave); // revert on error
        console.error(data.error || "Failed to save project");
      }
    } catch (err) {
      console.error(err);
      setIsSaved(!willSave); // revert on error
    } finally {
      setSaveLoading(false);
    }
  };

  const handleAuthorClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    navigate(`/profile/${author.username}`);
  };

  const getSourcePage = () => {
    if (location.pathname.includes('/home')) return 'home';
    if (location.pathname.includes('/search')) return 'search';
    return 'search';
  };

  return (
    <Link to={`/project/${id}`} state={{ from: getSourcePage() }} className="group block">
      <div className={`${getGradientStyle()} rounded-lg overflow-hidden shadow-sm hover:shadow-md transition-shadow`}>
        <div className="aspect-[4/3] overflow-hidden bg-gray-100">
          <ImageWithFallback
            src={image}
            alt={title}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          />
        </div>
        <div className="p-4">
          <div className="flex items-start justify-between mb-2">
            <div className="flex-1 min-w-0">
              <h3 className="font-medium truncate mb-1 text-[#FAF9F6]">{title}</h3>
              <div
                onClick={handleAuthorClick}
                className="flex items-center gap-2 group/author cursor-pointer"
              >
                <div className="w-6 h-6 rounded-full bg-gradient-to-br from-[#c2350a] to-[#1c3738] flex items-center justify-center text-white text-xs flex-shrink-0">
                  {author.name.charAt(0)}
                </div>
                <span className="text-sm text-[#FAF9F6] group-hover/author:text-[#FAD4C4] truncate">
                  {author.name}
                </span>
              </div>
            </div>
            <span className="text-xs bg-[#FAF9F6] text-[#1c110a] px-2 py-1 rounded-full ml-2 flex-shrink-0">
              {category}
            </span>
          </div>
          <div className="flex items-center justify-between mt-3 pt-3 border-t border-[#FAF9F6]">
            <div className="flex items-center gap-4">
              <button
                onClick={handleLike}
                className={`flex items-center gap-1 text-sm transition-colors ${
                  isLiked
                    ? "text-[#FAD4C4] bg-[#c2350a33]"
                    : "text-[#FAF9F6] hover:text-[#FAD4C4]"
                } rounded-md px-2 py-1`}
              >
                <Heart className={`w-4 h-4 ${isLiked ? "fill-[#c2350a] text-[#c2350a]" : ""}`} />
                <span>{likeCount}</span>
              </button>
              <div className="flex items-center gap-1 text-sm text-[#FAF9F6]">
                <MessageCircle className="w-4 h-4" />
                <span>{comments}</span>
              </div>
            </div>
            {isAuthenticated && (
              <button
                onClick={handleSave}
                disabled={saveLoading}
                className={`transition-colors p-1 rounded ${
                  isSaved
                    ? "text-[#c2350a]"
                    : "text-gray-400 hover:text-[#c2350a]"
                }`}
                title={isSaved ? "Unsave project" : "Save project"}
              >
                <Bookmark className={`w-4 h-4 ${isSaved ? "fill-[#c2350a] text-[#c2350a]" : ""}`} />
              </button>
            )}
          </div>
        </div>
      </div>
    </Link>
  );
}