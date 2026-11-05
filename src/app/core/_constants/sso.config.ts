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

/** Fixed user-facing message for each reason code, shared by the login page and account settings. */
export const SSO_ERROR_MESSAGES: Record<SsoErrorReason, string> = {
  [SsoErrorReason.EXPIRED]: 'Your sign-in attempt expired. Please try again.',
  [SsoErrorReason.PROVIDER_ERROR]: 'Single sign-on failed. Please try again or contact your administrator.',
  [SsoErrorReason.USER_DISABLED]: 'Your account is disabled. Please contact your administrator.',
  [SsoErrorReason.ALREADY_LINKED]: 'That account is already linked to another Hashtopolis user.'
};
