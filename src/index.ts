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
registerSnapHandler(app, async (ctx) => buildMainPage(ctx), { path: "/" });

// Detail page
registerSnapHandler(
  app,
  async (ctx) => {
    const solar = getSolarPosition(new Date());
    return buildDetailPage(solar.gate, solar.line, ctx);
  },
  { path: "/detail" }
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
    return buildSpectrumPage(solar.gate, type, ctx);
  },
  { path: "/spectrum" }
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
