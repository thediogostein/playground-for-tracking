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
