import { HTTP_SKIP_CACHE_HEADER_CONFIG, HTTP_SKIP_ERROR_HEADER_CONFIG, SKIP_AUTH_RETRY } from '@constants/http.config';
import type { OidcConfigResponse, OidcIdentityList, OidcLinkResponse } from '@generated/api/types';
import { Observable, of } from 'rxjs';
import { catchError, map, shareReplay } from 'rxjs/operators';

import { HttpClient, HttpContext } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';

import { ConfigService } from '@services/shared/config.service';

export type { OidcConfigResponse, OidcLinkResponse };
export type OidcIdentityView = OidcIdentityList['identities'][number];

/** Used when the config request fails: SSO off, local login on. */
export const DEFAULT_OIDC_CONFIG: OidcConfigResponse = { enabled: false, displayName: 'SSO', localLoginEnabled: true };

@Injectable({ providedIn: 'root' })
export class OidcService {
  private config$?: Observable<OidcConfigResponse>;

  private readonly http = inject(HttpClient);
  private readonly cs = inject(ConfigService);

  /** Link errors are shown inline by the caller, so the global error modal is skipped. */
  private readonly inlineErrorOptions = { withCredentials: true, headers: HTTP_SKIP_ERROR_HEADER_CONFIG };

  /** Public OIDC settings, fetched once. Falls back to "SSO disabled" if the request fails. */
  getConfig(): Observable<OidcConfigResponse> {
    this.config$ ??= this.http
      .get<OidcConfigResponse>(`${this.base()}/config`, {
        headers: { ...HTTP_SKIP_ERROR_HEADER_CONFIG, ...HTTP_SKIP_CACHE_HEADER_CONFIG }
      })
      .pipe(
        catchError(() => of(DEFAULT_OIDC_CONFIG)),
        shareReplay(1)
      );
    return this.config$;
  }

  /** URL for a full-page navigation that starts the SSO login (not an XHR). */
  loginUrl(returnTo: string = window.location.origin): string {
    return `${this.base()}/login?returnTo=${encodeURIComponent(returnTo)}`;
  }

  /**
   * A wrong password answers 401, which the auth interceptor would take for an expired token, refresh
   * and replay. The context flag turns that retry off.
   */
  startLink(password: string): Observable<OidcLinkResponse> {
    return this.http.post<OidcLinkResponse>(
      `${this.base()}/link`,
      { password },
      {
        ...this.inlineErrorOptions,
        context: new HttpContext().set(SKIP_AUTH_RETRY, true)
      }
    );
  }

  linkPending(username: string, password: string): Observable<void> {
    return this.http.post<void>(`${this.base()}/link-pending`, { username, password }, this.inlineErrorOptions);
  }

  listIdentities(): Observable<OidcIdentityView[]> {
    return this.http.get<OidcIdentityList>(`${this.base()}/identities`).pipe(map((r) => r.identities));
  }

  unlink(id: number): Observable<void> {
    return this.http.delete<void>(`${this.base()}/identities/${id}`, { withCredentials: true });
  }

  private base(): string {
    return `${this.cs.getEndpoint()}/auth/oidc`;
  }
}
