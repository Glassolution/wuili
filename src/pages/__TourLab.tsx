// TEMPORÁRIO — harness para exercitar o motor do tour. Remover antes do commit.
import { useState } from "react";
import { Home, Package, Search } from "lucide-react";
import GuidedTour from "@/components/tour/GuidedTour";
import type { TourStep } from "@/components/tour/tourSteps";

const R = "/__tour-lab";
const STEPS: TourStep[] = [
  { target: "lab-a", title: "Passo com alvo A", description: "Deve destacar a caixa A.", icon: Home, route: R },
  { target: "lab-b", title: "Passo com alvo B", description: "Deve destacar a caixa B.", icon: Package, route: R },
  { target: "nao-existe", title: "Alvo ausente", description: "Deve cair no modo centralizado.", icon: Search, route: R },
];

const TourLab = () => {
  const [open, setOpen] = useState(false);
  return (
    <div className="min-h-screen bg-[#F4F4F5] p-10">
      <button onClick={() => setOpen(true)} className="rounded bg-black px-4 py-2 text-white">Iniciar</button>
      <div className="mt-10 flex gap-10">
        <div data-dashboard-tour="lab-a" className="h-24 w-56 rounded bg-blue-500 p-4 text-white">Caixa A</div>
        <div data-dashboard-tour="lab-b" className="h-24 w-56 rounded bg-green-600 p-4 text-white">Caixa B</div>
      </div>
      <GuidedTour open={open} onClose={() => setOpen(false)} steps={STEPS} />
    </div>
  );
};

export default TourLab;
