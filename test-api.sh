#!/usr/bin/env bash
# ============================================================
# Smoke Test — API do formulário de contato
# Uso: ./test-api.sh
# ============================================================
set -e

BASE="${1:-https://playground-for-tracking.pages.dev}"
PASS=0
FAIL=0

check() {
  local desc="$1" method="$2" url="$3" expected_status="$4" expected_body="$5"
  local status body
  body=$(curl -s -X "$method" "$url" \
    -H "Content-Type: application/json" \
    -H "Origin: $BASE" \
    -d "$6" 2>&1) || true
  status=$(echo "$body" | python3 -c "import sys,json; print(json.load(sys.stdin).get('success','?'))" 2>/dev/null || echo "parse_error")

  if echo "$body" | grep -q "$expected_body"; then
    echo "  ✅ $desc"
    ((PASS++))
  else
    echo "  ❌ $desc — esperado: '$expected_body', body: $(echo $body | head -c 80)"
    ((FAIL++))
  fi
}

echo "🔍 Testando $BASE/api/contact"
echo ""

# 1. Sem token Turnstile (deve bloquear)
check "Bloqueia sem Turnstile" POST "$BASE/api/contact" 400 "anti-bot" \
  '{"name":"Teste Bot","whatsapp":"+5511999999999","email":"bot@test.com","company":"Bot Co","revenue":"ate-10k"}'

# 2. Com token Turnstile teste (deve passar)
check "Aceita com token teste" POST "$BASE/api/contact" 200 "sucesso" \
  '{"name":"Teste OK","whatsapp":"+5511999999999","email":"ok@test.com","company":"Test Co","revenue":"ate-10k","cf-turnstile-response":"test-token"}'

# 3. Validação de campos
check "Rejeita nome curto" POST "$BASE/api/contact" 422 "Nome" \
  '{"name":"A","whatsapp":"+5511999999999","email":"t@t.com","company":"T","revenue":"ate-10k","cf-turnstile-response":"test"}'

check "Rejeita email inválido" POST "$BASE/api/contact" 422 "E-mail" \
  '{"name":"Teste","whatsapp":"+5511999999999","email":"invalido","company":"T","revenue":"ate-10k","cf-turnstile-response":"test"}'

check "Rejeita faturamento inválido" POST "$BASE/api/contact" 422 "Faturamento" \
  '{"name":"Teste","whatsapp":"+5511999999999","email":"t@t.com","company":"T","revenue":"hack","cf-turnstile-response":"test"}'

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  ✅ $PASS passaram | ❌ $FAIL falharam"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━"
[[ $FAIL -eq 0 ]] && echo "🎉 Todos os testes passaram!" || echo "⚠️  Alguns testes falharam"
