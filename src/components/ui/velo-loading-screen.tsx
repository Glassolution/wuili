import { VeloLogo } from "@/components/VeloLogo";

/**
 * Marca + barra de carregamento da Velo.
 *
 * A logo respira (escala e opacidade em ciclo lento) e a barra é indeterminada
 * de propósito: o carregamento não expõe progresso real, e fingir uma
 * porcentagem exata seria mentira. O que ela comunica é "está andando".
 *
 * `fill` controla o enquadramento: por padrão ocupa a tela inteira (uso em
 * rota); com `fill={false}` ocupa só o espaço do pai, para quem já tem o
 * próprio fundo — é o caso do overlay de tela cheia do velo-toast.
 */
export const VeloLoadingScreen = ({ message, fill = true }: { message?: string; fill?: boolean }) => (
  <div
    className={`flex w-full flex-col items-center justify-center gap-8 px-6 ${
      fill ? "min-h-screen bg-white" : ""
    }`}
    role="status"
    aria-live="polite"
    aria-label={message ?? "Carregando"}
  >
    <span aria-hidden="true" className="velo-loading-mark">
      <VeloLogo size="md" variant="dark" />
    </span>

    <div className="flex w-full max-w-[188px] flex-col items-center gap-3.5">
      <span aria-hidden="true" className="velo-loading-track">
        <span className="velo-loading-sweep" />
      </span>

      {message ? (
        <span className="velo-loading-message text-[12.5px] font-medium tracking-[-0.01em] text-[#8E8E8A]">
          {message}
        </span>
      ) : null}
    </div>
  </div>
);

export default VeloLoadingScreen;
