import { registerSnapHandler } from "@farcaster/snap-hono";
import { Hono } from "hono";
import { getSolarPosition, getMoonPosition } from "./ephemeris.js";
import { getGate, type Gate } from "./gates.js";

// ── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(date: Date): string {
  return date.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

function zodiacSign(longitude: number): string {
  const signs = [
    "Aries", "Taurus", "Gemini", "Cancer", "Leo", "Virgo",
    "Libra", "Scorpio", "Sagittarius", "Capricorn", "Aquarius", "Pisces",
  ];
  return signs[Math.floor(((longitude % 360) + 360) % 360 / 30)];
}

function getBaseUrl(): string {
  return (typeof globalThis !== "undefined" && (globalThis as any).process?.env?.SNAP_PUBLIC_BASE_URL)
    ?? "http://localhost:3000";
}

// ── Page builders ─────────────────────────────────────────────────────────────

function buildMainPage() {
  const now   = new Date();
  const solar = getSolarPosition(now);
  const moon  = getMoonPosition(now);
  const gate  = getGate(solar.gate);
  const line  = gate.lines[solar.line - 1];
  const sign  = zodiacSign(solar.longitude);
  const base  = getBaseUrl();

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
            "header",
            "dateline",
            "divider1",
            "gate_heading",
            "line_label",
            "divider2",
            "keywords_row",
            "reflection_text",
            "divider3",
            "moon_row",
            "divider4",
            "btn_detail",
            "btn_share",
          ],
        },

        header: {
          type: "text" as const,
          props: {
            content: "Human Design Daily Transit",
            weight: "bold" as const,
            size: "md" as const,
          },
        },
        dateline: {
          type: "text" as const,
          props: {
            content: `${formatDate(now)}  ·  Sun in ${sign}`,
            size: "sm" as const,
          },
        },

        divider1: { type: "separator" as const, props: {} },

        gate_heading: {
          type: "text" as const,
          props: {
            content: `Gate ${solar.gate} · Line ${solar.line}  —  ${gate.name}`,
            weight: "bold" as const,
          },
        },
        line_label: {
          type: "text" as const,
          props: {
            content: `${line.name}: ${line.theme}`,
            size: "sm" as const,
          },
        },

        divider2: { type: "separator" as const, props: {} },

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

        reflection_text: {
          type: "text" as const,
          props: { content: gate.reflection, size: "sm" as const },
        },

        divider3: { type: "separator" as const, props: {} },

        moon_row: {
          type: "stack" as const,
          props: { direction: "horizontal" as const, gap: "sm" as const },
          children: ["moon_badge", "moon_text"],
        },
        moon_badge: {
          type: "badge" as const,
          props: { label: `${moon.emoji} ${moon.phaseName}` },
        },
        moon_text: {
          type: "text" as const,
          props: {
            content: `Moon in Gate ${moon.gate} · Line ${moon.line}`,
            size: "sm" as const,
          },
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

function buildDetailPage(gateNumber: number, activeLine: number) {
  const gate: Gate = getGate(gateNumber);
  const base = getBaseUrl();

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

// ── App + routes ──────────────────────────────────────────────────────────────

const app = new Hono();

// Main transit page — GET and back-button POST both serve the same page
registerSnapHandler(app, async () => buildMainPage(), { path: "/", og: false });

// Detail page
registerSnapHandler(
  app,
  async () => {
    const solar = getSolarPosition(new Date());
    return buildDetailPage(solar.gate, solar.line);
  },
  { path: "/detail", og: false }
);

export default app;
