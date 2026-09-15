import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import logoImage from "../../public/logo.png";

export default function SignIn() {
  // State
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  
  // Hooks
  const navigate = useNavigate();

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

  // Event handlers
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Get form values
    // Create request payload
      const payload = {
          email: email,
          password: password
      };

      // Send POST request
      fetch("api/user_login.php", {
          method: "POST",
          headers: {
              "Content-Type": "application/json"
          },
          body: JSON.stringify(payload)
      })
          .then(response => response.json().then(data => ({ response, data })))
          .then(({ response, data }) => {
              if (!response.ok) {
                  // Error signing in - use the error message from the server
                  console.log(data);
                  setError(data.error || "Invalid email or password. Please try again.");
                  return;
              }
              // Signed in!
              console.log("Success:", data);
              // user_id is no longer stored in localStorage; rely on server-side session

              // Redirect to home page
              navigate("/home");
          })
          .catch(error => {
              console.error("Error:", error);
              setError("An error occurred while signing in. Please try again later.");
          });
  };

  return (
    <div className="min-h-screen bg-[#faf9f6] flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <Link to="/" className="flex justify-center items-center gap-2 mb-6">
          <img src={logoImage} alt="ProCreate Logo" className="h-10 w-10" />
          <span className="text-2xl font-semibold text-[#1c110a]">ProCreate</span>
        </Link>
        <h2 className="text-center text-2xl sm:text-3xl mb-2 px-4">Welcome back</h2>
        <p className="text-center text-[#1c110a] px-4">
          Sign in to your account to continue
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md px-4">
        <div className="bg-white py-8 px-4 shadow-sm rounded-lg sm:px-10">
          {error && (
            <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3">
              <div className="flex-1">
                <p className="text-sm font-medium text-red-900">{error}</p>
              </div>
              <button
                onClick={() => setError("")}
                className="flex-shrink-0 text-red-400 hover:text-red-600"
              >
                <span className="sr-only">Close</span>
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
              </button>
            </div>
          )}
          <form className="space-y-6" onSubmit={handleSubmit}>
            <div>
              <Label htmlFor="email">Email address</Label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                required
                className="mt-1"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>

            <div>
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                autoComplete="current-password"
                required
                className="mt-1"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div className="flex items-center">
                <input
                  id="remember-me"
                  type="checkbox"
                  className="h-4 w-4 rounded border-gray-300 flex-shrink-0"
                />
                <label htmlFor="remember-me" className="ml-2 text-sm text-gray-600">
                  Remember me
                </label>
              </div>

              <Link
                to="/forgot-password"
                className="text-sm text-[#c2350a] hover:text-[#a02d08]"
              >
                Forgot password?
              </Link>
            </div>

            <Button type="submit" className="w-full">
              Sign in
            </Button>
          </form>

          <p className="mt-6 text-center text-sm text-[#1c110a]">
            Don't have an account?{" "}
            <Link to="/signup" className="text-[#c2350a] hover:text-[#a02d08]">
              Sign up
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}