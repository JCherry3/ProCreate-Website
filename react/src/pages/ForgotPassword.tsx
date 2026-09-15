import { Link } from "react-router";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { useState } from "react";
import { ArrowLeft, Mail } from "lucide-react";


export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Mock password reset - in real app would send reset email
    setSubmitted(true);
  };

  return (
    <div className="min-h-screen bg-[#faf9f6] flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <Link to="/" className="flex justify-center items-center gap-2 mb-6">
          <img src="/logo.png" alt="ProCreate Logo" className="h-10 w-10" />
          <span className="text-2xl font-semibold text-[#1c110a]">ProCreate</span>
        </Link>
        <h2 className="text-center text-2xl sm:text-3xl mb-2 px-4">Reset your password</h2>
        <p className="text-center text-[#1c110a] px-4">
          Enter your email and we'll send you a reset link
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md px-4">
        <div className="bg-white py-8 px-4 shadow-sm rounded-lg sm:px-10">
          {!submitted ? (
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
                  placeholder="you@example.com"
                />
              </div>

              <Button type="submit" className="w-full">
                Send reset link
              </Button>

              <div className="text-center">
                <Link
                  to="/signin"
                  className="inline-flex items-center gap-2 text-sm text-[#c2350a] hover:text-[#a02d08]"
                >
                  <ArrowLeft className="w-4 h-4" />
                  Back to sign in
                </Link>
              </div>
            </form>
          ) : (
            <div className="text-center space-y-4">
              <div className="w-16 h-16 bg-[#1c3738] bg-opacity-10 rounded-full flex items-center justify-center mx-auto">
                <Mail className="w-8 h-8 text-[#1c3738]" />
              </div>
              <div>
                <h3 className="text-xl mb-2">Check your email</h3>
                <p className="text-gray-600 break-words px-2">
                  We've sent a password reset link to{" "}
                  <span className="font-medium break-all">{email}</span>
                </p>
              </div>
              <p className="text-sm text-gray-500 px-2">
                Didn't receive the email? Check your spam folder or{" "}
                <button
                  onClick={() => setSubmitted(false)}
                  className="text-purple-600 hover:text-purple-500"
                >
                  try again
                </button>
              </p>
              <Button asChild variant="outline" className="w-full">
                <Link to="/signin">Return to sign in</Link>
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}