import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { Upload, X } from "lucide-react";
import { toast } from "sonner";
import { Navbar } from "../components/Navbar";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { Textarea } from "../components/ui/textarea";
import { categories } from "../data/mockProjects";

export default function UploadProject() {
  // State
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    category: "",
    tags: "",
    materials: "",
    software: "",
    difficulty: "",
    images: [] as string[],
  });
  const [files, setFiles] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [allowComments, setAllowComments] = useState(true);
  const [enableDownloads, setEnableDownloads] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSavingDraft, setIsSavingDraft] = useState(false);
  
  // Hooks
  const navigate = useNavigate();

  useEffect(() => {
    const verifyAuth = async () => {
      const response = await fetch("api/isauthed.php", {
        method: "GET",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
      });

      const data = await response.json();
      if (!data.isAuthed) {
        navigate("/signin");
      }
    };

    verifyAuth();
  }, [navigate]);

  // Event handlers
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(e.target.files || []);
    setFiles([...files, ...selectedFiles]);
    
    // Create preview URLs
    selectedFiles.forEach((file) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        setPreviews((prev) => [...prev, reader.result as string]);
      };
      reader.readAsDataURL(file);
    });
  };

  const handleRemoveFile = (index: number) => {
    setFiles(files.filter((_, i) => i !== index));
    setPreviews(previews.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      if (formData.description.length > 10000) {
        toast.error("Description must not exceed 10,000 characters");
        setIsSubmitting(false);
        return;
      }

      // Convert files to data URLs so backend receives an array of image strings
      const toDataURL = (file: File) =>
        new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(file);
        });

      const imageDataUrls = await Promise.all(files.map((f) => toDataURL(f)));

      // get CSRF token from get_csrf_token.php endpoint and include in request headers
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

      // Build JSON payload (backend expects JSON with `images` as data URLs)
      const payload = {
        csrf_token: csrfToken,
        title: formData.title,
        description: formData.description,
        category: formData.category,
        tags: formData.tags,
        materials_used: formData.materials,
        software_used: formData.software,
        difficulty_level: formData.difficulty,
        allow_comments: allowComments ? "1" : "0",
        enable_downloads: enableDownloads ? "1" : "0",
        images: imageDataUrls,
      };

      console.log("Sending payload with images:", imageDataUrls.length);

      const response = await fetch("api/new_project.php", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(payload),
      });

      // always try to parse JSON; server now returns HTTP 4xx/5xx when there
      // is a problem, but some validation responses might still come back 200
      // so we inspect the body as well.
      // capture raw text in case JSON parsing fails or we need to inspect
      const raw = await response.text();
      console.log("upload raw response text", raw);

      let data: any = null;
      try {
        data = JSON.parse(raw);
      } catch (e) {
        console.warn("failed to parse JSON", e);
      }
      console.log("upload parsed", response.status, data);
      if (data?.debug) {
        console.log("upload debug info", data.debug);
      }

      if (response.status === 401) {
        navigate("/signin");
        return;
      }

      if (!response.ok) {
        const msg = data?.error || "Upload failed";
        throw new Error(msg);
      }

      toast.success("Project uploaded successfully!");
      navigate("/profile");
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "An error occurred while uploading";
      toast.error(errorMessage);
      console.error("Upload error:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleChange = (field: string, value: string) => {
    setFormData({ ...formData, [field]: value });
  };

  const handleSaveDraft = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingDraft(true);

    try {
      if (formData.description.length > 10000) {
        toast.error("Description must not exceed 10,000 characters");
        setIsSavingDraft(false);
        return;
      }

      // Convert files to data URLs so backend receives an array of image strings
      const toDataURL = (file: File) =>
        new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(file);
        });

      const imageDataUrls = await Promise.all(files.map((f) => toDataURL(f)));

      // get CSRF token from get_csrf_token.php endpoint and include in request headers
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

      // Build JSON payload (backend expects JSON with `images` as data URLs)
      const payload = {
        csrf_token: csrfToken,
        title: formData.title,
        description: formData.description,
        category: formData.category,
        tags: formData.tags,
        materials_used: formData.materials,
        software_used: formData.software,
        difficulty_level: formData.difficulty,
        allow_comments: allowComments ? "1" : "0",
        enable_downloads: enableDownloads ? "1" : "0",
        images: imageDataUrls,
      };

      const response = await fetch("api/update_draft.php", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(payload),
      });

      const raw = await response.text();

      let data: any = null;
      try {
        data = JSON.parse(raw);
      } catch (e) {
        console.warn("failed to parse JSON", e);
      }

      if (response.status === 401) {
        navigate("/signin");
        return;
      }

      if (!response.ok || !data || data.error || !data.success) {
        const msg = data?.error || "Failed to save draft";
        throw new Error(msg);
      }

      toast.success("Draft saved successfully!");
      navigate("/profile");
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "An error occurred while saving the draft";
      toast.error(errorMessage);
      console.error("Save draft error:", error);
    } finally {
      setIsSavingDraft(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#faf9f6]">
      <Navbar isAuthenticated={true} />

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-2xl sm:text-3xl mb-2">Upload New Project</h1>
          <p className="text-[#1c110a]">
            Share your creative work with the community
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-8">
          {/* File Upload */}
          <div className="bg-white rounded-lg p-4 sm:p-6 shadow-sm">
            <Label className="text-base mb-4 block">Project Images</Label>
            
            {previews.length > 0 && (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-4">
                {previews.map((preview, index) => (
                  <div key={index} className="relative aspect-square rounded-lg overflow-hidden bg-gray-100">
                    <img
                      src={preview}
                      alt={`Preview ${index + 1}`}
                      className="w-full h-full object-cover"
                    />
                    <button
                      type="button"
                      onClick={() => handleRemoveFile(index)}
                      className="absolute top-2 right-2 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center hover:bg-red-600"
                    >
                      <X className="w-4 h-4" />
                    </button>
                    {index === 0 && (
                      <div className="absolute bottom-2 left-2 bg-[#c2350a] text-white text-xs px-2 py-1 rounded">
                        Cover
                      </div>
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
                <p className="text-sm text-gray-500">
                  PNG, JPG, GIF up to 10MB
                </p>
              </label>
            </div>
            <p className="text-sm text-gray-500 mt-2">
              The first image will be used as the cover image
            </p>
          </div>

          {/* Project Details */}
          <div className="bg-white rounded-lg p-6 shadow-sm space-y-6">
            <div>
              <Label htmlFor="title">Project Title</Label>
              <Input
                id="title"
                type="text"
                placeholder="Give your project a title"
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
                placeholder="Describe your project, process, and inspiration..."
                rows={6}
                required
                className="mt-1"
                value={formData.description}
                onChange={(e) => handleChange("description", e.target.value)}
              />
              <p className="text-sm text-gray-500 mt-1">
                Up to 10,000 characters
              </p>
            </div>

            <div>
              <Label htmlFor="category">Category</Label>
              <Select
                value={formData.category}
                onValueChange={(value) => handleChange("category", value)}
              >
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
                placeholder="design, branding, minimal (comma separated)"
                className="mt-1"
                value={formData.tags}
                onChange={(e) => handleChange("tags", e.target.value)}
              />
              <p className="text-sm text-gray-500 mt-1">
                Add tags to help others discover your work
              </p>
            </div>

            <div>
              <Label htmlFor="materials">Materials Used (optional)</Label>
              <Input
                id="materials"
                type="text"
                placeholder="e.g., Canvas, Acrylic paint, Digital assets"
                className="mt-1"
                value={formData.materials}
                onChange={(e) => handleChange("materials", e.target.value)}
              />
              <p className="text-sm text-gray-500 mt-1">
                List the materials or tools you used
              </p>
            </div>

            <div>
              <Label htmlFor="software">Software Used (optional)</Label>
              <Input
                id="software"
                type="text"
                placeholder="e.g., Adobe Photoshop, Figma, Blender"
                className="mt-1"
                value={formData.software}
                onChange={(e) => handleChange("software", e.target.value)}
              />
              <p className="text-sm text-gray-500 mt-1">
                What software or applications did you use?
              </p>
            </div>

            <div>
              <Label htmlFor="difficulty">Difficulty Level</Label>
              <Select
                value={formData.difficulty}
                onValueChange={(value) => handleChange("difficulty", value)}
              >
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Select difficulty level" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="beginner">Beginner</SelectItem>
                  <SelectItem value="intermediate">Intermediate</SelectItem>
                  <SelectItem value="advanced">Advanced</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-sm text-gray-500 mt-1">
                How would you rate the complexity of this project?
              </p>
            </div>
          </div>

          {/* Additional Settings */}
          <div className="bg-white rounded-lg p-6 shadow-sm">
            <h3 className="font-medium mb-4">Project Settings</h3>
            
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">Allow comments</p>
                  <p className="text-sm text-gray-600">
                    Let others comment on your project
                  </p>
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
                  <p className="text-sm text-gray-600">
                    Allow others to download your images
                  </p>
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

          {/* Actions */}
          <div className="flex gap-4 justify-end">
            <Button type="button" variant="outline" onClick={() => navigate("/home")} disabled={isSubmitting || isSavingDraft}>
              Cancel
            </Button>
            <Button type="button" variant="outline" onClick={handleSaveDraft} disabled={!formData.title || !formData.description || isSubmitting || isSavingDraft}>
              {isSavingDraft ? "Saving..." : "Save Draft"}
            </Button>
            <Button type="submit" disabled={!formData.title || !formData.description || files.length === 0 || isSubmitting || isSavingDraft}>
              {isSubmitting ? "Publishing..." : "Publish Project"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}