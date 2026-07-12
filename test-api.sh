#!/usr/bin/env bash
BASE="${1:-https://playground-for-tracking.pages.dev}"
PASS=0; FAIL=0

check() {
  local desc="$1" url="$2" expected="$3" postdata="$4"
  body=$(curl -s -X POST "$url" -H "Content-Type: application/json" -H "Origin: $BASE" -d "$postdata" 2>&1) || true
  if echo "$body" | grep -q "$expected" 2>/dev/null; then
    echo "  ✅ $desc"; PASS=$((PASS+1))
  else
    echo "  ❌ $desc — esperado '$expected'"; echo "     $(echo "$body" | head -c 100)"; FAIL=$((FAIL+1))
  fi
}

echo "🔍 $BASE/api/contact"
T=$(curl -s -X POST "$BASE/api/contact" -H "Content-Type: application/json" -H "Origin: $BASE" -d '{"name":"X","whatsapp":"+5511999999999","email":"x@x.com","company":"X","revenue":"ate-10k"}' | grep -c "sucesso" || true)
echo "Modo: $([ "$T" -ge 1 ] && echo '🧪 TEST' || echo '🔒 PROD')"
echo ""

check "Envio válido"          "$BASE/api/contact" "sucesso"      '{"name":"Maria","whatsapp":"+5511999999999","email":"m@t.com","company":"ACME","revenue":"ate-10k"}'
check "Rejeita nome curto"    "$BASE/api/contact" "Nome"         '{"name":"A","whatsapp":"+5511999999999","email":"t@t.com","company":"T","revenue":"ate-10k"}'
check "Rejeita email inválido" "$BASE/api/contact" "E-mail"      '{"name":"Teste","whatsapp":"+5511999999999","email":"x","company":"T","revenue":"ate-10k"}'
check "Rejeita faturamento"   "$BASE/api/contact" "Faturamento"  '{"name":"Teste","whatsapp":"+5511999999999","email":"t@t.com","company":"T","revenue":"hack"}'

echo ""
echo "━━━━━━━━━━━━━━━━━━━━"
echo "  ✅ $PASS | ❌ $FAIL"
echo "━━━━━━━━━━━━━━━━━━━━"
[[ $FAIL -eq 0 ]] && echo "🎉 Todos passaram!"

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  ✅ $PASS passaram | ❌ $FAIL falharam"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━"
[[ $FAIL -eq 0 ]] && echo "🎉 Todos os testes passaram!" || echo "⚠️  Alguns testes falharam"
