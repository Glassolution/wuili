import {
  AlertTriangle,
  CreditCard,
  PackageX,
  ShieldCheck,
  Store,
  UserCog,
  Truck,
  RefreshCcw,
  KeyRound,
  Wallet,
  Receipt,
  Ban,
  FileWarning,
  Image as ImageIcon,
  HelpCircle,
  Zap,
  type LucideIcon,
} from "lucide-react";

export type GuideItem = {
  id: string;
  icon: LucideIcon;
  title: string;
  summary: string;
  steps: string[];
  tip?: string;
};

export type GuideSection = {
  key: "anuncios" | "publicacao" | "pagamentos" | "conta";
  label: string;
  headline?: string;
  intro: string;
  quickTopics?: string[];
  items: GuideItem[];
};


export const guideSections: GuideSection[] = [
  {
    key: "anuncios",
    label: "Meus anúncios",
    headline: "Seu anúncio, sob controle.",
    intro:
      "Pausas, reprovações, falta de estoque, reativação. Resolva sem sair daqui.",
    quickTopics: ["pausado", "reprovado", "sem venda", "reativar"],
    items: [

      {
        id: "anuncio-pausado",
        icon: AlertTriangle,
        title: "Meu anúncio está pausado. E agora?",
        summary:
          "Um anúncio pode ser pausado pelo Mercado Livre por falta de estoque, atributo obrigatório ausente ou infração de política.",
        steps: [
          "Entre em Mercado Livre → Minha conta → Anúncios e localize o item pausado.",
          "Clique no anúncio e leia o motivo exato exibido pelo ML (aparece em vermelho no topo).",
          "Se o motivo for atributo obrigatório (ex.: marca, modelo, GTIN), corrija diretamente no anúncio pelo painel do ML.",
          "Se for problema de estoque, o próprio scraper vai reativar assim que o fornecedor repuser — normalmente em algumas horas.",
          "Se não conseguir identificar o motivo, abra um chamado no Suporte da Velo com o print do erro. A maior parte dos casos é resolvida em poucas horas.",
        ],
        tip: "Anúncios pausados por falta de estoque voltam sozinhos quando o produto retorna ao fornecedor. Não precisa republicar.",
      },
      {
        id: "reprovado-marca-modelo",
        icon: FileWarning,
        title: "Anúncio reprovado por marca ou modelo",
        summary:
          "Algumas categorias do Mercado Livre exigem marca e modelo específicos (não aceitam \"Genérica\").",
        steps: [
          "Abra o anúncio no painel do Mercado Livre.",
          "Vá na aba Ficha técnica e ajuste os campos Marca e Modelo com valores válidos para a categoria.",
          "Salve — o anúncio é reavaliado automaticamente em minutos.",
          "Se não souber qual marca/modelo usar, procure o mesmo produto em outros anúncios já ativos da categoria.",
        ],
      },
      {
        id: "sem-vendas",
        icon: PackageX,
        title: "Anúncio ativo mas sem vendas",
        summary:
          "Anúncio publicado, no ar, mas sem visitas ou vendas.",
        steps: [
          "Confira se o preço está competitivo comparando com os 3 primeiros anúncios da mesma busca.",
          "Verifique se o título tem palavras-chave que o comprador realmente pesquisa.",
          "Adicione 3 a 6 fotos boas — anúncios com uma foto só rendem muito menos.",
          "Considere ativar frete grátis ou o Mercado Envios Full quando disponível.",
        ],
        tip: "Nas primeiras 48h o ML testa o anúncio com pouco tráfego. Só ajuste depois desse período.",
      },
      {
        id: "reativar-anuncio",
        icon: RefreshCcw,
        title: "Como reativar um anúncio fechado",
        summary:
          "Anúncios fechados por muito tempo pausado ou por infração precisam de ação manual.",
        steps: [
          "Vá em Mercado Livre → Anúncios → Finalizados.",
          "Clique em Reativar. Se o ML pedir correções, resolva antes.",
          "Se o anúncio foi encerrado pela Velo (por reembolso, por exemplo), publique novamente pela plataforma — não force reativação no ML.",
        ],
      },
    ],
  },
  {
    key: "publicacao",
    label: "Publicação",
    intro:
      "Como publicar seu primeiro produto, requisitos da conta e por que algumas publicações falham.",
    items: [
      {
        id: "nao-consigo-publicar",
        icon: Ban,
        title: "Não consigo publicar um produto",
        summary:
          "Para publicar no Mercado Livre é obrigatório ter a conta verificada pelo Mercado Pago.",
        steps: [
          "Acesse mercadopago.com.br → Sua conta → Dados pessoais.",
          "Envie um documento com foto (RG ou CNH) válido.",
          "Confirme seu endereço residencial.",
          "Confirme que você tem 18 anos ou mais (menores de idade não podem vender).",
          "Aguarde a validação — normalmente sai em até 24h.",
          "Depois de aprovado, tente publicar novamente pela Velo.",
        ],
        tip: "A validação é feita pelo Mercado Pago, não pela Velo. Nós não conseguimos acelerar esse processo.",
      },
      {
        id: "precisa-pagar",
        icon: CreditCard,
        title: "Preciso pagar para publicar?",
        summary: "Sim. A Velo funciona com plano mensal ativo.",
        steps: [
          "Publicações via Velo exigem uma assinatura ativa.",
          "O plano cobre o acesso ao catálogo, publicação automatizada, sincronização de estoque e suporte.",
          "O Mercado Livre em si não cobra por publicar no formato Clássico. A tarifa de venda só é descontada quando o produto é vendido.",
          "Consulte a página Planos dentro do painel para ver os valores atuais.",
        ],
      },
      {
        id: "erro-publicacao",
        icon: AlertTriangle,
        title: "Deu erro ao publicar — o que verificar",
        summary:
          "Erros de publicação normalmente vêm de conta desconectada, categoria inválida ou dados obrigatórios ausentes.",
        steps: [
          "Vá em Integrações e confirme que sua conta Mercado Livre está conectada (status verde).",
          "Se estiver vermelho ou expirado, clique em Reconectar.",
          "Confira se o produto ainda tem estoque no fornecedor (produtos zerados são bloqueados).",
          "Se o erro mencionar categoria, tente publicar de novo — a Velo tenta detectar a categoria correta automaticamente.",
          "Persistindo, abra chamado no Suporte com o print da mensagem exata.",
        ],
      },
      {
        id: "conectar-ml",
        icon: KeyRound,
        title: "Como conectar minha conta do Mercado Livre",
        summary:
          "A conexão é feita uma vez por OAuth oficial do Mercado Livre.",
        steps: [
          "Vá em Integrações no painel da Velo.",
          "Clique em Conectar Mercado Livre.",
          "Você é redirecionado para o site oficial do ML — faça login com a conta que vai vender.",
          "Autorize os permissionamentos solicitados.",
          "Você volta automaticamente para a Velo com a conexão ativa.",
        ],
        tip: "Sempre conecte a conta principal de venda. Contas secundárias podem não ter todos os permissionamentos.",
      },
    ],
  },
  {
    key: "pagamentos",
    label: "Pagamentos",
    intro:
      "Cobrança da assinatura, reembolsos, tarifas do Mercado Livre e saldo do Mercado Pago.",
    items: [
      {
        id: "cobranca-nao-reconhecida",
        icon: Receipt,
        title: "Cobrança que não reconheço",
        summary:
          "A cobrança da Velo aparece na fatura como Mercado Pago com nossa descrição.",
        steps: [
          "Verifique no painel da Velo, em Pagamentos, se existe uma assinatura ativa no seu nome.",
          "Se sim, essa é a cobrança recorrente do plano.",
          "Se não reconhecer mesmo assim, abra chamado no Suporte com o valor exato e a data — devolvemos rapidamente em caso de erro.",
        ],
      },
      {
        id: "reembolso",
        icon: RefreshCcw,
        title: "Pedir reembolso de uma cobrança",
        summary:
          "Reembolsos são analisados caso a caso e processados via Mercado Pago.",
        steps: [
          "Vá em Pagamentos → Solicitar reembolso.",
          "Informe qual cobrança e o motivo.",
          "Nossa equipe responde em até 48h úteis.",
          "Reembolsos aprovados caem no mesmo meio de pagamento original em 5 a 10 dias úteis (prazo do Mercado Pago).",
        ],
      },
      {
        id: "tarifas-ml",
        icon: Wallet,
        title: "Como funcionam as tarifas do Mercado Livre",
        summary:
          "A Velo não cobra por venda. As tarifas são do próprio ML.",
        steps: [
          "O Mercado Livre desconta uma porcentagem por venda, que varia por categoria.",
          "Anúncios Clássicos têm tarifa menor; Premium têm mais visibilidade e tarifa maior.",
          "Consulte a tarifa exata da sua categoria em: mercadolivre.com.br/vender/precos.",
          "O valor já entra descontado no seu saldo do Mercado Pago quando o comprador libera a compra.",
        ],
      },
      {
        id: "saldo-mp",
        icon: Wallet,
        title: "Onde vejo o dinheiro das vendas",
        summary: "As vendas caem direto no seu Mercado Pago, não na Velo.",
        steps: [
          "Acesse mercadopago.com.br com a mesma conta que você conectou aqui.",
          "Vá em Atividade para ver cada venda.",
          "O ML libera o dinheiro após a entrega confirmada (normalmente até 2 dias depois).",
          "Você pode transferir para sua conta bancária a qualquer momento, sem taxa.",
        ],
      },
    ],
  },
  {
    key: "conta",
    label: "Conta & suporte",
    intro:
      "Login, senha, dados da conta e como falar com a gente quando nada resolve.",
    items: [
      {
        id: "recuperar-senha",
        icon: KeyRound,
        title: "Esqueci minha senha",
        summary: "Recuperação por email em 2 minutos.",
        steps: [
          "Na tela de login, clique em Esqueci minha senha.",
          "Informe o email cadastrado.",
          "Abra o email da Velo (verifique também a caixa de spam) e clique no link.",
          "Defina uma nova senha e faça login.",
        ],
      },
      {
        id: "trocar-email",
        icon: UserCog,
        title: "Trocar o email da conta",
        summary:
          "Por segurança, a troca de email é feita pelo suporte.",
        steps: [
          "Abra um chamado no Suporte informando o email atual e o novo email desejado.",
          "Envie do email atual — precisamos confirmar que é você.",
          "Fazemos a troca em até 24h úteis.",
        ],
      },
      {
        id: "cancelar-conta",
        icon: Ban,
        title: "Cancelar minha assinatura ou conta",
        summary:
          "Você pode cancelar a assinatura a qualquer momento.",
        steps: [
          "Vá em Pagamentos → Minha assinatura → Cancelar.",
          "O acesso continua até o fim do ciclo já pago.",
          "Anúncios já publicados no seu Mercado Livre continuam lá — cancelar a Velo não apaga anúncios.",
          "Para excluir os dados da conta em definitivo, abra chamado no Suporte pedindo exclusão (LGPD).",
        ],
      },
      {
        id: "produto-fornecedor",
        icon: Truck,
        title: "Cliente comprou mas o fornecedor sumiu",
        summary:
          "Casos raros, mas quando acontece a Velo intervém direto.",
        steps: [
          "Abra chamado no Suporte com o número do pedido do Mercado Livre.",
          "A gente contata o fornecedor pelos nossos canais.",
          "Se não houver solução em 48h, reembolsamos o comprador em nome do vendedor para preservar sua reputação no ML.",
          "Você não perde nota na reputação por problema de fornecedor da nossa base.",
        ],
        tip: "Nossa base de fornecedores é auditada, mas o suporte rápido existe justamente pra esses casos.",
      },
      {
        id: "falar-suporte",
        icon: HelpCircle,
        title: "Como falar com o suporte humano",
        summary: "Atendemos por chat interno em horário comercial.",
        steps: [
          "Vá em Suporte no menu principal.",
          "Clique em Novo chamado, escolha a categoria e descreva o problema.",
          "Anexe prints quando possível — acelera muito a resolução.",
          "Respondemos em até algumas horas em dias úteis.",
        ],
      },
    ],
  },
];
