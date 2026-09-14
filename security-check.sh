#!/bin/bash

# 🔒 Script de Verificação de Segurança — Projeto Velo
# Executa verificações básicas de segurança no repositório

set -e

echo "🔒 INICIANDO VERIFICAÇÃO DE SEGURANÇA..."
echo ""

# Cores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Contadores
WARNINGS=0
ERRORS=0
OK=0

# Função para imprimir resultados
print_ok() {
    echo -e "${GREEN}✓${NC} $1"
    ((OK++))
}

print_warning() {
    echo -e "${YELLOW}⚠${NC} $1"
    ((WARNINGS++))
}

print_error() {
    echo -e "${RED}✗${NC} $1"
    ((ERRORS++))
}

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "1. VERIFICANDO CONFIGURAÇÃO GIT"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Verificar configuração Git
GIT_NAME=$(git config user.name || echo "")
GIT_EMAIL=$(git config user.email || echo "")

if [ -z "$GIT_NAME" ]; then
    print_error "Git user.name não configurado"
else
    print_ok "Git user.name: $GIT_NAME"
fi

if [ -z "$GIT_EMAIL" ]; then
    print_error "Git user.email não configurado"
else
    print_ok "Git user.email: $GIT_EMAIL"
fi

# Verificar se email é válido (não é example.com)
if [[ "$GIT_EMAIL" == *"example.com"* ]]; then
    print_warning "Email configurado usa domínio 'example.com' (trocar por email real)"
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "2. VERIFICANDO PROTEÇÃO DE SECRETS"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Verificar .gitignore
if [ -f ".gitignore" ]; then
    if grep -q "^\.env$" .gitignore; then
        print_ok ".env está no .gitignore"
    else
        print_error ".env NÃO está no .gitignore"
    fi
    
    if grep -q "^node_modules$" .gitignore; then
        print_ok "node_modules está no .gitignore"
    else
        print_warning "node_modules NÃO está no .gitignore"
    fi
else
    print_error ".gitignore não encontrado"
fi

# Verificar se .env existe e não está commitado
if [ -f ".env" ]; then
    if git ls-files --error-unmatch .env 2>/dev/null; then
        print_error ".env está commitado no Git! REMOVER IMEDIATAMENTE"
    else
        print_ok ".env existe mas não está commitado"
    fi
fi

# Verificar se há secrets hardcoded no código
echo ""
echo "Procurando por secrets hardcoded..."

SECRETS_FOUND=0

# Procurar por padrões suspeitos
if grep -r "password.*=.*['\"]" src/ 2>/dev/null | grep -v "placeholder" | grep -v "example" | grep -q .; then
    print_warning "Possível senha hardcoded encontrada em src/"
    ((SECRETS_FOUND++))
fi

if grep -r "api[_-]key.*=.*['\"]" src/ 2>/dev/null | grep -v "placeholder" | grep -v "example" | grep -q .; then
    print_warning "Possível API key hardcoded encontrada em src/"
    ((SECRETS_FOUND++))
fi

if grep -r "secret.*=.*['\"]" src/ 2>/dev/null | grep -v "placeholder" | grep -v "example" | grep -q .; then
    print_warning "Possível secret hardcoded encontrada em src/"
    ((SECRETS_FOUND++))
fi

if [ $SECRETS_FOUND -eq 0 ]; then
    print_ok "Nenhuma secret hardcoded detectada"
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "3. VERIFICANDO HISTÓRICO GIT"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Verificar se há commits com emails suspeitos
SUSPICIOUS_EMAILS=$(git log --all --format="%ae" | grep -i "example.com" | wc -l)

if [ $SUSPICIOUS_EMAILS -gt 0 ]; then
    print_warning "$SUSPICIOUS_EMAILS commit(s) com email 'example.com' encontrado(s)"
    echo "   Executar: git log --all --format='%H|%an|%ae|%s' | grep 'example.com'"
else
    print_ok "Nenhum commit com email suspeito"
fi

# Contar autores únicos
UNIQUE_AUTHORS=$(git log --all --format="%an <%ae>" | sort -u | wc -l)
print_ok "$UNIQUE_AUTHORS autor(es) único(s) no histórico"

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "4. VERIFICANDO REMOTES"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Listar remotes
REMOTES=$(git remote -v | wc -l)

if [ $REMOTES -eq 0 ]; then
    print_warning "Nenhum remote configurado"
elif [ $REMOTES -eq 2 ]; then
    print_ok "1 remote configurado (fetch + push)"
    git remote -v | while read line; do
        echo "   $line"
    done
else
    print_warning "$((REMOTES / 2)) remotes configurados"
    git remote -v | while read line; do
        echo "   $line"
    done
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "5. VERIFICANDO BRANCHES"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Listar branches
LOCAL_BRANCHES=$(git branch | wc -l)
REMOTE_BRANCHES=$(git branch -r | wc -l)

print_ok "$LOCAL_BRANCHES branch(es) local(is)"
print_ok "$REMOTE_BRANCHES branch(es) remota(s)"

# Verificar se está em main
CURRENT_BRANCH=$(git branch --show-current)
if [ "$CURRENT_BRANCH" == "main" ]; then
    print_warning "Você está na branch 'main' (considere usar feature branches)"
else
    print_ok "Branch atual: $CURRENT_BRANCH"
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "6. VERIFICANDO DEPENDÊNCIAS"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Verificar se há vulnerabilidades conhecidas
if command -v npm &> /dev/null; then
    if [ -f "package.json" ]; then
        print_ok "package.json encontrado"
        
        # Verificar se node_modules existe
        if [ -d "node_modules" ]; then
            print_ok "node_modules instalado"
            
            # Executar npm audit (apenas resumo)
            echo ""
            echo "Executando npm audit..."
            npm audit --audit-level=moderate 2>&1 | head -20 || print_warning "Vulnerabilidades encontradas (executar 'npm audit' para detalhes)"
        else
            print_warning "node_modules não instalado (executar 'npm install')"
        fi
    fi
else
    print_warning "npm não encontrado (não foi possível verificar dependências)"
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "7. RESUMO"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

echo ""
echo -e "${GREEN}✓ OK:${NC} $OK"
echo -e "${YELLOW}⚠ AVISOS:${NC} $WARNINGS"
echo -e "${RED}✗ ERROS:${NC} $ERRORS"
echo ""

if [ $ERRORS -gt 0 ]; then
    echo -e "${RED}❌ VERIFICAÇÃO FALHOU${NC}"
    echo "Corrija os erros acima antes de continuar."
    exit 1
elif [ $WARNINGS -gt 0 ]; then
    echo -e "${YELLOW}⚠️  VERIFICAÇÃO CONCLUÍDA COM AVISOS${NC}"
    echo "Revise os avisos acima para melhorar a segurança."
    exit 0
else
    echo -e "${GREEN}✅ VERIFICAÇÃO CONCLUÍDA COM SUCESSO${NC}"
    echo "Nenhum problema de segurança detectado."
    exit 0
fi
