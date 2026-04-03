import Navbar from "@/components/landing/Navbar";
import HeroSection from "@/components/landing/HeroSection";
import HowItWorks from "@/components/landing/HowItWorks";
import FeaturesSection from "@/components/landing/FeaturesSection";
import TestimonialsSection from "@/components/landing/TestimonialsSection";
import PricingSection from "@/components/landing/PricingSection";
import CTASection from "@/components/landing/CTASection";
import Footer from "@/components/landing/Footer";

/* ── Intersection dot ── */
const Dot = ({ className = "" }: { className?: string }) => (
  <div className={`absolute w-[7px] h-[7px] rounded-full border-2 border-border bg-[#FAFAFA] z-10 ${className}`} />
);

/* ── Dashed vertical lines for column guides ── */
const VerticalGuides = ({ cols }: { cols: number }) => {
  const positions: string[] = [];
  if (cols === 2) positions.push("left-1/2");
  if (cols === 3) { positions.push("left-1/3"); positions.push("left-2/3"); }
  if (cols === 4) { positions.push("left-1/4"); positions.push("left-1/2"); positions.push("left-3/4"); }

  return (
    <div className="absolute inset-0 pointer-events-none">
      {positions.map((pos, i) => (
        <div
          key={i}
          className={`absolute top-0 bottom-0 ${pos} border-l border-dashed border-border/40`}
        />
      ))}
    </div>
  );
};

/* ── Horizontal rule with dots at column intersections ── */
const GridLine = ({ cols = 1 }: { cols?: number }) => (
  <div className="max-w-[1200px] mx-auto relative">
    <div className="border-t border-border" />
    <Dot className="-top-[4px] -left-[4px]" />
    <Dot className="-top-[4px] -right-[4px]" />
    {cols >= 2 && <Dot className="-top-[4px] left-1/2 -translate-x-1/2" />}
    {cols >= 3 && (
      <>
        <Dot className="-top-[4px] left-1/3 -translate-x-1/2" />
        <Dot className="-top-[4px] left-2/3 -translate-x-1/2" />
      </>
    )}
    {cols === 4 && (
      <>
        <Dot className="-top-[4px] left-1/4 -translate-x-1/2" />
        <Dot className="-top-[4px] left-3/4 -translate-x-1/2" />
      </>
    )}
  </div>
);

/* ── Section wrapper with side borders + dashed internal vertical guides ── */
const SectionContainer = ({
  children,
  cols = 1,
}: {
  children: React.ReactNode;
  cols?: number;
}) => (
  <div className="max-w-[1200px] mx-auto border-x border-border relative">
    {cols > 1 && <VerticalGuides cols={cols} />}
    <div className="relative z-[1]">{children}</div>
  </div>
);

const Index = () => (
  <div className="min-h-screen bg-[#FAFAFA] font-['DM_Sans'] overflow-x-hidden">
    <Navbar />

    <GridLine cols={2} />
    <SectionContainer cols={2}>
      <HeroSection />
    </SectionContainer>

    <GridLine cols={3} />
    <SectionContainer cols={3}>
      <HowItWorks />
    </SectionContainer>

    <GridLine cols={2} />
    <SectionContainer cols={2}>
      <FeaturesSection />
    </SectionContainer>

    <GridLine cols={3} />
    <SectionContainer cols={3}>
      <TestimonialsSection />
    </SectionContainer>

    <GridLine cols={4} />
    <SectionContainer cols={4}>
      <PricingSection />
    </SectionContainer>

    <GridLine cols={2} />
    <SectionContainer cols={2}>
      <CTASection />
    </SectionContainer>

    <GridLine cols={4} />
    <Footer />
  </div>
);

export default Index;
