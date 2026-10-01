import app from "../src/worker/index.ts";

export function GET(request: Request) {
  const id = new URL(request.url).searchParams.get("id");
  if (!id) return Response.json({ error: "Opportunity not found" }, { status: 404 });
  const url = new URL(`/api/registry/${encodeURIComponent(id)}`, request.url);
  return app.fetch(new Request(url, request));
}
