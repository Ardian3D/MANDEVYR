import app from "./_worker.mjs";

export function GET(request: Request) {
  return app.fetch(request);
}

export default { fetch: GET };
