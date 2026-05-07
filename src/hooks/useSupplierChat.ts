import { useEffect, useState, useCallback, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

// ── Types ─────────────────────────────────────────────────────────────────────

export type MessageSender = "user" | "supplier" | "system";
export type MessageType   = "text" | "image" | "system";

export interface ChatMessage {
  id: string;
  user_id: string;
  supplier_id: string;
  order_id: string | null;
  sender: MessageSender;
  message_text: string;
  message_type: MessageType;
  image_url: string | null;
  created_at: string;
}

export interface SupplierThread {
  supplier_id: string;
  supplier_name: string;
  last_message: string;
  last_time: string;
  unread: number;
}

// ── Supplier name map (derived from orders.supplier field) ────────────────────

function toSupplierId(name: string): string {
  return name.toLowerCase().replace(/\s+/g, "-");
}

// ── Hook: list of supplier threads ───────────────────────────────────────────

export function useSupplierThreads() {
  const { user } = useAuth();

  return useQuery<SupplierThread[]>({
    queryKey: ["chat-threads", user?.id],
    enabled: !!user,
    staleTime: 60_000,
    queryFn: async () => {
      // Get distinct suppliers from orders
      const { data: orders, error: ordErr } = await (supabase as any)
        .from("orders")
        .select("supplier")
        .eq("user_id", user!.id)
        .not("supplier", "is", null);

      if (ordErr) throw ordErr;

      const supplierNames: string[] = [
        ...new Set((orders ?? []).map((o: any) => o.supplier as string).filter(Boolean)),
      ] as string[];

      if (supplierNames.length === 0) return [];

      // For each supplier, get last message
      const threads: SupplierThread[] = await Promise.all(
        supplierNames.map(async (name) => {
          const sid = toSupplierId(name);
          const { data: msgs } = await (supabase as any)
            .from("chat_messages")
            .select("message_text, created_at, sender")
            .eq("user_id", user!.id)
            .eq("supplier_id", sid)
            .order("created_at", { ascending: false })
            .limit(1);

          const last = msgs?.[0];
          const { count } = await (supabase as any)
            .from("chat_messages")
            .select("id", { count: "exact", head: true })
            .eq("user_id", user!.id)
            .eq("supplier_id", sid)
            .eq("sender", "supplier");

          return {
            supplier_id:   sid,
            supplier_name: name,
            last_message:  last?.message_text ?? "Inicie uma conversa",
            last_time:     last ? formatTime(last.created_at) : "",
            unread:        0, // simplified — no read tracking yet
          };
        })
      );

      return threads;
    },
  });
}

// ── Hook: messages for a specific supplier ────────────────────────────────────

export function useSupplierMessages(supplierId: string | null) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const channelRef = useRef<any>(null);

  const query = useQuery<ChatMessage[]>({
    queryKey: ["chat-messages", user?.id, supplierId],
    enabled: !!user && !!supplierId,
    staleTime: 0,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("chat_messages")
        .select("*")
        .eq("user_id", user!.id)
        .eq("supplier_id", supplierId!)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as ChatMessage[];
    },
  });

  // Realtime subscription
  useEffect(() => {
    if (!user || !supplierId) return;

    const channel = (supabase as any)
      .channel(`chat:${user.id}:${supplierId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "chat_messages",
          filter: `user_id=eq.${user.id}`,
        },
        (payload: any) => {
          if (payload.new.supplier_id !== supplierId) return;
          qc.setQueryData(
            ["chat-messages", user.id, supplierId],
            (old: ChatMessage[] = []) => [...old, payload.new as ChatMessage]
          );
          // Also invalidate thread list to update last message
          qc.invalidateQueries({ queryKey: ["chat-threads", user.id] });
        }
      )
      .subscribe();

    channelRef.current = channel;
    return () => {
      (supabase as any).removeChannel(channel);
    };
  }, [user, supplierId, qc]);

  return query;
}

// ── Hook: send message ────────────────────────────────────────────────────────

export function useSendMessage() {
  const { user } = useAuth();
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async ({
      supplierId,
      text,
      orderId,
      sender = "user",
      type = "text",
    }: {
      supplierId: string;
      text: string;
      orderId?: string | null;
      sender?: MessageSender;
      type?: MessageType;
    }) => {
      if (!user) throw new Error("Not authenticated");
      const { data, error } = await (supabase as any)
        .from("chat_messages")
        .insert({
          user_id:      user.id,
          supplier_id:  supplierId,
          order_id:     orderId ?? null,
          sender,
          message_text: text,
          message_type: type,
        })
        .select()
        .single();
      if (error) throw error;
      return data as ChatMessage;
    },
    onSuccess: (msg) => {
      qc.setQueryData(
        ["chat-messages", user?.id, msg.supplier_id],
        (old: ChatMessage[] = []) => [...old, msg]
      );
      qc.invalidateQueries({ queryKey: ["chat-threads", user?.id] });
    },
  });
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatTime(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const diffDays = Math.floor((now.getTime() - d.getTime()) / 86400000);
  if (diffDays === 0) return d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  if (diffDays === 1) return "Ontem";
  if (diffDays < 7)   return d.toLocaleDateString("pt-BR", { weekday: "short" });
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
}

export function formatMessageTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

export function formatDateGroup(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const diffDays = Math.floor((now.getTime() - d.getTime()) / 86400000);
  if (diffDays === 0) return "Hoje";
  if (diffDays === 1) return "Ontem";
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "long" });
}

export function supplierInitials(name: string): string {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0])
    .join("")
    .toUpperCase();
}

const SUPPLIER_COLORS = [
  "#EA580C", "#2563EB", "#16A34A", "#7C3AED",
  "#DB2777", "#0891B2", "#D97706", "#059669",
];

export function supplierColor(id: string): string {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = id.charCodeAt(i) + ((hash << 5) - hash);
  return SUPPLIER_COLORS[Math.abs(hash) % SUPPLIER_COLORS.length];
}
