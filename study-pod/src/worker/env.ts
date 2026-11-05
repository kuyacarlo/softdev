export interface Env {
  DB: D1Database;
  ASSETS?: Fetcher;

  APP_NAME?: string;
  /** IANA timezone of the campus, e.g. "Asia/Manila" (SRS 2.4). */
  CAMPUS_TZ?: string;
  /** "oidc" (campus SSO) or "dev" (built-in mock SSO for local development only). */
  AUTH_MODE?: string;
  /** Comma-separated list of email domains allowed to sign in as students. */
  UNIVERSITY_EMAIL_DOMAIN?: string;
  /** Email that becomes the first Facility Manager when no manager exists yet. */
  BOOTSTRAP_MANAGER_EMAIL?: string;
  /** Public base URL used in emails, e.g. https://studypod.campus.edu. Defaults to request origin. */
  APP_URL?: string;

  SESSION_SECRET?: string;

  SSO_AUTHORIZE_URL?: string;
  SSO_TOKEN_URL?: string;
  SSO_USERINFO_URL?: string;
  SSO_CLIENT_ID?: string;
  SSO_CLIENT_SECRET?: string;
  SSO_SCOPES?: string;
  SSO_REDIRECT_URI?: string;

  EMAIL_PROVIDER?: string;
  EMAIL_FROM?: string;
  RESEND_API_KEY?: string;
}

export type StaffRole = 'facility_manager' | 'front_desk';

export type SessionUser =
  | { kind: 'student'; id: number; email: string; name: string }
  | { kind: 'staff'; id: number; email: string; name: string; role: StaffRole };
