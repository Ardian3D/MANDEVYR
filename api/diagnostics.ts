export default {
  async fetch() {
    try {
      const module = await import("../src/worker/index.ts");
      return Response.json({ moduleLoaded: true, hasFetch: typeof module.default.fetch === "function" });
    } catch (error) {
      return Response.json({ moduleLoaded: false, name: error instanceof Error ? error.name : "Unknown", message: error instanceof Error ? error.message.slice(0, 300) : "Unknown module error" });
    }
  },
};
