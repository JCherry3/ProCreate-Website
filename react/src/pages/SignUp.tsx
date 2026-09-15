import { Link, useNavigate } from "react-router";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { useState, useEffect } from "react";
import { X } from "lucide-react";
import logoImage from "../../public/logo.png";

export default function SignUp() {
  const navigate = useNavigate();
  const [error, setError] = useState("");
  const [activeLegalModal, setActiveLegalModal] = useState<"terms" | "privacy" | null>(null);
  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    username: "",
    email: "",
    password: "",
  });

  // Redirect to home if already signed in via API auth endpoint
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const response = await fetch("api/isauthed.php", {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
          },
          credentials: "include",
        });

        if (!response.ok) {
          return;
        }

        const data = await response.json();
        if (data.authenticated || data.isAuthed || data.success) {
          navigate("/home");
        }
      } catch (error) {
        console.error("isauthed check failed", error);
      }
    };

    checkAuth();
  }, [navigate]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Mock sign up - in real app would create account on server
    // Create request payload (use formData.* for all values)
    const payload = {
      first_name: formData.firstName,
      last_name: formData.lastName,
      username: formData.username,
      email: formData.email,
      password: formData.password
    };

    // Send POST request
    fetch("api/create_user.php", {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify(payload)
    })
        .then(response => {
            if (!response.ok) {
                console.log(response)
                alert("Invalid sign up details. Please try again.");
                throw new Error("Network response was not ok");
            }
            return response.json(); // assuming PHP returns JSON
        })
        .then(data => {
            console.log("Success:", data);
            alert("Account created successfully!");
            
            // Store user_id (auth token is now handled server-side via sessions)
            localStorage.setItem("user_id", data.user_id);

            // Go to the home page
            navigate("/home");
        })
        .catch(error => {
          alert("An error occurred during sign up. Please try again.");
            console.error("Error:", error);
        });
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({
      ...formData,
      [e.target.id]: e.target.value,
    });
  };

  const modalContent = activeLegalModal === "terms"
    ? {
        title: "Terms of Service",
        body: "Come on bro who even reads these",
      }
    : activeLegalModal === "privacy"
      ? {
          title: "Privacy Policy",
          body: "Quite frankly we're gonna sell all your data to China, Israel, and Russia for profit",
        }
      : null;

  return (
    <div className="min-h-screen bg-[#faf9f6] flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <Link to="/" className="flex justify-center items-center gap-2 mb-6">
          <img src={logoImage} alt="ProCreate Logo" className="h-10 w-10" />
          <span className="text-2xl font-semibold text-[#1c110a]">ProCreate</span>
        </Link>
        <h2 className="text-center text-2xl sm:text-3xl mb-2 px-4">Create your account</h2>
        <p className="text-center text-[#1c110a] px-4">
          Join the creative community today
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md px-4">
        <div className="bg-white py-8 px-4 shadow-sm rounded-lg sm:px-10">
          <form className="space-y-6" onSubmit={handleSubmit}>
            <div className="grid grid-cols-2 gap-3 sm:gap-4">
              <div>
                <Label htmlFor="firstName" className="text-sm">First name</Label>
                <Input
                  id="firstName"
                  type="text"
                  autoComplete="given-name"
                  required
                  className="mt-1"
                  value={formData.firstName}
                  onChange={handleChange}
                />
              </div>

              <div>
                <Label htmlFor="lastName" className="text-sm">Last name</Label>
                <Input
                  id="lastName"
                  type="text"
                  autoComplete="family-name"
                  required
                  className="mt-1"
                  value={formData.lastName}
                  onChange={handleChange}
                />
              </div>
            </div>

            <div>
              <Label htmlFor="username">Username</Label>
              <Input
                id="username"
                type="text"
                autoComplete="username"
                required
                className="mt-1"
                value={formData.username}
                onChange={handleChange}
              />
            </div>

            <div>
              <Label htmlFor="email">Email address</Label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                required
                className="mt-1"
                value={formData.email}
                onChange={handleChange}
              />
            </div>

            <div>
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                autoComplete="new-password"
                required
                className="mt-1"
                value={formData.password}
                onChange={handleChange}
              />
              <p className="mt-1 text-sm text-gray-500">
                Must be at least 8 characters
              </p>
            </div>

            <div className="flex items-start gap-2">
              <input
                id="terms"
                type="checkbox"
                required
                className="h-4 w-4 mt-1 rounded border-gray-300 flex-shrink-0"
              />
              <label htmlFor="terms" className="text-sm text-gray-600 leading-tight">
                I agree to the{" "}
                <button
                  type="button"
                  onClick={() => setActiveLegalModal("terms")}
                  className="text-[#c2350a] hover:text-[#a02d08]"
                >
                  Terms of Service
                </button>{" "}
                and{" "}
                <button
                  type="button"
                  onClick={() => setActiveLegalModal("privacy")}
                  className="text-[#c2350a] hover:text-[#a02d08]"
                >
                  Privacy Policy
                </button>
              </label>
            </div>

            <Button type="submit" className="w-full">
              Create account
            </Button>
          </form>

          <p className="mt-6 text-center text-sm text-[#1c110a]">
            Already have an account?{" "}
            <Link to="/signin" className="text-[#c2350a] hover:text-[#a02d08]">
              Sign in
            </Link>
          </p>
        </div>
      </div>

      {modalContent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-white/10 px-4 backdrop-blur-md">
          <div className="relative w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <button
              type="button"
              onClick={() => setActiveLegalModal(null)}
              aria-label="Close popup"
              className="absolute top-4 right-4 text-gray-500 transition-colors hover:text-gray-800"
            >
              <X className="h-5 w-5" />
            </button>
            <h3 className="pr-8 text-xl font-semibold text-[#1c110a]">
              {modalContent.title}
            </h3>
            <p className="mt-4 text-sm leading-6 text-gray-700">
              {modalContent.body}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
