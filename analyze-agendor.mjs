// analyze-agendor.mjs — Pull CRM data and generate report
import { readFileSync } from 'fs';

async function fetchJSON(url) {
  const res = await fetch(url, {
    headers: { Authorization: 'Token 636dd6c1-00ea-4256-bd70-86f20007d582' },
  });
  return res.json();
}

const dealsData = await fetchJSON('https://api.agendor.com.br/v3/deals?per_page=100&withCustomFields=true');
const deals = dealsData.data || [];
const total = deals.length;

// ── Status & Stage counts ──
const byStatus = {};
const byStage = {};
const bySource = {};
const byMedium = {};
const byCampaign = {};
const wonDeals = [];

for (const d of deals) {
  const status = d.dealStatus?.name || '?';
  byStatus[status] = (byStatus[status] || 0) + 1;

  const stage = d.dealStage?.name || '?';
  byStage[stage] = (byStage[stage] || 0) + 1;

  const cf = d.customFields || {};
  if (cf.utm_source) bySource[cf.utm_source] = (bySource[cf.utm_source] || 0) + 1;
  if (cf.utm_medium) byMedium[cf.utm_medium] = (byMedium[cf.utm_medium] || 0) + 1;
  if (cf.utm_campaign) byCampaign[cf.utm_campaign] = (byCampaign[cf.utm_campaign] || 0) + 1;

  if (status === 'Ganho') {
    wonDeals.push({ title: d.title, value: d.value || 0, source: cf.utm_source, medium: cf.utm_medium, campaign: cf.utm_campaign });
  }
}

// ── Print report ──
console.log('');
console.log('═══════════════════════════════════════════');
console.log('  📊 RELATÓRIO AGENDOR — Pipeline Completo');
console.log('═══════════════════════════════════════════');
console.log('  Total de negociações: ' + total);
console.log('');

console.log('───────────────────────────────────────────');
console.log('  📌 Distribuição por STATUS');
console.log('───────────────────────────────────────────');
Object.entries(byStatus).sort((a,b) => b[1]-a[1]).forEach(([k,v]) => {
  const pct = Math.round(v/total*100);
  const bar = '█'.repeat(Math.round(v/total*30));
  console.log('  ' + k.padEnd(16) + ' ' + String(v).padStart(2) + '  ' + bar + ' ' + pct + '%');
});

console.log('');
console.log('───────────────────────────────────────────');
console.log('  📌 Distribuição por ESTÁGIO (Funil)');
console.log('───────────────────────────────────────────');
const stageOrder = ['Novo_Lead', 'Em_Cadencia', 'Ja_Conectou', 'Em_Agenda', 'Fez_Reuniao'];
stageOrder.forEach(stage => {
  const count = byStage[stage] || 0;
  const bar = '▓'.repeat(Math.round(count/total*40));
  console.log('  ' + stage.padEnd(16) + ' ' + String(count).padStart(2) + '  ' + bar);
});

console.log('');
console.log('───────────────────────────────────────────');
console.log('  📌 Origem dos Leads (utm_source)');
console.log('───────────────────────────────────────────');
Object.entries(bySource).sort((a,b) => b[1]-a[1]).forEach(([k,v]) => {
  console.log('  ' + k.padEnd(14) + ' ' + v + ' leads');
});

console.log('');
console.log('───────────────────────────────────────────');
console.log('  📌 Canal/Mídia (utm_medium)');
console.log('───────────────────────────────────────────');
Object.entries(byMedium).sort((a,b) => b[1]-a[1]).forEach(([k,v]) => {
  console.log('  ' + k.padEnd(14) + ' ' + v + ' deals');
});

console.log('');
console.log('───────────────────────────────────────────');
console.log('  📌 Campanhas (utm_campaign)');
console.log('───────────────────────────────────────────');
Object.entries(byCampaign).sort((a,b) => b[1]-a[1]).forEach(([k,v]) => {
  console.log('  ' + k.padEnd(26) + ' ' + v + ' deals');
});

console.log('');
console.log('───────────────────────────────────────────');
console.log('  📌 NEGÓCIOS GANHOS (' + wonDeals.length + ')');
console.log('───────────────────────────────────────────');
let totalWon = 0;
wonDeals.forEach(d => {
  totalWon += d.value;
  console.log('  ' + d.title.padEnd(35) + ' R$ ' + String(d.value).padStart(6) + '  | ' + d.source);
});
console.log('  ' + '─'.repeat(55));
console.log('  VALOR TOTAL GANHO: R$ ' + totalWon);

console.log('');
console.log('───────────────────────────────────────────');
console.log('  📌 MÉTRICAS DE CONVERSÃO');
console.log('───────────────────────────────────────────');
console.log('  Taxa de Conversão (Ganhos):   ' + Math.round((byStatus['Ganho']||0)/total*100) + '%');
console.log('  Taxa de Perda:                ' + Math.round((byStatus['Perdido']||0)/total*100) + '%');
console.log('  Em andamento:                 ' + Math.round((byStatus['Em andamento']||0)/total*100) + '%');

// Source → Won analysis
console.log('');
console.log('───────────────────────────────────────────');
console.log('  📌 CANAIS QUE MAIS CONVERTERAM');
console.log('───────────────────────────────────────────');
const sourceStats = {};
for (const d of deals) {
  const src = (d.customFields||{}).utm_source || 'direto';
  if (!sourceStats[src]) sourceStats[src] = { total: 0, won: 0, lost: 0 };
  sourceStats[src].total++;
  const status = d.dealStatus?.name;
  if (status === 'Ganho') sourceStats[src].won++;
  if (status === 'Perdido') sourceStats[src].lost++;
}
Object.entries(sourceStats)
  .filter(([,v]) => v.won > 0)
  .sort((a,b) => b[1].won - a[1].won)
  .forEach(([src, stats]) => {
    const rate = Math.round(stats.won / stats.total * 100);
    console.log('  ' + src.padEnd(14) + ' ' + stats.won + ' ganhos de ' + stats.total + '  (' + rate + '% conversão)');
  });

console.log('');
console.log('═══════════════════════════════════════════');
console.log('  Fim do relatório.');
console.log('═══════════════════════════════════════════');
