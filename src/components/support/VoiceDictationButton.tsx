import { useEffect, useRef, useState } from "react";
import { Mic, MicOff } from "lucide-react";
import { veloToast as toast } from "@/components/ui/velo-toast";

// Web Speech API não tem tipos no lib.dom padrão.
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- API do navegador sem tipagem oficial
type AnyRecognition = any;

interface Props {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}

/** Botão de ditado: fala e o texto vai sendo escrito na caixa. */
const VoiceDictationButton = ({ value, onChange, disabled }: Props) => {
  const [listening, setListening] = useState(false);
  const recRef = useRef<AnyRecognition>(null);
  const baseRef = useRef("");

  useEffect(() => () => recRef.current?.stop?.(), []);

  const toggle = () => {
    if (listening) {
      recRef.current?.stop();
      return;
    }
    const w = window as unknown as { SpeechRecognition?: AnyRecognition; webkitSpeechRecognition?: AnyRecognition };
    const Ctor = w.SpeechRecognition || w.webkitSpeechRecognition;
    if (!Ctor) {
      toast.error("Seu navegador não suporta ditado por voz. Use o Chrome ou Edge.");
      return;
    }
    const rec = new Ctor();
    rec.lang = "pt-BR";
    rec.continuous = true;
    rec.interimResults = true;
    baseRef.current = value ? value.replace(/\s*$/, " ") : "";
    rec.onresult = (event: AnyRecognition) => {
      let finalText = "";
      let interim = "";
      for (let i = 0; i < event.results.length; i++) {
        const r = event.results[i];
        if (r.isFinal) finalText += r[0].transcript;
        else interim += r[0].transcript;
      }
      onChange(baseRef.current + finalText + interim);
    };
    rec.onerror = (event: AnyRecognition) => {
      if (event?.error === "not-allowed") toast.error("Permita o uso do microfone para ditar.");
    };
    rec.onend = () => setListening(false);
    recRef.current = rec;
    rec.start();
    setListening(true);
  };

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={disabled}
      className={`flex h-7 w-7 items-center justify-center rounded-md transition ${
        listening ? "animate-pulse bg-red-50 text-red-600" : "text-[#8c8c86] hover:bg-[#f0f0ed] hover:text-[#343431]"
      }`}
      aria-label={listening ? "Parar ditado" : "Ditar por voz"}
      title={listening ? "Parar ditado" : "Falar e escrever"}
    >
      {listening ? <MicOff size={14} /> : <Mic size={14} />}
    </button>
  );
};

export default VoiceDictationButton;
