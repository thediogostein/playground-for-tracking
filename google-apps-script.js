// ============================================================
// Google Apps Script - Web App para receber submissões do formulário
// ============================================================
//
// 1. Acesse https://script.google.com
// 2. Crie um novo projeto
// 3. Cole este código
// 4. Clique em "Implantar" → "Nova implantação" → "App da Web"
// 5. Execute como: "Eu" | Acesso: "Qualquer pessoa"
// 6. Copie a URL gerada e cole no comando abaixo
//
// Depois rode no terminal:
// npx wrangler pages secret put GOOGLE_SHEET_WEBHOOK_URL
// 
// ============================================================

function doPost(e) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  const data = JSON.parse(e.postData.contents);
  
  sheet.appendRow([
    new Date(),                    // Data/Hora
    data.name,                     // Nome
    data.whatsapp,                 // WhatsApp
    data.email,                    // Email
    data.company,                  // Empresa
    data.revenue,                  // Faturamento
    data.ip || "",                 // IP
  ]);
  
  return ContentService
    .createTextOutput(JSON.stringify({ success: true }))
    .setMimeType(ContentService.MimeType.JSON);
}
