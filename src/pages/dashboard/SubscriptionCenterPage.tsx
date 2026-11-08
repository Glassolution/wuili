import { ArrowLeft } from "lucide-react";
import { Link } from "react-router-dom";
import SubscriptionManageSection from "@/components/dashboard/SubscriptionManageSection";

const SubscriptionCenterPage = () => {
  const backTo = "/dashboard/configuracoes?tab=Plano";

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-6 sm:px-8 sm:py-10">
      <Link
        to={backTo}
        className="inline-flex items-center gap-2 rounded-lg px-2 py-2 text-sm font-medium text-[#1E40AF] hover:bg-blue-50 dark:text-blue-300 dark:hover:bg-blue-500/10"
      >
        <ArrowLeft size={16} aria-hidden="true" />
        Voltar às configurações
      </Link>
      <h1 className="mt-5 text-3xl font-semibold tracking-tight text-[#111113] dark:text-white">
        Gerenciar assinatura
      </h1>
      <p className="mb-7 mt-2 text-sm text-zinc-600 dark:text-zinc-400">
        Veja o seu plano e gerencie a renovação.
      </p>
      <SubscriptionManageSection />
    </main>
  );
};

export default SubscriptionCenterPage;
