// Script para validar tipografia dos números no Dashboard
// Cole este código no console do navegador (F12 > Console) na página /dashboard

console.log('=== TESTE DE TIPOGRAFIA DOS NÚMEROS ===\n');

// Função helper para testar elementos
function testNumericElement(selector, label) {
  const el = document.querySelector(selector);
  if (!el) {
    console.log(`❌ ${label}: Elemento não encontrado`);
    return;
  }
  
  const styles = window.getComputedStyle(el);
  console.log(`\n📍 ${label}:`);
  console.log(`   Conteúdo: "${el.textContent.trim()}"`);
  console.log(`   font-family: ${styles.fontFamily}`);
  console.log(`   font-size: ${styles.fontSize}`);
  console.log(`   font-weight: ${styles.fontWeight}`);
  console.log(`   letter-spacing: ${styles.letterSpacing}`);
  console.log(`   font-variant-numeric: ${styles.fontVariantNumeric}`);
  console.log(`   font-feature-settings: ${styles.fontFeatureSettings}`);
  
  // Verificar se Inter está carregada
  const hasInter = styles.fontFamily.includes('Inter');
  const hasInterVariable = styles.fontFamily.includes('Inter Variable');
  
  if (hasInterVariable) {
    console.log(`   ✅ Inter Variable está carregada`);
  } else if (hasInter) {
    console.log(`   ⚠️  Inter está presente, mas não Inter Variable`);
  } else {
    console.log(`   ❌ Inter não está carregada (usando fallback)`);
    console.log(`   ⚠️  Primeira fonte: ${styles.fontFamily.split(',')[0]}`);
  }
  
  // Verificar tabular-nums
  if (styles.fontVariantNumeric.includes('tabular-nums') || 
      styles.fontFeatureSettings.includes('tnum')) {
    console.log(`   ✅ Tabular nums ativado`);
  } else {
    console.log(`   ⚠️  Tabular nums NÃO ativado`);
  }
}

// 1. Valor principal do card (R$ 0,00)
console.log('\n═══ CARDS DE MÉTRICAS ═══');
const cardValues = document.querySelectorAll('.rounded-xl.border.bg-white div[style*="24px"]');
if (cardValues.length > 0) {
  testNumericElement('.rounded-xl.border.bg-white div[style*="24px"]', 'Valor do Card "R$ 0,00"');
} else {
  // Tentar outro seletor
  const allCards = document.querySelectorAll('.border-\\[\\#F0F0F0\\].bg-white');
  if (allCards.length > 0) {
    const firstCard = allCards[0];
    const valueDiv = firstCard.querySelector('div[style*="fontSize"]');
    if (valueDiv) {
      const styles = window.getComputedStyle(valueDiv);
      console.log(`\n📍 Valor do Card (primeiro encontrado):`);
      console.log(`   Conteúdo: "${valueDiv.textContent.trim()}"`);
      console.log(`   font-family: ${styles.fontFamily}`);
      console.log(`   font-size: ${styles.fontSize}`);
      console.log(`   font-weight: ${styles.fontWeight}`);
      console.log(`   letter-spacing: ${styles.letterSpacing}`);
      console.log(`   font-variant-numeric: ${styles.fontVariantNumeric}`);
      console.log(`   font-feature-settings: ${styles.fontFeatureSettings}`);
    }
  }
}

// 2. Percentual
console.log('\n═══ PERCENTUAIS ═══');
const percentSpans = Array.from(document.querySelectorAll('span')).filter(s => s.textContent.includes('%'));
if (percentSpans.length > 0) {
  const el = percentSpans[0];
  const styles = window.getComputedStyle(el);
  console.log(`\n📍 Percentual "${el.textContent.trim()}":`);
  console.log(`   font-family: ${styles.fontFamily}`);
  console.log(`   font-size: ${styles.fontSize}`);
  console.log(`   font-weight: ${styles.fontWeight}`);
  console.log(`   font-variant-numeric: ${styles.fontVariantNumeric}`);
  console.log(`   font-feature-settings: ${styles.fontFeatureSettings}`);
}

// 3. Valores da tabela
console.log('\n═══ TABELA ═══');
const tableCells = document.querySelectorAll('td');
let foundMonetary = false;
for (const cell of tableCells) {
  if (cell.textContent.includes('R$')) {
    const styles = window.getComputedStyle(cell);
    console.log(`\n📍 Valor da Tabela "${cell.textContent.trim()}":`);
    console.log(`   font-family: ${styles.fontFamily}`);
    console.log(`   font-size: ${styles.fontSize}`);
    console.log(`   font-weight: ${styles.fontWeight}`);
    console.log(`   font-variant-numeric: ${styles.fontVariantNumeric}`);
    console.log(`   font-feature-settings: ${styles.fontFeatureSettings}`);
    foundMonetary = true;
    break;
  }
}
if (!foundMonetary) {
  console.log('   ⚠️  Nenhum valor monetário encontrado na tabela');
}

// 4. Available/Pending Balance
console.log('\n═══ BALANCE CARDS ═══');
const balanceTexts = Array.from(document.querySelectorAll('p')).filter(p => 
  p.textContent.includes('R$') && 
  (p.previousElementSibling?.textContent.includes('Balance') || 
   p.parentElement?.textContent.includes('Balance'))
);
if (balanceTexts.length > 0) {
  const el = balanceTexts[0];
  const styles = window.getComputedStyle(el);
  console.log(`\n📍 Balance "${el.textContent.trim()}":`);
  console.log(`   font-family: ${styles.fontFamily}`);
  console.log(`   font-size: ${styles.fontSize}`);
  console.log(`   font-weight: ${styles.fontWeight}`);
  console.log(`   font-variant-numeric: ${styles.fontVariantNumeric}`);
  console.log(`   font-feature-settings: ${styles.fontFeatureSettings}`);
}

// 5. Próximos Repasses
console.log('\n═══ PRÓXIMOS REPASSES ═══');
const repasseValues = Array.from(document.querySelectorAll('p')).filter(p => 
  p.textContent.includes('R$') && 
  p.parentElement?.parentElement?.textContent.includes('Próximos')
);
if (repasseValues.length > 0) {
  const el = repasseValues[0];
  const styles = window.getComputedStyle(el);
  console.log(`\n📍 Valor Repasse "${el.textContent.trim()}":`);
  console.log(`   font-family: ${styles.fontFamily}`);
  console.log(`   font-size: ${styles.fontSize}`);
  console.log(`   font-weight: ${styles.fontWeight}`);
  console.log(`   font-variant-numeric: ${styles.fontVariantNumeric}`);
  console.log(`   font-feature-settings: ${styles.fontFeatureSettings}`);
}

console.log('\n=== FIM DO TESTE ===');
console.log('\n💡 Verificações importantes:');
console.log('   ✓ font-family deve começar com "Inter Variable" ou "Inter"');
console.log('   ✓ NÃO deve usar Arial, system-ui puro ou fallback');
console.log('   ✓ font-variant-numeric deve incluir "tabular-nums"');
console.log('   ✓ font-feature-settings deve incluir "tnum"');
console.log('   ✓ Valores principais: 24px, weight 500, letter-spacing -0.03em');
console.log('   ✓ Percentuais: 13px, weight 400');
console.log('   ✓ Valores menores: 14px, weight 600');
console.log('\n📌 Se algum valor estiver usando fallback, a fonte Inter não carregou corretamente.');
