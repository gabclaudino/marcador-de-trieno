interface Env {
  DB: D1Database;
  ACCESS_TEAM_DOMAIN: string;
  ACCESS_AUD: string;
  OWNER_EMAIL: string;
  /** Apenas em dev local (.dev.vars). Nunca em produção. */
  DEV_BYPASS_AUTH?: string;
}
