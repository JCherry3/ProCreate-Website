import { useState } from "react";
import { useNavigate } from "react-router";
import { Calendar, DollarSign, FileText, Plus, Tag, Users, X } from "lucide-react";
import { Navbar } from "../components/Navbar";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { Textarea } from "../components/ui/textarea";

type ProjectType = "individual" | "group";
interface GroupRole {
  role: string;
  count: string;
}

export default function PostRequest() {
  // State
  const [formData, setFormData] = useState({
    title: "",
    budget: "",
    deadline: "",
    description: "",
    category: "",
    projectType: "individual" as ProjectType,
  });
  const [groupRoles, setGroupRoles] = useState<GroupRole[]>([{ role: "", count: "1" }]);
  
  // Hooks
  const navigate = useNavigate();

  // Constants
  const categories = [
    "Branding",
    "UI/UX",
    "Photography",
    "Graphic Design",
    "Illustration",
    "3D Design",
    "Animation",
    "Video Editing",
    "Web Design",
    "Mobile Design",
    "Print Design",
    "Other",
  ];

  // Event handlers
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // run basic validation first
    if (!isFormValid()) {
      // determine reason for failure
      if (formData.title.length > MAX_TITLE) {
        alert(`Title cannot exceed ${MAX_TITLE} characters.`);
      } else if (formData.description.length > MAX_DESCRIPTION) {
        alert(`Description cannot exceed ${MAX_DESCRIPTION} characters.`);
      } else if (formData.budget.length > MAX_BUDGET) {
        alert(`Budget field cannot exceed ${MAX_BUDGET} characters.`);
      } else if (formData.projectType === "group") {
        alert("Please add at least one valid group role with a count of 1 or more.");
      } else {
        alert("Please fill in all required fields before submitting.");
      }
      return;
    }

    // Build payload for API
    const userId = localStorage.getItem("user_id");
    // const authToken = localStorage.getItem("authToken");

    // make request to the csrf token endpoint to get a token
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

    const payload = {
      csrf_token: csrfToken,
      project_title: formData.title,
      category: formData.category,
      description: formData.description,
      budget: Number.parseFloat(formData.budget.replaceAll(/[^0-9.]/g, "")) || 0,
      deadline: formData.deadline,
      date_of_request: new Date().toISOString().split("T")[0],
      project_type: formData.projectType,
      roles:
        formData.projectType === "group"
          ? groupRoles
              .map((entry) => ({
                role: entry.role.trim(),
                count: Number.parseInt(entry.count, 10),
              }))
              .filter((entry) => entry.role !== "" && Number.isInteger(entry.count) && entry.count >= 1)
          : [],
    };

    fetch("api/new_project_request.php", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(payload),
    })
      .then(async (res) => {
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          if (res.status === 401) {
            navigate("/signin");
          }
          throw new Error(err.error || "Failed to post request");
        }
        return res.json();
      })
      .then((data) => {
        console.log("Request created", data);
        alert("Your project request has been posted!");
        navigate("/requests");
      })
      .catch((err) => {
        console.error("Error posting request:", err);
        alert(err.message || "An error occurred while posting your request.");
      });
  };

  const handleInputChange = (field: string, value: string) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }));
  };
  const updateGroupRole = (index: number, field: keyof GroupRole, value: string) => {
    setGroupRoles((prev) =>
      prev.map((entry, i) => (i === index ? { ...entry, [field]: value } : entry))
    );
  };
  const addGroupRole = () => setGroupRoles((prev) => [...prev, { role: "", count: "1" }]);
  const removeGroupRole = (index: number) => {
    setGroupRoles((prev) => (prev.length <= 1 ? prev : prev.filter((_, i) => i !== index)));
  };

  // Helper functions
  const MAX_TITLE = 150;
  const MAX_DESCRIPTION = 10000;
  const MAX_BUDGET = 15;

  const isFormValid = () => {
    // basic non‑empty checks
    if (
      formData.title.trim() === "" ||
      formData.budget.trim() === "" ||
      formData.deadline.trim() === "" ||
      formData.description.trim() === "" ||
      formData.category === ""
    ) {
      return false;
    }

    // length restrictions
    if (
      formData.title.length > MAX_TITLE ||
      formData.description.length > MAX_DESCRIPTION ||
      formData.budget.length > MAX_BUDGET
    ) {
      return false;
    }
    if (formData.projectType === "group") {
      if (groupRoles.length === 0) return false;
      const invalidRole = groupRoles.some((entry) => {
        const role = entry.role.trim();
        const count = Number.parseInt(entry.count, 10);
        return role === "" || !Number.isInteger(count) || count < 1;
      });
      if (invalidRole) return false;
    }

    return true;
  };

  return (
    <div className="min-h-screen bg-[#faf9f6] overflow-x-hidden">
      <Navbar isAuthenticated={true} />

      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-2xl sm:text-3xl mb-2 break-words">Post a Project Request</h1>
          <p className="text-[#1c110a] text-sm sm:text-base break-words">
            Share your project needs and connect with talented creators
          </p>
        </div>

        <div className="bg-white rounded-lg p-6 sm:p-8 shadow-sm">
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Title */}
            <div className="space-y-2">
              <Label htmlFor="title" className="flex items-center gap-2">
                <FileText className="w-4 h-4" />
                Project Title *
              </Label>
              <Input
                id="title"
                placeholder="e.g., Brand Identity Design for Tech Startup"
                value={formData.title}
                onChange={(e) => handleInputChange("title", e.target.value)}
                required
                className="w-full"
              />
            </div>

            {/* Category */}
            <div className="space-y-2">
              <Label htmlFor="category" className="flex items-center gap-2">
                <Tag className="w-4 h-4" />
                Category *
              </Label>
              <Select
                value={formData.category}
                onValueChange={(value) => handleInputChange("category", value)}
                required
              >
                <SelectTrigger id="category" className="w-full">
                  <SelectValue placeholder="Select a category" />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((category) => (
                    <SelectItem key={category} value={category}>
                      {category}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Description */}
            <div className="space-y-2">
              <Label htmlFor="description">
                Project Description *
              </Label>
              <Textarea
                id="description"
                placeholder="Describe your project requirements, goals, and any specific details..."
                value={formData.description}
                onChange={(e) => handleInputChange("description", e.target.value)}
                required
                className="min-h-[150px] w-full"
              />
              <p className="text-xs text-gray-500">
                Be as detailed as possible to help creators understand your needs
              </p>
            </div>

            {/* Project Type */}
            <div className="space-y-2">
              <Label htmlFor="project-type" className="flex items-center gap-2">
                <Users className="w-4 h-4" />
                Project Type *
              </Label>
              <Select
                value={formData.projectType}
                onValueChange={(value) => handleInputChange("projectType", value)}
              >
                <SelectTrigger id="project-type" className="w-full">
                  <SelectValue placeholder="Select a project type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="individual">Individual</SelectItem>
                  <SelectItem value="group">Group</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {formData.projectType === "group" && (
              <div className="space-y-3 rounded-lg border border-gray-200 p-4">
                <div className="flex items-center justify-between gap-2">
                  <Label className="text-sm font-medium">Group Role Requirements *</Label>
                  <Button type="button" variant="outline" size="sm" onClick={addGroupRole}>
                    <Plus className="w-4 h-4 mr-1" />
                    Add Role
                  </Button>
                </div>
                {groupRoles.map((entry, index) => (
                  <div key={`group-role-${index}`} className="grid grid-cols-1 sm:grid-cols-[1fr_120px_auto] gap-2">
                    <Input
                      placeholder="Role name (e.g., Designer)"
                      value={entry.role}
                      onChange={(e) => updateGroupRole(index, "role", e.target.value)}
                      required
                    />
                    <Input
                      type="number"
                      min="1"
                      step="1"
                      placeholder="Count"
                      value={entry.count}
                      onChange={(e) => updateGroupRole(index, "count", e.target.value)}
                      required
                    />
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => removeGroupRole(index)}
                      disabled={groupRoles.length === 1}
                      aria-label={`Remove role ${index + 1}`}
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}

            {/* Budget */}
            <div className="space-y-2">
              <Label htmlFor="budget" className="flex items-center gap-2">
                <DollarSign className="w-4 h-4" />
                Budget *
              </Label>
              <Input
                id="budget"
                placeholder="e.g., $2,500 - $3,500"
                value={formData.budget}
                onChange={(e) => handleInputChange("budget", e.target.value)}
                required
                className="w-full"
              />
              <p className="text-xs text-gray-500">
                Provide a budget range to help creators assess the project
              </p>
            </div>

            {/* Deadline */}
            <div className="space-y-2">
              <Label htmlFor="deadline" className="flex items-center gap-2">
                <Calendar className="w-4 h-4" />
                Deadline *
              </Label>
              <Input
                id="deadline"
                type="date"
                value={formData.deadline}
                onChange={(e) => handleInputChange("deadline", e.target.value)}
                required
                className="w-full"
                min={new Date().toISOString().split("T")[0]}
              />
              <p className="text-xs text-gray-500">
                When do you need this project completed?
              </p>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row gap-3 pt-4">
              <Button
                type="submit"
                disabled={!isFormValid()}
                className="flex-1"
              >
                Post Request
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => navigate("/requests")}
                className="flex-1"
              >
                Cancel
              </Button>
            </div>
          </form>
        </div>

        {/* Tips Section */}
        <div className="mt-8 bg-[#c2350a] bg-opacity-10 rounded-lg p-6">
          <h3 className="font-medium mb-3 text-[#1c110a]">Tips for Getting Better Responses</h3>
          <ul className="space-y-2 text-sm text-[#1c110a]">
            <li className="flex gap-2">
              <span className="text-[#c2350a] flex-shrink-0">•</span>
              <span>Be specific about your project requirements and goals</span>
            </li>
            <li className="flex gap-2">
              <span className="text-[#c2350a] flex-shrink-0">•</span>
              <span>Include reference materials or examples if possible</span>
            </li>
            <li className="flex gap-2">
              <span className="text-[#c2350a] flex-shrink-0">•</span>
              <span>Set a realistic budget and timeline</span>
            </li>
            <li className="flex gap-2">
              <span className="text-[#c2350a] flex-shrink-0">•</span>
              <span>Respond promptly to creators who show interest</span>
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}