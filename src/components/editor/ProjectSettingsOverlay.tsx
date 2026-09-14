import { useCallback, useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Check, ChevronLeft, Crown, Globe, Loader2, Lock, Mail, Pencil, Settings, Trash2, Users, X } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { usePlan } from "@/hooks/usePlan";
import {
  fetchProjectMembers,
  getProjectCategory,
  getProjectSubdomain,
  getProjectVisibility,
  inviteProjectMember,
  parseInviteError,
  removeProjectMember,
  sendProjectInviteEmail,
  updateProjectMetadata,
  updateProjectName,
  type ProjectMember,
  type ProjectRole,
  type ProjectVisibility,
  type UserProject,
} from "@/lib/userProjects";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export type SettingsSection = "geral" | "equipe" | "publicacao" | "dominio";

const CATEGORIES = [
  "Casa",
  "Eletrônicos",
  "Moda",
  "Bijuterias",
  "Decoração",
  "Bebê e Infantil",
  "Pet",
  "Beleza",
  "Saúde e Bem-estar",
  "Esporte e Fitness",
  "Outros",
];

const ROLE_LABEL: Record<ProjectRole, string> = {
  owner: "Dono",
  editor: "Editor",
  viewer: "Visualizador",
};

const formatDate = (value: string | null | undefined) => {
  if (!value) return "—";
  return new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short", year: "numeric" }).format(new Date(value));
};

type Props = {
  open: boolean;
  onClose: () => void;
  project: UserProject | null;
  initialSection?: SettingsSection;
  onProjectChange?: (project: UserProject) => void;
  onNameChange?: (name: string) => void;
};

const NAV: { id: SettingsSection; label: string; icon: typeof Settings }[] = [
  { id: "geral", label: "Geral", icon: Settings },
  { id: "equipe", label: "Equipe", icon: Users },
  { id: "publicacao", label: "Publicação", icon: Crown },
  { id: "dominio", label: "Domínio", icon: Globe },
];

const ProjectSettingsOverlay = ({ open, onClose, project, initialSection = "geral", onProjectChange, onNameChange }: Props) => {
  const { user } = useAuth();
  const plan = usePlan();
  const isPaid = plan.status === "active" && plan.plan !== "gratis";

  const [section, setSection] = useState<SettingsSection>(initialSection);
  const [members, setMembers] = useState<ProjectMember[]>([]);
  const [membersLoading, setMembersLoading] = useState(false);
  const [notice, setNotice] = useState<{ tone: "ok" | "error"; text: string } | null>(null);

  const [nameDraft, setNameDraft] = useState("");
  const [subdomainDraft, setSubdomainDraft] = useState("");
  const [category, setCategory] = useState("");
  const [visibility, setVisibility] = useState<ProjectVisibility>("publico");
  const [saving, setSaving] = useState(false);

  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<Exclude<ProjectRole, "owner">>("editor");
  const [inviting, setInviting] = useState(false);

  const isOwner = !!project && !!user && project.user_id === user.id;

  useEffect(() => {
    if (open) setSection(initialSection);
  }, [open, initialSection]);

  useEffect(() => {
    if (!project) return;
    setNameDraft(project.nome ?? "");
    setSubdomainDraft(getProjectSubdomain(project));
    setCategory(getProjectCategory(project));
    setVisibility(getProjectVisibility(project));
  }, [project]);

  const loadMembers = useCallback(async () => {
    if (!project) return;
    setMembersLoading(true);
    try {
      setMembers(await fetchProjectMembers(project.id));
    } catch {
      setNotice({ tone: "error", text: "Não foi possível carregar a equipe." });
    } finally {
      setMembersLoading(false);
    }
  }, [project]);

  useEffect(() => {
    if (open && section === "equipe" && project) void loadMembers();
  }, [open, section, project, loadMembers]);

  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(null), 3600);
    return () => clearTimeout(timer);
  }, [notice]);

  const handleSaveName = async () => {
    if (!project) return;
    const nome = nameDraft.trim();
    if (!nome || nome === project.nome) return;
    setSaving(true);
    try {
      await updateProjectName(project.id, nome);
      onNameChange?.(nome);
      onProjectChange?.({ ...project, nome });
      setNotice({ tone: "ok", text: "Nome atualizado." });
    } catch {
      setNotice({ tone: "error", text: "Não foi possível renomear." });
    } finally {
      setSaving(false);
    }
  };

  const handleSaveMetadata = async (patch: Partial<{ category: string; visibility: ProjectVisibility; subdomain: string }>) => {
    if (!project) return;
    setSaving(true);
    try {
      const updated = await updateProjectMetadata(project, patch);
      onProjectChange?.(updated);
      setNotice({ tone: "ok", text: "Alterações salvas." });
    } catch {
      setNotice({ tone: "error", text: "Não foi possível salvar." });
    } finally {
      setSaving(false);
    }
  };

  const handleInvite = async () => {
    if (!project) return;
    const email = inviteEmail.trim().toLowerCase();
    if (!email || !email.includes("@")) {
      setNotice({ tone: "error", text: "Informe um e-mail válido." });
      return;
    }
    setInviting(true);
    try {
      await inviteProjectMember(project.id, email, inviteRole);
      // O convite em si já fica registrado. O email é best-effort: enquanto a
      // Edge Function send-project-invite-email não estiver publicada, a chamada
      // falha e o aviso não menciona envio de e-mail — em vez de afirmar um
      // envio que não aconteceu.
      let emailSent = true;
      try {
        await sendProjectInviteEmail(project.id, email, inviteRole);
      } catch (emailError) {
        emailSent = false;
        console.error("[ProjectSettingsOverlay] falha ao enviar email de convite:", emailError);
      }
      setInviteEmail("");
      setNotice({
        tone: "ok",
        text: emailSent
          ? "Convite enviado por e-mail. O acesso é liberado quando o convidado tiver um plano pago ativo."
          : "Convite registrado. O acesso é liberado quando o convidado tiver um plano pago ativo.",
      });
      await loadMembers();
    } catch (error) {
      const code = parseInviteError(error);
      const messages: Record<string, string> = {
        owner_not_paid: "Você precisa de um plano pago ativo para convidar.",
        cannot_invite_self: "Você já é o dono deste projeto.",
        not_owner: "Apenas o dono do projeto pode convidar.",
        invalid_role: "Papel inválido.",
        not_authenticated: "Sessão expirada. Entre novamente.",
        unknown: "Não foi possível enviar o convite.",
      };
      setNotice({ tone: "error", text: messages[code] });
    } finally {
      setInviting(false);
    }
  };

  const handleRemoveMember = async (member: ProjectMember) => {
    setSaving(true);
    try {
      await removeProjectMember(member.id);
      setMembers((current) => current.filter((item) => item.id !== member.id));
      setNotice({ tone: "ok", text: "Membro removido." });
    } catch {
      setNotice({ tone: "error", text: "Não foi possível remover." });
    } finally {
      setSaving(false);
    }
  };

  const ownerEmail = useMemo(() => (isOwner ? user?.email ?? "" : ""), [isOwner, user]);

  return (
    <AnimatePresence>
      {open && project ? (
        <motion.div
          className="fixed inset-0 z-[120] bg-[#0e0f10] text-white"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
        >
          <motion.div
            className="flex h-full"
            initial={{ scale: 0.985, y: 8 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.99, y: 6 }}
            transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
          >
            {/* Sidebar */}
            <aside className="hidden w-[280px] shrink-0 flex-col border-r border-white/[0.06] px-4 py-6 md:flex">
              <button type="button" onClick={onClose} className="flex items-center gap-2 rounded-[10px] px-2 py-2 text-[14px] font-medium text-white/70 transition hover:bg-white/[0.06] hover:text-white">
                <ChevronLeft size={18} /> Voltar
              </button>

              <div className="mt-6 flex items-center gap-3 rounded-[12px] px-2 py-2">
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#d8b287] text-[11px] font-bold text-[#4c2414]">
                  {(user?.email ?? "V").slice(0, 1).toUpperCase()}
                </span>
                <span className="min-w-0 truncate text-[13px] text-white/75">{user?.email ?? "Conta"}</span>
              </div>

              <p className="mt-6 px-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-white/35">Projeto</p>
              <nav className="mt-2 space-y-0.5">
                {NAV.map(({ id, label, icon: Icon }) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setSection(id)}
                    className={`flex w-full items-center gap-3 rounded-[10px] px-3 py-2 text-left text-[14px] font-medium transition ${section === id ? "bg-white/[0.08] text-white" : "text-white/60 hover:bg-white/[0.05] hover:text-white/90"}`}
                  >
                    <Icon size={17} strokeWidth={1.85} />
                    {label}
                  </button>
                ))}
              </nav>
            </aside>

            {/* Main */}
            <div className="relative flex-1 overflow-y-auto">
              <button type="button" onClick={onClose} aria-label="Fechar" className="absolute right-5 top-5 z-10 flex h-9 w-9 items-center justify-center rounded-full bg-white/[0.06] text-white/55 transition hover:bg-white/10 hover:text-white md:hidden">
                <X size={18} />
              </button>

              <div className="mx-auto max-w-[760px] px-6 py-10 md:px-10">
                {/* Project header */}
                <div className="flex items-center gap-4">
                  <span className="flex h-12 w-12 items-center justify-center rounded-[14px] bg-gradient-to-br from-[#4F7FFF] to-[#1D4ED8] text-white">
                    <Settings size={22} />
                  </span>
                  <div className="min-w-0">
                    <h1 className="truncate text-[24px] font-semibold tracking-[-0.02em]">{project.nome}</h1>
                    <p className="mt-0.5 text-[13px] text-white/45">
                      {project.status === "publicado" ? "Publicado" : "Rascunho"} · Criado em {formatDate(project.created_at)}
                    </p>
                  </div>
                </div>

                {/* Mobile nav */}
                <div className="mt-6 flex gap-2 overflow-x-auto md:hidden">
                  {NAV.map(({ id, label }) => (
                    <button key={id} type="button" onClick={() => setSection(id)} className={`whitespace-nowrap rounded-full px-3 py-1.5 text-[12px] font-medium transition ${section === id ? "bg-white text-black" : "bg-white/[0.06] text-white/65"}`}>
                      {label}
                    </button>
                  ))}
                </div>

                {notice ? (
                  <div className={`mt-6 rounded-[12px] px-4 py-3 text-[13px] ${notice.tone === "ok" ? "bg-emerald-500/10 text-emerald-300" : "bg-red-500/10 text-red-300"}`}>
                    {notice.text}
                  </div>
                ) : null}

                {section === "geral" ? (
                  <section className="mt-8">
                    <h2 className="text-[15px] font-semibold text-white/80">Detalhes do projeto</h2>
                    <div className="mt-4 divide-y divide-white/[0.06] rounded-[16px] border border-white/[0.07] bg-white/[0.02]">
                      <div className="flex items-center gap-3 px-5 py-4">
                        <span className="w-40 shrink-0 text-[14px] text-white/70">Nome do projeto</span>
                        <div className="flex flex-1 items-center justify-end gap-2">
                          <div className="flex min-w-0 items-center gap-2 rounded-[10px] border border-white/[0.14] bg-white/[0.04] px-3 py-2 transition focus-within:border-white/35 focus-within:bg-black/25">
                            <Pencil size={13} className="shrink-0 text-white/40" />
                            <input
                              value={nameDraft}
                              onChange={(event) => setNameDraft(event.target.value)}
                              onBlur={handleSaveName}
                              onKeyDown={(event) => { if (event.key === "Enter") event.currentTarget.blur(); }}
                              disabled={!isOwner || saving}
                              placeholder="Nome do projeto"
                              aria-label="Nome do projeto"
                              className="w-48 min-w-0 bg-transparent text-right text-[14px] text-white outline-none placeholder:text-white/30 disabled:opacity-60"
                            />
                          </div>
                          {isOwner && nameDraft.trim() && nameDraft.trim() !== project.nome ? (
                            <button
                              type="button"
                              onMouseDown={(event) => event.preventDefault()}
                              onClick={handleSaveName}
                              disabled={saving}
                              aria-label="Salvar nome"
                              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] bg-white text-black transition hover:opacity-90 disabled:opacity-60"
                            >
                              {saving ? <Loader2 size={15} className="animate-spin" /> : <Check size={16} strokeWidth={2.4} />}
                            </button>
                          ) : null}
                        </div>
                      </div>
                      <div className="flex items-center gap-3 px-5 py-4">
                        <span className="w-40 shrink-0 text-[14px] text-white/70">Subdomínio</span>
                        <div className="flex flex-1 items-center justify-end gap-1 text-[14px] text-white/55">
                          <input
                            value={subdomainDraft}
                            onChange={(event) => setSubdomainDraft(event.target.value.replace(/[^a-z0-9-]/gi, "").toLowerCase())}
                            onBlur={() => subdomainDraft !== getProjectSubdomain(project) && handleSaveMetadata({ subdomain: subdomainDraft })}
                            disabled={!isOwner || saving}
                            placeholder="minha-loja"
                            className="w-40 rounded-[10px] bg-transparent px-3 py-2 text-right text-white outline-none transition focus:bg-black/25 disabled:opacity-60"
                          />
                          <span>.velo.app</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 px-5 py-4">
                        <span className="w-40 shrink-0 text-[14px] text-white/70">Dono</span>
                        <span className="flex-1 truncate text-right text-[14px] text-white/85">{isOwner ? ownerEmail : "Outro usuário"}</span>
                      </div>
                      <div className="flex items-center gap-3 px-5 py-4">
                        <span className="w-40 shrink-0 text-[14px] text-white/70">Status</span>
                        <span className="flex-1 text-right text-[14px] text-white/85">{project.status === "publicado" ? "Publicado" : "Rascunho"}</span>
                      </div>
                      <div className="flex items-center gap-3 px-5 py-4">
                        <span className="w-40 shrink-0 text-[14px] text-white/70">Última edição</span>
                        <span className="flex-1 text-right text-[14px] text-white/85">{formatDate(project.last_edited_at)}</span>
                      </div>
                    </div>
                  </section>
                ) : null}

                {section === "equipe" ? (
                  <section className="mt-8">
                    <div className="flex items-center justify-between">
                      <div>
                        <h2 className="text-[15px] font-semibold text-white/80">Equipe</h2>
                        <p className="mt-1 text-[13px] text-white/45">Convide pessoas para editar esta loja em conjunto.</p>
                      </div>
                    </div>

                    {!isPaid ? (
                      <div className="mt-5 flex items-start gap-3 rounded-[16px] border border-amber-400/20 bg-amber-400/[0.06] px-5 py-4">
                        <Lock size={18} className="mt-0.5 shrink-0 text-amber-300" />
                        <div className="text-[13px] text-amber-100/80">
                          <strong className="text-amber-200">Recurso para assinantes.</strong> A colaboração em equipe exige um plano pago ativo — tanto você quanto o convidado precisam de assinatura paga.
                        </div>
                      </div>
                    ) : null}

                    {/* Owner row */}
                    <div className="mt-5 rounded-[16px] border border-white/[0.07] bg-white/[0.02]">
                      <div className="flex items-center gap-3 px-5 py-4">
                        <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[#d8b287] text-[12px] font-bold text-[#4c2414]">
                          {(ownerEmail || "V").slice(0, 1).toUpperCase()}
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-[14px] font-medium">{isOwner ? `${ownerEmail} (você)` : "Dono do projeto"}</p>
                        </div>
                        <span className="flex items-center gap-1 rounded-full bg-white/[0.06] px-3 py-1 text-[12px] font-medium text-white/70">
                          <Crown size={13} className="text-amber-300" /> Dono
                        </span>
                      </div>

                      {membersLoading ? (
                        <div className="flex items-center gap-2 px-5 py-4 text-[13px] text-white/50">
                          <Loader2 size={15} className="animate-spin" /> Carregando equipe...
                        </div>
                      ) : (
                        members.map((member) => (
                          <div key={member.id} className="flex items-center gap-3 border-t border-white/[0.06] px-5 py-4">
                            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-white/[0.08] text-[12px] font-bold text-white/70">
                              {member.invited_email.slice(0, 1).toUpperCase()}
                            </span>
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-[14px] font-medium">{member.invited_email}</p>
                              <p className="text-[12px] text-white/45">
                                {ROLE_LABEL[member.role]} · {member.status === "active" ? "Ativo" : "Convite pendente"}
                              </p>
                            </div>
                            {isOwner ? (
                              <button type="button" onClick={() => handleRemoveMember(member)} disabled={saving} className="flex h-8 w-8 items-center justify-center rounded-full text-white/45 transition hover:bg-red-500/10 hover:text-red-300 disabled:opacity-50" aria-label="Remover membro">
                                <Trash2 size={16} />
                              </button>
                            ) : null}
                          </div>
                        ))
                      )}
                    </div>

                    {isOwner ? (
                      <div className="mt-5 rounded-[16px] border border-white/[0.07] bg-white/[0.02] p-5">
                        <p className="text-[14px] font-medium text-white/80">Convidar por e-mail</p>
                        <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                          <div className="flex flex-1 items-center gap-2 rounded-[11px] border border-white/[0.1] bg-black/25 px-3">
                            <Mail size={16} className="text-white/40" />
                            <input
                              value={inviteEmail}
                              onChange={(event) => setInviteEmail(event.target.value)}
                              onKeyDown={(event) => { if (event.key === "Enter") void handleInvite(); }}
                              disabled={!isPaid || inviting}
                              placeholder="amigo@email.com"
                              className="h-11 flex-1 bg-transparent text-[14px] text-white outline-none disabled:opacity-60"
                            />
                          </div>
                          <Select
                            value={inviteRole}
                            onValueChange={(value) => setInviteRole(value as Exclude<ProjectRole, "owner">)}
                            disabled={!isPaid || inviting}
                          >
                            <SelectTrigger className="h-11 w-full rounded-[11px] border-white/[0.1] bg-black/25 px-3 text-[14px] text-white focus:ring-0 focus:ring-offset-0 disabled:opacity-60 sm:w-44">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent className="z-[130] rounded-[11px] border-white/10 bg-[#1c1d1e] text-white">
                              <SelectItem value="editor" className="rounded-lg text-[14px] text-white focus:bg-white/10 focus:text-white">
                                Editor
                              </SelectItem>
                              <SelectItem value="viewer" className="rounded-lg text-[14px] text-white focus:bg-white/10 focus:text-white">
                                Visualizador
                              </SelectItem>
                            </SelectContent>
                          </Select>
                          <button
                            type="button"
                            onClick={() => void handleInvite()}
                            disabled={!isPaid || inviting}
                            className="flex h-11 items-center justify-center gap-2 rounded-[11px] bg-[#3567e9] px-5 text-[14px] font-semibold text-white transition hover:bg-[#4272ee] disabled:opacity-45"
                          >
                            {inviting ? <Loader2 size={16} className="animate-spin" /> : null} Convidar
                          </button>
                        </div>
                      </div>
                    ) : null}
                  </section>
                ) : null}

                {section === "publicacao" ? (
                  <section className="mt-8">
                    <h2 className="text-[15px] font-semibold text-white/80">Publicação</h2>
                    <p className="mt-1 text-[13px] text-white/45">Controle como este projeto aparece quando publicado.</p>
                    <div className="mt-4 divide-y divide-white/[0.06] rounded-[16px] border border-white/[0.07] bg-white/[0.02]">
                      <div className="flex items-center gap-3 px-5 py-4">
                        <span className="w-40 shrink-0 text-[14px] text-white/70">Categoria</span>
                        <Select
                          value={category || undefined}
                          onValueChange={(value) => { setCategory(value); void handleSaveMetadata({ category: value }); }}
                          disabled={!isOwner || saving}
                        >
                          <SelectTrigger className="h-10 flex-1 rounded-[10px] border-white/[0.1] bg-black/25 px-3 text-[14px] text-white focus:ring-0 focus:ring-offset-0 disabled:opacity-60">
                            <SelectValue placeholder="Selecionar categoria" />
                          </SelectTrigger>
                          <SelectContent className="z-[130] max-h-72 rounded-[11px] border-white/10 bg-[#1c1d1e] text-white">
                            {CATEGORIES.map((item) => (
                              <SelectItem key={item} value={item} className="rounded-lg text-[14px] text-white focus:bg-white/10 focus:text-white">
                                {item}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="flex items-center gap-3 px-5 py-4">
                        <div className="flex-1">
                          <p className="text-[14px] text-white/80">Visibilidade</p>
                          <p className="mt-0.5 text-[12px] text-white/45">
                            {visibility === "publico" ? "Qualquer pessoa com o link pode ver a loja." : "Apenas você e a equipe podem ver."}
                          </p>
                        </div>
                        <div className="flex rounded-full bg-black/30 p-1">
                          {(["publico", "privado"] as ProjectVisibility[]).map((value) => (
                            <button
                              key={value}
                              type="button"
                              disabled={!isOwner || saving}
                              onClick={() => { setVisibility(value); void handleSaveMetadata({ visibility: value }); }}
                              className={`rounded-full px-3 py-1.5 text-[12px] font-medium transition disabled:opacity-60 ${visibility === value ? "bg-white text-black" : "text-white/60"}`}
                            >
                              {value === "publico" ? "Público" : "Privado"}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  </section>
                ) : null}

                {section === "dominio" ? (
                  <section className="mt-8">
                    <h2 className="text-[15px] font-semibold text-white/80">Domínio</h2>
                    <p className="mt-1 text-[13px] text-white/45">Endereço em que sua loja fica disponível.</p>
                    <div className="mt-4 rounded-[16px] border border-white/[0.07] bg-white/[0.02] p-5">
                      <p className="text-[13px] text-white/60">Subdomínio Velo</p>
                      <div className="mt-2 flex items-center gap-1 rounded-[11px] border border-white/[0.1] bg-black/25 px-3">
                        <input
                          value={subdomainDraft}
                          onChange={(event) => setSubdomainDraft(event.target.value.replace(/[^a-z0-9-]/gi, "").toLowerCase())}
                          onBlur={() => subdomainDraft !== getProjectSubdomain(project) && handleSaveMetadata({ subdomain: subdomainDraft })}
                          disabled={!isOwner || saving}
                          placeholder="minha-loja"
                          className="h-11 flex-1 bg-transparent text-[14px] text-white outline-none disabled:opacity-60"
                        />
                        <span className="text-[14px] text-white/45">.velo.app</span>
                      </div>
                      <p className="mt-4 text-[12px] text-white/40">Domínio personalizado (ex.: sualoja.com.br) estará disponível em breve.</p>
                    </div>
                  </section>
                ) : null}
              </div>
            </div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
};

export default ProjectSettingsOverlay;
