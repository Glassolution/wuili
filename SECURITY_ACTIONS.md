# 🛡️ AÇÕES DE SEGURANÇA — GUIA PRÁTICO

**Tempo estimado:** 15-30 minutos  
**Dificuldade:** Fácil  
**Urgência:** Média (recomendado fazer hoje)

---

## 📋 CHECKLIST RÁPIDO

Marque cada item conforme completar:

### Vercel (5 minutos)
- [ ] Marcar `ML_CLIENT_SECRET` como Sensitive
- [ ] Marcar `CJ_API_KEY` como Sensitive
- [ ] Marcar `GEMINI_API_KEY` como Sensitive
- [ ] Marcar `SUPABASE_SERVICE_ROLE_KEY` como Sensitive
- [ ] Marcar `MERCADOPAGO_ACCESS_TOKEN` como Sensitive
- [ ] Resolver variáveis com "Needs Attention"
- [ ] Auditar team members

### GitHub (5 minutos)
- [ ] Habilitar branch protection em `main`
- [ ] Auditar collaborators
- [ ] Verificar deploy keys
- [ ] Verificar webhooks

### Local (5 minutos por desenvolvedor)
- [ ] Configurar Git corretamente
- [ ] Executar script de verificação
- [ ] Confirmar .env no .gitignore

---

## 🎯 PASSO A PASSO DETALHADO

### 1️⃣ VERCEL — Marcar Secrets como Sensitive

#### Acesso:
```
https://vercel.com/[seu-projeto]/settings/environment-variables
```

#### Para cada secret:

1. Localize a variável na lista
2. Clique nos três pontos `...` à direita
3. Selecione **"Mark as Sensitive"**
4. Confirme a ação

#### Secrets a marcar:

| Variável | Descrição | Prioridade |
|----------|-----------|------------|
| `ML_CLIENT_SECRET` | Mercado Livre Client Secret | 🔴 CRÍTICA |
| `CJ_API_KEY` | CJ Dropshipping API Key | 🔴 CRÍTICA |
| `GEMINI_API_KEY` | Google Gemini API Key | 🔴 CRÍTICA |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase Service Role Key | 🔴 CRÍTICA |
| `MERCADOPAGO_ACCESS_TOKEN` | Mercado Pago Access Token | 🔴 CRÍTICA |

#### Resultado esperado:
- ✅ Secrets não aparecem mais em logs
- ✅ Secrets não são visíveis para membros não autorizados
- ✅ Ícone de cadeado aparece ao lado da variável

---

### 2️⃣ VERCEL — Resolver "Needs Attention"

#### Acesso:
```
https://vercel.com/[seu-projeto]/settings/environment-variables
```

#### Ações:

1. Procure por variáveis com badge **"Needs Attention"**
2. Para cada uma:
   - Se não é mais usada: **Delete**
   - Se está desatualizada: **Update**
   - Se está correta: **Dismiss**

---

### 3️⃣ VERCEL — Auditar Team Members

#### Acesso:
```
https://vercel.com/[seu-time]/settings/members
```

#### Verificar:

1. **Membros ativos:**
   - [ ] Luis Felipe Xavier
   - [ ] Lucas Lamonica
   - [ ] Outros desenvolvedores legítimos

2. **Remover:**
   - [ ] Membros inativos
   - [ ] Contas de teste
   - [ ] Colaboradores temporários que já saíram

3. **Permissões:**
   - Admin: apenas para líderes técnicos
   - Member: para desenvolvedores ativos
   - Viewer: para stakeholders

---

### 4️⃣ GITHUB — Habilitar Branch Protection

#### Acesso:
```
https://github.com/Glassolution/wuili/settings/branches
```

#### Configuração:

1. Clique em **"Add rule"**
2. Branch name pattern: `main`
3. Marque as opções:

```
☑ Require a pull request before merging
  ☑ Require approvals (1)
  ☑ Dismiss stale pull request approvals when new commits are pushed

☑ Require status checks to pass before merging
  ☑ Require branches to be up to date before merging

☑ Require conversation resolution before merging

☑ Include administrators
```

4. Clique em **"Create"**

#### Resultado esperado:
- ✅ Ninguém pode fazer push direto em `main`
- ✅ Todos os commits passam por Pull Request
- ✅ Código é revisado antes de merge

---

### 5️⃣ GITHUB — Auditar Collaborators

#### Acesso:
```
https://github.com/Glassolution/wuili/settings/access
```

#### Verificar:

1. **Collaborators:**
   - Listar todos os usuários com acesso
   - Remover usuários inativos
   - Verificar nível de permissão de cada um

2. **Deploy Keys:**
   - Acessar: Settings > Deploy keys
   - Verificar se há keys desconhecidas
   - Remover keys não utilizadas

3. **Webhooks:**
   - Acessar: Settings > Webhooks
   - Verificar URLs de destino
   - Remover webhooks suspeitos

---

### 6️⃣ LOCAL — Configurar Git Corretamente

#### Para cada desenvolvedor:

```bash
# 1. Verificar configuração atual
git config user.name
git config user.email

# 2. Configurar corretamente
git config user.name "Seu Nome Completo"
git config user.email "seu-email@empresa.com"

# 3. Verificar novamente
git config user.name
git config user.email

# 4. (Opcional) Configurar globalmente
git config --global user.name "Seu Nome Completo"
git config --global user.email "seu-email@empresa.com"
```

#### Valores corretos:

| Desenvolvedor | Nome | Email |
|---------------|------|-------|
| Luis Felipe | Luis Felipe Xavier | luisfelipexavier@... |
| Lucas | Lucas Lamonica | lucassrby@gmail.com |
| Outros | Nome Real | email@empresa.com |

#### ❌ NÃO usar:
- `Pedro` / `pedro@example.com`
- `Seu Nome` / `example@example.com`
- Nomes genéricos ou temporários

---

### 7️⃣ LOCAL — Executar Script de Verificação

#### Comando:

```bash
# No diretório do projeto
./security-check.sh
```

#### Resultado esperado:

```
✓ OK: 15
⚠ AVISOS: 2
✗ ERROS: 0

✅ VERIFICAÇÃO CONCLUÍDA COM SUCESSO
```

#### Se houver erros:

1. Leia a mensagem de erro
2. Corrija o problema
3. Execute novamente

---

### 8️⃣ VERIFICAR .gitignore

#### Comando:

```bash
# Verificar se .env está protegido
cat .gitignore | grep "^\.env$"
```

#### Resultado esperado:
```
.env
```

#### Se não estiver:

```bash
# Adicionar .env ao .gitignore
echo ".env" >> .gitignore
git add .gitignore
git commit -m "chore: add .env to .gitignore"
```

---

## 🔍 VERIFICAÇÕES FINAIS

### Checklist de Validação:

```bash
# 1. Verificar que .env não está commitado
git ls-files | grep "\.env$"
# Resultado esperado: (vazio)

# 2. Verificar configuração Git
git config user.name
git config user.email
# Resultado esperado: seu nome e email reais

# 3. Verificar remotes
git remote -v
# Resultado esperado: apenas origin apontando para GitHub

# 4. Verificar branch atual
git branch --show-current
# Resultado esperado: main ou feature branch

# 5. Executar script de segurança
./security-check.sh
# Resultado esperado: ✅ VERIFICAÇÃO CONCLUÍDA COM SUCESSO
```

---

## 📊 MONITORAMENTO CONTÍNUO

### Diário:
- [ ] Verificar logs de deploy na Vercel
- [ ] Verificar erros no Supabase

### Semanal:
- [ ] Executar `./security-check.sh`
- [ ] Revisar Pull Requests pendentes
- [ ] Verificar dependências desatualizadas

### Mensal:
- [ ] Auditar team members (GitHub + Vercel)
- [ ] Revisar secrets e tokens
- [ ] Verificar audit logs
- [ ] Executar `npm audit`

### Trimestral:
- [ ] Rotacionar secrets críticas
- [ ] Auditoria de segurança completa
- [ ] Revisar RLS policies do Supabase

---

## 🚨 EM CASO DE EMERGÊNCIA

### Se detectar atividade suspeita:

1. **PARE IMEDIATAMENTE**
2. **NÃO FAÇA PUSH**
3. **NOTIFIQUE A EQUIPE**

### Ações de emergência:

```bash
# 1. Revogar secrets comprometidas
# Acessar Vercel > Settings > Environment Variables
# Deletar e recriar todas as secrets

# 2. Rotacionar tokens OAuth
# Mercado Livre: https://developers.mercadolivre.com.br/apps
# Mercado Pago: https://www.mercadopago.com.br/developers

# 3. Verificar logs de acesso
# Supabase: https://supabase.com/dashboard/project/[id]/logs
# Vercel: https://vercel.com/[projeto]/logs

# 4. Fazer backup do banco
# Supabase: https://supabase.com/dashboard/project/[id]/database/backups
```

### Contatos de suporte:

- **GitHub Security:** https://github.com/security
- **Vercel Support:** https://vercel.com/support
- **Supabase Support:** https://supabase.com/support

---

## ✅ CONCLUSÃO

Após completar todas as ações acima:

1. ✅ Secrets estarão protegidas
2. ✅ Branch main estará protegida
3. ✅ Configuração Git estará normalizada
4. ✅ Projeto estará mais seguro

**Tempo total:** 15-30 minutos  
**Impacto:** Nenhum nas operações  
**Benefício:** Segurança significativamente melhorada

---

## 📚 DOCUMENTOS RELACIONADOS

- **Relatório Completo:** `SECURITY_AUDIT_REPORT.md`
- **Resumo Executivo:** `SECURITY_SUMMARY.md`
- **Script de Verificação:** `security-check.sh`
- **Documentação do Projeto:** `CLAUDE.md`

---

**Última atualização:** 09/05/2026  
**Próxima revisão:** 09/06/2026
