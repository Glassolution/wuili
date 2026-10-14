import { useState, type FormEvent } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { BeakerIcon } from "@heroicons/react/20/solid";
import { veloToast as toast } from "@/components/ui/velo-toast";
import { supabase } from "@/integrations/supabase/client";

/*
 * Dá uma assinatura de teste (provider "sandbox", sem cobrança) para outra
 * conta, para o time ver o fluxo como cliente — por exemplo, pedir reembolso.
 * A aprovação de reembolso reconhece o sandbox e não chama a ValidaPay.
 */

const PLANOS = [
  { id: "base", label: "Base" },
  { id: "pro", label: "Pro" },
  { id: "business", label: "Business" },
];

export const AdminSandboxGrant = () => {
  const qc = useQueryClient();
  const [email, setEmail] = useState("");
  const [plano, setPlano] = useState("base");
  const [enviando, setEnviando] = useState(false);

  const enviar = async (event: FormEvent) => {
    event.preventDefault();
    const alvo = email.trim().toLowerCase();
    if (!alvo) return;
    setEnviando(true);
    const { data, error } = await supabase.functions.invoke("admin-sandbox-subscription", {
      body: { plan: plano, cycle: "monthly", target_email: alvo },
    });
    setEnviando(false);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- resposta simples da função
    const resposta = data as any;
    if (error || resposta?.error) {
      let mensagem = resposta?.error as string | undefined;
      // erros 4xx chegam no corpo da resposta, não em `data`
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- FunctionsHttpError carrega a Response
      const ctx = (error as any)?.context;
      if (!mensagem && ctx?.json) mensagem = (await ctx.json().catch(() => null))?.error;
      toast.error(mensagem ?? "Não foi possível criar a assinatura de teste.");
      return;
    }
    toast.success(resposta?.message ?? "Assinatura de teste ativada.");
    void qc.invalidateQueries({ queryKey: ["admin-subs-eligible"] });
  };

  return (
    <form
      onSubmit={enviar}
      className="flex flex-wrap items-end gap-3 rounded-xl border border-dashed border-black/15 bg-white p-4"
    >
      <div className="min-w-[220px] flex-1">
        <p className="flex items-center gap-1.5 text-[13px] font-semibold text-[#171715]">
          <BeakerIcon className="h-4 w-4 text-[#2563EB]" aria-hidden="true" />
          Assinatura de teste
        </p>
        <p className="mt-0.5 text-[12px] text-[#8A8A8E]">
          Ativa um plano sem cobrança na conta escolhida, para testar o pedido de reembolso como cliente. O reembolso
          de teste não passa pela ValidaPay.
        </p>
      </div>
      <label className="flex flex-col gap-1 text-[12px] text-[#8A8A8E]">
        E-mail da conta
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="conta@exemplo.com"
          className="h-9 w-[240px] rounded-md border border-black/10 bg-white px-3 text-[13px] text-[#171715] outline-none focus:border-[#2563EB]"
        />
      </label>
      <label className="flex flex-col gap-1 text-[12px] text-[#8A8A8E]">
        Plano
        <select
          value={plano}
          onChange={(e) => setPlano(e.target.value)}
          className="h-9 rounded-md border border-black/10 bg-white px-2 text-[13px] text-[#171715]"
        >
          {PLANOS.map((p) => (
            <option key={p.id} value={p.id}>
              {p.label}
            </option>
          ))}
        </select>
      </label>
      <button
        type="submit"
        disabled={enviando || !email.trim()}
        className="h-9 rounded-md bg-[#171715] px-4 text-[12px] font-semibold text-white disabled:opacity-50"
      >
        {enviando ? "Ativando…" : "Dar assinatura de teste"}
      </button>
    </form>
  );
};
