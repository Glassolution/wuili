// Script para validar tipografia da sidebar no console do navegador
// Cole este código no console do navegador (F12 > Console)

console.log('=== TESTE DE TIPOGRAFIA DA SIDEBAR ===\n');

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
}

// Testar elementos da sidebar
testElement('a[href="/dashboard"]', 'Dashboard (link principal)');
testElement('button:has(span:contains("Sua Loja"))', 'Sua Loja (grupo)');
testElement('button:has(span:contains("Financeiro"))', 'Financeiro (grupo)');
testElement('a[href="/dashboard/produtos"]', 'Produtos (subitem)');
testElement('a[href="/admin/dashboard"]', 'Admin (footer)');
testElement('a[href="/dashboard/comissoes"]', 'Comissões (footer)');

// Testar nome do usuário
const userNameEl = document.querySelector('nav span[style*="font-weight: 600"]');
if (userNameEl) {
  const styles = window.getComputedStyle(userNameEl);
  console.log(`\n📍 Nome do usuário:`);
  console.log(`   font-family: ${styles.fontFamily}`);
  console.log(`   font-size: ${styles.fontSize}`);
  console.log(`   font-weight: ${styles.fontWeight}`);
  console.log(`   color: ${styles.color}`);
}

console.log('\n=== FIM DO TESTE ===');
console.log('\n💡 Verificações importantes:');
console.log('   - font-family deve começar com "Inter Variable" ou "Inter"');
console.log('   - Itens principais: 16px, weight 500, line-height ~22px');
console.log('   - Subitens: 15px, weight 500, line-height ~22px');
console.log('   - Texto inativo: rgb(17, 17, 17) = #111111');
console.log('   - Ícone inativo: rgb(107, 114, 128) = #6B7280');
console.log('   - Texto ativo: rgb(255, 255, 255) = #FFFFFF');
