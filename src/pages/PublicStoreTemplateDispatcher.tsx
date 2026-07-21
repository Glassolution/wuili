// Dispatcher que resolve o template da loja e renderiza a variante correta
// (Template 1 padrão ou Template 2 "Marketly") para catálogo, produto e conta.
import { lazy, Suspense, useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { fetchPublicProject, getProjectTemplate, type UserProject } from "@/lib/userProjects";

const CatalogT1 = lazy(() => import("./PublicStoreCatalogPage"));
const CatalogT2 = lazy(() => import("./PublicStoreCatalogPage2"));
const ProductT1 = lazy(() => import("./PublicProductPage"));
const ProductT2 = lazy(() => import("./PublicProductPage2"));
const AccountT1 = lazy(() => import("./PublicStoreAccountPage"));
const AccountT2 = lazy(() => import("./PublicStoreAccountPage2"));

const Loading = () => (
  <div className="grid min-h-screen place-items-center bg-white">
    <Loader2 className="animate-spin text-slate-400" />
  </div>
);

const useProjectTemplate = () => {
  const { slug } = useParams();
  const [state, setState] = useState<{ resolved: boolean; template: string }>({ resolved: false, template: "loja-1" });
  useEffect(() => {
    if (!slug) { setState({ resolved: true, template: "loja-1" }); return; }
    let active = true;
    void (async () => {
      let project: UserProject | null = null;
      try { project = await fetchPublicProject(slug); } catch { /* ignore */ }
      if (active) setState({ resolved: true, template: getProjectTemplate(project) || "loja-1" });
    })();
    return () => { active = false; };
  }, [slug]);
  return state;
};

export const PublicStoreCatalogDispatcher = () => {
  const { resolved, template } = useProjectTemplate();
  if (!resolved) return <Loading />;
  return <Suspense fallback={<Loading />}>{template === "loja-2" ? <CatalogT2 /> : <CatalogT1 />}</Suspense>;
};

export const PublicProductDispatcher = () => {
  const { resolved, template } = useProjectTemplate();
  if (!resolved) return <Loading />;
  return <Suspense fallback={<Loading />}>{template === "loja-2" ? <ProductT2 /> : <ProductT1 />}</Suspense>;
};

export const PublicStoreAccountDispatcher = () => {
  const { resolved, template } = useProjectTemplate();
  if (!resolved) return <Loading />;
  return <Suspense fallback={<Loading />}>{template === "loja-2" ? <AccountT2 /> : <AccountT1 />}</Suspense>;
};
