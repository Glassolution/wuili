import { VeloLogo } from "@/components/VeloLogo";

/**
 * Tela cheia de carregamento da Velo.
 *
 * Logo em cima, barra fina embaixo. A barra é indeterminada de propósito: o
 * carregamento de rota não expõe progresso real, e fingir uma porcentagem
 * exata seria mentira. O que ela comunica é "está andando", com um ciclo que
 * completa e recomeça.
 */
export const VeloLoadingScreen = ({ message }: { message?: string }) => (
  <div
    className="flex min-h-screen w-full flex-col items-center justify-center gap-7 bg-white px-6"
    role="status"
    aria-live="polite"
    aria-label={message ?? "Carregando"}
  >
    <VeloLogo size="md" variant="dark" />

    <div className="flex w-full max-w-[188px] flex-col items-center gap-3">
      <span aria-hidden="true" className="velo-loading-track">
        <span className="velo-loading-fill" />
      </span>

      {message ? (
        <span className="text-[12.5px] font-medium tracking-[-0.01em] text-[#8E8E8A]">{message}</span>
      ) : null}
    </div>
  </div>
);

export default VeloLoadingScreen;
