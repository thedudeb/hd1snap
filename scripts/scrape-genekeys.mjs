// One-shot scraper for the canonical Shadow / Gift / Siddhi triads
// from genekeys.com. Writes src/gene-keys-data.json.
//
// Run with: node scripts/scrape-genekeys.mjs

import { writeFile } from "node:fs/promises";

const OUT = new URL("../src/gene-keys-data.json", import.meta.url);

async function fetchKey(n) {
  const url = `https://genekeys.com/gene-key-${n}/`;
  const res = await fetch(url, {
    headers: {
      "user-agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36",
    },
  });
  if (!res.ok) throw new Error(`Gate ${n}: HTTP ${res.status}`);
  const html = await res.text();

  // Triad lives in the meta description / og:description and the <h3>.
  const metaDesc = html.match(/<meta\s+name=["']description["']\s+content=["']([^"']+)["']/i);
  const ogDesc   = html.match(/<meta\s+property=["']og:description["']\s+content=["']([^"']+)["']/i);
  const h3Match  = html.match(/<h3[^>]*>([^<]+)<\/h3>/i);
  const candidates = [metaDesc?.[1], ogDesc?.[1], h3Match?.[1]].filter(Boolean);

  for (const raw of candidates) {
    // Decode entities + normalise dashes to en-dash
    const decoded = raw
      .replace(/&#8211;|&ndash;/g, "–")
      .replace(/&#8212;|&mdash;/g, "—")
      .replace(/&amp;/g, "&")
      .replace(/\s+/g, " ")
      .trim();

    // Strip leading "Gene Key N – " and trailing " | Gene Keys"
    const cleaned = decoded
      .replace(/^Gene Key\s*\d+\s*[–—-]\s*/i, "")
      .replace(/\s*\|\s*Gene Keys.*$/i, "")
      .trim();

    const parts = cleaned.split(/\s*[–—-]\s*/).map((s) => s.trim()).filter(Boolean);
    if (parts.length >= 3) {
      const [shadow, gift, siddhi] = parts;
      // Pull the Richard Rudd quote that follows the H3 if present.
      const quoteMatch = html.match(/<h3[^>]*>[^<]+<\/h3>\s*<p><em>([\s\S]*?)<\/em><\/p>/i);
      const quote = quoteMatch
        ? quoteMatch[1]
            .replace(/<[^>]+>/g, "")
            .replace(/&#8220;|&#8221;|&ldquo;|&rdquo;/g, '"')
            .replace(/&#8217;|&rsquo;/g, "'")
            .replace(/&#8216;|&lsquo;/g, "'")
            .replace(/&#8211;|&ndash;/g, "–")
            .replace(/&amp;/g, "&")
            .replace(/\s+/g, " ")
            .trim()
        : null;
      return { number: n, shadow, gift, siddhi, quote };
    }
  }
  throw new Error(`Gate ${n}: could not parse triad from titles: ${candidates.join(" || ")}`);
}

async function main() {
  const results = [];
  // Throttle: 4 in flight at a time
  const concurrency = 4;
  let i = 1;
  async function worker() {
    while (i <= 64) {
      const n = i++;
      try {
        const row = await fetchKey(n);
        console.log(`✓ ${n}: ${row.shadow} – ${row.gift} – ${row.siddhi}`);
        results.push(row);
      } catch (err) {
        console.error(`✗ ${n}:`, err.message);
        results.push({ number: n, error: err.message });
      }
    }
  }
  await Promise.all(Array.from({ length: concurrency }, worker));
  results.sort((a, b) => a.number - b.number);
  await writeFile(OUT, JSON.stringify(results, null, 2) + "\n");
  console.log(`\nWrote ${results.length} entries → ${OUT.pathname}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
