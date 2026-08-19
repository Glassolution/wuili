/**
 * Decide se o extrato consolidado pela ValidaPay pode substituir os eventos
 * confirmados que já estão no banco.
 *
 * A Edge Function `admin-wallet-finance` responde 200 mesmo quando nenhum dos
 * caminhos de extrato existe no ambiente da ValidaPay — nesse caso ela devolve
 * métricas zeradas. Confiar nesses zeros deixava a Carteira exibindo R$ 0,00 nos
 * cartões enquanto a tabela de atividade listava as cobranças reais.
 */

export type WalletFinanceTotals = {
  approved_sales: number;
  gross_revenue: number;
  costs: number;
};

export type WalletFinanceSnapshot = {
  statement_available?: boolean;
  metrics: WalletFinanceTotals;
};

const isEmpty = (totals: WalletFinanceTotals) =>
  !(totals.approved_sales > 0) && !(totals.gross_revenue > 0) && !(totals.costs > 0);

export const shouldUseProviderStatement = (
  provider: WalletFinanceSnapshot | null | undefined,
  local: WalletFinanceSnapshot,
): boolean => {
  if (!provider) return false;
  // Sinal explícito da Edge Function: nenhum endpoint de extrato respondeu.
  if (provider.statement_available === false) return false;
  if (!isEmpty(provider.metrics)) return true;
  // Extrato vazio só é confiável quando os eventos locais também não têm nada;
  // caso contrário estaríamos escondendo cobranças que já foram confirmadas.
  return isEmpty(local.metrics);
};
