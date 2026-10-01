import app from "../src/worker";

export function GET(request: Request) {
  return app.fetch(request);
}
