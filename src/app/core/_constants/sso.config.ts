import { z } from 'zod';

/** sessionStorage key holding the in-app URL to return to after an SSO login. */
export const SSO_REDIRECT_KEY = 'hashtopolis-sso-redirect';

/** Accepts only in-app paths ('/x'), never absolute or protocol-relative URLs ('//host'). */
export const ssoRedirectSchema = z.string().refine((v) => v.startsWith('/') && !v.startsWith('//'), {
  message: 'Redirect target must be an in-app path'
});

/** Reason codes the server sends back as `?sso=error&reason=<code>`. */
export const SsoErrorReason = {
  EXPIRED: 'expired',
  PROVIDER_ERROR: 'provider_error',
  USER_DISABLED: 'user_disabled',
  ALREADY_LINKED: 'already_linked'
} as const;
export type SsoErrorReason = (typeof SsoErrorReason)[keyof typeof SsoErrorReason];

export const isSsoErrorReason = (value: string | null): value is SsoErrorReason =>
  Object.values<string>(SsoErrorReason).includes(value ?? '');
