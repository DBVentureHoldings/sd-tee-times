/**
 * Cron endpoint hit by Vercel every 30 minutes.
 *
 * Vercel Cron is reliable; GitHub Actions' cron schedule is best-effort and
 * can be delayed by hours under load. So we use Vercel as the trustworthy
 * scheduler, and this route fires `workflow_dispatch` on the GH Actions
 * scrape workflow so the actual scraping (which needs Playwright) still
 * runs on GitHub.
 *
 * Auth: Vercel Cron sends `Authorization: Bearer <CRON_SECRET>` automatically
 * when the route is listed in vercel.json's `crons` array. We reject anything
 * else so the route can't be triggered by randos.
 *
 * Env vars required:
 *   - GITHUB_TOKEN: fine-grained PAT with Actions: read+write on this repo
 *   - GITHUB_REPO:  "DBVentureHoldings/sd-tee-times" (optional override)
 *   - CRON_SECRET:  shared with Vercel cron config
 */

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const DEFAULT_REPO = "DBVentureHoldings/sd-tee-times";
const WORKFLOW_FILE = "scrape.yml";

export async function GET(request: Request): Promise<Response> {
  // Vercel Cron auth: Vercel injects `Authorization: Bearer <CRON_SECRET>`.
  const expected = process.env.CRON_SECRET;
  if (!expected) {
    return Response.json(
      { ok: false, error: "CRON_SECRET not configured" },
      { status: 500 },
    );
  }
  const auth = request.headers.get("authorization");
  if (auth !== `Bearer ${expected}`) {
    return Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const githubToken = process.env.GITHUB_TOKEN;
  if (!githubToken) {
    return Response.json(
      { ok: false, error: "GITHUB_TOKEN not configured" },
      { status: 500 },
    );
  }
  const repo = process.env.GITHUB_REPO ?? DEFAULT_REPO;

  // Dispatch the workflow. GH returns 204 No Content on success.
  const ghRes = await fetch(
    `https://api.github.com/repos/${repo}/actions/workflows/${WORKFLOW_FILE}/dispatches`,
    {
      method: "POST",
      headers: {
        accept: "application/vnd.github+json",
        authorization: `Bearer ${githubToken}`,
        "x-github-api-version": "2022-11-28",
        "content-type": "application/json",
      },
      body: JSON.stringify({ ref: "main" }),
    },
  );

  if (ghRes.status === 204) {
    return Response.json({ ok: true, dispatched: true, repo });
  }
  const text = await ghRes.text().catch(() => "");
  return Response.json(
    { ok: false, status: ghRes.status, body: text.slice(0, 400) },
    { status: 502 },
  );
}
