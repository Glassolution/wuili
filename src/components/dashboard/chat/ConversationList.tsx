import { Search } from 'lucide-react';
import type { Conversation, StatusType } from './types';

interface Props {
  conversations: Conversation[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  searchQuery: string;
  onSearchChange: (q: string) => void;
}

const StatusDot = ({ status }: { status: StatusType }) => {
  if (status === 'online') return (
    <span className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full border-2 border-white bg-[#16A34A]" />
  );
  if (status === 'typing') return (
    <span className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full border-2 border-white bg-[#2563EB]" />
  );
  return (
    <span className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full border-2 border-white bg-[#D4D4D4]" />
  );
};

const SkeletonItem = () => (
  <div className="flex items-center gap-3 px-4 py-3">
    <div className="h-10 w-10 shrink-0 animate-pulse rounded-full bg-[#EBEBEB]" />
    <div className="flex-1 space-y-2">
      <div className="h-3 w-2/3 animate-pulse rounded bg-[#EBEBEB]" />
      <div className="h-2.5 w-full animate-pulse rounded bg-[#EBEBEB]" />
    </div>
  </div>
);

export default function ConversationList({
  conversations, selectedId, onSelect, searchQuery, onSearchChange,
}: Props) {
  return (
    <div className="flex h-full flex-col border-r border-[#EBEBEB] bg-white">
      {/* Header */}
      <div className="border-b border-[#EBEBEB] px-4 pb-3 pt-4">
        <h2 className="mb-3 font-['Manrope'] text-[15px] font-bold text-[#0A0A0A]">
          Fornecedores
        </h2>
        <div className="relative">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#A3A3A3]" />
          <input
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Buscar fornecedor..."
            className="w-full rounded-xl border border-[#EBEBEB] bg-[#F7F7F7] py-2 pl-8 pr-3 text-[13px] text-[#0A0A0A] placeholder:text-[#A3A3A3] focus:border-[#D4D4D4] focus:outline-none focus:ring-2 focus:ring-[#0A0A0A]/8 transition"
          />
        </div>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto">
        {conversations.length === 0 ? (
          <>
            {[0, 1, 2, 3].map((i) => <SkeletonItem key={i} />)}
          </>
        ) : conversations.map((conv) => {
          const isActive = conv.id === selectedId;
          return (
            <button
              key={conv.id}
              onClick={() => onSelect(conv.id)}
              className={`flex w-full items-center gap-3 px-4 py-3 text-left transition-colors ${
                isActive
                  ? 'bg-[#F5F5F5]'
                  : 'hover:bg-[#FAFAFA]'
              }`}
            >
              {/* Avatar with status dot */}
              <div className="relative shrink-0">
                <div
                  className="flex h-10 w-10 items-center justify-center rounded-full text-[11px] font-bold text-white"
                  style={{ backgroundColor: conv.supplierColor }}
                >
                  {conv.supplierInitials}
                </div>
                <StatusDot status={conv.status} />
              </div>

              {/* Content */}
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline justify-between gap-1">
                  <p className={`truncate font-['Manrope'] text-[13.5px] font-semibold text-[#0A0A0A]`}>
                    {conv.supplierName}
                  </p>
                  <span className="shrink-0 text-[11px] text-[#A3A3A3]">{conv.lastTime}</span>
                </div>
                <p className="truncate text-[11.5px] text-[#737373]">
                  {conv.productName}
                </p>
                <div className="mt-0.5 flex items-center justify-between gap-1">
                  <p className={`truncate text-[12px] ${conv.unread > 0 ? 'font-medium text-[#0A0A0A]' : 'text-[#A3A3A3]'}`}>
                    {conv.status === 'typing' && conv.id !== selectedId
                      ? <span className="text-[#2563EB]">Digitando...</span>
                      : conv.lastMessage
                    }
                  </p>
                  {conv.unread > 0 && (
                    <span className="flex h-4.5 min-w-[18px] shrink-0 items-center justify-center rounded-full bg-[#0A0A0A] px-1.5 text-[10px] font-semibold text-white">
                      {conv.unread}
                    </span>
                  )}
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
