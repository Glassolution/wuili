import { useNavigate } from "react-router-dom";
import { ArrowRight, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { VeloLogo } from "@/components/VeloLogo";

/**
 * Página de sucesso pós-pagamento (/assinatura/confirmada).
 *
 * Destino do redirect da ValidaPay depois do pagamento aprovado. É estática de
 * propósito: não consulta status de assinatura. Quem confirma o pagamento é o
 * webhook; esta tela só agradece e leva o usuário para o painel.
 *
 * Não existe página de erro par: a ValidaPay trata falha na própria tela de
 * checkout, sem redirecionar de volta.
 */

const SUCCESS = "#22C55E";

const AssinaturaConfirmadaPage = () => {
  const navigate = useNavigate();

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-white px-5 py-16">
      <div className="mb-10">
        <VeloLogo size="md" variant="dark" />
      </div>

      <div className="w-full max-w-[440px] text-center">
        <span
          className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full"
          style={{ background: `${SUCCESS}1A` }}
        >
          <CheckCircle2 size={32} strokeWidth={2} style={{ color: SUCCESS }} aria-hidden="true" />
        </span>

        <h1 className="text-[26px] font-semibold leading-tight tracking-[-0.02em] text-[#0A0A0A] sm:text-[30px]">
          Assinatura ativada!
        </h1>
        <p className="mt-2 text-[16px] font-medium text-[#0A0A0A]">Bem-vindo à Velo.</p>

        <p className="mx-auto mt-4 max-w-[380px] text-[13.5px] leading-[1.6] text-[#6B6B6B]">
          Seu pagamento foi confirmado e sua conta já está liberada. É só entrar no painel para começar a montar
          seu catálogo e publicar suas páginas.
        </p>

        <Button
          type="button"
          variant="pilot"
          onClick={() => navigate("/dashboard")}
          className="mt-8 h-12 w-full text-[14px] sm:w-auto sm:px-8"
        >
          Ir para o painel
          <ArrowRight size={16} strokeWidth={2} aria-hidden="true" />
        </Button>

        <p className="mt-6 text-[12.5px] text-[#8A8A8A]">
          Recebeu o comprovante por e-mail. Precisa de ajuda?{" "}
          <a
            href="https://wa.me/5547999286334?text=Oi%2C%20acabei%20de%20assinar%20a%20Velo%20e%20preciso%20de%20ajuda."
            target="_blank"
            rel="noopener noreferrer"
            className="font-semibold text-[#0A0A0A] underline underline-offset-2"
          >
            Fale com o suporte
          </a>
          .
        </p>
      </div>
    </main>
  );
};

export default AssinaturaConfirmadaPage;
