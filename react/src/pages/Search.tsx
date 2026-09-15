import { useEffect, useState } from "react";
import { Link } from "react-router";
import { Search as SearchIcon, SlidersHorizontal, User, X } from "lucide-react";
import { Navbar } from "../components/Navbar";
import { ProjectCard } from "../components/ProjectCard";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "../components/ui/dialog";
import { categories } from "../data/mockProjects";

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
  difficulty?: string;
  description?: string;
  materials_used?: string;
  software_used?: string;
  isLiked: boolean;
}

interface DBUser {
  user_id: string;
  name: string;
  username: string;
  bio: string;
  followers: number;
  pic: string | null;
  project_count: number;
}

export default function Search() {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [projects, setProjects] = useState<Project[]>([]);
  const [users, setUsers] = useState<DBUser[]>([]); // Real data state
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  
  // Sort and Filter state
  const [showSortDialog, setShowSortDialog] = useState(false);
  const [sortBy, setSortBy] = useState<string>("");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const [selectedDifficulty, setSelectedDifficulty] = useState<string>("");
  const [minLikes, setMinLikes] = useState<number>(0);

  useEffect(() => {
    fetch("api/isauthed.php", { credentials: "include" })
      .then(r => r.json())
      .then(d => setIsAuthenticated(d.isAuthed === true))
      .catch(() => setIsAuthenticated(false));
  }, []);

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      setError(null);

      try {
        // Fetch Projects and Users in parallel
        const [projRes, userRes] = await Promise.all([
          fetch("api/get_projects.php", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({}),
          }),
          fetch("api/get_users.php")
        ]);

        if (!projRes.ok || !userRes.ok) throw new Error("Failed to fetch data");

        const projData = await projRes.json();
        const userData = await userRes.json();

        setProjects(Array.isArray(projData) ? projData : []);
        setUsers(Array.isArray(userData) ? userData : []);
      } catch (err) {
        console.error(err);
        setError("Could not connect to the database.");
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, []);

  // Filter and Sort Logic
  const filteredAndSortedProjects = projects
    .filter((project) => {
      const matchesSearch =
        project.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        project.author.name.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesCategory =
        selectedCategory === "All" || project.category === selectedCategory;
      const matchesDifficulty =
        !selectedDifficulty || project.difficulty === selectedDifficulty;
      const matchesLikes = project.likes >= minLikes;
      return matchesSearch && matchesCategory && matchesDifficulty && matchesLikes;
    })
    .sort((a, b) => {
      if (!sortBy) return 0;

      let aValue: any, bValue: any;

      switch (sortBy) {
        case "difficulty":
          const difficultyOrder = { "Beginner": 1, "Intermediate": 2, "Advanced": 3 };
          aValue = difficultyOrder[a.difficulty as keyof typeof difficultyOrder] || 0;
          bValue = difficultyOrder[b.difficulty as keyof typeof difficultyOrder] || 0;
          break;
        case "likes":
          aValue = a.likes;
          bValue = b.likes;
          break;
        default:
          return 0;
      }

      if (sortOrder === "asc") {
        return aValue - bValue;
      } else {
        return bValue - aValue;
      }
    });

  const filteredUsers = users.filter(
    (u) =>
      u.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.username.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-[#faf9f6]">
      <Navbar isAuthenticated={isAuthenticated} />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-2xl sm:text-3xl mb-6">Search</h1>

          <div className="flex gap-2 sm:gap-4 mb-6">
            <div className="flex-1 relative">
              <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <Input
                type="text"
                placeholder="Search projects, designers..."
                className="pl-10 text-sm sm:text-base"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <Button 
              variant="outline" 
              className="flex-shrink-0 px-4 sm:px-5 bg-[var(--color-procreate-accent)] text-white border-transparent hover:bg-white hover:text-black transition-all"
              onClick={() => setShowSortDialog(true)}
            >
              <SlidersHorizontal className="w-4 h-4 sm:mr-2" />
              <span className="hidden sm:inline">Sort</span>
            </Button>
          </div>

          {loading && <p className="text-sm">Updating results...</p>}
          {error && <p className="text-red-500 text-sm">{error}</p>}

          {searchQuery && !loading && (
            <p className="text-[#1c110a] text-sm sm:text-base">
              {filteredAndSortedProjects.length + filteredUsers.length} results for "{searchQuery}"
            </p>
          )}
        </div>

        {/* Sort Dialog */}
        <Dialog open={showSortDialog} onOpenChange={setShowSortDialog}>
          <DialogContent className="max-w-sm border border-[var(--color-procreate-secondary)] bg-[var(--color-procreate-background)] shadow-2xl">
            <DialogHeader>
              <div className="flex items-center justify-between">
                <DialogTitle className="text-[var(--color-procreate-primary)]">Sort Projects</DialogTitle>
              </div>
            </DialogHeader>

            <div className="space-y-6 py-4">
              {/* Sort By */}
              <div>
                <label className="block text-sm font-medium mb-2">Sort By</label>
                <div className="space-y-2">
                  {[
                    { value: "", label: "Default (Newest)" },
                    { value: "difficulty", label: "Difficulty" },
                    { value: "likes", label: "Likes" }
                  ].map((option) => (
                    <label key={option.value} className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="sortBy"
                        value={option.value}
                        checked={sortBy === option.value}
                        onChange={(e) => setSortBy(e.target.value)}
                        className="w-4 h-4"
                      />
                      <span className="text-sm">{option.label}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Sort Order */}
              {sortBy && (
                <div>
                  <label className="block text-sm font-medium mb-2">Order</label>
                  <div className="space-y-2">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="sortOrder"
                        value="desc"
                        checked={sortOrder === "desc"}
                        onChange={(e) => setSortOrder(e.target.value as "asc" | "desc")}
                        className="w-4 h-4"
                      />
                      <span className="text-sm">
                        {sortBy === "difficulty" ? "High to Low (Advanced → Beginner)" : "High to Low"}
                      </span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="sortOrder"
                        value="asc"
                        checked={sortOrder === "asc"}
                        onChange={(e) => setSortOrder(e.target.value as "asc" | "desc")}
                        className="w-4 h-4"
                      />
                      <span className="text-sm">
                        {sortBy === "difficulty" ? "Low to High (Beginner → Advanced)" : "Low to High"}
                      </span>
                    </label>
                  </div>
                </div>
              )}

              {/* Filter By Section */}
              <div className="border-t pt-4">
                <h4 className="text-sm font-medium mb-3">Filter By</h4>

                {/* Difficulty Filter */}
                <div className="mb-4">
                  <label className="block text-sm font-medium mb-2">Difficulty Level</label>
                  <div className="space-y-2">
                    {["", "Beginner", "Intermediate", "Advanced"].map((level) => (
                      <label key={level || "all"} className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="radio"
                          name="difficulty"
                          value={level}
                          checked={selectedDifficulty === level}
                          onChange={(e) => setSelectedDifficulty(e.target.value)}
                          className="w-4 h-4"
                        />
                        <span className="text-sm">{level || "All Levels"}</span>
                      </label>
                    ))}
                  </div>
                </div>

                {/* Likes Filter */}
                <div>
                  <label className="block text-sm font-medium mb-2">Minimum Likes: {minLikes}</label>
                  <input
                    type="range"
                    min="0"
                    max="1000"
                    step="50"
                    value={minLikes}
                    onChange={(e) => setMinLikes(parseInt(e.target.value))}
                    className="w-full"
                  />
                  <div className="flex gap-2 mt-2">
                    <input
                      type="number"
                      min="0"
                      value={minLikes}
                      onChange={(e) => setMinLikes(Math.max(0, parseInt(e.target.value) || 0))}
                      className="flex-1 px-2 py-1 border rounded text-sm"
                    />
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-2 pt-4">
                <Button
                  variant="outline"
                  onClick={() => {
                    setSortBy("");
                    setSortOrder("desc");
                    setSelectedDifficulty("");
                    setMinLikes(0);
                  }}
                  className="flex-1"
                >
                  Reset All
                </Button>
                <Button
                  onClick={() => setShowSortDialog(false)}
                  className="flex-1"
                >
                  Apply
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        <Tabs defaultValue="projects" className="space-y-6">
          <TabsList>
            <TabsTrigger value="projects">Projects ({filteredAndSortedProjects.length})</TabsTrigger>
            <TabsTrigger value="users">Users ({filteredUsers.length})</TabsTrigger>
          </TabsList>

          <TabsContent value="projects" className="space-y-6">
            <div className="flex gap-2 overflow-x-auto pb-2">
              {categories.map((cat) => (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  className={`px-4 py-2 rounded-full text-sm whitespace-nowrap transition-colors ${
                    selectedCategory === cat ? "bg-[#c2350a] text-white" : "bg-white text-gray-700 hover:bg-gray-100"
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>

            {filteredAndSortedProjects.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {filteredAndSortedProjects.map((p) => <ProjectCard key={p.id} {...p} isAuthenticated={isAuthenticated} />)}
              </div>
            ) : (
              <NoResults icon={<SearchIcon />} title="No projects found" />
            )}
          </TabsContent>

          <TabsContent value="users">
            {filteredUsers.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredUsers.map((user) => (
                  <div key={user.user_id} className="bg-white rounded-lg p-6 shadow-sm hover:shadow-md transition-shadow">
                    <div className="flex items-start gap-4 mb-4">
                      <div className="w-16 h-16 rounded-full overflow-hidden bg-gray-100 flex-shrink-0">
                        {user.pic ? (
                          <img
                            src={user.pic}
                            alt={user.name}
                            className="w-full h-full object-cover"
                            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                          />
                        ) : (
                          <div className="w-full h-full bg-gradient-to-br from-[#c2350a] to-[#1c3738] flex items-center justify-center text-white text-xl">
                            {user.name.charAt(0).toUpperCase()}
                          </div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <Link to={`/profile/${user.username}`} className="font-medium hover:text-[#c2350a] block truncate">
                          {user.name}
                        </Link>
                        <p className="text-sm text-gray-600">@{user.username}</p>
                      </div>
                    </div>
                    <p className="text-sm text-gray-700 mb-4 line-clamp-2">{user.bio || "No bio yet."}</p>
                    <div className="flex items-center gap-4 text-sm text-gray-600 mb-4">
                      <span>{user.project_count} projects</span>
                      <span>{user.followers} followers</span>
                    </div>
                    <Button className="w-full" asChild>
                      <Link to={`/profile/${user.username}`}>View Profile</Link>
                    </Button>
                  </div>
                ))}
              </div>
            ) : (
              <NoResults icon={<User />} title="No users found" />
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

// Simple helper component for empty states
function NoResults({ icon, title }: { icon: React.ReactNode; title: string }) {
  return (
    <div className="bg-white rounded-lg p-12 text-center">
      <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4 text-gray-400">
        {icon}
      </div>
      <h3 className="text-xl mb-2">{title}</h3>
      <p className="text-gray-600">Try adjusting your search or filters.</p>
    </div>
  );
}


