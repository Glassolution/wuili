import { ArrowLeft, Store } from "lucide-react";
import { Link } from "react-router-dom";

const CreateStoreStubPage = () => (
  <main
    className="flex min-h-screen items-center justify-center bg-black px-6 text-white"
    style={{ fontFamily: '"Helvetica Neue", Helvetica, Arial, sans-serif' }}
  >
    <section className="w-full max-w-[460px] rounded-[6px] bg-white/[0.045] p-8 sm:p-10">
      <span className="flex h-11 w-11 items-center justify-center rounded-[5px] bg-white/[0.07]">
        <Store size={21} strokeWidth={1.7} />
      </span>
      <p className="mt-10 text-[11px] font-semibold uppercase tracking-[0.16em] text-white/38">Criar minha loja</p>
      <h1 className="mt-3 text-[40px] font-normal leading-[1.05] tracking-[-0.05em]">Em construção.</h1>
      <p className="mt-4 text-[15px] leading-relaxed text-white/55">
        O assistente de criação da sua loja Velo estará disponível em breve.
      </p>
      <Link to="/comecar" className="mt-9 inline-flex items-center gap-2 text-[13px] font-medium text-white/70 transition hover:text-white">
        <ArrowLeft size={15} /> Voltar às opções
      </Link>
    </section>
  </main>
);

export default CreateStoreStubPage;
