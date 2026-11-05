import type { OidcConfigResponse, OidcIdentityList, OidcLinkResponse } from '@generated/api/types';
import { Observable, of } from 'rxjs';
import { catchError, map, shareReplay } from 'rxjs/operators';

import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';

import { ConfigService } from '@services/shared/config.service';

export type { OidcConfigResponse, OidcLinkResponse };
export type OidcIdentityView = OidcIdentityList['identities'][number];

const FALLBACK_CONFIG: OidcConfigResponse = { enabled: false, displayName: 'SSO', localLoginEnabled: true };

@Injectable({ providedIn: 'root' })
export class OidcService {
  /** sessionStorage key holding the in-app URL to return to after an SSO login. */
  static readonly REDIRECT_KEY = 'hashtopolis-sso-redirect';

  private config$?: Observable<OidcConfigResponse>;

  private readonly http = inject(HttpClient);
  private readonly cs = inject(ConfigService);

  /** Public OIDC settings, fetched once. Falls back to "SSO disabled" if the request fails. */
  getConfig(): Observable<OidcConfigResponse> {
    this.config$ ??= this.http.get<OidcConfigResponse>(`${this.base()}/config`).pipe(
      catchError(() => of(FALLBACK_CONFIG)),
      shareReplay(1)
    );
    return this.config$;
  }

  /** URL for a full-page navigation that starts the SSO login (not an XHR). */
  loginUrl(returnTo: string = window.location.origin): string {
    return `${this.base()}/login?returnTo=${encodeURIComponent(returnTo)}`;
  }

  startLink(password: string): Observable<OidcLinkResponse> {
    return this.http.post<OidcLinkResponse>(`${this.base()}/link`, { password }, { withCredentials: true });
  }

  linkPending(username: string, password: string): Observable<void> {
    return this.http.post<void>(`${this.base()}/link-pending`, { username, password }, { withCredentials: true });
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
