import { useMemo, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Flag,
  Handshake,
  Instagram,
  Music2,
  Plus,
  Search,
  Store,
  Twitter,
  Youtube,
} from "lucide-react";

export type VeloStore = {
  id: string;
  name: string;
  ownerName: string;
  cpf: string;
  phone: string;
  source: string;
  businessType: string;
  goal: string;
  productLimit: number;
  publishedProducts: number;
  createdAt: string;
  isActive?: boolean;
};

export const STORES_STORAGE_KEY = "velo-user-stores";
export const STORE_PUBLICATION_COUNTS_KEY = "velo-store-publication-counts";
export const STORES_CHANGED_EVENT = "velo-stores-changed";
export const START_STORE_ONBOARDING_EVENT = "velo-start-store-onboarding";
export const MAX_STORES_PER_USER = 2;

export const getStoreProductLimit = (storeIndex: number) => (storeIndex === 0 ? 30 : storeIndex === 1 ? 15 : 15);

export const readUserStores = (): VeloStore[] => {
  if (typeof window === "undefined") return [];

  try {
    const raw = window.localStorage.getItem(STORES_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.map((store, index) => ({
      ...store,
      productLimit: Number(store.productLimit ?? getStoreProductLimit(index)),
      publishedProducts: Number(store.publishedProducts ?? getStorePublishedCount(store.id)),
    }));
  } catch {
    return [];
  }
};

export const saveUserStores = (stores: VeloStore[]) => {
  window.localStorage.setItem(STORES_STORAGE_KEY, JSON.stringify(stores));
  window.dispatchEvent(new Event(STORES_CHANGED_EVENT));
};

export const setActiveStore = (storeId: string) => {
  const stores = readUserStores();
  const updatedStores = stores.map(store => ({
    ...store,
    isActive: store.id === storeId
  }));
  saveUserStores(updatedStores);
};

export const updateStoreName = (storeId: string, newName: string) => {
  const stores = readUserStores();
  const updatedStores = stores.map(store => 
    store.id === storeId ? { ...store, name: newName.trim() } : store
  );
  saveUserStores(updatedStores);
};

export const deleteStore = (storeId: string) => {
  const stores = readUserStores();
  const storeToDelete = stores.find(store => store.id === storeId);
  
  if (!storeToDelete) return;
  
  const filteredStores = stores.filter(store => store.id !== storeId);
  
  // Se excluiu a loja ativa e ainda há lojas restantes, ativar a primeira
  if (storeToDelete.isActive && filteredStores.length > 0) {
    filteredStores[0] = {
      ...filteredStores[0],
      isActive: true
    };
  }
  
  saveUserStores(filteredStores);
  
  // Limpar contadores de publicação da loja excluída
  try {
    const raw = window.localStorage.getItem(STORE_PUBLICATION_COUNTS_KEY);
    const counts = raw ? JSON.parse(raw) : {};
    delete counts[storeId];
    window.localStorage.setItem(STORE_PUBLICATION_COUNTS_KEY, JSON.stringify(counts));
  } catch {
    // Ignorar erros de limpeza
  }
};

export const getActiveStore = () => {
  const stores = readUserStores();
  // Procura por uma loja marcada como ativa
  const activeStore = stores.find(store => store.isActive);
  // Se não encontrar, retorna a primeira loja (compatibilidade)
  return activeStore || stores[0] || null;
};

export const getStorePublishedCount = (storeId: string) => {
  if (typeof window === "undefined") return 0;

  try {
    const raw = window.localStorage.getItem(STORE_PUBLICATION_COUNTS_KEY);
    const counts = raw ? JSON.parse(raw) : {};
    return Number(counts?.[storeId] ?? 0);
  } catch {
    return 0;
  }
};

export const incrementStorePublishedCount = (storeId: string) => {
  const current = getStorePublishedCount(storeId);
  const raw = window.localStorage.getItem(STORE_PUBLICATION_COUNTS_KEY);
  const counts = raw ? JSON.parse(raw) : {};
  counts[storeId] = current + 1;
  window.localStorage.setItem(STORE_PUBLICATION_COUNTS_KEY, JSON.stringify(counts));
  window.dispatchEvent(new Event(STORES_CHANGED_EVENT));
  return counts[storeId] as number;
};

const sourceOptions = [
  { label: "Google", icon: Search },
  { label: "Instagram", icon: Instagram },
  { label: "X (Twitter)", icon: Twitter },
  { label: "Youtube", icon: Youtube },
  { label: "TikTok", icon: Music2 },
  { label: "Recomendação", icon: Handshake },
  { label: "Propaganda", icon: Flag },
  { label: "Através de um parceiro", icon: Handshake },
  { label: "Outro", icon: Plus },
];

const businessTypes = ["Loja online", "Marketplace", "Dropshipping", "Produtos digitais", "Serviços", "Ainda estou decidindo"];
const goals = ["Começar do zero", "Importar produtos", "Vender mais", "Automatizar operação", "Criar anúncios com IA", "Organizar pedidos"];

const initialForm = {
  source: "",
  ownerName: "",
  cpf: "",
  phone: "",
  projectName: "",
  businessType: "",
  goal: "",
};

type FirstStoreOnboardingProps = {
  defaultName?: string | null;
  existingStores?: VeloStore[];
  onComplete: (store: VeloStore) => void;
};

const FirstStoreOnboarding = ({ defaultName, existingStores = [], onComplete }: FirstStoreOnboardingProps) => {
  const [step, setStep] = useState(0);
  const [form, setForm] = useState(() => ({ ...initialForm, ownerName: defaultName ?? "" }));
  const storeIndex = existingStores.length;
  const productLimit = getStoreProductLimit(storeIndex);

  const steps = useMemo(
    () => [
      {
        title: "Onde você nos conheceu?",
        content: (
          <OptionGrid
            options={sourceOptions}
            value={form.source}
            onChange={(value) => setForm((current) => ({ ...current, source: value }))}
          />
        ),
        canContinue: Boolean(form.source),
      },
      {
        title: "Dados do dono da conta",
        content: (
          <div className="grid gap-3 sm:grid-cols-2">
            <Field
              className="sm:col-span-2"
              label="Nome"
              value={form.ownerName}
              placeholder="Digite seu nome"
              onChange={(ownerName) => setForm((current) => ({ ...current, ownerName }))}
            />
            <Field
              label="CPF"
              value={form.cpf}
              placeholder="000.000.000-00"
              onChange={(cpf) => setForm((current) => ({ ...current, cpf }))}
            />
            <Field
              label="Telefone"
              value={form.phone}
              placeholder="(11) 99999-9999"
              onChange={(phone) => setForm((current) => ({ ...current, phone }))}
            />
          </div>
        ),
        canContinue: Boolean(form.ownerName && form.cpf && form.phone),
      },
      {
        title: "Qual o nome do seu projeto?",
        content: (
          <Field
            label="Nome do projeto"
            value={form.projectName}
            placeholder="Digite o nome do seu projeto"
            onChange={(projectName) => setForm((current) => ({ ...current, projectName }))}
          />
        ),
        canContinue: Boolean(form.projectName),
      },


      {
        title: "Tudo pronto para criar sua loja",
        content: (
          <div className="rounded-[16px] border border-[#DDE3EE] bg-[#F8FAFC] p-4">
            <div className="flex items-center gap-3">
              <span className="flex h-11 w-11 items-center justify-center rounded-[12px] bg-[#111111] text-white">
                <Store size={20} strokeWidth={1.8} />
              </span>
              <div className="min-w-0">
                <p className="truncate text-[18px] font-semibold text-[#111111]">{form.projectName || "Minha Loja"}</p>
                <p className="text-[13px] text-[#697386]">{form.businessType || "Loja online"} · {form.goal || "Começar"}</p>
              </div>
            </div>
          </div>
        ),
        canContinue: true,
      },
    ],
    [defaultName, form],
  );

  const current = steps[step];
  const isLastStep = step === steps.length - 1;

  const handleNext = () => {
    if (!current.canContinue) return;

    if (!isLastStep) {
      setStep((value) => value + 1);
      return;
    }

    const store: VeloStore = {
      id: crypto.randomUUID(),
      name: form.projectName.trim() || "Minha Loja",
      ownerName: form.ownerName.trim(),
      cpf: form.cpf.trim(),
      phone: form.phone.trim(),
      source: form.source,
      businessType: form.businessType,
      goal: form.goal,
      productLimit,
      publishedProducts: 0,
      createdAt: new Date().toISOString(),
      isActive: existingStores.length === 0, // Primeira loja é ativa por padrão
    };

    saveUserStores([...existingStores, store]);
    onComplete(store);
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-[#111111]/28 p-3 backdrop-blur-[3px] sm:p-5">
      <div className="flex h-[min(640px,calc(100vh-32px))] w-full max-w-[700px] flex-col rounded-[10px] border border-[#E5E7EB] bg-white p-6 shadow-[0_24px_80px_rgba(15,23,42,0.22)] sm:p-8">
        <div className="flex gap-1.5">
          {steps.map((_, index) => (
            <div
              key={index}
              className={`h-3 flex-1 rounded-full ${index <= step ? "bg-[#111111]" : "bg-[#E2E7EF]"}`}
            />
          ))}
        </div>

        <div className="flex flex-1 flex-col justify-center py-8">
          <h1 className="mb-7 text-[30px] font-semibold leading-tight text-[#05070B] sm:text-[32px]">{current.title}</h1>
          {current.content}
        </div>

        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={() => setStep((value) => Math.max(0, value - 1))}
            disabled={step === 0}
            className="inline-flex h-10 items-center gap-2 rounded-[8px] border border-[#DDE3EE] bg-white px-4 text-[15px] font-medium text-[#05070B] transition-colors hover:bg-[#F8FAFC] disabled:invisible"
          >
            <ArrowLeft size={15} />
            Voltar
          </button>
          <button
            type="button"
            onClick={handleNext}
            disabled={!current.canContinue}
            className="inline-flex h-11 items-center gap-2 rounded-[8px] bg-[#111111] px-4 text-[16px] font-medium text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-45"
          >
            {isLastStep ? "Criar loja" : "Próxima Etapa"}
            {isLastStep ? <Check size={16} /> : <ArrowRight size={16} />}
          </button>
        </div>
      </div>
    </div>
  );
};

const Field = ({
  label,
  value,
  placeholder,
  onChange,
  className,
}: {
  label: string;
  value: string;
  placeholder: string;
  onChange: (value: string) => void;
  className?: string;
}) => (
  <label className={className}>
    <span className="mb-2 block text-[15px] font-medium text-[#3C4257]">{label}</span>
    <input
      value={value}
      onChange={(event) => onChange(event.target.value)}
      placeholder={placeholder}
      className="h-10 w-full rounded-[8px] border border-[#DDE3EE] bg-white px-3 text-[14px] text-[#111111] outline-none transition focus:border-[#111111] focus:bg-white focus:shadow-[0_0_0_3px_rgba(17,17,17,0.08)]"
    />
  </label>
);

const OptionGrid = ({
  options,
  value,
  onChange,
}: {
  options: Array<{ label: string; icon: typeof Search }>;
  value: string;
  onChange: (value: string) => void;
}) => (
  <div className="flex flex-wrap gap-3">
    {options.map(({ label, icon: Icon }) => {
      const selected = value === label;
      return (
        <button
          key={label}
          type="button"
          onClick={() => onChange(label)}
          className={`inline-flex h-10 items-center gap-2 rounded-[8px] border px-3 text-[14px] font-medium transition-colors ${
            selected
              ? "border-[#111111] bg-[#111111] text-white"
              : "border-[#DDE3EE] bg-white text-[#8A8FA3] hover:border-[#111111] hover:text-[#111111]"
          }`}
        >
          <Icon size={15} strokeWidth={1.8} />
          {label}
        </button>
      );
    })}
  </div>
);

const PillGrid = ({
  options,
  value,
  onChange,
}: {
  options: string[];
  value: string;
  onChange: (value: string) => void;
}) => (
  <div className="grid gap-3 sm:grid-cols-2">
    {options.map((option) => {
      const selected = value === option;
      return (
        <button
          key={option}
          type="button"
          onClick={() => onChange(option)}
          className={`flex min-h-12 items-center justify-between rounded-[10px] border px-4 text-left text-[15px] font-medium transition-colors ${
            selected
              ? "border-[#111111] bg-[#111111] text-white"
              : "border-[#DDE3EE] bg-white text-[#5F6675] hover:border-[#111111]"
          }`}
        >
          {option}
          {selected && <Check size={16} strokeWidth={1.8} />}
        </button>
      );
    })}
  </div>
);

export default FirstStoreOnboarding;
