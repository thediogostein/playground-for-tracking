// functions/api/reports.ts — Proxy para Agendor API (protegida por Cloudflare Access)
export const onRequestGet: PagesFunction = async (context) => {
  const url = new URL(context.request.url);
  const type = url.searchParams.get("type") || "dashboard";

  const agendorToken = (context.env as any).AGENDOR_API_TOKEN;
  if (!agendorToken) {
    return new Response(JSON.stringify({ error: "Agendor não configurado." }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  const headers = {
    "Content-Type": "application/json",
    "Authorization": `Token ${agendorToken}`,
  };

  try {
    switch (type) {
      case "dashboard": {
        // Deal status counts + stage distribution
        const [dealsRes, stagesRes] = await Promise.all([
          fetch("https://api.agendor.com.br/v3/deals?per_page=100&withCustomFields=true", { headers }),
          fetch("https://api.agendor.com.br/v3/deal_stages?funnel=900827", { headers }),
        ]);
        const dealsData = await dealsRes.json() as any;
        const stagesData = await stagesRes.json() as any;
        const deals = dealsData.data || [];
        const stages = stagesData.data || [];

        const byStatus: Record<string, number> = {};
        const byStage: Record<string, number> = {};
        const bySource: Record<string, number> = {};
        let totalValue = 0;
        let wonValue = 0;

        for (const d of deals) {
          const status = d.dealStatus?.name || "?";
          byStatus[status] = (byStatus[status] || 0) + 1;
          const stage = d.dealStage?.name || "?";
          byStage[stage] = (byStage[stage] || 0) + 1;
          const src = d.customFields?.utm_source || "direto";
          bySource[src] = (bySource[src] || 0) + 1;
          if (d.value) totalValue += d.value;
          if (status === "Ganho" && d.value) wonValue += d.value;
        }

        return new Response(JSON.stringify({
          total: deals.length,
          byStatus,
          byStage,
          bySource,
          stages: stages.map((s: any) => ({ id: s.id, name: s.name, sequence: s.sequenceNumber })),
          totalValue,
          wonValue,
        }), { headers: { "Content-Type": "application/json" } });
      }

      case "funnel": {
        // Stage x Status cross-tabulation
        const dealsRes = await fetch("https://api.agendor.com.br/v3/deals?per_page=100&withCustomFields=true", { headers });
        const dealsData = await dealsRes.json() as any;
        const deals = dealsData.data || [];

        const stageOrder = ["Novo_Lead", "Em_Cadencia", "Ja_Conectou", "Em_Agenda", "Fez_Reuniao"];
        const statusOrder = ["Em andamento", "Ganho", "Perdido"];

        const matrix: Record<string, Record<string, number>> = {};
        for (const s of stageOrder) {
          matrix[s] = {};
          for (const ss of statusOrder) matrix[s][ss] = 0;
        }

        // Detail per deal with UTMs
        const details: any[] = [];

        for (const d of deals) {
          const stage = d.dealStage?.name || "?";
          const status = d.dealStatus?.name || "?";
          if (matrix[stage]) {
            matrix[stage][status] = (matrix[stage][status] || 0) + 1;
          }
          details.push({
            id: d.id,
            title: d.title,
            org: d.organization?.name,
            stage,
            status,
            value: d.value || 0,
            utm_source: d.customFields?.utm_source || "",
            utm_medium: d.customFields?.utm_medium || "",
            utm_campaign: d.customFields?.utm_campaign || "",
            createdAt: d.createdAt,
          });
        }

        return new Response(JSON.stringify({ matrix, stageOrder, statusOrder, details }), {
          headers: { "Content-Type": "application/json" },
        });
      }

      case "marketing": {
        // UTM analysis
        const dealsRes = await fetch("https://api.agendor.com.br/v3/deals?per_page=100&withCustomFields=true", { headers });
        const dealsData = await dealsRes.json() as any;
        const deals = dealsData.data || [];

        const sourceStats: Record<string, { total: number; won: number; lost: number; ongoing: number; value: number }> = {};
        const mediumStats: Record<string, { total: number; won: number }> = {};
        const campaignStats: Record<string, { total: number; won: number }> = {};

        for (const d of deals) {
          const cf = d.customFields || {};
          const src = cf.utm_source || "direto";
          const med = cf.utm_medium || "direto";
          const camp = cf.utm_campaign || "direto";
          const status = d.dealStatus?.name || "?";

          if (!sourceStats[src]) sourceStats[src] = { total: 0, won: 0, lost: 0, ongoing: 0, value: 0 };
          sourceStats[src].total++;
          if (status === "Ganho") { sourceStats[src].won++; if (d.value) sourceStats[src].value += d.value; }
          if (status === "Perdido") sourceStats[src].lost++;
          if (status === "Em andamento") sourceStats[src].ongoing++;

          if (!mediumStats[med]) mediumStats[med] = { total: 0, won: 0 };
          mediumStats[med].total++;
          if (status === "Ganho") mediumStats[med].won++;

          if (!campaignStats[camp]) campaignStats[camp] = { total: 0, won: 0 };
          campaignStats[camp].total++;
          if (status === "Ganho") campaignStats[camp].won++;
        }

        return new Response(JSON.stringify({ sourceStats, mediumStats, campaignStats }), {
          headers: { "Content-Type": "application/json" },
        });
      }

      case "metas": {
        // Funnel cascade: each stage's target depends on actual count of previous stage
        const dealsRes = await fetch("https://api.agendor.com.br/v3/deals?per_page=100&withCustomFields=true", { headers });
        const dealsData = await dealsRes.json() as any;
        const deals = dealsData.data || [];

        const stageOrder = ["Novo_Lead", "Em_Cadencia", "Ja_Conectou", "Em_Agenda", "Fez_Reuniao"];
        const targets: Record<string, number> = {
          "Em_Cadencia": 100,
          "Ja_Conectou": 60,
          "Em_Agenda": 30,
          "Fez_Reuniao": 10,
        };

        // Count deals per stage
        const actuals: Record<string, number> = {};
        for (const s of stageOrder) actuals[s] = 0;
        const won = deals.filter((d: any) => d.dealStatus?.name === "Ganho").length;

        for (const d of deals) {
          const stage = d.dealStage?.name || "?";
          if (actuals[stage] !== undefined) actuals[stage]++;
        }

        // Build cascade
        const funnel: any[] = [];
        for (let i = 1; i < stageOrder.length; i++) {
          const stage = stageOrder[i];
          const dependsOn = stageOrder[i - 1];
          const previousReal = actuals[dependsOn] || 0;
          const pctTarget = targets[stage] || 0;
          const target = Math.round(previousReal * pctTarget / 100);
          const actual = actuals[stage] || 0;
          const pct = target > 0 ? Math.round(actual / target * 100) : 0;
          const gap = actual - target;

          funnel.push({ stage, dependsOn, previousReal, target, actual, pct, gap });
        }

        // Indicators
        const novoLead = actuals["Novo_Lead"] || 1; // avoid div by zero
        const fezReuniao = actuals["Fez_Reuniao"] || 0;
        const emCadencia = actuals["Em_Cadencia"] || 0;
        const jaConectou = actuals["Ja_Conectou"] || 0;
        const emAgenda = actuals["Em_Agenda"] || 0;

        const indicators = [
          { label: "Leads → Vendas", pct: Math.round(won / novoLead * 100), numerator: won, denominator: novoLead },
          { label: "Leads → Reunião", pct: Math.round(fezReuniao / novoLead * 100), numerator: fezReuniao, denominator: novoLead },
          { label: "Novo → Cadencia", pct: Math.round(emCadencia / novoLead * 100), numerator: emCadencia, denominator: novoLead },
          { label: "Cadencia → Conectou", pct: emCadencia > 0 ? Math.round(jaConectou / emCadencia * 100) : 0, numerator: jaConectou, denominator: emCadencia },
          { label: "Conectou → Agenda", pct: jaConectou > 0 ? Math.round(emAgenda / jaConectou * 100) : 0, numerator: emAgenda, denominator: jaConectou },
          { label: "Agenda → Reunião", pct: emAgenda > 0 ? Math.round(fezReuniao / emAgenda * 100) : 0, numerator: fezReuniao, denominator: emAgenda },
        ];

        return new Response(JSON.stringify({ funnel, indicators, won, total: deals.length }), {
          headers: { "Content-Type": "application/json" },
        });
      }

      default:
        return new Response(JSON.stringify({ error: "Tipo de relatório inválido." }), {
          status: 400,
          headers: { "Content-Type": "application/json" },
        });
    }
  } catch (err: any) {
    return new Response(JSON.stringify({ error: "Erro ao consultar Agendor.", detail: err.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
};
