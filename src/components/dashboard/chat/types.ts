export type MessageType = 'text' | 'image' | 'link';
export type SenderType = 'user' | 'supplier';
export type StatusType = 'online' | 'offline' | 'typing';

export interface Message {
  id: string;
  sender: SenderType;
  content: string;
  timestamp: string;
  dateGroup: string;
  type: MessageType;
  imageUrl?: string;
  linkUrl?: string;
  linkTitle?: string;
}

export interface Conversation {
  id: string;
  supplierName: string;
  supplierInitials: string;
  supplierColor: string;
  productName: string;
  status: StatusType;
  unread: number;
  lastMessage: string;
  lastTime: string;
  messages: Message[];
}
