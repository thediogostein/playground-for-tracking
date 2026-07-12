// functions/relatorios/_middleware.ts — Email + senha para proteger /relatorios/*
export const onRequest: PagesFunction = async (context) => {
  const url = new URL(context.request.url);
  const password = (context.env as any).REPORT_PASSWORD || "admin123";
  const allowedEmail = (context.env as any).REPORT_EMAIL || "admin@trackinglab.com";

  // ── Helper: simple HMAC-like hash for cookie ──
  async function hash(input: string): Promise<string> {
    const encoder = new TextEncoder();
    const data = encoder.encode(input + password); // salt with password
    const hashBuffer = await crypto.subtle.digest("SHA-256", data);
    return Array.from(new Uint8Array(hashBuffer))
      .map(b => b.toString(16).padStart(2, "0"))
      .join("");
  }

  // ── Check existing auth cookie ──
  const cookieHeader = context.request.headers.get("cookie") || "";
  const authCookie = cookieHeader
    .split(";")
    .map(c => c.trim())
    .find(c => c.startsWith("report_auth="));

  if (authCookie) {
    const token = authCookie.split("=")[1];
    const expectedToken = await hash(allowedEmail);
    if (token === expectedToken) {
      // Valid session — let through
      return context.next();
    }
  }

  // ── Handle login POST ──
  if (context.request.method === "POST") {
    let body: URLSearchParams;
    try {
      body = await context.request.formData() as any;
    } catch {
      body = new URLSearchParams(await context.request.text()) as any;
    }

    const email = (body.get?.("email") || "").trim();
    const pass = (body.get?.("password") || "").trim();

    if (email === allowedEmail && pass === password) {
      const token = await hash(allowedEmail);
      const headers = new Headers();
      headers.set(
        "Set-Cookie",
        `report_auth=${token}; Path=/relatorios; HttpOnly; SameSite=Lax; Max-Age=86400; Secure`
      );
      headers.set("Location", url.pathname + url.search);
      return new Response(null, { status: 302, headers });
    }

    // Wrong credentials
    return new Response(loginPage("Email ou senha incorretos."), {
      status: 401,
      headers: { "Content-Type": "text/html; charset=utf-8" },
    });
  }

  // ── Show login page ──
  return new Response(loginPage(), {
    status: 200,
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
};

function loginPage(error?: string): string {
  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width" />
  <title>🔒 Acesso Restrito — Tracking Lab</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: #0f172a; color: #f1f5f9;
      display: flex; align-items: center; justify-content: center;
      min-height: 100vh;
    }
    .card {
      background: #1e293b; border: 1px solid #334155;
      border-radius: 16px; padding: 40px; width: 100%; max-width: 400px;
      box-shadow: 0 20px 60px rgba(0,0,0,0.4);
    }
    .card h1 { font-size: 1.5rem; margin-bottom: 0.5rem; }
    .card p { color: #94a3b8; font-size: 0.9rem; margin-bottom: 1.5rem; }
    label { display: block; font-size: 0.85rem; margin-bottom: 0.25rem; color: #94a3b8; }
    input {
      width: 100%; padding: 10px 14px; margin-bottom: 1rem;
      background: #0f172a; border: 1px solid #334155; border-radius: 8px;
      color: #f1f5f9; font-size: 0.95rem; outline: none;
      transition: border-color 0.2s;
    }
    input:focus { border-color: #6366f1; }
    button {
      width: 100%; padding: 12px; background: #6366f1; color: white;
      border: none; border-radius: 8px; font-size: 1rem; font-weight: 600;
      cursor: pointer; transition: background 0.2s;
    }
    button:hover { background: #4f46e5; }
    .error {
      background: #7f1d1d33; border: 1px solid #ef4444; color: #fca5a5;
      border-radius: 8px; padding: 10px 14px; margin-bottom: 1rem; font-size: 0.85rem;
    }
  </style>
</head>
<body>
  <div class="card">
    <h1>🔒 Relatórios</h1>
    <p>Acesso restrito. Entre com suas credenciais.</p>
    ${error ? `<div class="error">${error}</div>` : ""}
    <form method="post">
      <label for="email">Email</label>
      <input id="email" name="email" type="email" placeholder="seu@email.com" required autofocus />
      <label for="password">Senha</label>
      <input id="password" name="password" type="password" placeholder="••••••••" required />
      <button type="submit">Entrar</button>
    </form>
  </div>
</body>
</html>`;
}
