import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ArrowUp, Edit3, Plus, Search, Tag, Type, X } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";

const getGreeting = () => {
  const hour = new Date().getHours();
  if (hour < 12) return "Bom dia";
  if (hour < 18) return "Boa tarde";
  return "Olá";
};

const StoreSetupIllustration = () => (
  <div className="relative mx-auto flex h-[264px] w-full items-center justify-center overflow-hidden rounded-[18px] bg-[#fbfbfb]">
    <div className="absolute h-52 w-40 -translate-x-14 rotate-[-10deg] rounded-[18px] bg-[#efe9d9] shadow-[0_18px_34px_rgba(0,0,0,0.08)]">
      <div className="absolute inset-3 rounded-[14px] bg-[url('https://images.unsplash.com/photo-1548036328-c9fa89d128fa?auto=format&fit=crop&w=280&q=80')] bg-cover bg-center opacity-70" />
    </div>
    <div className="absolute h-52 w-40 translate-x-16 rotate-[12deg] rounded-[18px] bg-[#e7d7d4] shadow-[0_18px_34px_rgba(0,0,0,0.08)]">
      <div className="absolute inset-3 rounded-[14px] bg-[url('https://images.unsplash.com/photo-1505740420928-5e560c06d30e?auto=format&fit=crop&w=280&q=80')] bg-cover bg-center opacity-75" />
    </div>
    <div className="relative z-10 h-[174px] w-[174px] rounded-[18px] bg-white shadow-[0_18px_38px_rgba(0,0,0,0.12)]">
      <div className="absolute inset-4 rounded-[14px] border-2 border-dashed border-[#d7d7d7]" />
      <Tag className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-[#bdbdbd]" size={34} strokeWidth={1.8} />
      <div className="absolute bottom-6 left-5 right-5 h-4 rounded-full bg-[#cfcfcf]" />
    </div>
  </div>
);

const ThemeIllustration = () => (
  <div className="relative mx-auto flex h-[264px] w-full items-center justify-center overflow-hidden rounded-[18px] bg-[#fbfbfb]">
    <div className="absolute h-52 w-40 -translate-x-16 rotate-[-12deg] rounded-[18px] bg-[#dbe8ef] shadow-[0_18px_34px_rgba(0,0,0,0.08)]">
      <div className="absolute inset-3 rounded-[14px] bg-[url('https://images.unsplash.com/photo-1434389677669-e08b4cac3105?auto=format&fit=crop&w=280&q=80')] bg-cover bg-center opacity-70" />
    </div>
    <div className="absolute h-52 w-40 translate-x-16 rotate-[12deg] rounded-[18px] bg-[#e9d4b5] shadow-[0_18px_34px_rgba(0,0,0,0.08)]">
      <div className="absolute inset-3 rounded-[14px] bg-[url('https://images.unsplash.com/photo-1572635196237-14b3f281503f?auto=format&fit=crop&w=280&q=80')] bg-cover bg-center opacity-70" />
    </div>
    <div className="relative z-10 h-[174px] w-[230px] rounded-[18px] bg-white shadow-[0_18px_38px_rgba(0,0,0,0.12)]">
      <div className="absolute inset-4 rounded-[14px] border-2 border-dashed border-[#d7d7d7]" />
      <div className="absolute left-8 top-12 space-y-2">
        <span className="block h-7 w-7 rounded bg-[#c9c9c9]" />
        <span className="block h-7 w-7 rounded bg-[#c9c9c9]" />
        <span className="block h-7 w-7 rounded bg-[#c9c9c9]" />
      </div>
      <div className="absolute bottom-8 left-8 h-10 w-10 rounded-[10px] border-2 border-dashed border-[#dedede]" />
      <div className="absolute bottom-8 left-[86px] h-10 w-16 rounded-[10px] border-2 border-dashed border-[#dedede]" />
      <div className="absolute bottom-8 right-8 h-10 w-12 rounded-[10px] border-2 border-dashed border-[#dedede]" />
      <div className="absolute right-9 top-[84px] flex h-14 w-14 items-center justify-center rounded-[10px] bg-[#c9c9c9] text-[25px] font-semibold text-white">
        <Type size={30} strokeWidth={1.5} />
      </div>
    </div>
  </div>
);

const MiniCard = ({
  title,
  children,
  action,
}: {
  title: string;
  children: React.ReactNode;
  action?: React.ReactNode;
}) => (
  <article className="min-h-[156px] rounded-[16px] bg-[#fbfbfb] p-6">
    <div className="flex items-start justify-between gap-4">
      <h3 className="max-w-[220px] text-[18px] font-[650] leading-[1.16] tracking-[-0.02em] text-[#303030]">{title}</h3>
      {action}
    </div>
    <div className="mt-5">{children}</div>
  </article>
);

export default function DashboardHomePage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [command, setCommand] = useState("");

  const { data: profile } = useQuery({
    queryKey: ["dashboard-home-profile", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("display_name, loja_nome")
        .eq("user_id", user!.id)
        .maybeSingle();

      if (error) {
        console.error("[DashboardHomePage] erro ao buscar perfil:", error);
        return null;
      }

      return data as { display_name?: string | null; loja_nome?: string | null } | null;
    },
  });

  const firstName = useMemo(() => {
    const metadataName =
      (user?.user_metadata?.name as string | undefined) ??
      (user?.user_metadata?.full_name as string | undefined);
    const source = profile?.display_name?.trim() || metadataName || "";
    return source ? source.split(" ")[0] : "";
  }, [profile?.display_name, user?.user_metadata]);

  const submitCommand = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const normalized = command.trim().toLowerCase();
    if (!normalized) return;

    if (normalized.includes("produto") || normalized.includes("import")) {
      navigate("/dashboard/produtos");
      return;
    }

    if (normalized.includes("pedido") || normalized.includes("venda")) {
      navigate("/dashboard/pedidos");
      return;
    }

    if (normalized.includes("pagamento") || normalized.includes("plano")) {
      navigate("/checkout?plan=pro");
      return;
    }

    navigate("/dashboard/produtos");
  };

  return (
    <main className="-m-3 min-h-[calc(100vh-96px)] bg-[#f1f1f1] px-4 py-6 text-[#303030] antialiased [font-family:-apple-system,BlinkMacSystemFont,'SF_Pro_Text','Helvetica_Neue',Arial,sans-serif] sm:-m-4 sm:px-6 lg:-m-6 lg:px-8 lg:py-7">
      <div className="mx-auto w-full max-w-[960px]">
        <section className="flex min-h-[62px] items-center justify-between rounded-[14px] bg-[#202529] px-5 text-white shadow-[0_1px_2px_rgba(0,0,0,0.14)]">
          <p className="text-[16px] font-[520] tracking-[0.01em]">Garanta 3 meses por $ 1/mês</p>
          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={() => navigate("/checkout?plan=pro")}
              className="hidden h-11 rounded-[9px] bg-white px-5 text-[15px] font-[650] text-[#303030] shadow-[inset_0_0_0_1px_rgba(0,0,0,0.08)] transition hover:bg-[#f4f4f4] sm:inline-flex sm:items-center"
            >
              Selecionar um plano
            </button>
            <button
              type="button"
              aria-label="Fechar promoção"
              className="flex h-8 w-8 items-center justify-center rounded-full text-white/86 transition hover:bg-white/10 hover:text-white"
            >
              <X size={20} strokeWidth={2.2} />
            </button>
          </div>
        </section>

        <section className="mt-10">
          <div className="mb-4 flex items-center justify-between px-3">
            <h1 className="text-[22px] font-[650] leading-none tracking-[-0.012em] text-[#303030]">
              {getGreeting()}{firstName ? `, ${firstName}` : ""}, vamos começar.
            </h1>
            <p className="hidden text-[15px] font-[560] text-[#303030] sm:block">
              Dúvidas? <span className="font-[680]">0800 590 0140</span>
            </p>
          </div>

          <form
            onSubmit={submitCommand}
            className="relative rounded-[14px] border border-[#d8d8d8] bg-white px-4 py-4 shadow-[0_1px_2px_rgba(0,0,0,0.08)]"
          >
            <input
              value={command}
              onChange={(event) => setCommand(event.target.value)}
              placeholder="Pergunte o que quiser..."
              className="h-9 w-full border-0 bg-transparent pr-20 text-[17px] font-[430] text-[#303030] outline-none placeholder:text-[#858585]"
            />
            <div className="mt-5 flex items-center justify-between">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[#5e28d8] text-[14px] text-white">
                ◉
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  aria-label="Adicionar"
                  className="flex h-8 w-8 items-center justify-center rounded-full text-[#303030] transition hover:bg-[#f2f2f2]"
                >
                  <Plus size={20} strokeWidth={2.2} />
                </button>
                <button
                  type="submit"
                  aria-label="Enviar"
                  className="flex h-9 w-9 items-center justify-center rounded-full bg-[#f1f1f1] text-[#b8b8b8] transition hover:bg-[#e7e7e7] hover:text-[#303030]"
                >
                  <ArrowUp size={19} strokeWidth={2.4} />
                </button>
              </div>
            </div>
          </form>
        </section>

        <section className="mt-5 rounded-[14px] border border-[#d8d8d8] bg-white p-6 shadow-[0_1px_2px_rgba(0,0,0,0.07)]">
          <div className="mb-7 flex items-center gap-3">
            <h2 className="text-[18px] font-[680] tracking-[-0.01em] text-[#303030]">
              {profile?.loja_nome ? profile.loja_nome : "Adicionar nome da loja"}
            </h2>
            <button type="button" className="rounded-full text-[#303030] transition hover:text-black" aria-label="Editar nome da loja">
              <Edit3 size={18} strokeWidth={2.2} />
            </button>
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <article className="rounded-[18px] bg-[#fbfbfb] p-5">
              <StoreSetupIllustration />
              <div className="px-1 pb-1 pt-7">
                <h3 className="text-[18px] font-[680] tracking-[-0.01em] text-[#303030]">Adicione seu primeiro produto</h3>
                <p className="mt-3 max-w-[390px] text-[15px] font-[430] leading-[1.45] text-[#6b6b6b]">
                  Comece adicionando um produto e alguns detalhes principais. Não está pronto?{" "}
                  <button
                    type="button"
                    onClick={() => navigate("/dashboard/produtos")}
                    className="font-[520] text-[#275fd7] underline underline-offset-2"
                  >
                    Comece com um produto de amostra
                  </button>
                </p>
                <div className="mt-6 flex flex-wrap items-center gap-5">
                  <button
                    type="button"
                    onClick={() => navigate("/dashboard/produtos")}
                    className="h-10 rounded-[8px] bg-[#303030] px-4 text-[15px] font-[650] text-white shadow-[inset_0_0_0_1px_rgba(255,255,255,0.18),0_1px_0_rgba(0,0,0,0.35)] transition hover:bg-[#1f1f1f]"
                  >
                    Adicionar produto
                  </button>
                  <button
                    type="button"
                    onClick={() => navigate("/dashboard/produtos")}
                    className="text-[15px] font-[560] text-[#303030] transition hover:text-black"
                  >
                    Importar
                  </button>
                </div>
              </div>
            </article>

            <article className="rounded-[18px] bg-[#fbfbfb] p-5">
              <ThemeIllustration />
              <div className="px-1 pb-1 pt-7">
                <h3 className="text-[18px] font-[680] tracking-[-0.01em] text-[#303030]">Personalize sua loja virtual</h3>
                <p className="mt-3 max-w-[390px] text-[15px] font-[430] leading-[1.45] text-[#6b6b6b]">
                  Adicione seu logo, cores e imagens para dar vida à sua marca.
                </p>
                <button
                  type="button"
                  onClick={() => navigate("/dashboard/configuracoes")}
                  className="mt-7 h-10 rounded-[8px] border border-[#d6d6d6] bg-white px-4 text-[15px] font-[560] text-[#303030] shadow-[0_1px_1px_rgba(0,0,0,0.04)] transition hover:bg-[#f7f7f7]"
                >
                  Personalizar tema
                </button>
              </div>
            </article>
          </div>

          <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-3">
            <MiniCard title="Configurar um provedor de pagamento">
              <div className="mb-4 flex items-center gap-2">
                <span className="rounded-[6px] border border-[#dedede] bg-white px-2 py-1 text-[11px] font-[700] text-[#174ea6]">VISA</span>
                <span className="rounded-[6px] border border-[#dedede] bg-white px-2 py-1 text-[11px] font-[700] text-[#eb001b]">MC</span>
                <span className="rounded-[6px] border border-[#dedede] bg-white px-2 py-1 text-[11px] font-[700] text-[#00a650]">Pix</span>
              </div>
              <button
                type="button"
                onClick={() => navigate("/checkout?plan=pro")}
                className="h-8 rounded-[7px] border border-[#d6d6d6] bg-white px-3 text-[13px] font-[560] text-[#303030] transition hover:bg-[#f7f7f7]"
              >
                Ativar
              </button>
            </MiniCard>

            <MiniCard title="Analise suas taxas de frete">
              <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-[10px] bg-[#19a463] shadow-sm">
                <span className="h-4 w-4 rotate-45 rounded-[3px] bg-[#f6d34f]" />
              </div>
              <button
                type="button"
                onClick={() => navigate("/dashboard/pedidos")}
                className="h-8 rounded-[7px] border border-[#d6d6d6] bg-white px-3 text-[13px] font-[560] text-[#303030] transition hover:bg-[#f7f7f7]"
              >
                Analisar
              </button>
            </MiniCard>

            <MiniCard
              title="Personalizar domínio"
              action={
                <span className="rounded-full bg-[#e2e2e2] px-3 py-1 text-[13px] font-[650] text-[#303030]">
                  Ganhe $ 20
                </span>
              }
            >
              <div className="mb-4 flex h-9 items-center justify-between rounded-[8px] border border-[#dedede] bg-white px-3 text-[13px] text-[#6b6b6b]">
                velods.com.br
                <Search size={14} />
              </div>
              <button
                type="button"
                onClick={() => navigate("/dashboard/configuracoes")}
                className="h-8 rounded-[7px] border border-[#d6d6d6] bg-white px-3 text-[13px] font-[560] text-[#303030] transition hover:bg-[#f7f7f7]"
              >
                Personalizar
              </button>
            </MiniCard>
          </div>
        </section>
      </div>
    </main>
  );
}
