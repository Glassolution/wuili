import { Link } from "react-router-dom";
import MascoteVelo from "@/components/MascoteVelo";

const NotFound = () => {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#F7F7F8] px-4">
      <div className="flex max-w-[360px] flex-col items-center text-center">
        <MascoteVelo pose="acenando" altura={132} />
        <p className="m-0 mt-6 text-[13px] font-medium text-[#2563EB]">Erro 404</p>
        <h1 className="m-0 mt-1 text-[26px] font-semibold leading-8 tracking-[-0.02em] text-[#18181B]">Página não encontrada</h1>
        <p className="m-0 mt-2 text-[14px] leading-[21px] text-[#71717A]" style={{ textWrap: "balance" }}>
          O endereço que você abriu não existe ou mudou de lugar.
        </p>
        <Link
          to="/"
          className="mt-6 inline-flex h-10 items-center justify-center rounded-full bg-[#2563EB] px-5 text-[14px] font-medium text-white transition-colors duration-150 hover:bg-[#1D4ED8] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2563EB]/40 focus-visible:ring-offset-2"
        >
          Voltar ao início
        </Link>
      </div>
    </main>
  );
};

export default NotFound;
