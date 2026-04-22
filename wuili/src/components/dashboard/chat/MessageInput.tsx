import { useRef, useEffect } from 'react';
import { Send, Paperclip, Sparkles, ChevronRight } from 'lucide-react';

type AiOption = {
  key: string;
  label: string;
  description: string;
  generate: (product: string) => string;
};

const AI_OPTIONS: AiOption[] = [
  {
    key: 'negotiate',
    label: 'Negociar preço',
    description: 'Solicitar desconto por volume',
    generate: (p) =>
      `Olá! Gostaria de negociar o preço do ${p}. Vocês oferecem desconto para pedidos maiores? Qual seria o melhor valor para um pedido de 50 unidades?`,
  },
  {
    key: 'sample',
    label: 'Pedir amostra',
    description: 'Solicitar amostra para avaliação',
    generate: (p) =>
      `Boa tarde! Poderia enviar uma amostra do ${p} para avaliação antes de fecharmos um pedido maior? Qual seria o custo e o prazo estimado de entrega?`,
  },
  {
    key: 'shipping',
    label: 'Cobrar envio',
    description: 'Solicitar atualização do rastreio',
    generate: (p) =>
      `Olá! Gostaria de uma atualização sobre o envio do pedido referente ao ${p}. Poderia verificar o status e compartilhar o código de rastreio atualizado?`,
  },
  {
    key: 'deadline',
    label: 'Perguntar prazo',
    description: 'Consultar prazo de entrega',
    generate: (p) =>
      `Bom dia! Qual é o prazo de entrega estimado para o ${p} com envio para o Brasil? Preciso planejar meu estoque com antecedência.`,
  },
];

interface Props {
  value: string;
  onChange: (v: string) => void;
  onSend: () => void;
  productName: string;
  showAiMenu: boolean;
  onToggleAiMenu: () => void;
}

export default function MessageInput({
  value, onChange, onSend, productName, showAiMenu, onToggleAiMenu,
}: Props) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  // Auto-resize textarea
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
  }, [value]);

  // Close menu on outside click
  useEffect(() => {
    if (!showAiMenu) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onToggleAiMenu();
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showAiMenu, onToggleAiMenu]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      onSend();
    }
  };

  const handleAiSelect = (option: AiOption) => {
    onChange(option.generate(productName));
    onToggleAiMenu();
    setTimeout(() => textareaRef.current?.focus(), 50);
  };

  return (
    <div className="relative border-t border-[#EBEBEB] dark:border-zinc-800 bg-white dark:bg-zinc-900 p-3">
      {/* AI menu */}
      {showAiMenu && (
        <div
          ref={menuRef}
          className="absolute bottom-full left-3 mb-2 w-72 overflow-hidden rounded-2xl border border-[#E5E5E5] dark:border-zinc-700 bg-white dark:bg-zinc-900 shadow-xl"
          style={{ animation: 'slideUpMenu 180ms ease' }}
        >
          <div className="flex items-center gap-2 border-b border-[#F0F0F0] dark:border-zinc-800 px-4 py-2.5">
            <Sparkles size={13} className="text-[#525252] dark:text-zinc-300" />
            <span className="font-['Manrope'] text-[12.5px] font-semibold text-[#0A0A0A] dark:text-white">
              Gerar com IA
            </span>
          </div>
          {AI_OPTIONS.map((opt) => (
            <button
              key={opt.key}
              onClick={() => handleAiSelect(opt)}
              className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition-colors hover:bg-[#F7F7F7] dark:hover:bg-zinc-800"
            >
              <div>
                <p className="text-[13px] font-medium text-[#0A0A0A] dark:text-white">{opt.label}</p>
                <p className="text-[11.5px] text-[#A3A3A3] dark:text-zinc-400">{opt.description}</p>
              </div>
              <ChevronRight size={14} className="shrink-0 text-[#D4D4D4] dark:text-zinc-500" />
            </button>
          ))}
        </div>
      )}

      <div className="flex items-end gap-2 rounded-2xl border border-[#E5E5E5] dark:border-zinc-700 bg-[#F7F7F7] dark:bg-zinc-800 px-3 py-2 transition focus-within:border-[#D4D4D4] dark:focus-within:border-zinc-500 focus-within:ring-2 focus-within:ring-[#0A0A0A]/6 dark:focus-within:ring-white/10">
        {/* Attachment button */}
        <button
          className="mb-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-[#A3A3A3] dark:text-zinc-400 transition hover:bg-[#EBEBEB] dark:hover:bg-zinc-700 hover:text-[#525252] dark:hover:text-zinc-200"
          title="Anexar imagem"
        >
          <Paperclip size={15} />
        </button>

        {/* Textarea */}
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Digite uma mensagem..."
          rows={1}
          className="flex-1 resize-none bg-transparent py-0.5 text-[13.5px] text-[#0A0A0A] dark:text-white placeholder:text-[#A3A3A3] dark:placeholder:text-zinc-500 focus:outline-none"
          style={{ maxHeight: 120 }}
        />

        {/* AI button */}
        <button
          onClick={onToggleAiMenu}
          className={`mb-0.5 flex h-7 shrink-0 items-center gap-1.5 rounded-lg px-2.5 text-[11.5px] font-medium transition ${
            showAiMenu
              ? 'bg-[#0A0A0A] dark:bg-white text-white dark:text-black'
              : 'text-[#525252] dark:text-zinc-300 hover:bg-[#EBEBEB] dark:hover:bg-zinc-700 hover:text-[#0A0A0A] dark:hover:text-white'
          }`}
          title="Gerar mensagem com IA"
        >
          <Sparkles size={13} />
          <span className="hidden sm:inline">IA</span>
        </button>

        {/* Send button */}
        <button
          onClick={onSend}
          disabled={!value.trim()}
          className="mb-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[#0A0A0A] dark:bg-white text-white dark:text-black transition hover:bg-[#2a2a2a] dark:hover:bg-zinc-200 disabled:cursor-not-allowed disabled:opacity-30"
          title="Enviar (Enter)"
        >
          <Send size={13} />
        </button>
      </div>

      <p className="mt-1.5 text-center text-[10.5px] text-[#C0C0C0] dark:text-zinc-500">
        Enter para enviar · Shift+Enter para nova linha
      </p>

      <style>{`
        @keyframes slideUpMenu {
          from { opacity: 0; transform: translateY(8px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}
