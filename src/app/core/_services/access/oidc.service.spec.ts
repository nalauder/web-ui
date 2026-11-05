import { SKIP_AUTH_RETRY } from '@constants/http.config';

import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { OidcService } from '@services/access/oidc.service';
import { ConfigService } from '@services/shared/config.service';

describe('OidcService', () => {
  const base = 'http://api.test/api/v2';
  let service: OidcService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: ConfigService, useValue: { getEndpoint: () => base } }
      ]
    });
    service = TestBed.inject(OidcService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('requests the config once across two subscriptions', () => {
    const results: unknown[] = [];
    service.getConfig().subscribe((c) => results.push(c));
    service.getConfig().subscribe((c) => results.push(c));

    const config = { enabled: true, displayName: 'Corp SSO', localLoginEnabled: false };
    httpMock.expectOne(`${base}/auth/oidc/config`).flush(config);

    expect(results).toEqual([config, config]);
  });

  it('getConfig skips the global error dialog and the response cache', () => {
    service.getConfig().subscribe();
    const req = httpMock.expectOne(`${base}/auth/oidc/config`);
    expect(req.request.headers.get('X-Skip-Error-Dialog')).toBe('true');
    expect(req.request.headers.get('X-Cache-Skip')).toBe('true');
    req.flush({ enabled: false, displayName: 'SSO', localLoginEnabled: true });
  });

  it('falls back to a disabled config on error', () => {
    let result: unknown;
    service.getConfig().subscribe((c) => (result = c));

    httpMock.expectOne(`${base}/auth/oidc/config`).flush('boom', { status: 500, statusText: 'Server Error' });

    expect(result).toEqual({ enabled: false, displayName: 'SSO', localLoginEnabled: true });
  });

  it('encodes returnTo in the login URL', () => {
    expect(service.loginUrl('https://ui.test:4200/path?a=b')).toBe(
      `${base}/auth/oidc/login?returnTo=${encodeURIComponent('https://ui.test:4200/path?a=b')}`
    );
  });

  it('defaults returnTo to the current origin', () => {
    expect(service.loginUrl()).toBe(`${base}/auth/oidc/login?returnTo=${encodeURIComponent(window.location.origin)}`);
  });

  it('startLink posts the password with credentials', () => {
    let result: unknown;
    service.startLink('pw').subscribe((r) => (result = r));

    const req = httpMock.expectOne(`${base}/auth/oidc/link`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ password: 'pw' });
    expect(req.request.withCredentials).toBeTrue();
    req.flush({ authorizeUrl: 'https://idp.test/authorize' });

    expect(result).toEqual({ authorizeUrl: 'https://idp.test/authorize' });
  });

  it('linkPending posts username and password with credentials', () => {
    service.linkPending('alice', 'pw').subscribe();

    const req = httpMock.expectOne(`${base}/auth/oidc/link-pending`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ username: 'alice', password: 'pw' });
    expect(req.request.withCredentials).toBeTrue();
    req.flush(null, { status: 204, statusText: 'No Content' });
  });

  it('listIdentities unwraps the identities array', () => {
    let result: unknown;
    service.listIdentities().subscribe((r) => (result = r));

    const identity = { id: 5, label: 'alice@example.test', issuer: 'https://idp.test', createdAt: 1, lastUsedAt: null };
    const req = httpMock.expectOne(`${base}/auth/oidc/identities`);
    expect(req.request.method).toBe('GET');
    req.flush({ identities: [identity] });

    expect(result).toEqual([identity]);
  });

  it('unlink sends DELETE with credentials', () => {
    service.unlink(5).subscribe();

    const req = httpMock.expectOne(`${base}/auth/oidc/identities/5`);
    expect(req.request.method).toBe('DELETE');
    expect(req.request.withCredentials).toBeTrue();
    req.flush(null, { status: 204, statusText: 'No Content' });
  });
  it('startLink opts out of the interceptor auth retry', () => {
    service.startLink('pw').subscribe();
    const req = httpMock.expectOne(`${base}/auth/oidc/link`);
    expect(req.request.context.get(SKIP_AUTH_RETRY)).toBeTrue();
    req.flush({ authorizeUrl: 'https://idp' });
  });

  it('startLink and linkPending skip the global error dialog; unlink and listIdentities do not', () => {
    service.startLink('pw').subscribe();
    const link = httpMock.expectOne(`${base}/auth/oidc/link`);
    expect(link.request.headers.get('X-Skip-Error-Dialog')).toBe('true');
    link.flush({ authorizeUrl: 'https://idp' });

    service.linkPending('u', 'pw').subscribe();
    const pending = httpMock.expectOne(`${base}/auth/oidc/link-pending`);
    expect(pending.request.headers.get('X-Skip-Error-Dialog')).toBe('true');
    pending.flush(null);

    service.unlink(3).subscribe();
    const unlink = httpMock.expectOne(`${base}/auth/oidc/identities/3`);
    expect(unlink.request.headers.has('X-Skip-Error-Dialog')).toBeFalse();
    unlink.flush(null);

    service.listIdentities().subscribe();
    const list = httpMock.expectOne(`${base}/auth/oidc/identities`);
    expect(list.request.headers.has('X-Skip-Error-Dialog')).toBeFalse();
    list.flush({ identities: [] });
  });
});
