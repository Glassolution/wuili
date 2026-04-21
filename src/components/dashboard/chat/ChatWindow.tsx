import { useEffect, useRef, useState } from 'react';
import { MoreHorizontal, ArrowLeft, Package } from 'lucide-react';
import MessageBubble from './MessageBubble';
import MessageInput from './MessageInput';
import type { Conversation, Message, StatusType } from './types';

interface Props {
  conversation: Conversation;
  onSendMessage: (conversationId: string, content: string) => void;
  onBack?: () => void; // mobile back button
}

const StatusLabel = ({ status }: { status: StatusType }) => {
  if (status === 'online')
    return <span className="text-[11.5px] font-medium text-[#16A34A]">Online agora</span>;
  if (status === 'typing')
    return <span className="text-[11.5px] font-medium text-[#2563EB]">Digitando...</span>;
  return <span className="text-[11.5px] text-[#A3A3A3]">Offline</span>;
};

export default function ChatWindow({ conversation, onSendMessage, onBack }: Props) {
  const [inputText, setInputText] = useState('');
  const [showAiMenu, setShowAiMenu] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  // Scroll to bottom whenever messages change
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [conversation.messages]);

  // Reset input when conversation changes
  useEffect(() => {
    setInputText('');
    setShowAiMenu(false);
  }, [conversation.id]);

  const handleSend = () => {
    const trimmed = inputText.trim();
    if (!trimmed) return;
    onSendMessage(conversation.id, trimmed);
    setInputText('');
  };

  // Compute groups: consecutive same-sender messages
  type RenderedMessage = Message & { showSenderInfo: boolean; showDateSep: boolean };
  const rendered: RenderedMessage[] = conversation.messages.map((msg, idx) => {
    const prev = conversation.messages[idx - 1];
    const showDateSep = !prev || prev.dateGroup !== msg.dateGroup;
    const showSenderInfo =
      msg.sender === 'supplier' &&
      (!prev || prev.sender !== 'supplier' || prev.dateGroup !== msg.dateGroup);
    return { ...msg, showSenderInfo, showDateSep };
  });

  return (
    <div className="flex h-full flex-col bg-white">
      {/* ── Header ───────────────────────────────────────────────────── */}
      <div className="flex items-center gap-3 border-b border-[#EBEBEB] px-4 py-3">
        {/* Mobile back */}
        {onBack && (
          <button
            onClick={onBack}
            className="mr-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[#525252] transition hover:bg-[#F5F5F5] md:hidden"
          >
            <ArrowLeft size={17} />
          </button>
        )}

        {/* Avatar */}
        <div
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-[11px] font-bold text-white"
          style={{ backgroundColor: conversation.supplierColor }}
        >
          {conversation.supplierInitials}
        </div>

        {/* Info */}
        <div className="min-w-0 flex-1">
          <p className="truncate font-['Manrope'] text-[14px] font-bold text-[#0A0A0A]">
            {conversation.supplierName}
          </p>
          <div className="flex items-center gap-2">
            <Package size={11} className="shrink-0 text-[#A3A3A3]" />
            <span className="truncate text-[11.5px] text-[#737373]">{conversation.productName}</span>
            <span className="text-[#D4D4D4]">·</span>
            <StatusLabel status={conversation.status} />
          </div>
        </div>

        {/* Options */}
        <button className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[#A3A3A3] transition hover:bg-[#F5F5F5] hover:text-[#525252]">
          <MoreHorizontal size={17} />
        </button>
      </div>

      {/* ── Messages ─────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto px-4 py-5">
        <div className="space-y-3">
          {rendered.map((msg) => (
            <div key={msg.id}>
              {/* Date group separator */}
              {msg.showDateSep && (
                <div className="my-4 flex items-center gap-3">
                  <div className="h-px flex-1 bg-[#EBEBEB]" />
                  <span className="rounded-full border border-[#EBEBEB] bg-[#F7F7F7] px-3 py-1 text-[11px] font-medium text-[#A3A3A3]">
                    {msg.dateGroup}
                  </span>
                  <div className="h-px flex-1 bg-[#EBEBEB]" />
                </div>
              )}

              <MessageBubble
                message={msg}
                showSenderInfo={msg.showSenderInfo}
                supplierName={conversation.supplierName}
                supplierInitials={conversation.supplierInitials}
                supplierColor={conversation.supplierColor}
              />
            </div>
          ))}

          {/* Typing indicator */}
          {conversation.status === 'typing' && (
            <div className="flex items-end gap-2.5">
              <div
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white"
                style={{ backgroundColor: conversation.supplierColor }}
              >
                {conversation.supplierInitials}
              </div>
              <div className="rounded-2xl rounded-bl-sm bg-[#F0F0F0] px-4 py-3">
                <div className="flex items-center gap-1">
                  {[0, 1, 2].map((i) => (
                    <span
                      key={i}
                      className="h-1.5 w-1.5 rounded-full bg-[#A3A3A3]"
                      style={{ animation: `typingDot 1.2s ${i * 0.2}s infinite` }}
                    />
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
        <div ref={bottomRef} />
      </div>

      {/* ── Input ────────────────────────────────────────────────────── */}
      <MessageInput
        value={inputText}
        onChange={setInputText}
        onSend={handleSend}
        productName={conversation.productName}
        showAiMenu={showAiMenu}
        onToggleAiMenu={() => setShowAiMenu((v) => !v)}
      />

      <style>{`
        @keyframes typingDot {
          0%, 60%, 100% { transform: translateY(0); opacity: 0.4; }
          30%            { transform: translateY(-4px); opacity: 1; }
        }
      `}</style>
    </div>
  );
}
