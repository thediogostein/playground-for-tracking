// seed-agendor.mjs — Populate 30 test deals with rock bands
// Usage: node seed-agendor.mjs

const TOKEN = "636dd6c1-00ea-4256-bd70-86f20007d582";
const BASE = "https://api.agendor.com.br/v3";
const FUNNEL = 900827;

const headers = {
  "Content-Type": "application/json",
  "Authorization": `Token ${TOKEN}`,
};

// ─── Rock band data ───
const rockStars = [
  { band: "Metallica",        name: "James Hetfield",     email: "james@metallica.com",    phone: "+5511991010101" },
  { band: "Iron Maiden",      name: "Bruce Dickinson",    email: "bruce@ironmaiden.com",   phone: "+5511992020202" },
  { band: "Pink Floyd",       name: "David Gilmour",      email: "david@pinkfloyd.com",    phone: "+5511993030303" },
  { band: "Led Zeppelin",     name: "Robert Plant",       email: "robert@ledzeppelin.com", phone: "+5511994040404" },
  { band: "Black Sabbath",    name: "Ozzy Osbourne",      email: "ozzy@blacksabbath.com",  phone: "+5511995050505" },
  { band: "Queen",            name: "Freddie Mercury",    email: "freddie@queen.com",      phone: "+5511996060606" },
  { band: "AC/DC",            name: "Angus Young",        email: "angus@acdc.com",         phone: "+5511997070707" },
  { band: "The Rolling Stones", name: "Mick Jagger",      email: "mick@rollingstones.com", phone: "+5511998080808" },
  { band: "Deep Purple",      name: "Ian Gillan",         email: "ian@deeppurple.com",     phone: "+5511999090909" },
  { band: "Guns N Roses",     name: "Axl Rose",           email: "axl@gunsnroses.com",     phone: "+5511981010101" },
  { band: "Nirvana",          name: "Kurt Cobain",        email: "kurt@nirvana.com",       phone: "+5511982020202" },
  { band: "Pearl Jam",        name: "Eddie Vedder",       email: "eddie@pearljam.com",     phone: "+5511983030303" },
  { band: "Soundgarden",      name: "Chris Cornell",      email: "chris@soundgarden.com",  phone: "+5511984040404" },
  { band: "Alice in Chains",  name: "Layne Staley",       email: "layne@aliceinchains.com", phone: "+5511985050505" },
  { band: "Foo Fighters",     name: "Dave Grohl",         email: "dave@foofighters.com",   phone: "+5511986060606" },
  { band: "Red Hot Chili Peppers", name: "Anthony Kiedis", email: "anthony@rhcp.com",      phone: "+5511987070707" },
  { band: "Radiohead",        name: "Thom Yorke",         email: "thom@radiohead.com",     phone: "+5511988080808" },
  { band: "U2",               name: "Bono",               email: "bono@u2.com",            phone: "+5511989090909" },
  { band: "Aerosmith",        name: "Steven Tyler",       email: "steven@aerosmith.com",   phone: "+5511971010101" },
  { band: "Van Halen",        name: "Eddie Van Halen",    email: "eddie@vanhalen.com",     phone: "+5511972020202" },
  { band: "The Who",          name: "Roger Daltrey",      email: "roger@thewho.com",       phone: "+5511973030303" },
  { band: "Kiss",             name: "Gene Simmons",       email: "gene@kiss.com",          phone: "+5511974040404" },
  { band: "Rush",             name: "Geddy Lee",          email: "geddy@rush.com",         phone: "+5511975050505" },
  { band: "Yes",              name: "Jon Anderson",       email: "jon@yesband.com",        phone: "+5511976060606" },
  { band: "Genesis",          name: "Phil Collins",       email: "phil@genesis.com",       phone: "+5511977070707" },
  { band: "The Doors",        name: "Jim Morrison",       email: "jim@thedoors.com",       phone: "+5511978080808" },
  { band: "Cream",            name: "Eric Clapton",       email: "eric@cream.com",         phone: "+5511979090909" },
  { band: "The Police",       name: "Sting",              email: "sting@thepolice.com",    phone: "+5511961010101" },
  { band: "Dire Straits",     name: "Mark Knopfler",      email: "mark@direstraits.com",   phone: "+5511962020202" },
  { band: "Scorpions",        name: "Klaus Meine",        email: "klaus@scorpions.com",    phone: "+5511963030303" },
];

// ─── UTM variations (distributed across 30 entries) ───
const utmPool = {
  sources:     ["google","facebook","instagram","linkedin","youtube","newsletter","tiktok","direct","twitter","referral"],
  mediums:     ["cpc","organic","social","email","display","referral","paid_social","video","banner","sms"],
  campaigns:   ["lancamento_q1","lancamento_q2","branding_2026","lead_qualification","reativacao","webinar_series","demo_day","free_trial","referral_program","black_friday_2026","google_ads_pro","meta_ads_pro","retargeting","cold_outreach","conteudo_organico"],
  terms:       ["vendas+b2b","automacao+comercial","crm+para+empresas","gestao+de+vendas","software+de+vendas","pipeline+vendas","crm+online","erp+vendas",""],
  contents:    ["banner_topo","sidebar","popup","hero_video","cta_button","footer_link","email_sig","story_ads","feed_ad","carousel"],
};

function pick(arr, i) {
  return arr[i % arr.length];
}

const revenues = ["ate-10k","10k-50k","50k-200k","200k-500k","500k-1m","1m-5m","5m-10m","acima-10m","nao-informar"];

async function main() {
  for (let i = 0; i < rockStars.length; i++) {
    const { band, name, email, phone } = rockStars[i];
    const revenue = revenues[i % revenues.length];
    const utms = {
      utm_source: pick(utmPool.sources, i),
      utm_medium: pick(utmPool.mediums, i),
      utm_campaign: pick(utmPool.campaigns, i),
      utm_term: i < 25 ? pick(utmPool.terms, i) : "",
      utm_content: pick(utmPool.contents, i * 3),
    };

    console.log(`\n[${i + 1}/30] Criando ${band} (${name})...`);

    // 1. Create organization
    let orgRes;
    try {
      orgRes = await fetch(`${BASE}/organizations`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          name: band,
          description: `Banda de rock cadastrada via seed automático — ${revenue}`,
          contact: {
            email: email,
            whatsapp: phone,
            mobile: phone,
          },
          leadOrigin: pick(utmPool.sources, i),
        }),
      });
    } catch (err) {
      console.error(`  ❌ Erro rede ao criar org: ${err.message}`);
      continue;
    }

    const orgData = await orgRes.json();
    if (!orgRes.ok) {
      console.error(`  ❌ Org fail (${orgRes.status}):`, JSON.stringify(orgData).slice(0, 200));
      continue;
    }
    const orgId = orgData.data?.id;
    console.log(`  ✅ Org #${orgId}`);

    // 2. Create deal
    let dealRes;
    try {
      dealRes = await fetch(`${BASE}/organizations/${orgId}/deals`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          title: `${name} - ${band}`,
          funnel: FUNNEL,
          customFields: {
            utm_source: utms.utm_source,
            utm_medium: utms.utm_medium,
            utm_campaign: utms.utm_campaign,
            utm_term: utms.utm_term,
            utm_content: utms.utm_content,
          },
        }),
      });
    } catch (err) {
      console.error(`  ❌ Erro rede ao criar deal: ${err.message}`);
      continue;
    }

    const dealData = await dealRes.json();
    if (!dealRes.ok) {
      console.error(`  ❌ Deal fail (${dealRes.status}):`, JSON.stringify(dealData).slice(0, 200));
    } else {
      console.log(`  ✅ Deal #${dealData.data?.id} — ${utms.utm_source}/${utms.utm_medium}/${utms.utm_campaign}`);
    }

    // Small delay to avoid rate limits
    await new Promise(r => setTimeout(r, 300));
  }

  console.log("\n🎸 Done! 30 rock bands seeded into Agendor.");
}

main();
