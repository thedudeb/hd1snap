import { registerSnapHandler } from "@farcaster/snap-hono";
import { Hono } from "hono";
import {
  getSolarPosition,
  getMoonPosition,
  nextTransitions,
  SUN_DAILY_MOTION,
  MOON_DAILY_MOTION,
} from "./ephemeris.js";
import { getGate, type Gate } from "./gates.js";
import { getHexagramGlyph, getHexagramLineRows } from "./hexagrams.js";
import { renderBodyGraph } from "./bodygraph.js";
import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { track } from "./analytics.js";

// ── Static logo asset ───────────────────────────────────────────────────────
// Read once at module init. Vercel's NFT will include the PNG in the bundle
// because it sees the `new URL(..., import.meta.url)` pattern.
const LOGO_URL_REF = new URL("../public/threshold-logo.png", import.meta.url);
const LOGO_BYTES: Buffer | null = (() => {
  try {
    const p = fileURLToPath(LOGO_URL_REF);
    if (existsSync(p)) return readFileSync(p);
  } catch {}
  return null;
})();

const APP_NAME = "Threshold";
const APP_DESC = "Daily Human Design transit — the gate the Sun is crossing right now.";
const PUBLIC_BASE =
  (typeof process !== "undefined" && process.env?.SNAP_PUBLIC_BASE_URL?.replace(/\/$/, "")) ||
  "https://hd1snap.vercel.app";
const LOGO_PUBLIC_URL = `${PUBLIC_BASE}/threshold-logo.png`;
const POSTHOG_KEY  = process.env.POSTHOG_API_KEY ?? "";
const POSTHOG_HOST = (process.env.POSTHOG_HOST ?? "https://us.i.posthog.com").replace(/\/$/, "");

function buildFallbackHtml(title: string, description: string): string {
  const t = title.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/"/g, "&quot;");
  const d = description.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/"/g, "&quot;");
  // Compute today's transit for the landing page preview
  const now = new Date();
  const solar = getSolarPosition(now);
  const moon = getMoonPosition(now);
  const gate = getGate(solar.gate);
  const bodygraphUrl = `${PUBLIC_BASE}/bodygraph.svg?gate=${solar.gate}&line=${solar.line}`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${t}</title>
<meta name="description" content="${d}">
<meta property="og:title" content="${t}">
<meta property="og:description" content="${d}">
<meta property="og:image" content="${LOGO_PUBLIC_URL}">
<meta property="og:image:alt" content="Threshold — daily Human Design transit">
<meta property="og:type" content="website">
<meta property="og:site_name" content="Threshold">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${t}">
<meta name="twitter:description" content="${d}">
<meta name="twitter:image" content="${LOGO_PUBLIC_URL}">
<style>
  *{margin:0;padding:0;box-sizing:border-box}
  @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,600;1,300&family=Raleway:wght@300;400;500&display=swap');
  :root{--purple:#a78bfa;--purple-light:#c4b5fd;--purple-dark:#6d28d9;--bg:#050514;--bg2:#0f0d2a;--text:#c4b5fd;--muted:#5b5878}
  body{background:var(--bg);color:var(--text);font-family:'Cormorant Garamond',Georgia,serif;min-height:100vh;overflow-x:hidden}

  /* starfield */
  .stars{position:fixed;inset:0;pointer-events:none;z-index:0;background:radial-gradient(ellipse at 50% 30%,#1e1b4b 0%,#0b0820 50%,#050514 100%)}
  .stars::before,.stars::after{content:'';position:absolute;inset:0;background-image:radial-gradient(1px 1px at 10% 20%,#fff 0%,transparent 100%),radial-gradient(1px 1px at 30% 60%,#fff 0%,transparent 100%),radial-gradient(1.5px 1.5px at 50% 10%,#c4b5fd 0%,transparent 100%),radial-gradient(1px 1px at 70% 40%,#fff 0%,transparent 100%),radial-gradient(1px 1px at 85% 75%,#fff 0%,transparent 100%),radial-gradient(1.5px 1.5px at 20% 85%,#c4b5fd 0%,transparent 100%),radial-gradient(1px 1px at 65% 90%,#fff 0%,transparent 100%),radial-gradient(1px 1px at 40% 45%,#fff 0%,transparent 100%),radial-gradient(1px 1px at 90% 15%,#c4b5fd 0%,transparent 100%),radial-gradient(1px 1px at 15% 50%,#fff 0%,transparent 100%);animation:twinkle 4s ease-in-out infinite alternate}
  .stars::after{background-image:radial-gradient(1px 1px at 25% 30%,#fff 0%,transparent 100%),radial-gradient(1px 1px at 55% 70%,#fff 0%,transparent 100%),radial-gradient(1.5px 1.5px at 75% 20%,#c4b5fd 0%,transparent 100%),radial-gradient(1px 1px at 45% 80%,#fff 0%,transparent 100%),radial-gradient(1px 1px at 80% 55%,#fff 0%,transparent 100%),radial-gradient(1px 1px at 5% 65%,#c4b5fd 0%,transparent 100%),radial-gradient(1px 1px at 95% 40%,#fff 0%,transparent 100%);animation-delay:2s}
  @keyframes twinkle{0%{opacity:.4}100%{opacity:1}}

  /* layout */
  .wrap{position:relative;z-index:1;max-width:900px;margin:0 auto;padding:60px 24px 80px}

  /* hero */
  .logo{display:block;width:140px;height:140px;object-fit:cover;border-radius:50%;margin:0 auto 32px;box-shadow:0 0 60px rgba(167,139,250,0.4),0 0 120px rgba(109,40,217,0.2)}
  h1{font-size:clamp(36px,8vw,72px);font-weight:300;letter-spacing:14px;text-transform:uppercase;margin-bottom:12px;background:linear-gradient(135deg,#e9d5ff,#a78bfa,#7c3aed);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text}
  .tagline{font-size:18px;font-weight:300;color:var(--muted);letter-spacing:2px;font-style:italic;margin-bottom:48px}

  /* today card */
  .today{background:rgba(167,139,250,0.06);border:1px solid rgba(167,139,250,0.15);border-radius:20px;padding:32px;margin-bottom:48px;display:flex;gap:32px;align-items:center;flex-wrap:wrap;justify-content:center}
  .bodygraph{width:180px;height:180px;flex-shrink:0;border-radius:12px;overflow:hidden;box-shadow:0 0 40px rgba(109,40,217,0.3)}
  .bodygraph img{width:100%;height:100%;object-fit:cover}
  .transit-info{text-align:left;flex:1;min-width:220px}
  .transit-label{font-family:'Raleway',sans-serif;font-size:11px;letter-spacing:3px;text-transform:uppercase;color:var(--muted);margin-bottom:8px}
  .transit-gate{font-size:clamp(22px,4vw,32px);font-weight:600;color:var(--purple-light);margin-bottom:4px}
  .transit-sub{font-size:16px;font-weight:300;color:var(--muted);margin-bottom:20px;font-style:italic}
  .triad{display:flex;gap:8px;flex-wrap:wrap}
  .pill{font-family:'Raleway',sans-serif;font-size:11px;padding:4px 12px;border-radius:999px;letter-spacing:1px}
  .pill-shadow{border:1px solid rgba(167,139,250,0.3);color:var(--muted)}
  .pill-gift{background:rgba(167,139,250,0.2);border:1px solid var(--purple);color:var(--purple-light)}
  .pill-siddhi{border:1px solid rgba(167,139,250,0.3);color:var(--muted)}
  .moon-row{margin-top:16px;font-family:'Raleway',sans-serif;font-size:12px;color:var(--muted);letter-spacing:1px}

  /* features */
  .features{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:16px;margin-bottom:48px}
  .feature{background:rgba(167,139,250,0.04);border:1px solid rgba(167,139,250,0.1);border-radius:14px;padding:24px}
  .feature-icon{font-size:28px;margin-bottom:12px}
  .feature-title{font-size:16px;font-weight:600;color:var(--purple-light);margin-bottom:6px}
  .feature-desc{font-family:'Raleway',sans-serif;font-size:13px;color:var(--muted);line-height:1.6}

  /* CTA */
  .cta-wrap{text-align:center}
  .cta{display:inline-flex;align-items:center;gap:10px;background:linear-gradient(135deg,#7c3aed,#a78bfa);color:#fff;text-decoration:none;padding:16px 36px;border-radius:999px;font-family:'Raleway',sans-serif;font-size:15px;font-weight:500;letter-spacing:2px;text-transform:uppercase;box-shadow:0 0 40px rgba(109,40,217,0.4);transition:all .2s}
  .cta:hover{box-shadow:0 0 60px rgba(167,139,250,0.5);transform:translateY(-2px)}
  .cta-sub{margin-top:16px;font-family:'Raleway',sans-serif;font-size:12px;color:var(--muted);letter-spacing:1px}

  /* divider */
  .divider{border:none;border-top:1px solid rgba(167,139,250,0.1);margin:48px 0}

  @media(max-width:480px){.today{padding:20px}.transit-info{text-align:center}.triad{justify-content:center}.moon-row{text-align:center}}
</style>
${POSTHOG_KEY ? `<script>
!function(t,e){var o,n,p,r;e.__SV||(window.posthog=e,e._i=[],e.init=function(i,s,a){function g(t,e){var o=e.split(".");2==o.length&&(t=t[o[0]],e=o[1]),t[e]=function(){t.push([e].concat(Array.prototype.slice.call(arguments,0)))}}(p=t.createElement("script")).type="text/javascript",p.crossOrigin="anonymous",p.async=!0,p.src=s.api_host.replace(".i.posthog.com","-assets.i.posthog.com")+"/static/array.js",(r=t.getElementsByTagName("script")[0]).parentNode.insertBefore(p,r);var u=e;for(void 0!==a?u=e[a]=[]:a="posthog",u.people=u.people||[],u.toString=function(t){var e="posthog";return"posthog"!==a&&(e+="."+a),t||(e+=" (stub)"),e},u.people.toString=function(){return u.toString(1)+" (stub)"},o="init capture register register_once register_for_session unregister unregister_for_session getFeatureFlag getFeatureFlagPayload isFeatureEnabled reloadFeatureFlags updateEarlyAccessFeatureEnrollment getEarlyAccessFeatures on onFeatureFlags onSessionId getSurveys getActiveMatchingSurveys renderSurvey canRenderSurvey identify setPersonProperties group resetGroups setPersonPropertiesForFlags resetPersonPropertiesForFlags setGroupPropertiesForFlags resetGroupPropertiesForFlags reset get_distinct_id getGroups get_session_id get_session_replay_url alias set_config startSessionRecording stopSessionRecording sessionRecordingStarted captureException loadToolbar get_property getSessionProperty createPersonProfile opt_in_capturing opt_out_capturing has_opted_in_capturing has_opted_out_capturing clear_opt_in_out_capturing debug".split(" "),n=0;n<o.length;n++)g(u,o[n]);e._i.push([i,s,a])},e.__SV=1)}(document,window.posthog||[]);
posthog.init('${POSTHOG_KEY}',{api_host:'${POSTHOG_HOST}',person_profiles:'identified_only'});
posthog.capture('landing_page_viewed',{gate:${solar.gate},gate_name:'${gate.name}',line:${solar.line}});
</script>` : ""}
</head>
<body>
<div class="stars"></div>
<div class="wrap">

  <!-- Hero -->
  <img class="logo" src="${LOGO_PUBLIC_URL}" alt="Threshold">
  <h1>Threshold</h1>
  <p class="tagline">know the gate you're standing in</p>

  <!-- Today's transit live preview -->
  <div class="today">
    <div class="bodygraph">
      <img src="${bodygraphUrl}" alt="Today's BodyGraph">
    </div>
    <div class="transit-info">
      <div class="transit-label">Today's Sun Transit</div>
      <div class="transit-gate">Gate ${solar.gate} · Line ${solar.line}</div>
      <div class="transit-sub">${gate.name} — ${gate.keyword}</div>
      <div class="triad">
        <span class="pill pill-shadow">🌑 ${gate.shadow}</span>
        <span class="pill pill-gift">🎁 ${gate.gift}</span>
        <span class="pill pill-siddhi">✨ ${gate.siddhi}</span>
      </div>
      <div class="moon-row">${moon.emoji} Moon in Gate ${moon.gate} · ${moon.phaseName}</div>
    </div>
  </div>

  <!-- Features -->
  <div class="features">
    <div class="feature">
      <div class="feature-icon">☀️</div>
      <div class="feature-title">Daily Sun Gate</div>
      <div class="feature-desc">The exact gate and line the Sun is crossing today, with its shadow, gift, and siddhi from Richard Rudd's Gene Keys.</div>
    </div>
    <div class="feature">
      <div class="feature-icon">🌙</div>
      <div class="feature-title">Moon Transits</div>
      <div class="feature-desc">The Moon shifts gates every ~10 hours. See what's moving and how long until the next threshold crossing.</div>
    </div>
    <div class="feature">
      <div class="feature-icon">⏳</div>
      <div class="feature-title">Live Countdowns</div>
      <div class="feature-desc">Exact time remaining until the Sun and Moon enter their next gate and line — down to the minute.</div>
    </div>
    <div class="feature">
      <div class="feature-icon">🔮</div>
      <div class="feature-title">Animated BodyGraph</div>
      <div class="feature-desc">A stylized HD bodygraph with the active center glowing and pulsing — beautiful enough to screenshot and share.</div>
    </div>
  </div>

  <hr class="divider">

  <!-- CTA -->
  <div class="cta-wrap">
    <a class="cta" href="https://farcaster.xyz">
      <svg width="18" height="16" viewBox="0 0 520 457" fill="currentColor"><path d="M519.801 0V61.6809H458.172V123.31H477.054V123.331H519.801V456.795H416.57L416.507 456.49L363.832 207.03C358.81 183.251 345.667 161.736 326.827 146.434C307.988 131.133 284.255 122.71 260.006 122.71H259.8C235.551 122.71 211.818 131.133 192.979 146.434C174.139 161.736 160.996 183.259 155.974 207.03L103.239 456.795H0V123.323H42.7471V123.31H61.6262V61.6809H0V0H519.801Z"/></svg>
      Open in Farcaster
    </a>
    <p class="cta-sub">Threshold lives as an interactive snap inside the Farcaster app</p>
  </div>

</div>
</body>
</html>`;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(date: Date): string {
  return date.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

function formatDuration(ms: number): string {
  if (ms < 0) ms = 0;
  const totalMinutes = Math.floor(ms / 60_000);
  const days = Math.floor(totalMinutes / (60 * 24));
  const hours = Math.floor((totalMinutes % (60 * 24)) / 60);
  const minutes = totalMinutes % 60;
  if (days > 0)  return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

function zodiacSign(longitude: number): string {
  const signs = [
    "Aries", "Taurus", "Gemini", "Cancer", "Leo", "Virgo",
    "Libra", "Scorpio", "Sagittarius", "Capricorn", "Aquarius", "Pisces",
  ];
  return signs[Math.floor(((longitude % 360) + 360) % 360 / 30)];
}

function getBaseUrl(ctx?: any): string {
  // Prefer the request's own origin so we always POST back to the same deployment.
  try {
    const req = ctx?.request as Request | undefined;
    if (req?.url) return new URL(req.url).origin;
  } catch {}
  return (
    (typeof globalThis !== "undefined" && (globalThis as any).process?.env?.SNAP_PUBLIC_BASE_URL) ??
    "http://localhost:3000"
  );
}

// ── Page builders ─────────────────────────────────────────────────────────────

function buildSpectrumBlurb(
  type: "shadow" | "gift" | "siddhi",
  gateNumber: number,
  gate: Gate,
  term: string,
): string {
  const lower = term.toLowerCase();
  if (type === "shadow") {
    return `In Gate ${gateNumber} (${gate.name}), the shadow shows up as ${lower} — the unconscious, reactive expression of "${gate.keyword}". This is the pattern of fear and contraction that runs the gate when you're on autopilot. Recognising it in yourself is the first step to transmuting it into the gift.`;
  }
  if (type === "gift") {
    return `The gift of Gate ${gateNumber} (${gate.name}) is ${lower} — what becomes available when the shadow of "${gate.keyword}" is met with awareness. This is the gate in conscious service: your unique creative contribution flowing through this archetype.`;
  }
  return `The siddhi of Gate ${gateNumber} (${gate.name}) is ${lower} — the fully realised, transcendent frequency of "${gate.keyword}". Beyond personality and effort, this is the highest expression of the gate, glimpsed in moments of grace and union with the whole.`;
}

const SPECTRUM_INFO = {
  shadow: {
    title: "🌑 The Shadow",
    blurb:
      "The unconscious, reactive frequency of a gate — the patterns of fear, blame, and contraction we fall into when we're running on autopilot. Recognizing the Shadow is the first step to transmuting it.",
  },
  gift: {
    title: "🎁 The Gift",
    blurb:
      "The conscious, embodied frequency — what becomes available when the Shadow is met with awareness. The Gift is your unique creative contribution; the gene key in service to life.",
  },
  siddhi: {
    title: "✨ The Siddhi",
    blurb:
      "The transcendent, fully realized frequency — pure essence beyond the personal self. The Siddhi is the highest expression of a gate, glimpsed in moments of grace and union.",
  },
} as const;

function buildMainPage(ctx?: any) {
  const now   = new Date();
  const solar = getSolarPosition(now);
  const moon  = getMoonPosition(now);
  const gate  = getGate(solar.gate);
  const line  = gate.lines[solar.line - 1];
  const sign  = zodiacSign(solar.longitude);
  const base  = getBaseUrl(ctx);

  // Read ?expand=shadow|gift|siddhi to reveal an inline panel under the buttons
  let expand: "shadow" | "gift" | "siddhi" | null = null;
  try {
    const url = new URL((ctx?.request as Request).url);
    const e = url.searchParams.get("expand");
    if (e === "shadow" || e === "gift" || e === "siddhi") expand = e;
  } catch {}
  const expanded = expand !== null;
  const expandInfo = expand ? SPECTRUM_INFO[expand] : null;
  const expandTerm = expand ? gate[expand] : "";

  const glyph = getHexagramGlyph(solar.gate);
  const lineRows = getHexagramLineRows(solar.gate);
  const bodygraphUrl = `${base}/bodygraph.svg?gate=${solar.gate}&line=${solar.line}`;

  // Transition countdowns
  const sunNext  = nextTransitions(solar.longitude, SUN_DAILY_MOTION);
  const moonNext = nextTransitions(moon.longitude,  MOON_DAILY_MOTION);
  const sunGate = getGate(sunNext.nextGate);
  const moonGate = getGate(moonNext.nextGate);

  const sunCountdown  = `☀ Sun enters Gate ${sunNext.nextGate} (${sunGate.name}) in ${formatDuration(sunNext.msUntilNextGate)} · Line ${sunNext.nextLine} in ${formatDuration(sunNext.msUntilNextLine)}`;
  const moonCountdown = `🌙 Moon enters Gate ${moonNext.nextGate} (${moonGate.name}) in ${formatDuration(moonNext.msUntilNextGate)} · Line ${moonNext.nextLine} in ${formatDuration(moonNext.msUntilNextLine)}`;

  return {
    version: "1.0" as const,
    theme: { accent: "purple" as const },
    ui: {
      root: "page",
      elements: {
        page: {
          type: "stack" as const,
          props: { gap: "md" as const },
          children: [
            "header_item",
            "divider1",
            "bodygraph_image",
            "gate_item",
            "sun_countdown",
            "divider2",
            "keywords_row",
            ...(expanded ? ["expand_panel", "expand_text", "btn_close_expand"] : []),
            "reflection_text",
            "divider3",
            "moon_item",
            "moon_countdown",
            "divider4",
            "btn_detail",
            "btn_share",
          ],
        },

        header_item: {
          type: "item" as const,
          props: {
            title: "☀ Human Design Daily Transit",
            description: `${formatDate(now)} · Sun in ${sign}`,
          },
        },

        divider1: { type: "separator" as const, props: {} },

        // 🌌 Animated HD BodyGraph — pulses today's active center
        bodygraph_image: {
          type: "image" as const,
          props: {
            url: bodygraphUrl,
            aspect: "1:1" as const,
            alt: `Human Design BodyGraph showing active gate ${solar.gate}`,
          },
        },

        gate_item: {
          type: "item" as const,
          props: {
            title: `Gate ${solar.gate} · Line ${solar.line} — ${gate.name}`,
            description: `${line.name}: ${line.theme}`,
          },
        },

        sun_countdown: {
          type: "text" as const,
          props: { content: sunCountdown, size: "sm" as const },
        },

        divider2: { type: "separator" as const, props: {} },

        keywords_row: {
          type: "stack" as const,
          props: { direction: "vertical" as const, gap: "sm" as const },
          children: ["btn_shadow", "btn_gift", "btn_siddhi"],
        },
        btn_shadow: {
          type: "button" as const,
          props: {
            label: `🌑 Shadow · ${gate.shadow}`,
            variant: (expand === "shadow" ? "primary" as const : "secondary" as const),
          },
          on: { press: { action: "submit" as const, params: { target: `${base}/?expand=${expand === "shadow" ? "" : "shadow"}` } } },
        },
        btn_gift: {
          type: "button" as const,
          props: {
            label: `🎁 Gift · ${gate.gift}`,
            variant: (expand === "gift" ? "primary" as const : "secondary" as const),
          },
          on: { press: { action: "submit" as const, params: { target: `${base}/?expand=${expand === "gift" ? "" : "gift"}` } } },
        },
        btn_siddhi: {
          type: "button" as const,
          props: {
            label: `✨ Siddhi · ${gate.siddhi}`,
            variant: (expand === "siddhi" ? "primary" as const : "secondary" as const),
          },
          on: { press: { action: "submit" as const, params: { target: `${base}/?expand=${expand === "siddhi" ? "" : "siddhi"}` } } },
        },

        ...(expanded
          ? {
              expand_panel: {
                type: "item" as const,
                props: {
                  title: `${expandInfo!.title} of Gate ${solar.gate} — ${expandTerm}`,
                  description: `${gate.name} · ${gate.keyword}`,
                },
              },
              expand_text: {
                type: "text" as const,
                props: {
                  content: gate.quote
                    ? `${buildSpectrumBlurb(expand!, solar.gate, gate, expandTerm as string)}\n\n${gate.quote}`
                    : buildSpectrumBlurb(expand!, solar.gate, gate, expandTerm as string),
                  size: "sm" as const,
                },
              },
              btn_close_expand: {
                type: "button" as const,
                props: { label: "Close", variant: "secondary" as const },
                on: { press: { action: "submit" as const, params: { target: `${base}/` } } },
              },
            }
          : {}),

        reflection_text: {
          type: "text" as const,
          props: { content: gate.reflection, size: "sm" as const },
        },

        divider3: { type: "separator" as const, props: {} },

        // Moon row — item with badge in the action slot
        moon_item: {
          type: "item" as const,
          props: {
            title: `${moon.emoji} ${moon.phaseName}`,
            description: `Moon in Gate ${moon.gate} (${getGate(moon.gate).name}) · Line ${moon.line}`,
          },
        },

        moon_countdown: {
          type: "text" as const,
          props: { content: moonCountdown, size: "sm" as const },
        },

        divider4: { type: "separator" as const, props: {} },

        btn_detail: {
          type: "button" as const,
          props: { label: `Explore Gate ${solar.gate}`, variant: "primary" as const },
          on: {
            press: {
              action: "submit" as const,
              params: { target: `${base}/detail` },
            },
          },
        },
        btn_share: {
          type: "button" as const,
          props: { label: "Share Today's Transit", variant: "secondary" as const },
          on: {
            press: {
              action: "compose_cast" as const,
              params: {
                text: `Gate ${solar.gate} · Line ${solar.line} — ${gate.name}\n\n"${gate.reflection}"\n\nCheck today's HD transit:`,
                embeds: [`${base}/`],
              },
            },
          },
        },
      },
    },
  };
}

function buildDetailPage(gateNumber: number, activeLine: number, ctx?: any) {
  const gate: Gate = getGate(gateNumber);
  const base = getBaseUrl(ctx);

  return {
    version: "1.0" as const,
    theme: { accent: "purple" as const },
    ui: {
      root: "page",
      elements: {
        page: {
          type: "stack" as const,
          props: { gap: "md" as const },
          children: [
            "heading",
            "circuit_badge",
            "divider1",
            "kw_header",
            "keywords_row",
            "divider2",
            "lines_header",
            "line1", "line2", "line3", "line4", "line5", "line6",
            "divider3",
            "btn_back",
          ],
        },

        heading: {
          type: "text" as const,
          props: { content: `Gate ${gateNumber}: ${gate.name}`, weight: "bold" as const },
        },
        circuit_badge: {
          type: "badge" as const,
          props: { label: `${gate.circuit} Circuit · ${gate.keyword}` },
        },

        divider1: { type: "separator" as const, props: {} },

        kw_header: {
          type: "text" as const,
          props: { content: "Gene Keys Spectrum", weight: "bold" as const, size: "sm" as const },
        },
        keywords_row: {
          type: "stack" as const,
          props: { direction: "horizontal" as const, gap: "sm" as const },
          children: ["badge_shadow", "badge_gift", "badge_siddhi"],
        },
        badge_shadow: {
          type: "badge" as const,
          props: { label: `Shadow: ${gate.shadow}`, variant: "outline" as const },
        },
        badge_gift: {
          type: "badge" as const,
          props: { label: `Gift: ${gate.gift}` },
        },
        badge_siddhi: {
          type: "badge" as const,
          props: { label: `Siddhi: ${gate.siddhi}`, variant: "outline" as const },
        },

        divider2: { type: "separator" as const, props: {} },

        lines_header: {
          type: "text" as const,
          props: { content: "The 6 Lines", weight: "bold" as const, size: "sm" as const },
        },

        line1: {
          type: "text" as const,
          props: {
            content: `${activeLine === 1 ? "→ " : ""}1. ${gate.lines[0].name} — ${gate.lines[0].theme}`,
            size: "sm" as const,
            weight: activeLine === 1 ? ("bold" as const) : undefined,
          },
        },
        line2: {
          type: "text" as const,
          props: {
            content: `${activeLine === 2 ? "→ " : ""}2. ${gate.lines[1].name} — ${gate.lines[1].theme}`,
            size: "sm" as const,
            weight: activeLine === 2 ? ("bold" as const) : undefined,
          },
        },
        line3: {
          type: "text" as const,
          props: {
            content: `${activeLine === 3 ? "→ " : ""}3. ${gate.lines[2].name} — ${gate.lines[2].theme}`,
            size: "sm" as const,
            weight: activeLine === 3 ? ("bold" as const) : undefined,
          },
        },
        line4: {
          type: "text" as const,
          props: {
            content: `${activeLine === 4 ? "→ " : ""}4. ${gate.lines[3].name} — ${gate.lines[3].theme}`,
            size: "sm" as const,
            weight: activeLine === 4 ? ("bold" as const) : undefined,
          },
        },
        line5: {
          type: "text" as const,
          props: {
            content: `${activeLine === 5 ? "→ " : ""}5. ${gate.lines[4].name} — ${gate.lines[4].theme}`,
            size: "sm" as const,
            weight: activeLine === 5 ? ("bold" as const) : undefined,
          },
        },
        line6: {
          type: "text" as const,
          props: {
            content: `${activeLine === 6 ? "→ " : ""}6. ${gate.lines[5].name} — ${gate.lines[5].theme}`,
            size: "sm" as const,
            weight: activeLine === 6 ? ("bold" as const) : undefined,
          },
        },

        divider3: { type: "separator" as const, props: {} },

        btn_back: {
          type: "button" as const,
          props: { label: "Back to Today's Transit", variant: "primary" as const },
          on: {
            press: {
              action: "submit" as const,
              params: { target: `${base}/` },
            },
          },
        },
      },
    },
  };
}

function buildSpectrumPage(gateNumber: number, type: "shadow" | "gift" | "siddhi", ctx?: any) {
  const gate = getGate(gateNumber);
  const info = SPECTRUM_INFO[type];
  const term = gate[type];
  const base = getBaseUrl(ctx);

  return {
    version: "1.0" as const,
    theme: { accent: "purple" as const },
    ui: {
      root: "page",
      elements: {
        page: {
          type: "stack" as const,
          props: { gap: "md" as const },
          children: ["header", "term_item", "divider1", "blurb", "divider2", "btn_back"],
        },
        header: {
          type: "text" as const,
          props: { content: info.title, weight: "bold" as const, size: "lg" as const },
        },
        term_item: {
          type: "item" as const,
          props: {
            title: `${term}`,
            description: `Gate ${gateNumber} · ${gate.name}`,
          },
        },
        divider1: { type: "separator" as const, props: {} },
        blurb: {
          type: "text" as const,
          props: { content: info.blurb, size: "sm" as const },
        },
        divider2: { type: "separator" as const, props: {} },
        btn_back: {
          type: "button" as const,
          props: { label: "← Back to Today's Transit", variant: "primary" as const },
          on: { press: { action: "submit" as const, params: { target: `${base}/` } } },
        },
      },
    },
  };
}

// ── App + routes ──────────────────────────────────────────────────────────────

const app = new Hono();

// Serve the Threshold logo PNG (used as the OG / embed image)
app.get("/threshold-logo.png", (c) => {
  if (!LOGO_BYTES) return c.notFound();
  return new Response(new Uint8Array(LOGO_BYTES), {
    headers: {
      "content-type": "image/png",
      "cache-control": "public, max-age=3600, s-maxage=86400, immutable",
    },
  });
});

// Serve the animated bodygraph SVG
app.get("/bodygraph.svg", (c) => {
  const gate = Number(c.req.query("gate") ?? "1");
  const line = Number(c.req.query("line") ?? "1");
  const svg = renderBodyGraph(
    Number.isFinite(gate) && gate >= 1 && gate <= 64 ? gate : 1,
    Number.isFinite(line) && line >= 1 && line <= 6 ? line : 1,
  );
  return new Response(svg, {
    headers: {
      "content-type": "image/svg+xml; charset=utf-8",
      "cache-control": "public, max-age=300, s-maxage=3600",
    },
  });
});

// Main transit page — GET and back-button POST both serve the same page
function fidFromCtx(ctx: any): number | undefined {
  try { return ctx?.action?.interactor?.fid ?? undefined; } catch { return undefined; }
}

// Browser requests (Accept: text/html) get the dynamic landing page —
// computed per-request so today's gate is always live. Snap clients
// (Accept: application/octet-stream) fall through to snap-hono below.
app.use("/", async (c, next) => {
  const accept = c.req.header("Accept") ?? "";
  if (c.req.method === "GET" && accept.includes("text/html")) {
    return c.html(buildFallbackHtml(APP_NAME, APP_DESC));
  }
  return next();
});

registerSnapHandler(app, async (ctx) => {
  const solar = getSolarPosition(new Date());
  const gate  = getGate(solar.gate);
  track({ event: "snap_opened", gate: solar.gate, line: solar.line, gate_name: gate.name }, fidFromCtx(ctx));
  return buildMainPage(ctx);
}, { path: "/", og: false });

// Detail page
registerSnapHandler(
  app,
  async (ctx) => {
    const solar = getSolarPosition(new Date());
    const gate  = getGate(solar.gate);
    track({ event: "detail_viewed", gate: solar.gate, line: solar.line, gate_name: gate.name }, fidFromCtx(ctx));
    return buildDetailPage(solar.gate, solar.line, ctx);
  },
  { path: "/detail", og: false },
);

// Spectrum page (shadow / gift / siddhi description)
registerSnapHandler(
  app,
  async (ctx) => {
    const url = new URL((ctx as any).request.url);
    const typeParam = url.searchParams.get("type");
    const type: "shadow" | "gift" | "siddhi" =
      typeParam === "gift" || typeParam === "siddhi" ? typeParam : "shadow";
    const solar = getSolarPosition(new Date());
    track({ event: "spectrum_expanded", gate: solar.gate, type }, fidFromCtx(ctx));
    return buildSpectrumPage(solar.gate, type, ctx);
  },
  { path: "/spectrum", og: false },
);

export default app;

// Local dev server — only when explicitly run via `npm run dev`
if (process.env.SNAP_LOCAL_DEV === "1") {
  const { serve } = await import("@hono/node-server");
  const port = Number(process.env.PORT ?? 3000);
  serve({ fetch: app.fetch, port }, () => {
    console.log(`HD Transit snap → http://localhost:${port}`);
  });
}
