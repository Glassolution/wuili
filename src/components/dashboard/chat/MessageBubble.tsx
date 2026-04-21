import { ExternalLink } from 'lucide-react';
import type { Message } from './types';

interface Props {
  message: Message;
  showSenderInfo: boolean;
  supplierName: string;
  supplierInitials: string;
  supplierColor: string;
}

export default function MessageBubble({
  message, showSenderInfo, supplierName, supplierInitials, supplierColor,
}: Props) {
  const isUser = message.sender === 'user';

  const bubbleBase = isUser
    ? 'rounded-2xl rounded-br-sm bg-[#0A0A0A] px-4 py-2.5 text-[13.5px] leading-relaxed text-white'
    : 'rounded-2xl rounded-bl-sm bg-[#F0F0F0] px-4 py-2.5 text-[13.5px] leading-relaxed text-[#0A0A0A]';

  return (
    <div className={`flex items-end gap-2.5 ${isUser ? 'flex-row-reverse' : 'flex-row'}`}>
      {/* Avatar — always reserves space, invisible when not first in group */}
      {!isUser && (
        <div
          className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white transition-opacity ${
            showSenderInfo ? 'opacity-100' : 'opacity-0 pointer-events-none'
          }`}
          style={{ backgroundColor: supplierColor }}
        >
          {supplierInitials}
        </div>
      )}

      {/* Bubble column */}
      <div className={`flex max-w-[68%] flex-col gap-1 ${isUser ? 'items-end' : 'items-start'}`}>
        {/* Sender name — first in group only */}
        {!isUser && showSenderInfo && (
          <span className="px-1 text-[11.5px] font-semibold text-[#525252]">
            {supplierName}
          </span>
        )}

        {/* ── Text ── */}
        {message.type === 'text' && (
          <div className={bubbleBase}>{message.content}</div>
        )}

        {/* ── Image ── */}
        {message.type === 'image' && (
          <div className="space-y-1.5">
            {message.content && (
              <div className={bubbleBase}>{message.content}</div>
            )}
            <a
              href={message.imageUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="block overflow-hidden rounded-xl border border-[#E5E5E5] shadow-sm"
            >
              <img
                src={message.imageUrl}
                alt="Imagem do produto"
                className="max-h-[220px] w-full object-cover transition-transform duration-300 hover:scale-[1.03]"
              />
            </a>
          </div>
        )}

        {/* ── Link ── */}
        {message.type === 'link' && (
          <div className="space-y-1.5">
            {message.content && (
              <div className={bubbleBase}>{message.content}</div>
            )}
            <a
              href={message.linkUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-3 rounded-xl border border-[#E5E5E5] bg-white p-3 shadow-sm transition hover:border-[#D4D4D4] hover:shadow-md"
            >
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#F5F5F5]">
                <ExternalLink size={14} className="text-[#525252]" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[12.5px] font-semibold text-[#0A0A0A]">
                  {message.linkTitle}
                </p>
                <p className="truncate text-[11px] text-[#737373]">{message.linkUrl}</p>
              </div>
              <ExternalLink size={11} className="shrink-0 text-[#C0C0C0]" />
            </a>
          </div>
        )}

        {/* Timestamp */}
        <span className="px-1 text-[10.5px] text-[#B0B0B0]">{message.timestamp}</span>
      </div>
    </div>
  );
}
