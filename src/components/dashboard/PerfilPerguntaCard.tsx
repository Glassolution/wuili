import { useMemo, useState } from "react";
import { X } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { CHAVE_RESPOSTAS_DO_QUIZ, lerRespostasDoQuiz } from "@/lib/perfilDoQuiz";

/*
  Perguntas que SAÍRAM do onboarding para não atrasar o primeiro contato com o
  catálogo. Elas continuam existindo para a análise do time: aparecem aqui, uma
  por vez, num cartão pequeno e dispensável, só depois que a pessoa já publicou
  pelo menos um produto.

  As respostas vão para o mesmo lugar de sempre (metadata do usuário, chave
  `velo_onboarding_answers`), então a segmentação continua comparável com quem
  respondeu no formato antigo de 7 perguntas.
*/
const PERGUNTAS: Array<{ id: string; label: string; options: Array<{ value: string; label: string }> }> = [
  {
    id: "perfil",
    label: "Como você se descreve hoje?",
    options: [
      { value: "dropshipper", label: "Vendo sem estoque" },
      { value: "marca", label: "Tenho marca ou loja" },
      { value: "agencia", label: "Cuido de lojas de clientes" },
      { value: "explorando", label: "Ainda estou conhecendo" },
    ],
  },
  {
    id: "produtos",
    label: "Quantos produtos você tem à venda hoje?",
    options: [
      { value: "nenhum", label: "Nenhum ainda" },
      { value: "1-10", label: "De 1 a 10" },
      { value: "10-50", label: "De 11 a 50" },
      { value: "50+", label: "Mais de 50" },
    ],
  },
  {
    id: "dificuldade",
    label: "O que mais te atrapalha para vender mais?",
    options: [
      { value: "anuncios", label: "Montar um bom anúncio" },
      { value: "testar", label: "Achar o produto certo" },
      { value: "trafego", label: "Aparecer nas buscas" },
      { value: "profissional", label: "Parecer mais profissional" },
    ],
  },
  {
    id: "metodoAtual",
    label: "Como você criava seus anúncios antes da Velo?",
    options: [
      { value: "manual", label: "Um por um, na mão" },
      { value: "outra-ferramenta", label: "Com outro aplicativo" },
      { value: "sem-anuncios", label: "Nunca tinha criado" },
      { value: "desenvolvedor", label: "Alguém fazia por mim" },
    ],
  },
];

const chaveDispensado = (userId: string) => `velo-pergunta-dispensada:${userId}`;

type Props = {
  /** Só aparece quando a pessoa já publicou algo. */
  jaPublicou: boolean;
};

const PerfilPerguntaCard = ({ jaPublicou }: Props) => {
  const { user } = useAuth();
  const respostas = useMemo(() => lerRespostasDoQuiz(user), [user]);
  const [fechado, setFechado] = useState(() => {
    if (typeof window === "undefined" || !user?.id) return false;
    return window.localStorage.getItem(chaveDispensado(user.id)) === "1";
  });
  const [salvando, setSalvando] = useState(false);

  const pergunta = PERGUNTAS.find((p) => !respostas[p.id as keyof typeof respostas]);

  if (!jaPublicou || !pergunta || fechado || !user?.id) return null;

  const dispensar = () => {
    // Dispensou: não insiste nesta sessão nem nas próximas neste aparelho.
    window.localStorage.setItem(chaveDispensado(user.id), "1");
    setFechado(true);
  };

  const responder = async (value: string) => {
    setSalvando(true);
    await supabase.auth.updateUser({
      data: { [CHAVE_RESPOSTAS_DO_QUIZ]: { ...respostas, [pergunta.id]: value } },
    });
    setSalvando(false);
    setFechado(true);
  };

  return (
    <div className="mb-6 rounded-2xl border border-[#E5E7EB] bg-white p-4 sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[12px] font-medium uppercase tracking-[0.08em] text-[#8E8E87]">Uma perguntinha rápida</p>
          <h3 className="mt-1 text-[16px] font-semibold text-[#111111]">{pergunta.label}</h3>
        </div>
        <button
          type="button"
          onClick={dispensar}
          aria-label="Dispensar pergunta"
          className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-[#8E8E87] transition-colors hover:bg-black/[0.04]"
        >
          <X size={18} strokeWidth={1.9} />
        </button>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        {pergunta.options.map((option) => (
          <button
            key={option.value}
            type="button"
            disabled={salvando}
            onClick={() => void responder(option.value)}
            className="min-h-[44px] rounded-full border border-[#E5E7EB] px-4 text-[14px] font-medium text-[#111111] transition-colors hover:border-[#0B5FFF] hover:bg-[#0B5FFF]/[0.04] disabled:opacity-50"
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );
};

export default PerfilPerguntaCard;
