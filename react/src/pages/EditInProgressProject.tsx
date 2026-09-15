import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router";
import { Upload, X } from "lucide-react";
import { toast } from "sonner";
import { Navbar } from "../components/Navbar";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { Textarea } from "../components/ui/textarea";
import { categories } from "../data/mockProjects";

interface InProgressProject {
  id: string;
  title: string;
  description: string;
  category: string;
  tags: string;
  materials_used: string;
  software_used: string;
  difficulty: string;
  difficulty_level?: string;
  allow_comments: number;
  enable_downloads: number;
  images?: string[];
}

const fileToDataUrl = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });

const filesToDataUrls = (files: File[]) => Promise.all(files.map((file) => fileToDataUrl(file)));

/** DB ENUM uses title case; SelectItem values are lowercase — normalize so Radix Select matches after reload. */
function normalizeDifficultyForSelect(raw: unknown): string {
  const s = String(raw ?? "").trim().toLowerCase();
  if (s === "beginner" || s === "intermediate" || s === "advanced") {
    return s;
  }
  return "";
}

export default function EditInProgressProject() {
  const navigate = useNavigate();
  const { id } = useParams();

  const [loading, setLoading] = useState(true);
  const [isSavingDraft, setIsSavingDraft] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [publishError, setPublishError] = useState("");

  const [formData, setFormData] = useState({
    title: "",
    description: "",
    category: "",
    tags: "",
    materials: "",
    software: "",
    difficulty: "",
  });

  const [allowComments, setAllowComments] = useState(true);
  const [enableDownloads, setEnableDownloads] = useState(false);
  const [existingImages, setExistingImages] = useState<string[]>([]);
  const [newFiles, setNewFiles] = useState<File[]>([]);
  const [newPreviews, setNewPreviews] = useState<string[]>([]);

  const allPreviews = useMemo(() => [...existingImages, ...newPreviews], [existingImages, newPreviews]);

  useEffect(() => {
    const verifyAuthAndLoadDraft = async () => {
      try {
        const authResponse = await fetch("api/isauthed.php", {
          method: "GET",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
        });

        const authData = await authResponse.json();
        if (!authData.isAuthed) {
          navigate("/signin");
          return;
        }

        if (!id) {
          toast.error("Missing draft id");
          navigate("/profile");
          return;
        }

        const response = await fetch("api/get_in_progress.php", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ project_id: Number(id), limit: 1 }),
        });

        if (!response.ok) {
          throw new Error("Failed to load draft");
        }

        const data = await response.json();
        const project: InProgressProject | null = Array.isArray(data) && data.length > 0 ? data[0] : null;

        if (!project) {
          toast.error("Draft not found");
          navigate("/profile");
          return;
        }

        setFormData({
          title: project.title ?? "",
          description: project.description ?? "",
          category: project.category ?? "",
          tags: project.tags ?? "",
          materials: project.materials_used ?? "",
          software: project.software_used ?? "",
          difficulty: normalizeDifficultyForSelect(project.difficulty_level ?? project.difficulty),
        });

        setAllowComments(Number(project.allow_comments) === 1);
        setEnableDownloads(Number(project.enable_downloads) === 1);
        setExistingImages(Array.isArray(project.images) ? project.images : []);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Failed to load draft";
        toast.error(errorMessage);
        navigate("/profile");
      } finally {
        setLoading(false);
      }
    };

    verifyAuthAndLoadDraft();
  }, [id, navigate]);

  const handleChange = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(e.target.files || []);
    if (selectedFiles.length === 0) return;

    setNewFiles((prev) => [...prev, ...selectedFiles]);

    const previews = await filesToDataUrls(selectedFiles);
    setNewPreviews((prev) => [...prev, ...previews]);
  };

  const handleRemoveImage = (index: number) => {
    if (index < existingImages.length) {
      setExistingImages((prev) => prev.filter((_, i) => i !== index));
      return;
    }

    const newIndex = index - existingImages.length;
    setNewFiles((prev) => prev.filter((_, i) => i !== newIndex));
    setNewPreviews((prev) => prev.filter((_, i) => i !== newIndex));
  };

  const validateForm = () => {
    if (formData.description.length > 10000) {
      toast.error("Description must not exceed 10,000 characters");
      return false;
    }

    if (allPreviews.length === 0) {
      toast.error("At least one image is required");
      return false;
    }

    return true;
  };

  const getCsrfToken = async () => {
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

    return csrfToken;
  };

  const buildPayload = async () => {
    const newImageDataUrls = await filesToDataUrls(newFiles);

    return {
      title: formData.title,
      description: formData.description,
      category: formData.category,
      tags: formData.tags,
      materials_used: formData.materials,
      software_used: formData.software,
      difficulty_level: formData.difficulty,
      allow_comments: allowComments ? "1" : "0",
      enable_downloads: enableDownloads ? "1" : "0",
      images: [...existingImages, ...newImageDataUrls],
    };
  };

  const handleSaveDraft = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id || !validateForm()) return;

    setIsSavingDraft(true);
    setPublishError("");
    try {
      const csrfToken = await getCsrfToken();
      const payload = await buildPayload();

      const response = await fetch("api/update_draft.php", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          csrf_token: csrfToken,
          project_id: Number(id),
          ...payload,
        }),
      });

      const raw = await response.text();
      let data: any = null;
      try {
        data = JSON.parse(raw);
      } catch {
        data = null;
      }

      if (response.status === 401) {
        navigate("/signin");
        return;
      }

      if (!response.ok || !data || data.error || !data.success) {
        const msg = data?.error || "Failed to save draft";
        throw new Error(msg);
      }

      toast.success("Draft updated successfully!");
      navigate("/profile");
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Failed to save draft";
      toast.error(errorMessage);
    } finally {
      setIsSavingDraft(false);
    }
  };

  const handlePostProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id || !validateForm()) return;

    setIsSubmitting(true);
    setPublishError("");
    try {
      const csrfToken = await getCsrfToken();
      const payload = await buildPayload();

      const response = await fetch("api/publish_project.php", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          csrf_token: csrfToken,
          project_id: Number(id),
          post: 1,
          ...payload,
        }),
      });

      const raw = await response.text();
      let data: any = null;
      try {
        data = JSON.parse(raw);
      } catch {
        data = null;
      }

      if (response.status === 401) {
        navigate("/signin");
        return;
      }

      if (!response.ok || !data || data.error || !data.success) {
        const msg = data?.error || "Failed to publish project";
        setPublishError(msg);
        throw new Error(msg);
      }

      toast.success("Project published successfully!");
      navigate("/home");
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Failed to publish project";
      setPublishError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#faf9f6]">
        <Navbar isAuthenticated={true} />
        <div className="max-w-4xl mx-auto px-4 py-8">Loading draft...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#faf9f6]">
      <Navbar isAuthenticated={true} />

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-2xl sm:text-3xl mb-2">Edit In-Progress Project</h1>
          <p className="text-[#1c110a]">Update your draft and publish when it is ready</p>
        </div>

        <form className="space-y-8">
          <div className="bg-white rounded-lg p-4 sm:p-6 shadow-sm">
            <Label className="text-base mb-4 block">Project Images</Label>

            {allPreviews.length > 0 && (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-4">
                {allPreviews.map((preview, index) => (
                  <div key={`${preview}-${index}`} className="relative aspect-square rounded-lg overflow-hidden bg-gray-100">
                    <img src={preview} alt={`Preview ${index + 1}`} className="w-full h-full object-cover" />
                    <button
                      type="button"
                      onClick={() => handleRemoveImage(index)}
                      className="absolute top-2 right-2 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center hover:bg-red-600"
                    >
                      <X className="w-4 h-4" />
                    </button>
                    {index === 0 && (
                      <div className="absolute bottom-2 left-2 bg-[#c2350a] text-white text-xs px-2 py-1 rounded">Cover</div>
                    )}
                  </div>
                ))}
              </div>
            )}

            <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 sm:p-12 text-center hover:border-[#c2350a] transition-colors">
              <input
                type="file"
                id="file-upload"
                className="hidden"
                accept="image/*"
                multiple
                onChange={handleFileChange}
              />
              <label htmlFor="file-upload" className="cursor-pointer">
                <div className="w-16 h-16 bg-[#c2350a] bg-opacity-10 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Upload className="w-8 h-8 text-[#c2350a]" />
                </div>
                <p className="text-base sm:text-lg mb-2">
                  <span className="text-[#c2350a]">Click to upload</span> or drag and drop
                </p>
                <p className="text-sm text-gray-500">PNG, JPG, GIF up to 10MB</p>
              </label>
            </div>
          </div>

          <div className="bg-white rounded-lg p-6 shadow-sm space-y-6">
            <div>
              <Label htmlFor="title">Project Title</Label>
              <Input
                id="title"
                type="text"
                required
                className="mt-1"
                value={formData.title}
                onChange={(e) => handleChange("title", e.target.value)}
              />
            </div>

            <div>
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                rows={6}
                required
                className="mt-1"
                value={formData.description}
                onChange={(e) => handleChange("description", e.target.value)}
              />
              <p className="text-sm text-gray-500 mt-1">Up to 10,000 characters</p>
            </div>

            <div>
              <Label htmlFor="category">Category</Label>
              <Select value={formData.category} onValueChange={(value) => handleChange("category", value)}>
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Select a category" />
                </SelectTrigger>
                <SelectContent>
                  {categories.filter((cat) => cat !== "All").map((category) => (
                    <SelectItem key={category} value={category}>
                      {category}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="tags">Tags (optional)</Label>
              <Input
                id="tags"
                type="text"
                className="mt-1"
                value={formData.tags}
                onChange={(e) => handleChange("tags", e.target.value)}
              />
            </div>

            <div>
              <Label htmlFor="materials">Materials Used (optional)</Label>
              <Input
                id="materials"
                type="text"
                className="mt-1"
                value={formData.materials}
                onChange={(e) => handleChange("materials", e.target.value)}
              />
            </div>

            <div>
              <Label htmlFor="software">Software Used (optional)</Label>
              <Input
                id="software"
                type="text"
                className="mt-1"
                value={formData.software}
                onChange={(e) => handleChange("software", e.target.value)}
              />
            </div>

            <div>
              <Label htmlFor="difficulty">Difficulty Level</Label>
              <Select value={formData.difficulty} onValueChange={(value) => handleChange("difficulty", value)}>
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Select difficulty level" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="beginner">Beginner</SelectItem>
                  <SelectItem value="intermediate">Intermediate</SelectItem>
                  <SelectItem value="advanced">Advanced</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="bg-white rounded-lg p-6 shadow-sm">
            <h3 className="font-medium mb-4">Project Settings</h3>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">Allow comments</p>
                  <p className="text-sm text-gray-600">Let others comment on your project</p>
                </div>
                <input
                  type="checkbox"
                  checked={allowComments}
                  onChange={(e) => setAllowComments(e.target.checked)}
                  className="w-5 h-5 rounded"
                />
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">Enable downloads</p>
                  <p className="text-sm text-gray-600">Allow others to download your images</p>
                </div>
                <input
                  type="checkbox"
                  checked={enableDownloads}
                  onChange={(e) => setEnableDownloads(e.target.checked)}
                  className="w-5 h-5 rounded"
                />
              </div>
            </div>
          </div>

          <div className="flex gap-4 justify-end">
            <Button type="button" variant="outline" onClick={() => navigate("/profile")} disabled={isSubmitting || isSavingDraft}>
              Cancel
            </Button>
            <Button type="button" variant="outline" onClick={handleSaveDraft} disabled={!formData.title || !formData.description || isSubmitting || isSavingDraft}>
              {isSavingDraft ? "Saving..." : "Save Changes"}
            </Button>
            <Button type="button" onClick={handlePostProject} disabled={!formData.title || !formData.description || isSubmitting || isSavingDraft}>
              {isSubmitting ? "Posting..." : "Post Project"}
            </Button>
          </div>
          {publishError && (
            <p className="text-sm text-red-600">{publishError}</p>
          )}
        </form>
      </div>
    </div>
  );
}
