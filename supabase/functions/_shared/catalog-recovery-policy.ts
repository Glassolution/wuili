import { isBlocked, isCellphoneProduct } from './catalog-filters.ts';

export interface RecoveryProduct {
  id: string; title: string; category: string | null; images: string[];
  stock_quantity: number; is_active: boolean;
}
export interface RecoveryVerdict { url: string; clean: boolean | null }
export function recoveryDecision(product: RecoveryProduct, verdicts: RecoveryVerdict[]) {
  const urls = [...new Set(product.images.filter(url => url.trim()))];
  const approved = urls.filter(url => verdicts.some(v => v.url === url && v.clean === true));
  const title = product.title.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  const risk = /(espiao|espionagem|reconhecimento facial|camera|vigilancia|arma|municao)/.test(title);
  const anatel = /(smartphone|smartwatch|smart watch|smart band|smartband|mi band|redmi watch|amazfit|haylou|relogio smart|roteador|modem 4g|^drone|celular caterpillar|positivo p[0-9]+ dual)/.test(title)
    && !/(pulseira|suporte|capa|pelicula|carregador|cabo|anemometro|garrafa|caneta|protetor)/.test(title);
  const restriction = anatel || isBlocked(product.title) || isCellphoneProduct(product.title, product.category ?? '') || urls.length < 3;
  const primaryApproved = verdicts.some(v => v.url === urls[0] && v.clean === true);
  const decision = risk ? 'excluded_risk' : !product.is_active ? 'other_restriction'
    : product.stock_quantity <= 0 ? 'no_stock' : restriction ? 'other_restriction'
    : approved.length < 3 || !primaryApproved ? 'pending_manual_retry' : 'recover';
  return { decision, approved, primaryApproved, urlCount: urls.length };
}