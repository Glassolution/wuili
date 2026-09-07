import { supabase } from "@/integrations/supabase/client";

export type TicketCategory = "financeiro" | "bug" | "integracao" | "conta" | "reembolso" | "outros";

export type SupportTicket = {
  id: string;
  user_id: string;
  status: "open" | "closed";
  ai_active: boolean;
  admin_last_seen_at: string | null;
  category: TicketCategory;
  subject: string | null;
  created_at: string;
  updated_at: string;
};

export type SupportMessage = {
  id: string;
  ticket_id: string;
  user_id: string;
  message: string;
  sender: "user" | "admin" | "ai";
  created_at: string;
};

export type SupportImageAttachment = {
  url: string;
  path: string;
  name: string;
  type: string;
  size: number;
};

export type SupportRedirectShortcut = {
  label: string;
  url: string;
  note: string | null;
};

export type SupportReplyReference = {
  author: string;
  text: string;
  sender: "user" | "admin" | "ai" | null;
};

export type ParsedSupportMessage = {
  text: string;
  attachment: SupportImageAttachment | null;
  redirect: SupportRedirectShortcut | null;
  reply: SupportReplyReference | null;
};

const SUPPORT_IMAGE_MARKER = "__VELO_SUPPORT_IMAGE__";
const SUPPORT_REDIRECT_MARKER = "__VELO_SUPPORT_REDIRECT__";
const SUPPORT_REPLY_MARKER = "__VELO_SUPPORT_REPLY__";
export const SUPPORT_IMAGE_MAX_BYTES = 8 * 1024 * 1024;
export const SUPPORT_IMAGE_ACCEPT = "image/jpeg,image/png,image/webp,image/gif";
const SUPPORT_IMAGE_TYPES = new Set(SUPPORT_IMAGE_ACCEPT.split(","));

export const SUPPORT_AUTO_GREETING_MESSAGE =
  "Oi! Que bom te ver por aqui. Nosso horário de atendimento é de segunda a sexta das 13h às 21h, e aos sábados e domingos das 13h às 19h. Pode deixar sua dúvida por aqui, que em breve alguém vai te responder!";

export const validateSupportImage = (file: File) => {
  if (!SUPPORT_IMAGE_TYPES.has(file.type)) {
    return "Envie uma imagem JPG, PNG, WebP ou GIF.";
  }
  if (file.size > SUPPORT_IMAGE_MAX_BYTES) {
    return "A imagem deve ter no máximo 8 MB.";
  }
  return null;
};

const sanitizeSupportFileName = (name: string) => {
  const normalized = name.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const safe = normalized.replace(/[^a-zA-Z0-9._-]/g, "-").replace(/-+/g, "-");
  return safe.slice(-100) || "imagem";
};

export const uploadSupportImage = async ({
  file,
  ticketId,
  userId,
}: {
  file: File;
  ticketId: string;
  userId: string;
}): Promise<SupportImageAttachment> => {
  const validationError = validateSupportImage(file);
  if (validationError) throw new Error(validationError);

  const path = `${userId}/support/${ticketId}/${crypto.randomUUID()}-${sanitizeSupportFileName(file.name)}`;
  const { error } = await supabase.storage.from("assets").upload(path, file, {
    cacheControl: "31536000",
    contentType: file.type,
    upsert: false,
  });
  if (error) throw error;

  const { data } = supabase.storage.from("assets").getPublicUrl(path);
  if (!data.publicUrl) {
    await supabase.storage.from("assets").remove([path]);
    throw new Error("Não foi possível gerar a URL da imagem.");
  }

  return {
    url: data.publicUrl,
    path,
    name: file.name,
    type: file.type,
    size: file.size,
  };
};

export const removeSupportImage = async (path: string) => {
  const { error } = await supabase.storage.from("assets").remove([path]);
  if (error) console.warn("Não foi possível remover o anexo de suporte órfão.", error);
};

export const buildSupportImageMessage = (attachment: SupportImageAttachment, text = "") =>
  `${SUPPORT_IMAGE_MARKER}${JSON.stringify({ text: text.trim(), attachment })}`;

const safeSupportRedirectUrl = (value: string) => {
  const trimmed = value.trim();
  if (!trimmed || !trimmed.startsWith("/") || trimmed.startsWith("//")) return "/dashboard";
  return trimmed;
};

export const buildSupportRedirectMessage = ({
  label,
  url,
  note = "",
}: {
  label: string;
  url: string;
  note?: string;
}) =>
  `${SUPPORT_REDIRECT_MARKER}${JSON.stringify({
    label: label.trim() || "Abrir página",
    url: safeSupportRedirectUrl(url),
    note: note.trim() || null,
  })}`;

const normalizeReplyReference = (reply: SupportReplyReference): SupportReplyReference => ({
  author: reply.author.trim().slice(0, 80) || "Mensagem",
  text: reply.text.trim().replace(/\s+/g, " ").slice(0, 180) || "Mensagem sem texto",
  sender: reply.sender,
});

export const buildSupportReplyMessage = ({
  text,
  reply,
  attachment = null,
}: {
  text: string;
  reply: SupportReplyReference;
  attachment?: SupportImageAttachment | null;
}) =>
  `${SUPPORT_REPLY_MARKER}${JSON.stringify({
    text: text.trim(),
    reply: normalizeReplyReference(reply),
    attachment,
  })}`;

export const parseSupportMessage = (value: string): ParsedSupportMessage => {
  if (value.startsWith(SUPPORT_REDIRECT_MARKER)) {
    try {
      const parsed = JSON.parse(value.slice(SUPPORT_REDIRECT_MARKER.length)) as {
        label?: unknown;
        url?: unknown;
        note?: unknown;
      };
      const label = typeof parsed.label === "string" && parsed.label.trim() ? parsed.label.trim() : "Abrir página";
      const url = typeof parsed.url === "string" ? safeSupportRedirectUrl(parsed.url) : "/dashboard";
      const note = typeof parsed.note === "string" && parsed.note.trim() ? parsed.note.trim() : null;
      return { text: note ?? "", attachment: null, redirect: { label, url, note }, reply: null };
    } catch {
      return { text: "Atalho enviado", attachment: null, redirect: null, reply: null };
    }
  }

  if (value.startsWith(SUPPORT_REPLY_MARKER)) {
    try {
      const parsed = JSON.parse(value.slice(SUPPORT_REPLY_MARKER.length)) as {
        text?: unknown;
        reply?: Partial<SupportReplyReference>;
        attachment?: Partial<SupportImageAttachment> | null;
      };
      const reply =
        parsed.reply && typeof parsed.reply.author === "string" && typeof parsed.reply.text === "string"
          ? normalizeReplyReference({
              author: parsed.reply.author,
              text: parsed.reply.text,
              sender:
                parsed.reply.sender === "user" || parsed.reply.sender === "admin" || parsed.reply.sender === "ai"
                  ? parsed.reply.sender
                  : null,
            })
          : null;
      const attachment = parsed.attachment;
      const parsedAttachment =
        attachment &&
        typeof attachment.url === "string" &&
        typeof attachment.path === "string" &&
        typeof attachment.name === "string"
          ? {
              url: attachment.url,
              path: attachment.path,
              name: attachment.name,
              type: typeof attachment.type === "string" ? attachment.type : "image/jpeg",
              size: typeof attachment.size === "number" ? attachment.size : 0,
            }
          : null;
      return {
        text: typeof parsed.text === "string" ? parsed.text : "",
        attachment: parsedAttachment,
        redirect: null,
        reply,
      };
    } catch {
      return { text: "Resposta enviada", attachment: null, redirect: null, reply: null };
    }
  }

  if (!value.startsWith(SUPPORT_IMAGE_MARKER)) return { text: value, attachment: null, redirect: null, reply: null };

  try {
    const parsed = JSON.parse(value.slice(SUPPORT_IMAGE_MARKER.length)) as {
      text?: unknown;
      attachment?: Partial<SupportImageAttachment>;
    };
    const attachment = parsed.attachment;
    if (
      !attachment ||
      typeof attachment.url !== "string" ||
      typeof attachment.path !== "string" ||
      typeof attachment.name !== "string"
    ) {
      return { text: "Imagem enviada", attachment: null, redirect: null, reply: null };
    }
    return {
      text: typeof parsed.text === "string" ? parsed.text : "",
      attachment: {
        url: attachment.url,
        path: attachment.path,
        name: attachment.name,
        type: typeof attachment.type === "string" ? attachment.type : "image/jpeg",
        size: typeof attachment.size === "number" ? attachment.size : 0,
      },
      redirect: null,
      reply: null,
    };
  } catch {
    return { text: "Imagem enviada", attachment: null, redirect: null, reply: null };
  }
};

export const supportMessagePreview = (value: string) => {
  const parsed = parseSupportMessage(value);
  if (parsed.redirect) return `Atalho · ${parsed.redirect.label}`;
  if (parsed.reply && parsed.text) return `Resposta · ${parsed.text}`;
  if (parsed.reply) return "Resposta enviada";
  if (parsed.attachment && parsed.text) return `Imagem · ${parsed.text}`;
  if (parsed.attachment) return "Imagem enviada";
  return parsed.text;
};

export const insertSupportAutoGreeting = async ({
  ticketId,
  userId,
}: {
  ticketId: string;
  userId: string;
}) => {
  const { data, error } = await supportDb
    .from("support_messages")
    .insert({
      ticket_id: ticketId,
      user_id: userId,
      message: SUPPORT_AUTO_GREETING_MESSAGE,
      sender: "ai",
    })
    .select("id")
    .single();

  if (error) throw error;
  return data?.id as string | undefined;
};

export const SUPPORT_CATEGORIES: Array<{ key: TicketCategory; label: string; description: string }> = [
  { key: "financeiro", label: "Financeiro", description: "Cobranças, planos e pagamentos" },
  { key: "bug", label: "Bug / Erro", description: "Problemas técnicos na plataforma" },
  { key: "integracao", label: "Integrações", description: "Mercado Livre, Shopee e outras" },
  { key: "conta", label: "Conta", description: "Login, dados pessoais, acessos" },
  { key: "reembolso", label: "Reembolso", description: "Solicitações de devolução" },
  { key: "outros", label: "Outros", description: "Dúvidas gerais e outros assuntos" },
];

export const CATEGORY_LABEL: Record<TicketCategory, string> = SUPPORT_CATEGORIES.reduce(
  (acc, cat) => ({ ...acc, [cat.key]: cat.label }),
  {} as Record<TicketCategory, string>,
);

export const FAQ_ITEMS: Array<{ question: string; answer: string }> = [
  {
    question: "Como funciona a abertura de um ticket?",
    answer:
      "Escolha o tipo de solicitação, descreva o que aconteceu e envie. Ele entra na fila do nosso time e a conversa continua aqui mesmo, dentro da plataforma.",
  },
  {
    question: "Em quanto tempo o suporte responde?",
    answer:
      "Respondemos em até 1 dia útil. Assuntos de cobrança e reembolso costumam ter prioridade na fila.",
  },
  {
    question: "Como cancelo minha assinatura ou peço reembolso?",
    answer:
      "Abra um ticket com o tipo Reembolso informando o motivo. O reembolso vale para pagamentos feitos há até 7 dias e toda solicitação passa por análise em até 48h.",
  },
  {
    question: "Como conecto o Mercado Livre à minha conta?",
    answer:
      "Vá em Configurações → Integrações e clique em conectar no card do Mercado Livre. Se a conexão falhar, abra um ticket do tipo Integrações.",
  },
  {
    question: "Posso trocar de plano quando quiser?",
    answer:
      "Sim. A troca vale a partir do próximo ciclo e você mantém acesso ao que já contratou até lá.",
  },
];

// As tabelas de suporte ainda não constam nos tipos gerados do Supabase, então
// as consultas usam este alias em vez de espalhar `as any` por cada chamada.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const supportDb = supabase as any;

export const protocolo = (id: string) => `SR#${id.replace(/-/g, "").slice(0, 9).toUpperCase()}`;

export const formatTicketDate = (iso: string) =>
  new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });

export const formatTicketTime = (iso: string) =>
  new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });

const ACTIVE_SUPPORT_TICKET_KEY = "velo_active_support_ticket_id";

export const ACTIVE_SUPPORT_TICKET_EVENT = "velo-active-support-ticket";

export const readActiveSupportTicketId = () => {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(ACTIVE_SUPPORT_TICKET_KEY);
};

export const setActiveSupportTicketId = (ticketId: string | null) => {
  if (typeof window === "undefined") return;
  if (ticketId) {
    window.localStorage.setItem(ACTIVE_SUPPORT_TICKET_KEY, ticketId);
  } else {
    window.localStorage.removeItem(ACTIVE_SUPPORT_TICKET_KEY);
  }
  window.dispatchEvent(new CustomEvent(ACTIVE_SUPPORT_TICKET_EVENT, { detail: { ticketId } }));
};

const announcedSupportMessages = new Set<string>();

export const shouldAnnounceSupportReply = (message: SupportMessage) => {
  if (message.sender !== "admin" || announcedSupportMessages.has(message.id)) return false;
  announcedSupportMessages.add(message.id);
  return true;
};

export const playSoftSupportNotification = () => {
  if (typeof window === "undefined") return;

  try {
    const audioWindow = window as Window & typeof globalThis & { webkitAudioContext?: typeof AudioContext };
    const AudioContextClass = audioWindow.AudioContext || audioWindow.webkitAudioContext;
    if (!AudioContextClass) return;

    const context = new AudioContextClass();
    const master = context.createGain();
    master.gain.setValueAtTime(0.0001, context.currentTime);
    master.gain.exponentialRampToValueAtTime(0.08, context.currentTime + 0.018);
    master.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + 0.46);
    master.connect(context.destination);

    [660, 880].forEach((frequency, index) => {
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      const start = context.currentTime + index * 0.12;
      oscillator.type = "sine";
      oscillator.frequency.setValueAtTime(frequency, start);
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(0.16, start + 0.018);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.22);
      oscillator.connect(gain);
      gain.connect(master);
      oscillator.start(start);
      oscillator.stop(start + 0.26);
    });

    window.setTimeout(() => void context.close().catch(() => undefined), 700);
  } catch {
    // Alguns navegadores bloqueiam áudio até uma interação do usuário.
  }
};

/** Abre um ticket e já grava a primeira mensagem do usuário. */
export const createSupportTicket = async (opts: {
  userId: string;
  category: TicketCategory;
  subject: string;
  firstMessage: string;
}): Promise<{ ticket: SupportTicket; messageId: string }> => {
  const { data, error } = await supportDb
    .from("support_tickets")
    .insert({
      user_id: opts.userId,
      status: "open",
      ai_active: false,
      category: opts.category,
      subject: opts.subject,
    })
    .select("*")
    .single();

  if (error) throw error;

  const ticket = data as SupportTicket;

  const { data: message, error: messageError } = await supportDb
    .from("support_messages")
    .insert({
      ticket_id: ticket.id,
      user_id: opts.userId,
      message: opts.firstMessage,
      sender: "user",
    })
    .select("*")
    .single();

  if (messageError) throw messageError;

  await insertSupportAutoGreeting({ ticketId: ticket.id, userId: opts.userId });

  return { ticket, messageId: message.id as string };
};
