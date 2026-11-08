import { recoveryDecision, type RecoveryProduct } from './catalog-recovery-policy.ts';
const urls = ['https://example.org/1.jpg','https://example.org/2.jpg','https://example.org/3.jpg'];
const product: RecoveryProduct = { id: 'test', title: 'Árvore de Natal', category: 'Produto de Natal', images: urls, stock_quantity: 1, is_active: true };
const verdicts = urls.map(url => ({ url, clean: true }));
function expectDecision(expected: string, p = product, v = verdicts) {
  const actual = recoveryDecision(p, v).decision;
  if (actual !== expected) throw new Error(`${actual} != ${expected}`);
}
Deno.test('three approved including primary and stock 1 permits recovery', () => expectDecision('recover'));
Deno.test('two approvals do not permit recovery', () => expectDecision('pending_manual_retry', product, verdicts.slice(0,2)));
Deno.test('three approvals without approved primary do not permit recovery', () => expectDecision('pending_manual_retry', { ...product, images: ['https://example.org/main.jpg', ...urls] }));
Deno.test('stock zero never permits recovery', () => expectDecision('no_stock', { ...product, stock_quantity: 0 }));
Deno.test('fewer than three URLs remains independent restriction', () => expectDecision('other_restriction', { ...product, images: urls.slice(0,2) }));
Deno.test('Anatel title remains excluded', () => expectDecision('other_restriction', { ...product, title: 'Smartwatch Mi Smart Band 10 Pro Gps Preto' }));
Deno.test('spy recorder expressly excluded', () => expectDecision('excluded_risk', { ...product, title: 'Gravador De Voz 8gb Digital Espião' }));
Deno.test('facial REP-p expressly excluded', () => expectDecision('excluded_risk', { ...product, title: 'Equipamento De Reconhecimento Facial Para Rep-p' }));
Deno.test('prohibited category content remains blocked', () => expectDecision('other_restriction', { ...product, title: 'Produto erótico' }));