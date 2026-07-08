import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

// Carregar variáveis do arquivo .env
const envPath = path.join(process.cwd(), '.env');
const envContent = fs.readFileSync(envPath, 'utf-8');
const env = {};
envContent.split('\n').forEach(line => {
  const parts = line.split('=');
  if (parts.length >= 2) {
    const key = parts[0].trim();
    const val = parts.slice(1).join('=').trim().replace(/^"|"$/g, '');
    env[key] = val;
  }
});

const supabaseUrl = env['VITE_SUPABASE_URL'];
const supabaseKey = env['VITE_SUPABASE_PUBLISHABLE_KEY'];

console.log('Supabase URL:', supabaseUrl);
console.log('Using Key (first 10 chars):', supabaseKey ? supabaseKey.substring(0, 10) + '...' : 'undefined');

if (!supabaseUrl || !supabaseKey) {
  console.error('Erro: VITE_SUPABASE_URL ou VITE_SUPABASE_PUBLISHABLE_KEY não encontrados no .env');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  console.log('\n--- Testando conexão e tabelas ---');
  
  // Tentar criar ou logar com um usuário de teste para obter um token JWT 'authenticated'
  const email = `test_agent_${Date.now()}@velo.app`;
  const password = 'TestPassword123!';
  
  console.log(`Tentando registrar usuário temporário: ${email}...`);
  const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
    email,
    password
  });

  if (signUpError) {
    console.error('Erro ao registrar:', signUpError.message);
  } else {
    console.log('Usuário registrado com sucesso!');
  }

  // Se o registro funcionar ou se já tivermos a sessão
  const session = signUpData?.session;
  if (!session) {
    console.log('Sem sessão ativa. Tentando login com credenciais padrão se existirem (ou prosseguindo anônimo)...');
  } else {
    console.log('Autenticado como usuário:', session.user.email);
  }

  // Testar chamada à RPC get_support_tickets_admin
  const { data: ticketsRpc, error: errorRpc } = await supabase
    .rpc('get_support_tickets_admin', { p_status: 'open' });

  console.log('\nChamada à RPC get_support_tickets_admin:');
  console.log('Error:', errorRpc);
  console.log('Data:', ticketsRpc);
  
  // Limpar usuário de teste se possível (não é estritamente necessário no teste, mas bom saber)
}

run().catch(console.error);
