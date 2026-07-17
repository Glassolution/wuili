import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import TutorialVideoEmbed from "./TutorialVideoEmbed";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export default function TutorialModal({ open, onOpenChange }: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl border-white/10 bg-black p-0 text-white sm:rounded-2xl">
        <DialogTitle className="sr-only">Tutorial Velo</DialogTitle>
        <div className="p-4 sm:p-5">
          <div className="mb-3">
            <h2 className="text-base font-semibold tracking-tight text-white">
              Tutorial da Velo
            </h2>
            <p className="text-xs text-white/60">
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
