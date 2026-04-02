import Navbar from "@/components/landing/Navbar";
import HeroSection from "@/components/landing/HeroSection";
import LogosStrip from "@/components/landing/LogosStrip";
import ProductsSection from "@/components/landing/ProductsSection";
import HowItWorks from "@/components/landing/HowItWorks";
import StatsBand from "@/components/landing/StatsBand";
import FeaturesSection from "@/components/landing/FeaturesSection";
import TestimonialsSection from "@/components/landing/TestimonialsSection";
import PricingSection from "@/components/landing/PricingSection";
import CTASection from "@/components/landing/CTASection";
import Footer from "@/components/landing/Footer";

const Index = () => (
  <div className="min-h-screen">
    <Navbar />
    <HeroSection />
    <LogosStrip />
    <ProductsSection />
    <HowItWorks />
    <StatsBand />
    <FeaturesSection />
    <TestimonialsSection />
    <PricingSection />
    <CTASection />
    <Footer />
  </div>
);

export default Index;
