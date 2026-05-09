import type { Conversation } from './types';

export const MOCK_CONVERSATIONS: Conversation[] = [
  {
    id: '1',
    supplierName: 'CJ Dropshipping',
    supplierInitials: 'CJ',
    supplierColor: '#EA580C',
    productName: 'Kit Organizador de Gaveta',
    status: 'online',
    unread: 2,
    lastMessage: 'Posso oferecer 15% de desconto para pedidos acima de 50 unidades.',
    lastTime: '14:32',
    messages: [
      {
        id: 'm1', sender: 'user', type: 'text', dateGroup: 'Hoje',
        content: 'Olá! Gostaria de negociar o preço do Kit Organizador de Gaveta.',
        timestamp: '14:20',
      },
      {
        id: 'm2', sender: 'supplier', type: 'text', dateGroup: 'Hoje',
        content: 'Olá! Seja bem-vindo. Como posso ajudá-lo hoje?',
        timestamp: '14:22',
      },
      {
        id: 'm3', sender: 'user', type: 'text', dateGroup: 'Hoje',
        content: 'Quero fazer um pedido de 100 unidades. Qual o melhor preço disponível?',
        timestamp: '14:25',
      },
      {
        id: 'm4', sender: 'supplier', type: 'text', dateGroup: 'Hoje',
        content: 'Para 100 unidades conseguimos oferecer R$ 12,50 por unidade com frete incluso para o Brasil. Prazo de 15 a 20 dias úteis.',
        timestamp: '14:27',
      },
      {
        id: 'm5', sender: 'supplier', type: 'image', dateGroup: 'Hoje',
        content: 'Aqui está a foto do produto com a embalagem atualizada:',
        imageUrl: 'https://images.unsplash.com/photo-1586023492125-27b2c045efd7?w=400&q=80',
        timestamp: '14:29',
      },
      {
        id: 'm6', sender: 'supplier', type: 'link', dateGroup: 'Hoje',
        content: 'Confira nosso catálogo completo:',
        linkUrl: 'https://cjdropshipping.com',
        linkTitle: 'CJ Dropshipping — Catálogo 2024',
        timestamp: '14:30',
      },
      {
        id: 'm7', sender: 'supplier', type: 'text', dateGroup: 'Hoje',
        content: 'Posso oferecer 15% de desconto para pedidos acima de 50 unidades.',
        timestamp: '14:32',
      },
    ],
  },
  {
    id: '2',
    supplierName: 'Alibaba Supply',
    supplierInitials: 'AB',
    supplierColor: '#2563EB',
    productName: 'Fone Bluetooth Pro',
    status: 'typing',
    unread: 0,
    lastMessage: 'Código de rastreio: BR9284719283CN',
    lastTime: '11:47',
    messages: [
      {
        id: 'm1', sender: 'user', type: 'text', dateGroup: 'Hoje',
        content: 'Boa tarde! Qual o status do envio do pedido #4821?',
        timestamp: '11:40',
      },
      {
        id: 'm2', sender: 'supplier', type: 'text', dateGroup: 'Hoje',
        content: 'Boa tarde! Deixe-me verificar para você.',
        timestamp: '11:43',
      },
      {
        id: 'm3', sender: 'supplier', type: 'text', dateGroup: 'Hoje',
        content: 'O envio foi realizado ontem. Código de rastreio: BR9284719283CN. Prazo estimado: 12 a 18 dias úteis.',
        timestamp: '11:47',
      },
    ],
  },
  {
    id: '3',
    supplierName: 'Global Source',
    supplierInitials: 'GS',
    supplierColor: '#16A34A',
    productName: 'Elástico de Resistência Set',
    status: 'offline',
    unread: 4,
    lastMessage: 'Podemos enviar amostra em até 3 dias úteis.',
    lastTime: 'Ontem',
    messages: [
      {
        id: 'm1', sender: 'user', type: 'text', dateGroup: 'Ontem',
        content: 'Olá! Poderia enviar uma amostra do Elástico de Resistência para avaliação?',
        timestamp: '16:10',
      },
      {
        id: 'm2', sender: 'supplier', type: 'text', dateGroup: 'Ontem',
        content: 'Olá! Com certeza. Qual seria o endereço para envio?',
        timestamp: '16:35',
      },
      {
        id: 'm3', sender: 'user', type: 'text', dateGroup: 'Ontem',
        content: 'Rua das Flores, 123 — São Paulo, SP, 01310-000',
        timestamp: '16:36',
      },
      {
        id: 'm4', sender: 'supplier', type: 'text', dateGroup: 'Ontem',
        content: 'Podemos enviar amostra em até 3 dias úteis.',
        timestamp: '16:40',
      },
    ],
  },
  {
    id: '4',
    supplierName: 'ShenZhen Trade',
    supplierInitials: 'ST',
    supplierColor: '#7C3AED',
    productName: 'Tênis Running Lite',
    status: 'offline',
    unread: 1,
    lastMessage: 'O prazo padrão é de 18 a 25 dias úteis para o Brasil.',
    lastTime: 'Ontem',
    messages: [
      {
        id: 'm1', sender: 'user', type: 'text', dateGroup: 'Ontem',
        content: 'Qual é o prazo de entrega para o Tênis Running Lite com envio ao Brasil?',
        timestamp: '09:15',
      },
      {
        id: 'm2', sender: 'supplier', type: 'text', dateGroup: 'Ontem',
        content: 'O prazo padrão é de 18 a 25 dias úteis para o Brasil. Para envio expresso, 8 a 12 dias úteis com taxa adicional.',
        timestamp: '09:45',
      },
    ],
  },
  {
    id: '5',
    supplierName: 'FastDrop Co.',
    supplierInitials: 'FD',
    supplierColor: '#DB2777',
    productName: 'LEGO Compatível City',
    status: 'online',
    unread: 0,
    lastMessage: 'Sim, temos estoque disponível. Quando confirma o pedido?',
    lastTime: 'Ter',
    messages: [
      {
        id: 'm1', sender: 'user', type: 'text', dateGroup: 'Terça',
        content: 'Vocês têm estoque do LEGO Compatível City para pronta entrega?',
        timestamp: '10:00',
      },
      {
        id: 'm2', sender: 'supplier', type: 'text', dateGroup: 'Terça',
        content: 'Sim, temos estoque disponível. Quando confirma o pedido?',
        timestamp: '10:30',
      },
    ],
  },
];
