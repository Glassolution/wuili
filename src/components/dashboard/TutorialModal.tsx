import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import TutorialVideoEmbed from "./TutorialVideoEmbed";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export default function TutorialModal({ open, onOpenChange }: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl border-black/10 bg-white p-0 sm:rounded-2xl">
        <DialogTitle className="sr-only">Tutorial Velo</DialogTitle>
        <div className="p-4 sm:p-5">
          <div className="mb-3">
            <h2 className="text-base font-semibold tracking-tight text-[#111]">
              Tutorial da Velo
            </h2>
            <p className="text-xs text-[#6b7280]">
              Assista este vídeo rápido para conhecer sua conta.
            </p>
          </div>
          <div className="overflow-hidden rounded-xl bg-black">
            {open ? <TutorialVideoEmbed /> : null}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
