# Segurança do Serviço de Email (Resend)

## ⚠️ REGRAS DE SEGURANÇA OBRIGATÓRIAS

### 1. Proteção da API Key

- ✅ **RESEND_API_KEY** está no arquivo `.env` (que está no `.gitignore`)
- ❌ **NUNCA** exponha a chave no frontend
- ❌ **NUNCA** inclua a chave em logs, responses da API ou mensagens de erro
- ❌ **NUNCA** commite o arquivo `.env` no Git

### 2. Uso Correto

- ✅ Todas as chamadas de email devem passar pelo **backend**
- ✅ O frontend **NUNCA** deve chamar o Resend diretamente
- ✅ Use a função `sendEmail()` do `emailService.ts`

### 3. Configuração no Vercel

Para deploy em produção:

1. Acesse: **Vercel Dashboard** → **Settings** → **Environment Variables**
2. Adicione a variável:
   - **Name**: `RESEND_API_KEY`
   - **Value**: `re_E3d8WLYe_BTiE9uGPUcJm4k2zz1odtGFj`
   - **Environment**: Production, Preview, Development

### 4. Validação

Antes de usar o serviço, verifique se está configurado:

```typescript
import { isEmailServiceConfigured } from './emailService';

if (!isEmailServiceConfigured()) {
  console.error('Serviço de email não configurado');
}
```

### 5. Exemplo de Uso Seguro

```typescript
// ✅ CORRETO - No backend
import { sendEmail } from '@/server/services/emailService';

await sendEmail({
  to: 'usuario@example.com',
  subject: 'Bem-vindo à Velo',
  html: '<h1>Olá!</h1>',
});
```

```typescript
// ❌ ERRADO - No frontend
import { Resend } from 'resend'; // NUNCA faça isso!
const resend = new Resend(process.env.RESEND_API_KEY);
```

## Checklist de Segurança

- [x] `.env` está no `.gitignore`
- [x] API key adicionada no `.env`
- [x] `.env.example` atualizado (sem a chave real)
- [x] Serviço criado em `server/services/emailService.ts`
- [x] Validações de segurança implementadas
- [ ] Variável configurada no Vercel (fazer manualmente)

## Contato

Em caso de dúvidas sobre segurança, consulte a documentação do Resend:
https://resend.com/docs/introduction
