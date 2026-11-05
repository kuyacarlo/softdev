import { Hono } from 'hono';
import { z } from 'zod';
import { base64Url, randomToken } from '../lib/codes.js';
import { AppError, forbidden } from '../lib/errors.js';
import {
  clearSession,
  safeReturnTo,
  setOidcState,
  setSession,
  takeOidcState,
} from '../lib/session.js';
import { v } from '../lib/validate.js';
import { allowedDomains, listStaff, resolveIdentity } from '../services/identity.js';
import type { AppEnv } from '../types.js';

export const authRoutes = new Hono<AppEnv>();

const authMode = (env: AppEnv['Bindings']) => (env.AUTH_MODE === 'dev' ? 'dev' : 'oidc');

authRoutes.get('/me', (c) => c.json({ user: c.get('user'), authMode: authMode(c.env) }));

/**
 * Campus SSO (SRS 2.4 / 3.1.3 / 3.5.4): OAuth 2.0 authorization-code flow with
 * PKCE against the university identity provider. StudyPod never sees passwords.
 */
authRoutes.get('/login', async (c) => {
  const returnTo = safeReturnTo(c.req.query('returnTo'));
  if (authMode(c.env) === 'dev') return c.redirect(`/login?returnTo=${encodeURIComponent(returnTo)}`);
  const env = c.env;
  if (!env.SSO_AUTHORIZE_URL || !env.SSO_TOKEN_URL || !env.SSO_USERINFO_URL || !env.SSO_CLIENT_ID) {
    throw new AppError(500, 'SSO_NOT_CONFIGURED', 'Campus sign-in is not configured yet. Please contact library IT.');
  }
  const state = randomToken(16);
  const nonce = randomToken(16);
  const verifier = randomToken(32);
  const challenge = base64Url(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier))));
  await setOidcState(c, { state, nonce, verifier, returnTo });
  const url = new URL(env.SSO_AUTHORIZE_URL);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('client_id', env.SSO_CLIENT_ID);
  url.searchParams.set('redirect_uri', redirectUri(c));
  url.searchParams.set('scope', env.SSO_SCOPES || 'openid email profile');
  url.searchParams.set('state', state);
  url.searchParams.set('nonce', nonce);
  url.searchParams.set('code_challenge', challenge);
  url.searchParams.set('code_challenge_method', 'S256');
  return c.redirect(url.toString());
});

function redirectUri(c: { env: AppEnv['Bindings']; req: { url: string } }) {
  return c.env.SSO_REDIRECT_URI || `${new URL(c.req.url).origin}/api/auth/callback`;
}

authRoutes.get('/callback', async (c) => {
  const env = c.env;
  const fail = (reason: string) => c.redirect(`/login?error=${encodeURIComponent(reason)}`);
  const saved = await takeOidcState(c);
  const code = c.req.query('code');
  if (c.req.query('error')) return fail('Campus sign-in was cancelled or failed. Please try again.');
  if (!saved || !code || c.req.query('state') !== saved.state) {
    return fail('Your sign-in session expired. Please try again.');
  }

  const tokenRes = await fetch(env.SSO_TOKEN_URL!, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: redirectUri(c),
      client_id: env.SSO_CLIENT_ID!,
      ...(env.SSO_CLIENT_SECRET ? { client_secret: env.SSO_CLIENT_SECRET } : {}),
      code_verifier: saved.verifier,
    }),
  });
  if (!tokenRes.ok) return fail('Campus sign-in could not be completed. Please try again.');
  const tokens = (await tokenRes.json()) as { access_token?: string };
  if (!tokens.access_token) return fail('Campus sign-in could not be completed. Please try again.');

  // Profile comes straight from the IdP's userinfo endpoint over TLS using the fresh access token.
  const infoRes = await fetch(env.SSO_USERINFO_URL!, { headers: { Authorization: `Bearer ${tokens.access_token}` } });
  if (!infoRes.ok) return fail('We could not read your campus profile. Please try again.');
  const info = (await infoRes.json()) as { sub?: string; email?: string; name?: string; email_verified?: boolean };
  if (!info.email || info.email_verified === false) return fail('Your campus account has no verified email address.');

  try {
    const user = await resolveIdentity(c.get('svc'), { email: info.email, name: info.name ?? '', subject: info.sub });
    await setSession(c, user);
    return c.redirect(user.kind === 'staff' && saved.returnTo === '/' ? '/admin' : saved.returnTo);
  } catch (err) {
    if (err instanceof AppError) return fail(err.message);
    throw err;
  }
});

/* ---------- Development-only mock SSO ---------- */

authRoutes.get('/dev-accounts', async (c) => {
  if (authMode(c.env) !== 'dev') throw forbidden('Development sign-in is disabled.');
  const staff = await listStaff(c.env.DB);
  const domain = allowedDomains(c.get('svc'))[0] ?? 'campus.edu';
  return c.json({
    domain,
    staff: staff.filter((s) => s.active).map((s) => ({ name: s.name, email: s.email, role: s.role })),
    students: [
      { name: 'Ana Cruz', email: `ana.cruz@${domain}` },
      { name: 'Ben Lim', email: `ben.lim@${domain}` },
      { name: 'Carla Diaz', email: `carla.diaz@${domain}` },
    ],
  });
});

authRoutes.post(
  '/dev-login',
  v('json', z.object({ email: z.string().email('Enter a valid email address.'), name: z.string().max(120).optional() })),
  async (c) => {
    if (authMode(c.env) !== 'dev') throw forbidden('Development sign-in is disabled.');
    const body = c.req.valid('json');
    const user = await resolveIdentity(c.get('svc'), { email: body.email, name: body.name ?? '', subject: `dev:${body.email}` });
    await setSession(c, user);
    return c.json({ user });
  },
);

authRoutes.post('/logout', (c) => {
  clearSession(c);
  return c.json({ ok: true });
});
