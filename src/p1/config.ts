/** The public deployment serves P1/P2 through the Cloudflare Worker. Set false only for an emergency frontend rollback. */
export const P1_ENABLED = import.meta.env.VITE_P1_ENABLED !== "false";
