// Opções que a fornecedora oferece para um produto (tamanho, cor, capacidade,
// voltagem, modelo, sabor... qualquer uma) e a escolha do vendedor na hora de
// publicar. Usado pela tela de publicar (src) e pela `ml-publish`, para que a
// regra de quais opções existem e quais preços valem seja uma só.
//
// Regra do dono: toda opção da fornecedora aparece ao publicar, cada uma com o
// próprio custo; o vendedor escolhe quais publicar e o preço de cada uma.

export type OpcaoDaFornecedora = {
  /** Identificador estável da opção: "<nome>: <valor>". */
  chave: string
  nome: string
  valor: string
  /** Custo da opção na fornecedora; cai no custo do produto quando ausente. */
  custo: number
  /** Estoque informado; null quando a fornecedora não informa. */
  estoque: number | null
  sku: string | null
}

export type OpcaoEscolhida = { chave: string; preco: number }

// Níveis de compra da fornecedora (Atacado/Dropshipping/Grupo VIP...) não são
// opção do produto: o vendedor sempre compra no dropshipping.
const NOMES_IGNORADOS = new Set([
  'compra', 'compras', 'kit', 'kits', 'promocao', 'oferta', 'lote', 'atacado', 'pacote',
])

const norm = (v: unknown) =>
  String(v ?? '').trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()

const texto = (v: unknown) => (typeof v === 'string' ? v.trim() : typeof v === 'number' ? String(v) : '')

export function listarOpcoesDaFornecedora(variantsRaw: unknown, custoDoProduto: number): OpcaoDaFornecedora[] {
  let raw = variantsRaw
  if (typeof raw === 'string') {
    try { raw = JSON.parse(raw) } catch { return [] }
  }
  if (!Array.isArray(raw)) return []
  const opcoes: OpcaoDaFornecedora[] = []
  const vistas = new Set<string>()
  const adicionar = (nome: string, valor: string, r: Record<string, unknown>) => {
    if (!nome || !valor || NOMES_IGNORADOS.has(norm(nome))) return
    const chave = `${nome}: ${valor}`
    if (vistas.has(norm(chave))) return
    vistas.add(norm(chave))
    const custoNum = Number(r.cost_price)
    const estoqueNum = Number(r.stock)
    // stock_managed=false: a fornecedora não controla estoque dessa opção.
    const estoque = r.stock_managed === false
      ? null
      : (r.stock === null || r.stock === undefined || !Number.isFinite(estoqueNum) ? null : estoqueNum)
    opcoes.push({
      chave,
      nome,
      valor,
      custo: Number.isFinite(custoNum) && custoNum > 0 ? custoNum : custoDoProduto,
      estoque,
      sku: texto(r.sku) || null,
    })
  }
  for (const entry of raw) {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) continue
    const r = entry as Record<string, unknown>
    const nome = texto(r.name)
    const valor = texto(r.value)
    if (valor) { adicionar(nome, valor, r); continue }
    if (Array.isArray(r.options)) for (const o of r.options) adicionar(nome, texto(o), r)
  }
  // Uma opção só não é escolha: o produto publica como sempre.
  return opcoes.length >= 2 ? opcoes : []
}

export const opcaoTemEstoque = (o: OpcaoDaFornecedora) => o.estoque === null || o.estoque > 0

/** Erros da escolha do vendedor, em português, prontos para mostrar. Vazio = ok. */
export function validarOpcoesEscolhidas(
  opcoes: OpcaoDaFornecedora[],
  escolhidas: OpcaoEscolhida[],
): string[] {
  const erros: string[] = []
  if (escolhidas.length === 0) return ['Escolha pelo menos uma opção para publicar.']
  const usadas = new Set<string>()
  for (const e of escolhidas) {
    const opcao = opcoes.find((o) => o.chave === e.chave)
    if (!opcao) { erros.push(`A opção "${e.chave}" não existe mais na fornecedora.`); continue }
    if (usadas.has(e.chave)) { erros.push(`A opção "${opcao.valor}" foi escolhida duas vezes.`); continue }
    usadas.add(e.chave)
    if (!opcaoTemEstoque(opcao)) erros.push(`A opção "${opcao.valor}" está sem estoque.`)
    if (!Number.isFinite(e.preco) || e.preco <= opcao.custo) {
      erros.push(`O preço de "${opcao.valor}" precisa ser maior que o custo.`)
    }
  }
  return erros
}

/** Título com o nome da opção no fim, cortando o título para caber no limite. */
export function tituloComOpcao(titulo: string, valor: string, max = 60): string {
  const base = titulo.trim()
  const sufixo = ` ${valor.trim()}`
  if (norm(base).includes(norm(valor))) return base.slice(0, max)
  if (sufixo.length >= max) return base.slice(0, max)
  return `${base.slice(0, max - sufixo.length).trimEnd()}${sufixo}`
}

/** Todas as escolhidas com o mesmo preço? Só então cabem num anúncio com variações. */
export const precosIguais = (escolhidas: OpcaoEscolhida[]) =>
  escolhidas.every((e) => Math.abs(e.preco - escolhidas[0].preco) < 0.005)
