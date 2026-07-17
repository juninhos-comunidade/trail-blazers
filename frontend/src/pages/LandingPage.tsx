import { DifferenceSection } from "../components/landing/DifferenceSection";
import { FinalCtaSection } from "../components/landing/FinalCtaSection";
import { HeroSection } from "../components/landing/HeroSection";
import { HowItWorksSection } from "../components/landing/HowItWorksSection";
import { LandingFooter } from "../components/landing/LandingFooter";
import { LandingHeader } from "../components/landing/LandingHeader";

export function LandingPage() {
  return (
    <div className="min-h-screen animate-rise">
      <LandingHeader />
      <main>
        <HeroSection />
        <HowItWorksSection />
        <DifferenceSection />
        <FinalCtaSection />
      </main>
      <LandingFooter />
    </div>
  );
}
