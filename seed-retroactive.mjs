// seed-retroactive.mjs — 50 deals com startTime Jan-Jul 2026 + movimentações no funil
const TOKEN = "636dd6c1-00ea-4256-bd70-86f20007d582";
const BASE = "https://api.agendor.com.br/v3";
const FUNNEL = 900827;

const headers = {
  "Content-Type": "application/json",
  Authorization: `Token ${TOKEN}`,
};

// ─── Bands + sales reps across 7 months ───
const bands = [
  "The Beatles","The Rolling Stones","Led Zeppelin","Pink Floyd","Queen","The Who","Black Sabbath",
  "The Doors","Jimi Hendrix","Janis Joplin","The Kinks","Creedence","Fleetwood Mac","Eagles",
  "Lynyrd Skynyrd","Aerosmith","KISS","AC/DC","Van Halen","Guns N Roses",
  "Def Leppard","Bon Jovi","Motley Crue","Metallica","Megadeth","Slayer","Iron Maiden",
  "Judas Priest","Motorhead","Ozzy Osbourne","Dio","Scorpions","Whitesnake","Deep Purple",
  "Rainbow","Rush","Yes","Genesis","King Crimson","Emerson Lake","Jethro Tull","Santana",
  "The Police","Talking Heads","Blondie","Ramones","The Clash","Sex Pistols","The Cure","Depeche Mode",
];

const reps = [
  "John Lennon","Mick Jagger","Robert Plant","David Gilmour","Freddie Mercury","Roger Daltrey","Ozzy",
  "Jim Morrison","Jimi Hendrix","Janis Joplin","Ray Davies","John Fogerty","Stevie Nicks","Don Henley",
  "Ronnie Van Zant","Steven Tyler","Gene Simmons","Angus Young","Eddie Van Halen","Axl Rose",
  "Joe Elliott","Jon Bon Jovi","Vince Neil","James Hetfield","Dave Mustaine","Tom Araya","Bruce Dickinson",
  "Rob Halford","Lemmy","Ozzy Osbourne","Ronnie James Dio","Klaus Meine","David Coverdale","Ian Gillan",
  "Ritchie Blackmore","Geddy Lee","Jon Anderson","Phil Collins","Robert Fripp","Keith Emerson","Ian Anderson","Carlos Santana",
  "Sting","David Byrne","Debbie Harry","Joey Ramone","Joe Strummer","Johnny Rotten","Robert Smith","Dave Gahan",
];

const utmSources = ["google","facebook","instagram","linkedin","direct","youtube","newsletter","referral","tiktok","twitter"];
const utmMediums = ["cpc","organic","social","email","display","referral","video","banner","sms","paid_social"];
const utmCampaigns = ["lancamento_q1","lancamento_q2","branding_2026","lead_qual","reativacao","webinar","demo_day","black_friday","retargeting","google_ads_pro","meta_ads","cold_outreach","indication","evento_2026","parceria"];

// Month distributions: Jan(8), Feb(7), Mar(7), Apr(7), May(7), Jun(7), Jul(7)
const monthDeals = [8, 7, 7, 7, 7, 7, 7]; // total 50
const months = ["2026-01","2026-02","2026-03","2026-04","2026-05","2026-06","2026-07"];

async function apiCall(method, url, body = null, retries = 3) {
  const opts = { method, headers };
  if (body) opts.body = JSON.stringify(body);
  for (let r = 0; r < retries; r++) {
    try {
      const res = await fetch(url, opts);
      const text = await res.text();
      if (!text.startsWith("{")) throw new Error("Non-JSON response: " + text.slice(0, 100));
      const data = JSON.parse(text);
      return { ok: res.ok, status: res.status, data };
    } catch (e) {
      if (r < retries - 1) { await new Promise(r => setTimeout(r, 1000 * (r + 1))); continue; }
      return { ok: false, status: 0, data: { error: e.message } };
    }
  }
  return { ok: false, status: 0, data: { error: "max retries" } };
}

async function main() {
  let dealIndex = 0;
  const createdDeals = [];

  for (let mi = 0; mi < months.length; mi++) {
    const month = months[mi];
    const count = monthDeals[mi];

    for (let i = 0; i < count; i++) {
      const band = bands[dealIndex % bands.length];
      const rep = reps[dealIndex % reps.length];
      const email = rep.toLowerCase().replace(/[^a-z]/g, "") + "@" + band.toLowerCase().replace(/[^a-z]/g, "") + ".com";
      const phone = "+55" + String(11900000000 + dealIndex);
      const startDate = month + "-" + String((dealIndex % 25) + 1).padStart(2, "0") + "T10:00:00.000Z";

      const utm = {
        source: utmSources[dealIndex % utmSources.length],
        medium: utmMediums[(dealIndex * 3) % utmMediums.length],
        campaign: utmCampaigns[dealIndex % utmCampaigns.length],
      };

      console.log(`[${dealIndex + 1}/50] ${rep} @ ${band} (${month})`);

      // 1. Upsert org (find by name or create)
      const { ok: orgOk, data: orgData } = await apiCall("POST", `${BASE}/organizations/upsert`, {
        name: band,
        contact: { email, whatsapp: phone, mobile: phone },
        leadOrigin: utm.source,
      });
      if (!orgOk) { console.error("  ❌ Org fail:", orgData); dealIndex++; continue; }
      const orgId = orgData.data?.id;
      console.log(`  ✅ Org #${orgId}`);

      // 2. Create deal with startTime
      const { ok: dealOk, data: dealData } = await apiCall("POST", `${BASE}/organizations/${orgId}/deals`, {
        title: `${rep} - ${band}`,
        funnel: FUNNEL,
        startTime: startDate,
        customFields: {
          utm_source: utm.source,
          utm_medium: utm.medium,
          utm_campaign: utm.campaign,
        },
      });
      if (!dealOk) { console.error("  ❌ Deal fail:", dealData); dealIndex++; continue; }
      const dealId = dealData.data?.id;
      console.log(`  ✅ Deal #${dealId} (start: ${startDate.slice(0,10)})`);
      createdDeals.push({ dealId, orgId, startDate, utm, month, rep, band });

      await new Promise(r => setTimeout(r, 400));
      dealIndex++;
    }
  }

  console.log(`\n✅ ${createdDeals.length} deals criados. Agora simulando movimentações...\n`);

  // ─── Simulate movements ───
  for (const d of createdDeals) {
    const monthIndex = months.indexOf(d.month);
    const monthsSinceCreation = 6 - monthIndex; // how many months since then

    // Determine how far this lead progressed based on its age + randomness
    // Older months: more progressed
    const rand = Math.random();
    let stagesToAdvance = 0;
    if (monthsSinceCreation >= 6) stagesToAdvance = 4; // Jan: fully progressed
    else if (monthsSinceCreation >= 5 && rand > 0.2) stagesToAdvance = 4;
    else if (monthsSinceCreation >= 4) stagesToAdvance = rand > 0.3 ? 3 : 2;
    else if (monthsSinceCreation >= 3) stagesToAdvance = rand > 0.4 ? 3 : 1;
    else if (monthsSinceCreation >= 2) stagesToAdvance = rand > 0.5 ? 2 : 1;
    else if (monthsSinceCreation >= 1) stagesToAdvance = rand > 0.6 ? 1 : 0;
    else stagesToAdvance = 0;

    const stageSequence = [1, 2, 3, 4, 5]; // Novo_Lead=1, Em_Cadencia=2, Ja_Conectou=3, Em_Agenda=4, Fez_Reuniao=5

    // Advance stage by stage
    for (let s = 1; s <= stagesToAdvance && s < stageSequence.length; s++) {
      const { ok } = await apiCall("PUT", `${BASE}/deals/${d.dealId}/stage`, {
        dealStage: stageSequence[s],
        funnel: FUNNEL,
      });
      if (!ok) break;
      await new Promise(r => setTimeout(r, 100));
    }

    // Win some, lose some
    if (stagesToAdvance >= 4 && Math.random() > 0.5) {
      // Won
      await apiCall("PUT", `${BASE}/deals/${d.dealId}/status`, {
        dealStatusText: "won",
        value: Math.round(Math.random() * 5000 + 500),
      });
      console.log(`  🏆 Won: ${d.rep} - ${d.band}`);
    } else if (stagesToAdvance >= 2 && Math.random() > 0.7) {
      // Lost
      await apiCall("PUT", `${BASE}/deals/${d.dealId}/status`, { dealStatusText: "lost" });
      console.log(`  ❌ Lost: ${d.rep} - ${d.band}`);
    }

    await new Promise(r => setTimeout(r, 100));
  }

  console.log("\n🎸 Done! 50 deals com movimentações retroativas.");
}

main();
