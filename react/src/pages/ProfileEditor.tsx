import { Navbar } from "../components/Navbar";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Textarea } from "../components/ui/textarea";
import { useState, useEffect } from "react";
import { useNavigate } from "react-router";
import { Camera, MapPin, Briefcase, Link as LinkIcon } from "lucide-react";

export default function ProfileEditor() {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    username: "",
    bio: "",
    location: "",
    website: "",
    company: "",
    role: "",
    showEmail: false,
    pic: "",
  });

  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Character limits
  const MAX_FIRST_NAME = 13;
  const MAX_LAST_NAME = 13;
  const MAX_USERNAME = 35;
  const MAX_BIO = 500;
  const MAX_WEBSITE = 150;
  const MAX_LOCATION = 50;
  const MAX_COMPANY = 50;
  const MAX_ROLE = 50;

  // Fetch the authenticated user's profile data
  useEffect(() => {
    const fetchProfileData = async () => {
      try {
        const authResponse = await fetch("api/isauthed.php", {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
          },
          credentials: "include",
        });

        const authData = await authResponse.json();
        if (!authData.isAuthed) {
          navigate("/signin");
          return;
        }

        const response = await fetch("api/get_profile.php", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          credentials: "include",
        });

        const data = await response.json();
        
        console.log("Full API Response:", JSON.stringify(data, null, 2));

        if (response.ok && !data.error) {
          // Map API response to form field names
          setFormData({
            firstName: data.first_name || "",
            lastName: data.last_name || "",
            username: data.username || "",
            bio: data.bio || "",
            location: data.location || "",
            website: data.website || "",
            company: data.company || "",
            role: data.role || "",
            showEmail: data.showEmail === 1,
            pic: data.pic || "",
          });
        } else {
          setError(data.error || "Failed to load profile data");
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "An error occurred while loading profile");
      } finally {
        setLoading(false);
      }
    };

    fetchProfileData();
  }, [navigate]);

  const handleChange = (field: string, value: string | boolean) => {
    setFormData({ ...formData, [field]: value });
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onloadend = () => {
      setFormData((prev) => ({
        ...prev,
        pic: reader.result as string,
      }));
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Validate character limits
    if (formData.firstName.length > MAX_FIRST_NAME) {
      setError(`First name cannot exceed ${MAX_FIRST_NAME} characters.`);
      return;
    }
    if (formData.lastName.length > MAX_LAST_NAME) {
      setError(`Last name cannot exceed ${MAX_LAST_NAME} characters.`);
      return;
    }
    if (formData.username.length > MAX_USERNAME) {
      setError(`Username cannot exceed ${MAX_USERNAME} characters.`);
      return;
    }
    if (formData.bio.length > MAX_BIO) {
      setError(`Bio cannot exceed ${MAX_BIO} characters.`);
      return;
    }
    if (formData.website.length > MAX_WEBSITE) {
      setError(`Website cannot exceed ${MAX_WEBSITE} characters.`);
      return;
    }
    if (formData.location.length > MAX_LOCATION) {
      setError(`Location cannot exceed ${MAX_LOCATION} characters.`);
      return;
    }
    if (formData.company.length > MAX_COMPANY) {
      setError(`Company cannot exceed ${MAX_COMPANY} characters.`);
      return;
    }
    if (formData.role.length > MAX_ROLE) {
      setError(`Role cannot exceed ${MAX_ROLE} characters.`);
      return;
    }

    setIsSaving(true);

    try {
      const response = await fetch("api/update_profile.php", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({
          firstName: formData.firstName,
          lastName: formData.lastName,
          username: formData.username,
          location: formData.location,
          bio: formData.bio,
          company: formData.company,
          role: formData.role,
          website: formData.website,
          pic: formData.pic,
          showEmail: formData.showEmail ? 1 : 0,
        }),
      });

      const result = await response.json();

      if (response.ok) {
        navigate("/profile");
      } else {
        setError(result.error || "Failed to update profile");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred while updating profile");
    } finally {
      setIsSaving(false);
    }
  };



  return (
    <div className="min-h-screen bg-[#faf9f6]">
      <Navbar isAuthenticated={true} />

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-2xl sm:text-3xl mb-2">Edit Profile</h1>
          <p className="text-[#1c110a]">
            Update your profile information and settings
          </p>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
            <p className="text-red-800 font-medium">Error</p>
            <p className="text-red-700 text-sm mt-1">{error}</p>
          </div>
        )}

        {loading && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
            <p className="text-blue-800">Loading profile information...</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className={`space-y-8 ${loading ? 'opacity-50 pointer-events-none' : ''}`}>
          {/* Profile Photo */}
          <div className="bg-white rounded-lg p-4 sm:p-6 shadow-sm">
            <Label className="text-base mb-4 block">Profile Photo</Label>
            <div className="flex flex-col sm:flex-row items-center gap-6">
              {formData.pic ? (
                <img
                  src={"api/" + formData.pic}
                  alt="Profile"
                  className="w-24 h-24 rounded-full object-cover flex-shrink-0"
                />
              ) : (
                <div className="w-24 h-24 rounded-full bg-gradient-to-br from-[#c2350a] to-[#1c3738] flex items-center justify-center text-white text-3xl flex-shrink-0">
                  {formData.firstName.charAt(0)}
                </div>
              )}
              <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
                <div className="w-full sm:w-auto">
                  <input
                    id="profilePicInput"
                    type="file"
                    accept="image/*"
                    onChange={handleImageUpload}
                    className="hidden"
                  />
                  <Button asChild variant="outline" size="sm" className="w-full sm:w-auto">
                    <label htmlFor="profilePicInput" className="cursor-pointer flex items-center">
                      <Camera className="w-4 h-4 mr-2" />
                      Change Photo
                    </label>
                  </Button>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="w-full sm:w-auto"
                  onClick={() => handleChange("pic", "")}
                >
                  Remove
                </Button>
              </div>
            </div>
          </div>

          {/* Basic Information */}
          <div className="bg-white rounded-lg p-4 sm:p-6 shadow-sm space-y-6">
            <h3 className="font-medium text-lg">Basic Information</h3>

            <div className="grid md:grid-cols-2 gap-6">
              <div>
                <Label htmlFor="firstName">First Name</Label>
                <Input
                  id="firstName"
                  type="text"
                  placeholder="Your first name"
                  required
                  className="mt-1"
                  value={formData.firstName}
                  onChange={(e) => handleChange("firstName", e.target.value)}
                  maxLength={MAX_FIRST_NAME}
                />
              </div>

              <div>
                <Label htmlFor="lastName">Last Name</Label>
                <Input
                  id="lastName"
                  type="text"
                  placeholder="Your last name"
                  required
                  className="mt-1"
                  value={formData.lastName}
                  onChange={(e) => handleChange("lastName", e.target.value)}
                  maxLength={MAX_LAST_NAME}
                />
              </div>
            </div>

            <div>
              <Label htmlFor="username">Username</Label>
              <Input
                id="username"
                type="text"
                placeholder="username"
                required
                className="mt-1"
                value={formData.username}
                onChange={(e) => handleChange("username", e.target.value)}
                maxLength={MAX_USERNAME}
              />
              <p className="text-sm text-gray-500 mt-1">
                This is your unique identifier on ProCreate
              </p>
            </div>

            <div>
              <Label htmlFor="bio">Bio</Label>
              <Textarea
                id="bio"
                placeholder="Tell us about yourself..."
                rows={4}
                className="mt-1"
                value={formData.bio}
                onChange={(e) => handleChange("bio", e.target.value)}
                maxLength={MAX_BIO}
              />
              <p className="text-sm text-gray-500 mt-1">
                {formData.bio.length}/{MAX_BIO} characters
              </p>
            </div>

            <div className="grid md:grid-cols-2 gap-6">
              <div>
                <Label htmlFor="location">Location</Label>
                <div className="relative mt-1">
                  <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <Input
                    id="location"
                    type="text"
                    placeholder="City, Country"
                    className="pl-10"
                    value={formData.location}
                    onChange={(e) => handleChange("location", e.target.value)}
                    maxLength={MAX_LOCATION}
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="website">Website</Label>
                <div className="relative mt-1">
                  <LinkIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <Input
                    id="website"
                    type="text"
                    placeholder="yourwebsite.com"
                    className="pl-10"
                    value={formData.website}
                    onChange={(e) => handleChange("website", e.target.value)}
                    maxLength={MAX_WEBSITE}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Professional Information */}
          <div className="bg-white rounded-lg p-4 sm:p-6 shadow-sm space-y-6">
            <h3 className="font-medium text-lg">Professional Information</h3>

            <div className="grid md:grid-cols-2 gap-6">
              <div>
                <Label htmlFor="company">Company</Label>
                <div className="relative mt-1">
                  <Briefcase className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <Input
                    id="company"
                    type="text"
                    placeholder="Your company"
                    className="pl-10"
                    value={formData.company}
                    onChange={(e) => handleChange("company", e.target.value)}
                    maxLength={MAX_COMPANY}
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="role">Role</Label>
                <Input
                  id="role"
                  type="text"
                  placeholder="Your role"
                  className="mt-1"
                  value={formData.role}
                  onChange={(e) => handleChange("role", e.target.value)}
                  maxLength={MAX_ROLE}
                />
              </div>
            </div>


          </div>

          {/* Privacy Settings */}
          <div className="bg-white rounded-lg p-4 sm:p-6 shadow-sm">
            <h3 className="font-medium text-lg mb-4">Privacy Settings</h3>

            <div className="flex items-center gap-3">
              <input
                id="showEmail"
                type="checkbox"
                checked={formData.showEmail}
                onChange={(e) => handleChange("showEmail", e.target.checked)}
                className="w-4 h-4"
              />
              <Label htmlFor="showEmail" className="mb-0">
                Show my email on my profile
              </Label>
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-4 justify-end">
            <Button type="button" variant="outline" onClick={() => navigate("/profile")} disabled={isSaving}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSaving}>
              {isSaving ? "Saving..." : "Save Changes"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}