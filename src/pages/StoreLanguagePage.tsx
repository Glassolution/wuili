import { useMemo, useState, type ComponentType } from "react";
import { motion } from "framer-motion";
import { ArrowLeft, Check, Globe2, Search, Smile } from "lucide-react";
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";
import { listItem, listStagger, screenEnter } from "@/components/onboarding/flowMotion";
import {
  BD, BG, BR, CN, DE, DK, ES, FI, FR, GR, HR, HU, ID, IL, IN, IT, JP, KR,
  NL, NO, PL, PT, RO, SA, SE, SK, TH, TR, UA, US, ZA,
} from "country-flag-icons/react/3x2";
import type { ExampleProduct } from "@/pages/StartChoicePage";
import { saveProjectDraft } from "@/lib/userProjects";
import { readOnboardingProjectId } from "@/lib/onboardingProject";

// Emoji de bandeira não renderiza no Windows (a fonte do sistema não tem os
// indicadores regionais, e o Chrome cai para as letras "BR"/"PT"). Por isso as
// bandeiras vêm como SVG, que funciona igual em qualquer sistema.
type FlagComponent = ComponentType<{ className?: string; title?: string }>;
type LanguageOption = { name: string; Flag: FlagComponent };

// O catalão não é idioma de um país, então não tem bandeira própria.
const GenericFlag: FlagComponent = ({ className }) => (
  <Globe2 className={className} strokeWidth={1.6} />
);

const featuredLanguages: LanguageOption[] = [
  { name: "Português (Brasil)", Flag: BR },
  { name: "Português (Portugal)", Flag: PT },
  { name: "Inglês", Flag: US },
  { name: "Espanhol", Flag: ES },
  { name: "Francês", Flag: FR },
  { name: "Alemão", Flag: DE },
];

const otherLanguages: LanguageOption[] = [
  { name: "Africâner", Flag: ZA }, { name: "Árabe", Flag: SA },
  { name: "Bengali", Flag: BD }, { name: "Búlgaro", Flag: BG },
  { name: "Catalão", Flag: GenericFlag }, { name: "Chinês", Flag: CN },
  { name: "Coreano", Flag: KR }, { name: "Croata", Flag: HR },
  { name: "Dinamarquês", Flag: DK }, { name: "Eslovaco", Flag: SK },
  { name: "Finlandês", Flag: FI }, { name: "Grego", Flag: GR },
  { name: "Hebraico", Flag: IL }, { name: "Hindi", Flag: IN },
  { name: "Holandês", Flag: NL }, { name: "Húngaro", Flag: HU },
  { name: "Indonésio", Flag: ID }, { name: "Italiano", Flag: IT },
  { name: "Japonês", Flag: JP }, { name: "Norueguês", Flag: NO },
  { name: "Polonês", Flag: PL }, { name: "Romeno", Flag: RO },
  { name: "Sueco", Flag: SE }, { name: "Tailandês", Flag: TH },
  { name: "Turco", Flag: TR }, { name: "Ucraniano", Flag: UA },
];

// Bandeiras claras (Japão, Finlândia) somem no card sem o contorno.
const FLAG_CLASS = "h-4 w-6 shrink-0 rounded-[2px] object-cover ring-1 ring-white/15";

const StoreLanguagePage = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const projectId =
    (location.state as { projectId?: string } | null)?.projectId ?? readOnboardingProjectId() ?? null;
  const product = useMemo(() => {
    const fromState = (location.state as { product?: ExampleProduct } | null)?.product;
    if (fromState) return fromState;
    try {
      const stored = sessionStorage.getItem("velo-example-product");
      return stored ? (JSON.parse(stored) as ExampleProduct) : null;
    } catch {
      return null;
    }
  }, [location.state]);
  const [selectedLanguage, setSelectedLanguage] = useState("Português (Brasil)");
  const [showOtherLanguages, setShowOtherLanguages] = useState(false);
  const [search, setSearch] = useState("");

  const filteredLanguages = otherLanguages.filter((language) =>
    language.name.toLocaleLowerCase("pt-BR").includes(search.trim().toLocaleLowerCase("pt-BR")),
  );

  if (!product) return <Navigate to="/comecar" replace />;

  const chooseLanguage = (name: string) => {
    setSelectedLanguage(name);
    if (otherLanguages.some((language) => language.name === name)) setShowOtherLanguages(true);
  };

  const handleContinue = () => {
    const flowState = { product, language: selectedLanguage, projectId };
    sessionStorage.setItem("velo-store-language", selectedLanguage);
    // Persistência real: escolha é gravada no user_projects criado no passo anterior.
    // Falhas de rede não bloqueiam o wizard — sessionStorage é o cache de UI.
    if (projectId) {
      void saveProjectDraft(projectId, { language: selectedLanguage }).catch((err) => {
        console.error("saveProjectDraft (language) failed:", err);
      });
    }
    navigate("/onboarding/persona", { state: flowState });
  };

  return (
    <main className="velo-flow min-h-screen">
      <div className="grid min-h-screen lg:grid-cols-[55%_45%]">
        <section className="relative flex min-h-screen flex-col items-center overflow-hidden px-6 py-7 sm:px-9 lg:px-12">
          <Link
            to="/onboarding/preparando-produto"
            state={{ product }}
            className="vf-btn-ghost absolute left-6 top-7 inline-flex items-center sm:left-9 lg:left-12"
            aria-label="Voltar"
          >
            <ArrowLeft size={20} />
          </Link>
          <div
            className="absolute left-1/2 top-7 h-[5px] w-[210px] -translate-x-1/2 overflow-hidden rounded-[1px] bg-white/10"
            aria-label="Progresso da criação"
          >
            <div className="h-full bg-white transition-all duration-300" style={{ width: "72%" }} />
          </div>

          <motion.div {...screenEnter} className="mt-[76px] w-full max-w-[580px]">
            <h1 className="vf-headline text-[24px] font-medium leading-[30px] tracking-[-0.6px]">Que idioma falam seus clientes?</h1>
            <p className="vf-subhead mt-2 text-[18px] font-normal leading-[28px]">Isso define o idioma da loja que você vai vender.</p>

            <motion.div variants={listStagger} initial="initial" animate="animate" className="mt-8 grid grid-cols-2 gap-2">
              {featuredLanguages.map((language) => {
                const selected = selectedLanguage === language.name;
                return (
                  <motion.button
                    variants={listItem}
                    key={language.name}
                    type="button"
                    onClick={() => chooseLanguage(language.name)}
                    data-selected={selected}
                    className="vf-nested flex h-[58px] items-center gap-3 rounded-[10px] px-4 text-left outline-none"
                  >
                    <language.Flag className={FLAG_CLASS} title={language.name} />
                    <span className={`flex-1 text-[16px] font-medium ${selected ? "text-[var(--vf-text-1)]" : "text-[var(--vf-text-2)]"}`}>{language.name}</span>
                    {selected ? <Check size={16} className="text-[var(--vf-text-1)]" /> : null}
                  </motion.button>
                );
              })}
            </motion.div>

            <div className="my-4 h-px bg-[var(--vf-border)]" />
            <button type="button" onClick={() => setShowOtherLanguages((current) => !current)} aria-expanded={showOtherLanguages} data-selected={showOtherLanguages} className="vf-nested flex w-full items-center gap-4 rounded-[10px] p-4 text-left">
              <Globe2 size={20} className="text-[var(--vf-text-2)]" />
              <span className="flex-1"><span className="block text-[16px] font-medium text-[var(--vf-text-1)]">Outro idioma</span><span className="mt-0.5 block text-[13px] text-[var(--vf-text-3)]">Pesquisar entre mais idiomas</span></span>
              {otherLanguages.some((language) => language.name === selectedLanguage) ? <Check size={16} className="text-[var(--vf-text-1)]" /> : null}
            </button>

            {showOtherLanguages ? (
              <div className="mt-2 rounded-[12px] border border-[var(--vf-border)] bg-[var(--vf-panel)] p-3 shadow-[0_24px_64px_rgba(0,0,0,0.4)]">
                <label className="flex h-10 items-center gap-2 rounded-[8px] bg-[var(--vf-nested)] px-3 focus-within:ring-1 focus-within:ring-[var(--vf-border-hover)]">
                  <Search size={15} className="text-[var(--vf-text-3)]" />
                  <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar idioma" className="min-w-0 flex-1 bg-transparent text-[13px] text-[var(--vf-text-1)] outline-none placeholder:text-[var(--vf-text-3)]" autoFocus />
                </label>
                <div className="mt-2 max-h-[150px] overflow-y-auto">
                  {filteredLanguages.map((language) => (
                    <button key={language.name} type="button" onClick={() => chooseLanguage(language.name)} className={`flex w-full items-center gap-3 rounded-[6px] px-3 py-2 text-left text-[13px] transition hover:bg-[var(--vf-nested)] ${selectedLanguage === language.name ? "bg-[var(--vf-nested)] text-[var(--vf-text-1)]" : "text-[var(--vf-text-2)]"}`}>
                      <language.Flag className={FLAG_CLASS} title={language.name} /><span className="flex-1">{language.name}</span>{selectedLanguage === language.name ? <Check size={13} className="text-[var(--vf-text-1)]" /> : null}
                    </button>
                  ))}
                  {filteredLanguages.length === 0 ? <p className="px-3 py-5 text-center text-[11px] text-[var(--vf-text-3)]">Nenhum idioma encontrado.</p> : null}
                </div>
              </div>
            ) : null}

            <button type="button" onClick={handleContinue} disabled={!selectedLanguage} className="vf-btn mt-6 inline-flex h-12 w-full items-center justify-center text-[14px]">Continuar</button>
          </motion.div>
        </section>

        <aside className="relative hidden min-h-screen items-center justify-center overflow-hidden border-l border-[var(--vf-border)] bg-[var(--vf-panel-side)] p-12 lg:flex">
          <div
            className="pointer-events-none absolute inset-0 opacity-[0.15]"
            style={{
              backgroundImage: "radial-gradient(circle, rgb(255,255,255) 1px, transparent 1px)",
              backgroundSize: "24px 24px",
            }}
          />
          <div className="relative z-10 flex w-full max-w-[420px] flex-col items-center rounded-[20px] border border-[var(--vf-border)] bg-[var(--vf-panel)] px-6 py-14 text-center">
            <span className="flex h-20 w-20 items-center justify-center rounded-full bg-white/[0.06] text-white/20">
              <Smile size={38} strokeWidth={1.6} />
            </span>
            <p className="mt-6 text-[24px] font-medium tracking-[-0.02em] text-white/20">Persona do cliente ideal</p>
            <p className="mt-2 text-[16px] text-white/15">Seu ângulo de marketing único</p>
          </div>
        </aside>
      </div>
    </main>
  );
};

export default StoreLanguagePage;
