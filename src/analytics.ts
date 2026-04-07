/**
 * Lightweight PostHog server-side analytics.
 * Fire-and-forget — never throws, never blocks the response.
 */

const POSTHOG_API_KEY = process.env.POSTHOG_API_KEY ?? "";
const POSTHOG_HOST    = (process.env.POSTHOG_HOST ?? "https://us.i.posthog.com").replace(/\/$/, "");

export type SnapEvent =
  | { event: "snap_opened";        gate: number; line: number; gate_name: string }
  | { event: "detail_viewed";      gate: number; line: number; gate_name: string }
  | { event: "spectrum_expanded";  gate: number; type: "shadow" | "gift" | "siddhi" }
  | { event: "share_clicked";      gate: number; gate_name: string }
  | { event: "landing_page_viewed"; gate: number; gate_name: string };

/**
 * Track a snap or landing page event.
 * @param fid  Farcaster user ID (pass 0 / omit for anonymous / landing page)
 */
export function track(payload: SnapEvent, fid?: number): void {
  if (!POSTHOG_API_KEY) return; // silently skip if not configured

  const distinct_id = fid ? `fid:${fid}` : "anonymous";
  const body = JSON.stringify({
    api_key: POSTHOG_API_KEY,
    event: payload.event,
    distinct_id,
    properties: {
      ...payload,
      $lib: "threshold-snap",
    },
    timestamp: new Date().toISOString(),
  });

  // Fire and forget — swallow all errors so analytics never breaks the snap
  fetch(`${POSTHOG_HOST}/capture/`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body,
  }).catch(() => {});
}
