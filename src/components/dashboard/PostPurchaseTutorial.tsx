import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowRight, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import VideoTutorialModal from "./VideoTutorialModal";

/** Optional presentation only: does not activate or modify a subscription. */
export default function PostPurchaseTutorial() {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  return (
    <section className="mt-8 text-center" aria-label="Tutorial de início">
      <h2 className="text-lg font-semibold text-foreground">Seus primeiros passos na Velo</h2>
      <div className="mt-4 flex flex-col gap-2">
        <Button variant="pilot" className="h-12 w-full" onClick={() => setOpen(true)}>
          <Play size={18} aria-hidden="true" />
          Assistir agora
        </Button>
        <Button variant="ghost" className="h-12 w-full" onClick={() => navigate("/dashboard")}>
          Ver depois
          <ArrowRight size={16} aria-hidden="true" />
        </Button>
      </div>
      <VideoTutorialModal
        open={open}
        onClose={() => setOpen(false)}
        title="Tutorial de início"
        description="Veja como dar os primeiros passos na Velo."
        src="https://player.vimeo.com/video/1226153949?badge=0&autopause=0&player_id=0&app_id=58479"
        aspectPadding="62.5%"
      />
    </section>
  );
}