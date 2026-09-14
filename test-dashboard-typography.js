// Script para validar tipografia do Dashboard no console do navegador
// Cole este código no console do navegador (F12 > Console) na página /dashboard

console.log('=== TESTE DE TIPOGRAFIA DO DASHBOARD ===\n');

// Função helper para testar elementos
function testElement(selector, label) {
  const el = document.querySelector(selector);
  if (!el) {
    console.log(`❌ ${label}: Elemento não encontrado`);
    return;
  }
  
  const styles = window.getComputedStyle(el);
  console.log(`\n📍 ${label}:`);
  console.log(`   font-family: ${styles.fontFamily}`);
  console.log(`   font-size: ${styles.fontSize}`);
  console.log(`   font-weight: ${styles.fontWeight}`);
  console.log(`   line-height: ${styles.lineHeight}`);
  console.log(`   color: ${styles.color}`);
  console.log(`   letter-spacing: ${styles.letterSpacing}`);
  
  // Verificar se Inter está carregada
  const hasInter = styles.fontFamily.includes('Inter');
  const hasInterVariable = styles.fontFamily.includes('Inter Variable');
  
  if (hasInterVariable) {
    console.log(`   ✅ Inter Variable está carregada`);
  } else if (hasInter) {
    console.log(`   ⚠️  Inter está presente, mas não Inter Variable`);
  } else {
    console.log(`   ❌ Inter não está carregada (usando fallback)`);
  }
  
  // Verificar peso
  const weight = parseInt(styles.fontWeight);
  if (weight > 600) {
    console.log(`   ⚠️  Font-weight muito alto: ${weight} (máximo deveria ser 600)`);
  }
}

// 1. Título Dashboard na topbar
testElement('header span', 'Título "Dashboard" na topbar');

// 2. Label de card (Receita Total)
const labels = document.querySelectorAll('.rounded-xl.border.bg-white p');
if (labels.length > 0) {
  const el = labels[0];
  const styles = window.getComputedStyle(el);
  console.log(`\n📍 Label "Receita Total":`);
  console.log(`   font-family: ${styles.fontFamily}`);
  console.log(`   font-size: ${styles.fontSize}`);
  console.log(`   font-weight: ${styles.fontWeight}`);
  console.log(`   color: ${styles.color}`);
  
  // Verificar cor
  if (styles.color === 'rgb(138, 143, 163)') {
    console.log(`   ✅ Cor correta: #8A8FA3`);
  } else {
    console.log(`   ⚠️  Cor incorreta. Esperado: rgb(138, 143, 163), Atual: ${styles.color}`);
  }
}

// 3. Valor do card (R$ 0,00)
const values = document.querySelectorAll('.rounded-xl.border.bg-white div[style*="28px"]');
if (values.length > 0) {
  const el = values[0];
  const styles = window.getComputedStyle(el);
  console.log(`\n📍 Valor "R$ 0,00":`);
  console.log(`   font-family: ${styles.fontFamily}`);
  console.log(`   font-size: ${styles.fontSize}`);
  console.log(`   font-weight: ${styles.fontWeight}`);
  console.log(`   line-height: ${styles.lineHeight}`);
  console.log(`   color: ${styles.color}`);
  console.log(`   letter-spacing: ${styles.letterSpacing}`);
  
  // Verificar especificações
  if (styles.fontSize === '28px') console.log(`   ✅ Font-size correto: 28px`);
  if (styles.fontWeight === '500') console.log(`   ✅ Font-weight correto: 500`);
  if (styles.color === 'rgb(17, 17, 17)') console.log(`   ✅ Cor correta: #111111`);
}

// 4. Botão de filtro "Hoje"
const buttons = document.querySelectorAll('button[style*="14px"]');
if (buttons.length > 0) {
  const el = buttons[0];
  const styles = window.getComputedStyle(el);
  console.log(`\n📍 Botão "Hoje":`);
  console.log(`   font-family: ${styles.fontFamily}`);
  console.log(`   font-size: ${styles.fontSize}`);
  console.log(`   font-weight: ${styles.fontWeight}`);
  console.log(`   color: ${styles.color}`);
  
  if (styles.fontSize === '14px') console.log(`   ✅ Font-size correto: 14px`);
  if (styles.fontWeight === '500') console.log(`   ✅ Font-weight correto: 500`);
}

// 5. Cabeçalho da tabela
const tableHeaders = document.querySelectorAll('th');
if (tableHeaders.length > 0) {
  const el = tableHeaders[0];
  const styles = window.getComputedStyle(el);
  console.log(`\n📍 Cabeçalho da tabela "ID do Pedido":`);
  console.log(`   font-family: ${styles.fontFamily}`);
  console.log(`   font-size: ${styles.fontSize}`);
  console.log(`   font-weight: ${styles.fontWeight}`);
  console.log(`   color: ${styles.color}`);
  
  if (styles.fontSize === '13px') console.log(`   ✅ Font-size correto: 13px`);
  if (styles.fontWeight === '500') console.log(`   ✅ Font-weight correto: 500`);
  if (styles.color === 'rgb(138, 143, 163)') console.log(`   ✅ Cor correta: #8A8FA3`);
}

console.log('\n=== FIM DO TESTE ===');
console.log('\n💡 Verificações importantes:');
console.log('   ✓ font-family deve começar com "Inter Variable" ou "Inter"');
console.log('   ✓ Pesos não devem passar de 600 (sem bold/700)');
console.log('   ✓ Labels: #8A8FA3 = rgb(138, 143, 163)');
console.log('   ✓ Textos principais: #111111 = rgb(17, 17, 17)');
console.log('   ✓ Placeholders: #9CA3AF = rgb(156, 163, 175)');
console.log('   ✓ Valores grandes: 28px, weight 500, letter-spacing -0.03em');
