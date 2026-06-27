import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ArrowUp, Plus } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { veloToast } from "@/components/ui/velo-toast";
import SuggestedProducts from "@/components/dashboard/SuggestedProducts";

// ─── Types ────────────────────────────────────────────────────────────────────
type ProfileRow = {
  display_name: string | null;
  loja_nome: string | null;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
const getName = (profile?: ProfileRow | null, email?: string | null): string => {
  const raw = profile?.loja_nome || profile?.display_name || email?.split("@")[0] || "Velo";
  return raw
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
};

// ─── Atlas Avatar ─────────────────────────────────────────────────────────────
const AtlasAvatar = ({ size = 28 }: { size?: number }) => (
  <div
    style={{ width: size, height: size }}
    className="shrink-0 rounded-full bg-gradient-to-br from-violet-500 via-fuchsia-500 to-indigo-500 grid place-items-center text-white text-[12px] font-bold shadow-sm"
  >
    A
  </div>
);

// ─── Page ─────────────────────────────────────────────────────────────────────
const DashboardHomePage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [inputText, setInputText] = useState("");
  const [creating, setCreating] = useState(false);

  const { data: profile } = useQuery({
    queryKey: ["dashboard-home-profile", user?.id],
    enabled: Boolean(user?.id),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles" as never)
        .select("display_name, loja_nome")
        .eq("id", user!.id)
        .maybeSingle();
      if (error) throw error;
      return data as ProfileRow | null;
    },
  });

  const name = getName(profile, user?.email);

  const startAtlasThread = async (firstMessage?: string) => {
    if (!user?.id) {
      veloToast.error("Faça login para conversar com o Atlas");
      return;
    }
    setCreating(true);
    try {
      const { data, error } = await supabase
        .from("atlas_threads" as never)
        .insert({ user_id: user.id, title: firstMessage?.slice(0, 50) || "Nova conversa" })
        .select("id")
        .single();
      if (error || !data) throw error || new Error("erro");
      const id = (data as { id: string }).id;
      const qs = firstMessage ? `?first=${encodeURIComponent(firstMessage)}` : "";
      navigate(`/dashboard/atlas/${id}${qs}`);
    } catch {
      veloToast.error("Não foi possível abrir a conversa com o Atlas");
    } finally {
      setCreating(false);
    }
  };

  const handleSearchSubmit = (text: string) => {
    const t = text.trim();
    if (!t) return;
    setInputText("");
    startAtlasThread(t);
  };

  return (
    <main
      className="min-h-full w-full text-[#111111] pb-16"
      style={{ fontFamily: '"Plus Jakarta Sans", sans-serif' }}
    >
      {/* ── Header bar ─────────────────────────────────────────────────── */}
      <header className="flex items-center justify-between gap-4 mb-10">
        <div
          onClick={() => navigate("/dashboard/planos")}
          className="flex items-center gap-3 rounded-full bg-[#111111] py-2 pl-[14px] pr-4 text-white cursor-pointer select-none text-[12.5px]"
        >
          <span className="h-2 w-2 rounded-full bg-emerald-400 shrink-0" />
          <span className="font-medium text-neutral-100">Aproveite 3 meses por R$ 1/mês</span>
          <span className="h-3.5 w-px bg-white/20 mx-1" />
          <span className="font-semibold">Selecionar um plano</span>
        </div>
        <div className="text-[12.5px] text-neutral-500 hidden sm:block">
          Dúvidas?{" "}
          <span className="text-neutral-900 font-semibold">contato@velo.com.br</span>
        </div>
      </header>

      {/* ── Welcome + Search ───────────────────────────────────────────── */}
      {/*
        Título e barra de busca ficam centralizados visualmente,
        mas dentro do layout de largura total — sem container estreito.
        max-w aqui só para o bloco de texto+input, não para o grid abaixo.
      */}
      <section className="flex flex-col items-center text-center mb-10">
        <h1 className="text-[28px] sm:text-[34px] font-bold tracking-tight text-neutral-900 leading-tight">
          Boas-vindas ao{" "}
          <span
            style={{
              fontFamily: '"Playfair Display", Georgia, serif',
              fontStyle: "italic",
              fontWeight: 600,
            }}
          >
            Velo
          </span>
          {name && name !== "Velo" ? (
            <span className="text-neutral-500 font-medium">, {name}</span>
          ) : null}
        </h1>
        <p className="mt-2 text-[14px] text-neutral-500 font-normal">
          O que você quer vender hoje?
        </p>

        {/* Campo de busca / Atlas — limitado para não ficar largo demais */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSearchSubmit(inputText);
          }}
          className="mt-6 w-full max-w-[680px] flex items-center gap-2 bg-white border border-neutral-200 rounded-full pl-4 pr-2 py-2 shadow-[0_2px_10px_rgba(0,0,0,0.03)] focus-within:border-neutral-400 transition-colors"
        >
          <AtlasAvatar size={24} />
          <input
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder="Pergunte ao Atlas… ou pesquise um produto"
            className="flex-1 bg-transparent outline-none text-[13.5px] text-neutral-800 placeholder:text-neutral-400 px-1.5"
            disabled={creating}
          />
          <button
            type="button"
            onClick={() => startAtlasThread()}
            className="h-8 w-8 rounded-full border border-neutral-200 text-neutral-500 grid place-items-center hover:bg-neutral-50 transition-colors"
            aria-label="Nova conversa com o Atlas"
            title="Nova conversa"
          >
            <Plus className="h-4 w-4" />
          </button>
          <button
            type="submit"
            disabled={!inputText.trim() || creating}
            className="h-8 w-8 rounded-full bg-neutral-900 text-white grid place-items-center disabled:opacity-40 hover:bg-neutral-800 transition-colors"
            aria-label="Enviar mensagem ao Atlas"
          >
            <ArrowUp className="h-4 w-4" />
          </button>
        </form>
      </section>

      {/* ── Produtos sugeridos — largura total ─────────────────────────── */}
      <SuggestedProducts />
    </main>
  );
};

export default DashboardHomePage;
