import type { PagesFunction } from "@cloudflare/workers-types";

// ---------------------------------------------------------------------------
// Rate limiting — simple in-memory store (per-request, resets on cold start)
// For production, use KV or D1 for persistent rate limiting.
// ---------------------------------------------------------------------------
const RATE_LIMIT_WINDOW_MS = 60_000; // 1 minute
const RATE_LIMIT_MAX = 5; // max 5 submissions per window per IP
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(ip);
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return false;
  }
  if (entry.count >= RATE_LIMIT_MAX) return true;
  entry.count++;
  return false;
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------
interface ContactForm {
  name: string;
  whatsapp: string;
  email: string;
  company: string;
  revenue: string;
  "cf-turnstile-response"?: string;
}

interface ValidationError {
  field: string;
  message: string;
}

const ALLOWED_REVENUE = [
  "ate-10k",
  "10k-50k",
  "50k-200k",
  "200k-500k",
  "500k-1m",
  "1m-5m",
  "5m-10m",
  "acima-10m",
  "nao-informar",
];

function validate(body: ContactForm): ValidationError[] {
  const errors: ValidationError[] = [];

  // Name
  if (!body.name || typeof body.name !== "string") {
    errors.push({ field: "name", message: "Nome é obrigatório." });
  } else {
    const trimmed = body.name.trim();
    if (trimmed.length < 2) {
      errors.push({ field: "name", message: "Nome deve ter pelo menos 2 caracteres." });
    }
    if (trimmed.length > 100) {
      errors.push({ field: "name", message: "Nome deve ter no máximo 100 caracteres." });
    }
  }

  // WhatsApp (with +55 country code, e.g., +5511999999999)
  if (!body.whatsapp || typeof body.whatsapp !== "string") {
    errors.push({ field: "whatsapp", message: "WhatsApp é obrigatório." });
  } else {
    const digits = body.whatsapp.replace(/\D/g, "");
    // +55 Brazil = 12-13 digits total (2 code + 10-11 phone)
    if (digits.length < 12 || digits.length > 13) {
      errors.push({ field: "whatsapp", message: "WhatsApp inválido. Use DDD + número." });
    }
  }

  // Email
  if (!body.email || typeof body.email !== "string") {
    errors.push({ field: "email", message: "E-mail é obrigatório." });
  } else {
    const trimmed = body.email.trim();
    if (trimmed.length > 254) {
      errors.push({ field: "email", message: "E-mail muito longo." });
    }
    const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRe.test(trimmed)) {
      errors.push({ field: "email", message: "E-mail inválido." });
    }
  }

  // Company
  if (!body.company || typeof body.company !== "string") {
    errors.push({ field: "company", message: "Empresa é obrigatória." });
  } else {
    const trimmed = body.company.trim();
    if (trimmed.length < 1) {
      errors.push({ field: "company", message: "Nome da empresa é obrigatório." });
    }
    if (trimmed.length > 150) {
      errors.push({ field: "company", message: "Nome da empresa muito longo." });
    }
  }

  // Revenue
  if (!body.revenue || typeof body.revenue !== "string") {
    errors.push({ field: "revenue", message: "Faturamento é obrigatório." });
  } else if (!ALLOWED_REVENUE.includes(body.revenue)) {
    errors.push({ field: "revenue", message: "Faturamento inválido." });
  }

  return errors;
}

// ---------------------------------------------------------------------------
// HTML-sanitize helper — strips tags from a string
// ---------------------------------------------------------------------------
function sanitize(input: string): string {
  return input
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#x27;");
}

// ---------------------------------------------------------------------------
// Pages Function handler
// ---------------------------------------------------------------------------
export const onRequestPost: PagesFunction = async (context) => {
  const request = context.request;

  // ---- CORS headers ----
  const headers = new Headers({
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Content-Type": "application/json",
  });

  // ---- CSRF: Origin / Referer check ----
  const origin = request.headers.get("origin") || "";
  const referer = request.headers.get("referer") || "";
  const allowedOrigins = [
    "https://playground-for-tracking.pages.dev",
    "https://webwizardry101.com",
    "https://www.webwizardry101.com",
    "http://localhost:4321",
    "http://localhost:4322",
    "http://127.0.0.1:4321",
  ];

  const isAllowedOrigin = allowedOrigins.some(
    (allowed) => origin === allowed || referer.startsWith(allowed),
  );

  // In dev, allow requests without origin (e.g., curl)
  if (origin && !isAllowedOrigin) {
    return new Response(
      JSON.stringify({ success: false, error: "Origem não permitida." }),
      { status: 403, headers },
    );
  }

  // ---- Rate limit ----
  const ip = request.headers.get("cf-connecting-ip") || "unknown";
  if (isRateLimited(ip)) {
    return new Response(
      JSON.stringify({ success: false, error: "Muitas tentativas. Aguarde um minuto." }),
      { status: 429, headers },
    );
  }

  // ---- Parse body ----
  let body: ContactForm;
  try {
    body = await request.json();
  } catch {
    return new Response(
      JSON.stringify({ success: false, error: "Corpo da requisição inválido." }),
      { status: 400, headers },
    );
  }

  // ---- Validate ----
  const errors = validate(body);
  if (errors.length > 0) {
    return new Response(
      JSON.stringify({ success: false, errors }),
      { status: 422, headers },
    );
  }

  // ---- Turnstile verification ----
  const token = body["cf-turnstile-response"];
  const turnstileSecret = (context.env as any).TURNSTILE_SECRET_KEY;
  const testMode = (context.env as any).TURNSTILE_TEST_MODE === "true";

  // Test mode: skip Turnstile (for automated testing)
  if (!testMode) {
    if (!token) {
      return new Response(
        JSON.stringify({ success: false, error: "Verificação anti-bot necessária." }),
        { status: 400, headers },
      );
    }

    const turnstileResult = await fetch(
      "https://challenges.cloudflare.com/turnstile/v0/siteverify",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          secret: turnstileSecret,
          response: token,
          remoteip: ip,
        }),
      },
    );
    const turnstileData = await turnstileResult.json() as { success: boolean };
    if (!turnstileData.success) {
      return new Response(
        JSON.stringify({ success: false, error: "Verificação anti-bot falhou. Tente novamente." }),
        { status: 400, headers },
      );
    }
  }

  // ---- Sanitize & process ----
  const utms = {
    utm_source: sanitize(((body as any).utm_source || "").trim()),
    utm_medium: sanitize(((body as any).utm_medium || "").trim()),
    utm_campaign: sanitize(((body as any).utm_campaign || "").trim()),
    utm_term: sanitize(((body as any).utm_term || "").trim()),
    utm_content: sanitize(((body as any).utm_content || "").trim()),
  };

  const submission = {
    name: sanitize(body.name.trim()),
    whatsapp: sanitize(body.whatsapp.trim()),
    email: sanitize(body.email.trim()),
    company: sanitize(body.company.trim()),
    revenue: body.revenue,
    ip,
    timestamp: new Date().toISOString(),
    ...utms,
  };

  // ---- Send email notification via Resend (free tier: 100/day) ----
  console.log("[contact] New submission:", JSON.stringify(submission));

  const resendKey = (context.env as any).RESEND_API_KEY;
  const notifyEmail = (context.env as any).NOTIFICATION_EMAIL || "sdiogo01@gmail.com";

  if (resendKey) {
    try {
      const emailResult = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${resendKey}`,
        },
        body: JSON.stringify({
          from: "Tracking Lab <onboarding@resend.dev>",
          to: [notifyEmail],
          subject: `Novo contato: ${submission.name} - ${submission.company}`,
          html: `
            <h2>Novo formulário de contato</h2>
            <table>
              <tr><td><strong>Nome:</strong></td><td>${submission.name}</td></tr>
              <tr><td><strong>WhatsApp:</strong></td><td>${submission.whatsapp}</td></tr>
              <tr><td><strong>Email:</strong></td><td>${submission.email}</td></tr>
              <tr><td><strong>Empresa:</strong></td><td>${submission.company}</td></tr>
              <tr><td><strong>Faturamento:</strong></td><td>${submission.revenue}</td></tr>
              ${submission.utm_source ? `<tr><td colspan="2"><hr></td></tr><tr><td colspan="2"><strong>📊 UTM Tracking</strong></td></tr>` : ""}
              ${submission.utm_source ? `<tr><td><strong>Source:</strong></td><td>${submission.utm_source}</td></tr>` : ""}
              ${submission.utm_medium ? `<tr><td><strong>Medium:</strong></td><td>${submission.utm_medium}</td></tr>` : ""}
              ${submission.utm_campaign ? `<tr><td><strong>Campaign:</strong></td><td>${submission.utm_campaign}</td></tr>` : ""}
              ${submission.utm_term ? `<tr><td><strong>Term:</strong></td><td>${submission.utm_term}</td></tr>` : ""}
              ${submission.utm_content ? `<tr><td><strong>Content:</strong></td><td>${submission.utm_content}</td></tr>` : ""}
              <tr><td colspan="2"><hr></td></tr>
              <tr><td><strong>IP:</strong></td><td>${submission.ip}</td></tr>
              <tr><td><strong>Data:</strong></td><td>${submission.timestamp}</td></tr>
            </table>
          `,
          text: `Novo contato de ${submission.name} (${submission.company})\nWhatsApp: ${submission.whatsapp}\nEmail: ${submission.email}\nFaturamento: ${submission.revenue}${submission.utm_source ? `\n\nUTMs:\nSource: ${submission.utm_source}\nMedium: ${submission.utm_medium}\nCampaign: ${submission.utm_campaign}\nTerm: ${submission.utm_term}\nContent: ${submission.utm_content}` : ""}\n\nIP: ${submission.ip}\nData: ${submission.timestamp}`,
        }),
      });
      const emailData = await emailResult.json() as { id?: string; error?: any };
      if (emailData.id) {
        console.log("[contact] Email sent:", emailData.id);
      } else {
        console.error("[contact] Email failed:", JSON.stringify(emailData));
      }
    } catch (emailErr) {
      console.error("[contact] Email send failed:", emailErr);
    }
  } else {
    console.log("[contact] Email not configured. Set RESEND_API_KEY secret.");
  }

  // ---- Save to Google Sheets (if configured) ----
  const sheetUrl = (context.env as any).GOOGLE_SHEET_WEBHOOK_URL;
  if (sheetUrl) {
    try {
      await fetch(sheetUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(submission),
      });
      console.log("[contact] Saved to Google Sheets");
    } catch (sheetErr) {
      console.error("[contact] Google Sheets save failed:", sheetErr);
    }
  }

    // ---- Create deal in Agendor CRM (if configured) ----
  const agendorToken = (context.env as any).AGENDOR_API_TOKEN;
  if (agendorToken) {
    try {
      const orgRes = await fetch('https://api.agendor.com.br/v3/organizations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Token ${agendorToken}` },
        body: JSON.stringify({
          name: submission.company,
          description: `Lead via formulário${utms.utm_source ? ` | Source: ${utms.utm_source}` : ""}${utms.utm_campaign ? ` | Campanha: ${utms.utm_campaign}` : ""}. Faturamento: ${submission.revenue}`,
          contact: { email: submission.email, whatsapp: submission.whatsapp },
        }),
      });
      const orgData = await orgRes.json();
      if (orgData.errors) console.error('[agendor] org error:', JSON.stringify(orgData.errors));
      const orgId = orgData.data?.id;
      if (orgId) {
        console.log('[agendor] org:', orgId);
        const dealRes = await fetch(`https://api.agendor.com.br/v3/organizations/${orgId}/deals`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Token ${agendorToken}` },
          body: JSON.stringify({
            title: `${submission.name} - ${submission.company}`,
            funnel: 900827,
            customFields: {
              utm_source: submission.utm_source || "",
              utm_medium: submission.utm_medium || "",
              utm_campaign: submission.utm_campaign || "",
              utm_term: submission.utm_term || "",
              utm_content: submission.utm_content || "",
            },
          }),
        });
        const dealData = await dealRes.json();
        if (dealData.data?.id) console.log('[agendor] deal:', dealData.data.id);
        else console.error('[agendor] deal failed:', JSON.stringify(dealData));
      }
    } catch (e) { console.error('[agendor] error:', e); }
  }

  // ---- Respond ----
  return new Response(
    JSON.stringify({
      success: true,
      message: "Mensagem recebida com sucesso! Entraremos em contato em breve.",
    }),
    { status: 200, headers },
  );
};

// Handle OPTIONS (CORS preflight)
export const onRequestOptions: PagesFunction = async () => {
  return new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
      "Access-Control-Max-Age": "86400",
    },
  });
};
