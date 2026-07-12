import { test, expect } from "@playwright/test";

const BASE = process.env.TEST_URL || "https://playground-for-tracking.pages.dev";

test.describe("Formulário de Contato", () => {
  test("fluxo completo — 5 passos até /obrigado", async ({ page }) => {
    await page.goto(`${BASE}/contact`);
    await page.waitForTimeout(2000); // espera React carregar

    // Passo 1: Nome
    await page.fill('input[placeholder*="Digite seu nome"]', "Maria Teste");
    await page.click('button:has-text("Próximo")');
    await page.waitForTimeout(500);

    // Passo 2: WhatsApp
    await expect(page.locator('h3:has-text("WhatsApp")')).toBeVisible();
    await page.fill('input[placeholder*="(11)"]', "11988887777");
    await page.click('button:has-text("Próximo")');
    await page.waitForTimeout(500);

    // Passo 3: Email
    await expect(page.locator('h3:has-text("e-mail")')).toBeVisible();
    await page.fill('input[placeholder*="seu@email"]', "maria@teste.com");
    await page.click('button:has-text("Próximo")');
    await page.waitForTimeout(500);

    // Passo 4: Empresa
    await expect(page.locator('h3:has-text("empresa")')).toBeVisible();
    await page.fill('input[placeholder*="Nome da sua empresa"]', "Empresa Teste");
    await page.click('button:has-text("Próximo")');
    await page.waitForTimeout(800);

    // Passo 5: Faturamento + Turnstile
    await expect(page.locator('h3:has-text("faturamento")')).toBeVisible();

    // Seleciona faturamento
    await page.click('[role="combobox"]');
    await page.click('text=Até R\\$ 10 mil');
    await page.waitForTimeout(500);

    // Clica Enviar
    await page.click('button:has-text("Enviar")');

    // Deve redirecionar para /obrigado
    await page.waitForURL("**/obrigado", { timeout: 15000 });
    await expect(page.locator("h1")).toContainText("Obrigado");
  });

  test("validação — nome muito curto mostra erro", async ({ page }) => {
    await page.goto(`${BASE}/contact`);
    await page.waitForTimeout(2000);

    await page.fill('input[placeholder*="Digite seu nome"]', "A");
    await page.click('button:has-text("Próximo")');
    await page.waitForTimeout(300);

    await expect(page.locator("text=Mínimo 2 caracteres")).toBeVisible();
  });

  test("validação — email inválido mostra erro", async ({ page }) => {
    await page.goto(`${BASE}/contact`);
    await page.waitForTimeout(2000);

    // Passo 1
    await page.fill('input[placeholder*="Digite seu nome"]', "João");
    await page.click('button:has-text("Próximo")');
    await page.waitForTimeout(500);

    // Passo 2
    await page.fill('input[placeholder*="(11)"]', "11988887777");
    await page.click('button:has-text("Próximo")');
    await page.waitForTimeout(500);

    // Passo 3 — email inválido
    await page.fill('input[placeholder*="seu@email"]', "nao-e-email");
    await page.click('button:has-text("Próximo")');
    await page.waitForTimeout(300);

    await expect(page.locator("text=E-mail inválido")).toBeVisible();
  });
});
