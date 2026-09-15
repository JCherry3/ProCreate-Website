import { Navbar } from "../components/Navbar";
import { Button } from "../components/ui/button";
import { Link, useNavigate } from "react-router";
import { TrendingUp, ArrowRight } from "lucide-react";

export default function Welcome() {
  const navigate = useNavigate();

  const handleProtectedNavigation = (path: string) => {
    const userId = localStorage.getItem("user_id");
    navigate(path);
  };

  return (
    <div className="min-h-screen bg-[#faf9f6] overflow-x-hidden">
      <Navbar isAuthenticated={false} />

      {/* Hero Section */}
      <section className="relative overflow-hidden">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 lg:py-24">
          <div className="text-center max-w-4xl mx-auto">
            <div className="inline-flex items-center gap-2 bg-[#c2350a]/10 text-[#1c110a] px-4 py-2 rounded-full text-sm font-medium mb-6 whitespace-nowrap">
              <TrendingUp className="w-4 h-4 flex-shrink-0" />
              <span>Welcome to ProCreate</span>
            </div>
            <h1 className="text-3xl sm:text-4xl lg:text-5xl xl:text-6xl mb-6 text-[#1c110a] break-words px-2">
              Ready to Explore Amazing Creative Work?
            </h1>
            <p className="text-base sm:text-lg md:text-xl text-[#1c110a] mb-8 max-w-2xl mx-auto px-2">
              Discover thousands of inspiring projects, connect with talented creators, 
              and share your own work with a supportive community.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center px-2">
              <Button
                size="lg"
                className="text-base sm:text-lg px-6 sm:px-8 w-full sm:w-auto"
                onClick={() => handleProtectedNavigation("/home")}
              >
                Discover
                <ArrowRight className="w-5 h-5 ml-2 flex-shrink-0" />
              </Button>
              <Button
                size="lg"
                variant="outline"
                className="text-base sm:text-lg px-6 sm:px-8 w-full sm:w-auto"
                onClick={() => handleProtectedNavigation("/upload")}
              >
                Upload Your First Project
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-16 sm:py-20">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="bg-[#1c3738] rounded-2xl p-6 sm:p-12 text-center text-white">
            <h2 className="text-2xl sm:text-3xl mb-4 break-words">Your Creative Journey Starts Now</h2>
            <p className="text-base sm:text-xl mb-8 opacity-90 break-words">
              Join thousands of creators sharing their work and growing their careers on ProCreate.
            </p>
            <Button
              size="lg"
              className="bg-white text-[#c2350a] hover:bg-gray-100 text-base sm:text-lg px-6 sm:px-8 w-full sm:w-auto"
              onClick={() => handleProtectedNavigation("/home")}
            >
              Go to Home Feed
              <ArrowRight className="w-5 h-5 ml-2 flex-shrink-0" />
            </Button>
          </div>
        </div>
      </section>

      {/* Quick Stats */}
      <section className="py-16 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 sm:gap-8 text-center">
            <div>
              <div className="text-3xl sm:text-4xl font-semibold text-[#c2350a] mb-2">50K+</div>
              <div className="text-sm sm:text-base text-[#1c110a]">Active Creators</div>
            </div>
            <div>
              <div className="text-3xl sm:text-4xl font-semibold text-[#1c3738] mb-2">100K+</div>
              <div className="text-sm sm:text-base text-[#1c110a]">Projects Shared</div>
            </div>
            <div>
              <div className="text-3xl sm:text-4xl font-semibold text-[#c2350a] mb-2">1M+</div>
              <div className="text-sm sm:text-base text-[#1c110a]">Likes Given</div>
            </div>
            <div>
              <div className="text-3xl sm:text-4xl font-semibold text-[#1c3738] mb-2">150+</div>
              <div className="text-sm sm:text-base text-[#1c110a]">Countries</div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}