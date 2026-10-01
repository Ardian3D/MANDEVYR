/** P1 stays in local preview until the production database and scheduled Worker exist. */
export const P1_ENABLED = import.meta.env.DEV || import.meta.env.VITE_P1_ENABLED === "true";
