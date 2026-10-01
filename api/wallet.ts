import app from "../src/worker";

export function GET(request: Request) {
  const address = new URL(request.url).searchParams.get("address");
  if (!address) return Response.json({ error: "Invalid wallet address" }, { status: 400 });
  const url = new URL(`/api/wallet/${encodeURIComponent(address)}`, request.url);
  return app.fetch(new Request(url, request));
}
