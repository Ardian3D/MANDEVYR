import app from "../src/worker/index.ts";

export function GET(request: Request) {
  return app.fetch(request);
}

export default { fetch: GET };
