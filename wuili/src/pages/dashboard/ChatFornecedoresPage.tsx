import { useState, useMemo } from 'react';
import { MessageSquare } from 'lucide-react';
import ConversationList from '@/components/dashboard/chat/ConversationList';
import ChatWindow from '@/components/dashboard/chat/ChatWindow';
import { MOCK_CONVERSATIONS } from '@/components/dashboard/chat/mockData';
import type { Conversation } from '@/components/dashboard/chat/types';

export default function ChatFornecedoresPage() {
  const [conversations, setConversations] = useState<Conversation[]>(MOCK_CONVERSATIONS);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  // Mobile: 'list' | 'chat'
  const [mobileView, setMobileView] = useState<'list' | 'chat'>('list');

  const filteredConversations = useMemo(() => {
    if (!searchQuery.trim()) return conversations;
    const q = searchQuery.toLowerCase();
    return conversations.filter(
      (c) =>
        c.supplierName.toLowerCase().includes(q) ||
        c.productName.toLowerCase().includes(q)
    );
  }, [conversations, searchQuery]);

  const selectedConversation = conversations.find((c) => c.id === selectedId) ?? null;

  const handleSelect = (id: string) => {
    setSelectedId(id);
    setMobileView('chat');
    // Clear unread
    setConversations((prev) =>
      prev.map((c) => (c.id === id ? { ...c, unread: 0 } : c))
    );
  };

  const handleSendMessage = (conversationId: string, content: string) => {
    const now = new Date();
    const timestamp = now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

    setConversations((prev) =>
      prev.map((c) => {
        if (c.id !== conversationId) return c;
        return {
          ...c,
          lastMessage: content,
          lastTime: timestamp,
          messages: [
            ...c.messages,
            {
              id: `msg-${Date.now()}`,
              sender: 'user',
              content,
              timestamp,
              dateGroup: 'Hoje',
              type: 'text',
            },
          ],
        };
      })
    );
  };

  return (
    <div
      className="flex overflow-hidden rounded-2xl border border-[#E5E5E5] dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-sm"
      style={{ height: 'calc(100vh - 56px - 2rem)' }}
    >
      {/* ── Left column: conversation list ─────────────────────────── */}
      <div
        className={`w-full shrink-0 md:w-[300px] lg:w-[320px] ${
          mobileView === 'chat' ? 'hidden md:block' : 'block'
        }`}
      >
        <ConversationList
          conversations={filteredConversations}
          selectedId={selectedId}
          onSelect={handleSelect}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
        />
      </div>

      {/* ── Right column: chat window ────────────────────────────────── */}
      <div
        className={`min-w-0 flex-1 ${
          mobileView === 'list' ? 'hidden md:flex md:flex-col' : 'flex flex-col'
        }`}
      >
        {selectedConversation ? (
          <ChatWindow
            conversation={selectedConversation}
            onSendMessage={handleSendMessage}
            onBack={() => setMobileView('list')}
          />
        ) : (
          <EmptyState />
        )}
      </div>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 bg-[#FAFAFA] dark:bg-zinc-900 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-[#E5E5E5] dark:border-zinc-700 bg-white dark:bg-zinc-800 shadow-sm">
        <MessageSquare size={22} className="text-[#A3A3A3] dark:text-zinc-400" />
      </div>
      <div>
        <p className="font-['Manrope'] text-[15px] font-semibold text-[#0A0A0A] dark:text-white">
          Nenhuma conversa selecionada
        </p>
        <p className="mt-1 text-[13px] text-[#737373] dark:text-zinc-400">
          Selecione um fornecedor para iniciar
        </p>
      </div>
    </div>
  );
}
