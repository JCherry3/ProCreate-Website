import { Navbar } from "../components/Navbar";
import { Button } from "../components/ui/button";
import { Link } from "react-router";
import { TrendingUp, Users, Upload, Briefcase, Star, Search, ArrowRight, Target, Lightbulb, Rocket } from "lucide-react";
import { ImageWithFallback } from "../components/ui/ImageWithFallback";

export default function LearnMore() {
  return (
    <div className="min-h-screen bg-[#faf9f6] overflow-x-hidden">
      <Navbar isAuthenticated={false} />

      {/* Hero Section - Vision */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-20">
        <div className="text-center max-w-3xl mx-auto mb-12 sm:mb-16">
          <h1 className="text-3xl sm:text-4xl lg:text-5xl mb-6 text-[#1c110a] break-words px-2">
            Our Vision for ProCreate
          </h1>
          <p className="text-base sm:text-lg md:text-xl text-[#1c110a] px-2">
            Empowering creative professionals to share their work, connect with opportunities,
            and build thriving careers in the digital age.
          </p>
        </div>

        {/* Vision Cards */}
        <div className="grid md:grid-cols-3 gap-6 sm:gap-8 mb-16 sm:mb-20">
          <div className="bg-white rounded-xl p-6 sm:p-8 shadow-sm">
            <div className="w-16 h-16 bg-[#c2350a] rounded-lg flex items-center justify-center mb-4 flex-shrink-0">
              <Target className="w-8 h-8 text-white" />
            </div>
            <h3 className="text-xl sm:text-2xl mb-3 break-words">Our Mission</h3>
            <p className="text-[#1c110a] text-sm sm:text-base break-words">
              To create the world's most supportive and inspiring platform for creative
              professionals to showcase their work, grow their skills, and connect with
              opportunities.
            </p>
          </div>

          <div className="bg-white rounded-xl p-6 sm:p-8 shadow-sm">
            <div className="w-16 h-16 bg-[#1c3738] rounded-lg flex items-center justify-center mb-4 flex-shrink-0">
              <Lightbulb className="w-8 h-8 text-white" />
            </div>
            <h3 className="text-xl sm:text-2xl mb-3 break-words">Our Vision</h3>
            <p className="text-[#1c110a] text-sm sm:text-base break-words">
              A world where every creative professional has the tools, community, and
              opportunities they need to turn their passion into a sustainable career.
            </p>
          </div>

          <div className="bg-white rounded-xl p-6 sm:p-8 shadow-sm">
            <div className="w-16 h-16 bg-[#c2350a] rounded-lg flex items-center justify-center mb-4 flex-shrink-0">
              <Rocket className="w-8 h-8 text-white" />
            </div>
            <h3 className="text-xl sm:text-2xl mb-3 break-words">Our Goal</h3>
            <p className="text-[#1c110a] text-sm sm:text-base break-words">
              To help 1 million creators build successful careers by providing the best
              platform for portfolio building, networking, and discovering opportunities.
            </p>
          </div>
        </div>

        <div className="aspect-video rounded-2xl overflow-hidden shadow-2xl mb-16 sm:mb-20">
          <ImageWithFallback
            src="https://images.unsplash.com/photo-1758873268053-675432cd8922?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxtb2Rlcm4lMjB3b3Jrc3BhY2UlMjBjcmVhdGl2ZXxlbnwxfHx8fDE3NzA1ODE4NDl8MA&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral"
            alt="Creative workspace"
            className="w-full h-full object-cover"
          />
        </div>

        {/* What You Can Do Section */}
        <div className="mb-12 sm:mb-16">
          <div className="text-center mb-12">
            <h2 className="text-2xl sm:text-3xl mb-4 px-2">What You Can Do on ProCreate</h2>
            <p className="text-lg sm:text-xl text-[#1c110a] px-2">
              Everything you need to grow as a creative professional
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8">
            <div className="bg-white rounded-xl hover:shadow-lg transition-shadow overflow-hidden">
              <div className="aspect-video w-full overflow-hidden">
                <ImageWithFallback
                  src="https://images.unsplash.com/photo-1563697013858-7d658cdb639d?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHx0cmVuZGluZyUyMGNyZWF0aXZlJTIwZGVzaWduJTIwYXJ0d29ya3xlbnwxfHx8fDE3NzA2Nzc1NDF8MA&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral"
                  alt="Discover Trending Work"
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="p-6 sm:p-8">
                <h3 className="text-lg sm:text-xl mb-3 break-words">Discover Trending Work</h3>
                <p className="text-[#1c110a] text-sm sm:text-base break-words">
                  Browse the latest projects from top creators across all creative disciplines. 
                  Filter by category to find exactly what inspires you.
                </p>
                <Link to="/home" className="inline-flex items-center gap-2 text-[#c2350a] hover:text-[#a02d08] mt-4 text-sm sm:text-base">
                  View Feed <ArrowRight className="w-4 h-4 flex-shrink-0" />
                </Link>
              </div>
            </div>

            <div className="bg-white rounded-xl hover:shadow-lg transition-shadow overflow-hidden">
              <div className="aspect-video w-full overflow-hidden">
                <ImageWithFallback
                  src="https://images.unsplash.com/photo-1739298061740-5ed03045b280?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHx0ZWFtJTIwY29sbGFib3JhdGlvbiUyMG1lZXRpbmd8ZW58MXx8fHwxNzcwNTk2ODAzfDA&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral"
                  alt="Connect with Creators"
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="p-6 sm:p-8">
                <h3 className="text-lg sm:text-xl mb-3 break-words">Connect with Creators</h3>
                <p className="text-[#1c110a] text-sm sm:text-base break-words">
                  Follow talented designers, like their work, and engage through comments. 
                  Build your network and find collaboration opportunities.
                </p>
                <Link to="/search" className="inline-flex items-center gap-2 text-[#c2350a] hover:text-[#a02d08] mt-4 text-sm sm:text-base">
                  Explore Creators <ArrowRight className="w-4 h-4 flex-shrink-0" />
                </Link>
              </div>
            </div>

            <div className="bg-white rounded-xl hover:shadow-lg transition-shadow overflow-hidden">
              <div className="aspect-video w-full overflow-hidden">
                <ImageWithFallback
                  src="https://images.unsplash.com/photo-1626736327061-7c27ad865761?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxhcnRpc3QlMjBzaGFyaW5nJTIwY3JlYXRpdmUlMjBwcm9qZWN0fGVufDF8fHx8MTc3MDY3NzU0Mnww&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral"
                  alt="Share Your Projects"
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="p-6 sm:p-8">
                <h3 className="text-lg sm:text-xl mb-3 break-words">Share Your Projects</h3>
                <p className="text-[#1c110a] text-sm sm:text-base break-words">
                  Upload your creative work and showcase it to the community. 
                  Get feedback, appreciation, and grow your portfolio.
                </p>
                <Link to="/upload" className="inline-flex items-center gap-2 text-[#c2350a] hover:text-[#a02d08] mt-4 text-sm sm:text-base">
                  Upload Project <ArrowRight className="w-4 h-4 flex-shrink-0" />
                </Link>
              </div>
            </div>

            <div className="bg-white rounded-xl hover:shadow-lg transition-shadow overflow-hidden">
              <div className="aspect-video w-full overflow-hidden">
                <ImageWithFallback
                  src="https://images.unsplash.com/photo-1612736232022-691d6243202b?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxmcmVlbGFuY2UlMjBidXNpbmVzcyUyMHdvcmslMjByZXF1ZXN0fGVufDF8fHx8MTc3MDY3NzU0Mnww&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral"
                  alt="Accept Freelance Requests"
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="p-6 sm:p-8">
                <h3 className="text-lg sm:text-xl mb-3 break-words">Accept Freelance Requests</h3>
                <p className="text-[#1c110a] text-sm sm:text-base break-words">
                  Receive project requests from potential clients and collaborators. 
                  Manage all opportunities in one place.
                </p>
                <Link to="/requests" className="inline-flex items-center gap-2 text-[#c2350a] hover:text-[#a02d08] mt-4 text-sm sm:text-base">
                  View Requests <ArrowRight className="w-4 h-4 flex-shrink-0" />
                </Link>
              </div>
            </div>

            <div className="bg-white rounded-xl hover:shadow-lg transition-shadow overflow-hidden">
              <div className="aspect-video w-full overflow-hidden">
                <ImageWithFallback
                  src="https://images.unsplash.com/photo-1760071744047-5542cbfda184?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxwb3J0Zm9saW8lMjBjcmVhdGl2ZSUyMHNob3djYXNlfGVufDF8fHx8MTc3MDY3NzU0Mnww&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral"
                  alt="Build Your Portfolio"
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="p-6 sm:p-8">
                <h3 className="text-lg sm:text-xl mb-3 break-words">Build Your Portfolio</h3>
                <p className="text-[#1c110a] text-sm sm:text-base break-words">
                  Create a stunning profile that showcases your best work. 
                  Customize your bio, skills, and professional information.
                </p>
                <Link to="/profile" className="inline-flex items-center gap-2 text-[#c2350a] hover:text-[#a02d08] mt-4 text-sm sm:text-base">
                  View Profile <ArrowRight className="w-4 h-4 flex-shrink-0" />
                </Link>
              </div>
            </div>

            <div className="bg-white rounded-xl hover:shadow-lg transition-shadow overflow-hidden">
              <div className="aspect-video w-full overflow-hidden">
                <ImageWithFallback
                  src="https://images.unsplash.com/photo-1762330467186-1af11aa6bd31?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxzZWFyY2glMjBmaWx0ZXIlMjBkaXNjb3Zlcnl8ZW58MXx8fHwxNzcwNjc3NTQzfDA&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral"
                  alt="Search & Filter"
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="p-6 sm:p-8">
                <h3 className="text-lg sm:text-xl mb-3 break-words">Search & Filter</h3>
                <p className="text-[#1c110a] text-sm sm:text-base break-words">
                  Find exactly what you're looking for with powerful search and filtering. 
                  Discover projects, designers, and inspiration by category.
                </p>
                <Link to="/search" className="inline-flex items-center gap-2 text-[#c2350a] hover:text-[#a02d08] mt-4 text-sm sm:text-base">
                  Start Exploring <ArrowRight className="w-4 h-4 flex-shrink-0" />
                </Link>
              </div>
            </div>
          </div>
        </div>

        {/* CTA Section */}
        <div className="bg-gradient-to-r from-[#c2350a] to-[#1c3738] rounded-2xl p-6 sm:p-12 text-center text-white">
          <h2 className="text-2xl sm:text-3xl mb-4 break-words">Ready to Get Started?</h2>
          <p className="text-base sm:text-xl mb-8 opacity-90 break-words">
            Join thousands of creators sharing their work and building their careers on ProCreate.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button size="lg" variant="secondary" asChild className="w-full sm:w-auto">
              <Link to="/signup">Sign Up Free</Link>
            </Button>
            <Button size="lg" className="bg-white text-[#1c3738] hover:bg-gray-100 w-full sm:w-auto" asChild>
              <Link to="/home">Explore Feed</Link>
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
}
