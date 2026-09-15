import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { User, LayoutGrid } from "lucide-react";
import { Navbar } from "../components/Navbar";
import { ProjectCard } from "../components/ProjectCard";
import { Button } from "../components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/tabs";
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
  isLiked: boolean;
  isSaved: boolean;
  difficulty: string;
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

export default function Feed() {
  // State
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [projects, setProjects] = useState<Project[]>([]);
  const [users, setUsers] = useState<DBUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  // Check auth
  useEffect(() => {
    fetch("api/isauthed.php", { credentials: "include" })
      .then(r => r.json())
      .then(d => setIsAuthenticated(d.isAuthed === true))
      .catch(() => setIsAuthenticated(false));
  }, []);

  // Load data from backend
  useEffect(() => {
    const loadFeedData = async () => {
      setLoading(true);
      setError(null);

      try {
        const [projRes, userRes] = await Promise.all([
          fetch("api/get_projects.php", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({}),
          }),
          fetch("api/get_users.php")
        ]);

        if (!projRes.ok || !userRes.ok) throw new Error("Failed to load feed data");

        const projData = await projRes.json();
        const userData = await userRes.json();

        setProjects(Array.isArray(projData) ? projData : []);
        setUsers(Array.isArray(userData) ? userData : []);
      } catch (err) {
        console.error(err);
        setError("Unable to connect to the server.");
      } finally {
        setLoading(false);
      }
    };

    loadFeedData();
  }, []);

  // Filter Logic for Projects
  const filteredProjects = selectedCategory === "All"
    ? projects
    : projects.filter((p) => p.category === selectedCategory);

  const hottestProjects = [...projects]
    .sort((a, b) => Number(b.likes) - Number(a.likes))
    .slice(0, 8);

  return (
    <div className="min-h-screen bg-[#faf9f6]">
      <Navbar isAuthenticated={isAuthenticated} />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl sm:text-3xl mb-2 font-semibold text-[#1c110a]">
            Discover Creative Work
          </h1>
          <p className="text-gray-600">
            Explore amazing projects and connect with talented creators.
          </p>
        </div>

        {/* Main Content Tabs */}
        <Tabs defaultValue="projects" className="space-y-8">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <TabsList>
              <TabsTrigger value="projects" className="flex gap-2">
                <LayoutGrid className="w-4 h-4" /> Projects
              </TabsTrigger>
              <TabsTrigger value="users" className="flex gap-2">
                <User className="w-4 h-4" /> Creators
              </TabsTrigger>
            </TabsList>
          </div>

          {/* Loading & Error States */}
          {loading && <p className="text-center py-10 text-gray-500">Curating your feed...</p>}
          {error && <p className="text-center py-10 text-red-500">{error}</p>}

          {/* Projects Feed */}
          <TabsContent value="projects" className="mt-0 focus-visible:outline-none">
            {!loading && filteredProjects.length > 0 ? (
              <>
                <section className="mb-8">
                  <div className="mb-4">
                    <h2 className="text-xl sm:text-2xl font-semibold text-[#1c110a]">Today's Hottest Projects</h2>
                    <p className="text-sm text-gray-600">Most liked projects of the day.</p>
                  </div>
                  {hottestProjects.length > 0 && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                      {hottestProjects.map((project) => (
                        <ProjectCard key={`hot-${project.id}`} {...project} isAuthenticated={isAuthenticated} />
                      ))}
                    </div>
                  )}
                </section>

                <div className="mb-6">
                  <h2 className="text-xl sm:text-2xl font-semibold text-[#1c110a] mb-3">New Projects</h2>
                  <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
                    {categories.map((cat) => (
                      <button
                        key={cat}
                        onClick={() => setSelectedCategory(cat)}
                        className={`px-4 py-1.5 rounded-full text-sm whitespace-nowrap transition-all ${
                          selectedCategory === cat
                            ? "bg-[#c2350a] text-white shadow-sm"
                            : "bg-white text-gray-600 border border-gray-200 hover:border-gray-300"
                        }`}
                      >
                        {cat}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                  {filteredProjects.map((project) => (
                    <ProjectCard key={project.id} {...project} isAuthenticated={isAuthenticated} />
                  ))}
                </div>
                <div className="mt-12 text-center">
                  <Button variant="outline" className="px-8">Load More Projects</Button>
                </div>
              </>
            ) : !loading && (
              <EmptyState icon="🎨" title="No projects found" subtitle="Try switching categories." />
            )}
          </TabsContent>

          {/* Creators Feed */}
          <TabsContent value="users" className="mt-0 focus-visible:outline-none">
            {!loading && users.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {users.map((user) => (
                  <UserFeedCard key={user.user_id} user={user} />
                ))}
              </div>
            ) : !loading && (
              <EmptyState icon="👤" title="No creators found" subtitle="Check back later for new talent." />
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

/** * Sub-components for cleaner code
 */

function UserFeedCard({ user }: { user: DBUser }) {
  return (
    <div className="bg-white rounded-xl p-6 border border-gray-100 shadow-sm hover:shadow-md transition-all">
      <div className="flex items-center gap-4 mb-4">
        <div className="w-14 h-14 rounded-full overflow-hidden bg-gray-100 border flex-shrink-0">
          {user.pic ? (
            <img
              src={user.pic}
              alt={user.name}
              className="w-full h-full object-cover"
              onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
            />
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-[#c2350a] to-[#5e1a05] flex items-center justify-center text-white text-lg font-bold">
              {user.name.charAt(0).toUpperCase()}
            </div>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <Link to={`/profile/${user.username}`} className="font-semibold hover:text-[#c2350a] block truncate">
            {user.name}
          </Link>
          <p className="text-xs text-gray-500">@{user.username}</p>
        </div>
      </div>
      <p className="text-sm text-gray-600 line-clamp-2 mb-4 h-10">{user.bio || "Creative professional."}</p>
      <div className="flex justify-between items-center text-xs text-gray-500 mb-4 px-1">
        <span><strong>{user.project_count}</strong> Projects</span>
        <span><strong>{user.followers}</strong> Followers</span>
      </div>
      <Button variant="secondary" className="w-full text-xs" asChild>
        <Link to={`/profile/${user.username}`}>View Portfolio</Link>
      </Button>
    </div>
  );
}

function EmptyState({ icon, title, subtitle }: { icon: string; title: string; subtitle: string }) {
  return (
    <div className="text-center py-20">
      <div className="text-4xl mb-4">{icon}</div>
      <h3 className="text-lg font-medium text-gray-900">{title}</h3>
      <p className="text-gray-500">{subtitle}</p>
    </div>
  );
}


