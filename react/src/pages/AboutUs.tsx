import { Navbar } from "../components/Navbar";
import { Button } from "../components/ui/button";
import { Link } from "react-router";
import { ImageWithFallback } from "../components/ui/ImageWithFallback";
import { Heart, Users, Globe, Zap } from "lucide-react";

export default function AboutUs() {
  return (
    <div className="min-h-screen bg-[#faf9f6] overflow-x-hidden">
      <Navbar isAuthenticated={false} />

      {/* Hero Section */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-20">
        <div className="text-center max-w-3xl mx-auto mb-12 sm:mb-16">
          <h1 className="text-3xl sm:text-4xl lg:text-5xl mb-6 text-[#1c110a] break-words px-2">
            Meet the Team Behind ProCreate
          </h1>
          <p className="text-base sm:text-lg md:text-xl text-[#1c110a] mb-4 px-2">
            We're a passionate group of designers and developers dedicated to empowering 
            the creative community.
          </p>
          <Link to="/learn-more" className="inline-flex items-center gap-2 text-[#c2350a] hover:text-[#a02d08] text-base">
            Learn About Our Vision & Platform
          </Link>
        </div>

        <div className="aspect-video rounded-2xl overflow-hidden shadow-2xl mb-12 sm:mb-20">
          <ImageWithFallback
            src="procreate-team.png"
            alt="ProCreate Team"
            className="w-full h-full object-cover"
          />
        </div>

        {/* Team Section */}
        <div className="mb-12 sm:mb-20">
          <h2 className="text-2xl sm:text-3xl mb-4 text-center px-2">Our Team</h2>
          <p className="text-center text-lg text-[#1c110a] mb-12 max-w-2xl mx-auto px-2">
            Four colleagues who came together with a shared vision to create a better 
            platform for creative professionals.
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-6 sm:gap-8">
            {[
              { 
                name: "Jason Yang",
                description: "UB Computer Science Junior graduating early. Both a TA in Discrete Mathmathics and a researcher at XLab. Avid enjoyer of creative work."
              },
              { 
                name: "Jason Cherry",
                description: "Computer Science student at UB, Creative, Designer, Engineer, MVP, Heart of the Team, The GOAT (debatable)."
              },
              { 
                name: "Nicholas Green",
                description: "Computer Science student at the University at Buffalo with a passion for software engineering, emerging technologies, and building thoughtful systems that bridge theory and practice."
              },
              { 
                name: "Frederik Davidson",
                description: "Computer Engineering student at the University at Buffalo with a passion for working with embedded systems and physical computing."
              },
            ].map((member, index) => (
              <div key={index} className="text-center">
                <div className="w-32 h-32 sm:w-40 sm:h-40 rounded-full bg-gradient-to-br from-[#c2350a] to-[#1c3738] flex items-center justify-center text-white text-3xl sm:text-4xl mx-auto mb-4">
                  {member.name.charAt(0)}
                </div>
                <h3 className="font-semibold text-base sm:text-lg break-words px-2 mb-2">{member.name}</h3>
                <p className="text-xs sm:text-sm text-gray-600 break-words px-2">{member.description}</p>
              </div>
            ))}
          </div>
        </div>

        {/* CTA Section */}
        <div className="bg-gradient-to-r from-[#c2350a] to-[#1c3738] rounded-2xl p-6 sm:p-12 text-center text-white">
          <h2 className="text-2xl sm:text-3xl mb-4 break-words">Join Our Community</h2>
          <p className="text-base sm:text-xl mb-8 opacity-90 break-words">
            Start sharing your creative work and connect with other talented
            professionals.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button size="lg" variant="secondary" asChild className="w-full sm:w-auto">
              <Link to="/signup">Get Started Free</Link>
            </Button>
            <Button size="lg" className="bg-white text-[#1c3738] hover:bg-gray-100 w-full sm:w-auto" asChild>
              <Link to="/search">Explore Projects</Link>
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
}
