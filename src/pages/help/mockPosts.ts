export type HelpFeedPost = {
  id: string;
  author_name: string;
  author_avatar_url: string;
  content: string;
  image_url: string | null;
  created_at: string;
  likes_count: number;
  liked_by_me: boolean;
  comments_count: number;
};

export type HelpFeedComment = {
  id: string;
  post_id: string;
  author_name: string;
  author_avatar_url: string;
  content: string;
  created_at: string;
};

export const mockPosts: HelpFeedPost[] = [
  {
    id: "post-ml-status-sync",
    author_name: "Equipe Velo",
    author_avatar_url: "https://api.dicebear.com/8.x/initials/svg?seed=Equipe%20Velo",
    content:
      "Novo recurso: sincronizacao de status ML em tempo real. Agora fica mais facil acompanhar pedido recebido, envio e entrega dentro da Velo.",
    image_url:
      "https://images.unsplash.com/photo-1551288049-bebda4e38f71?auto=format&fit=crop&w=1200&q=80",
    created_at: new Date(Date.now() - 4 * 60 * 1000).toISOString(),
    likes_count: 42,
    liked_by_me: false,
    comments_count: 3,
  },
  {
    id: "post-catalog-workflow",
    author_name: "Camila, Growth",
    author_avatar_url: "https://api.dicebear.com/8.x/initials/svg?seed=Camila%20Growth",
    content:
      "Checklist rapido para escolher produto no catalogo: margem clara, foto boa, fornecedor confiavel e promessa facil de explicar no anuncio.",
    image_url: null,
    created_at: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
    likes_count: 31,
    liked_by_me: true,
    comments_count: 2,
  },
  {
    id: "post-first-sale",
    author_name: "Rafael, Comunidade",
    author_avatar_url: "https://api.dicebear.com/8.x/initials/svg?seed=Rafael%20Comunidade",
    content:
      "Caso real: uma loja saiu de zero para as primeiras 12 vendas usando 3 variacoes de titulo e uma descricao mais direta no Mercado Livre.",
    image_url:
      "https://images.unsplash.com/photo-1460925895917-afdab827c52f?auto=format&fit=crop&w=1200&q=80",
    created_at: new Date(Date.now() - 22 * 60 * 60 * 1000).toISOString(),
    likes_count: 68,
    liked_by_me: false,
    comments_count: 5,
  },
  {
    id: "post-supplier-tip",
    author_name: "Suporte Velo",
    author_avatar_url: "https://api.dicebear.com/8.x/initials/svg?seed=Suporte%20Velo",
    content:
      "Dica de operacao: antes de comprar no fornecedor, confira variacao, prazo e endereco completo do comprador. Evita retrabalho e pedido parado.",
    image_url: null,
    created_at: new Date(Date.now() - 30 * 60 * 60 * 1000).toISOString(),
    likes_count: 24,
    liked_by_me: false,
    comments_count: 1,
  },
  {
    id: "post-content-hooks",
    author_name: "Equipe Aquas",
    author_avatar_url: "https://api.dicebear.com/8.x/initials/svg?seed=Equipe%20Aquas",
    content:
      "Para gerar anuncios melhores com IA, comece com a dor do cliente e termine com prova concreta. Promessa vaga quase sempre perde para beneficio visivel.",
    image_url:
      "https://images.unsplash.com/photo-1516321318423-f06f85e504b3?auto=format&fit=crop&w=1200&q=80",
    created_at: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
    likes_count: 57,
    liked_by_me: true,
    comments_count: 4,
  },
];

export const mockComments: HelpFeedComment[] = [
  {
    id: "comment-1",
    post_id: "post-ml-status-sync",
    author_name: "Ana Paula",
    author_avatar_url: "https://api.dicebear.com/8.x/initials/svg?seed=Ana%20Paula",
    content: "Isso resolve uma das maiores duvidas do dia a dia. Boa!",
    created_at: new Date(Date.now() - 3 * 60 * 1000).toISOString(),
  },
  {
    id: "comment-2",
    post_id: "post-ml-status-sync",
    author_name: "Marcos V.",
    author_avatar_url: "https://api.dicebear.com/8.x/initials/svg?seed=Marcos%20V",
    content: "Vai ter filtro por status tambem?",
    created_at: new Date(Date.now() - 2 * 60 * 1000).toISOString(),
  },
  {
    id: "comment-3",
    post_id: "post-catalog-workflow",
    author_name: "Julia Ramos",
    author_avatar_url: "https://api.dicebear.com/8.x/initials/svg?seed=Julia%20Ramos",
    content: "Margem clara fez muita diferenca aqui tambem.",
    created_at: new Date(Date.now() - 50 * 60 * 1000).toISOString(),
  },
  {
    id: "comment-4",
    post_id: "post-first-sale",
    author_name: "Pedro Lima",
    author_avatar_url: "https://api.dicebear.com/8.x/initials/svg?seed=Pedro%20Lima",
    content: "Quero ver esse exemplo de titulo depois.",
    created_at: new Date(Date.now() - 7 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: "comment-5",
    post_id: "post-content-hooks",
    author_name: "Bianca S.",
    author_avatar_url: "https://api.dicebear.com/8.x/initials/svg?seed=Bianca%20S",
    content: "Usei esse formato e o CTR subiu no primeiro teste.",
    created_at: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
  },
];
