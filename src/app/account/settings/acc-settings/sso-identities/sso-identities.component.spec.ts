import { of, throwError } from 'rxjs';

import { HttpErrorResponse } from '@angular/common/http';
import { NO_ERRORS_SCHEMA, Pipe, PipeTransform } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ReactiveFormsModule } from '@angular/forms';
import { MatDialog, MatDialogRef } from '@angular/material/dialog';
import { ActivatedRoute, Router } from '@angular/router';

import { OidcIdentityView, OidcService } from '@services/access/oidc.service';
import { ConfirmDialogService } from '@services/confirm/confirm-dialog.service';
import { AlertService } from '@services/shared/alert.service';

import { LinkSsoDialogComponent } from '@src/app/account/settings/acc-settings/sso-identities/link-sso-dialog.component';
import { SsoIdentitiesComponent } from '@src/app/account/settings/acc-settings/sso-identities/sso-identities.component';

@Pipe({ name: 'uiDate', standalone: false })
class StubUiDatePipe implements PipeTransform {
  transform(value: number | null | undefined): string | null {
    return value == null ? null : `date:${value}`;
  }
}

const IDENTITIES: OidcIdentityView[] = [
  { id: 1, label: 'alice@corp', issuer: 'https://idp', createdAt: 1700000000, lastUsedAt: 1700000500 },
  { id: 2, label: 'alice@other', issuer: 'https://idp2', createdAt: 1700001000, lastUsedAt: null }
];

describe('SsoIdentitiesComponent', () => {
  let fixture: ComponentFixture<SsoIdentitiesComponent>;
  let oidc: jasmine.SpyObj<OidcService>;
  let confirm: jasmine.SpyObj<ConfirmDialogService>;
  let alert: jasmine.SpyObj<AlertService>;
  let router: jasmine.SpyObj<Router>;
  let dialog: jasmine.SpyObj<MatDialog>;
  let enabled: boolean;
  let queryParams: Record<string, string>;

  const text = () => (fixture.nativeElement as HTMLElement).textContent ?? '';

  async function create(): Promise<void> {
    fixture = TestBed.createComponent(SsoIdentitiesComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  beforeEach(() => {
    enabled = true;
    queryParams = {};
    oidc = jasmine.createSpyObj<OidcService>('OidcService', ['getConfig', 'listIdentities', 'unlink']);
    oidc.getConfig.and.callFake(() => of({ enabled, displayName: 'Keycloak', localLoginEnabled: true }));
    oidc.listIdentities.and.returnValue(of(IDENTITIES));
    oidc.unlink.and.returnValue(of(undefined));
    confirm = jasmine.createSpyObj<ConfirmDialogService>('ConfirmDialogService', ['confirmYesNo']);
    alert = jasmine.createSpyObj<AlertService>('AlertService', ['showSuccessMessage', 'showErrorMessage']);
    router = jasmine.createSpyObj<Router>('Router', ['navigate']);
    dialog = jasmine.createSpyObj<MatDialog>('MatDialog', ['open']);

    TestBed.configureTestingModule({
      declarations: [SsoIdentitiesComponent, StubUiDatePipe],
      schemas: [NO_ERRORS_SCHEMA],
      providers: [
        { provide: OidcService, useValue: oidc },
        { provide: ConfirmDialogService, useValue: confirm },
        { provide: AlertService, useValue: alert },
        { provide: Router, useValue: router },
        { provide: MatDialog, useValue: dialog },
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: {
              get queryParamMap() {
                return { get: (k: string) => queryParams[k] ?? null };
              }
            }
          }
        }
      ]
    });
  });

  it('renders nothing when SSO disabled', async () => {
    enabled = false;
    await create();
    expect(text().trim()).toBe('');
    expect(oidc.listIdentities).not.toHaveBeenCalled();
  });

  it('lists identities with Never for null lastUsedAt', async () => {
    await create();
    expect(fixture.nativeElement.querySelector('app-page-subtitle').getAttribute('subtitle')).toBe('Single sign-on');
    expect(text()).toContain('alice@corp');
    expect(text()).toContain('alice@other');
    expect(text()).toContain('date:1700000500');
    expect(text()).toContain('Never');
    expect(text()).toContain('Link Keycloak account');
  });

  it('unlink confirms then calls unlink and reloads', async () => {
    confirm.confirmYesNo.and.returnValue(of(true));
    await create();
    oidc.listIdentities.calls.reset();

    fixture.componentInstance.unlink(IDENTITIES[0]);

    expect(confirm.confirmYesNo).toHaveBeenCalledWith(
      'Unlink alice@corp?',
      'Unlink alice@corp? You will no longer be able to sign in with it.'
    );
    expect(oidc.unlink).toHaveBeenCalledWith(1);
    expect(oidc.listIdentities).toHaveBeenCalledTimes(1);
  });

  it('cancelled confirm does not unlink', async () => {
    confirm.confirmYesNo.and.returnValue(of(false));
    await create();

    fixture.componentInstance.unlink(IDENTITIES[0]);

    expect(oidc.unlink).not.toHaveBeenCalled();
  });

  it('labels each Unlink button with the identity', async () => {
    await create();
    const labels = Array.from(
      (fixture.nativeElement as HTMLElement).querySelectorAll('[data-testid="button-unlink"]')
    ).map((b) => b.getAttribute('aria-label'));
    expect(labels).toEqual(['Unlink alice@corp', 'Unlink alice@other']);
  });

  it('renders an empty state when no identities are linked', async () => {
    oidc.listIdentities.and.returnValue(of([]));
    await create();
    expect(text()).toContain('No single sign-on accounts linked.');
    expect(fixture.nativeElement.querySelector('table')).toBeNull();
  });

  it('opens the link dialog', async () => {
    await create();
    fixture.componentInstance.openLinkDialog();
    expect(dialog.open).toHaveBeenCalledWith(LinkSsoDialogComponent, jasmine.any(Object));
  });

  it('shows linked success from query param and clears params', async () => {
    queryParams = { sso: 'linked' };
    await create();
    expect(alert.showSuccessMessage).toHaveBeenCalledWith('Single sign-on account linked.');
    expect(router.navigate).toHaveBeenCalledWith([], { queryParams: {}, replaceUrl: true });
  });

  it('shows already_linked error', async () => {
    queryParams = { sso: 'error', reason: 'already_linked' };
    await create();
    expect(alert.showErrorMessage).toHaveBeenCalledWith('That account is already linked to another Hashtopolis user.');
    expect(router.navigate).toHaveBeenCalledWith([], { queryParams: {}, replaceUrl: true });
  });

  it('shows expired error', async () => {
    queryParams = { sso: 'error', reason: 'expired' };
    await create();
    expect(alert.showErrorMessage).toHaveBeenCalledWith('Your sign-in attempt expired. Please try again.');
  });

  it('falls back to a generic error for an unknown reason without rendering it', async () => {
    queryParams = { sso: 'error', reason: '<b>weird</b>' };
    await create();
    expect(alert.showErrorMessage).toHaveBeenCalledWith(
      'Single sign-on failed. Please try again or contact your administrator.'
    );
    expect(router.navigate).toHaveBeenCalledWith([], { queryParams: {}, replaceUrl: true });
  });
});

describe('LinkSsoDialogComponent', () => {
  let fixture: ComponentFixture<LinkSsoDialogComponent>;
  let component: LinkSsoDialogComponent;
  let oidc: jasmine.SpyObj<OidcService>;
  let dialogRef: { close: jasmine.Spy };

  beforeEach(() => {
    oidc = jasmine.createSpyObj<OidcService>('OidcService', ['startLink']);
    dialogRef = { close: jasmine.createSpy('close') };
    TestBed.configureTestingModule({
      declarations: [LinkSsoDialogComponent],
      imports: [ReactiveFormsModule],
      schemas: [NO_ERRORS_SCHEMA],
      providers: [
        { provide: OidcService, useValue: oidc },
        { provide: MatDialogRef, useValue: dialogRef }
      ]
    });
    fixture = TestBed.createComponent(LinkSsoDialogComponent);
    component = fixture.componentInstance;
    spyOn(component, 'navigateTo');
    fixture.detectChanges();
  });

  it('link dialog calls startLink and navigates', () => {
    oidc.startLink.and.returnValue(of({ authorizeUrl: 'https://idp/authorize?x=1' }));
    component.password.setValue('secret');

    component.submit();

    expect(oidc.startLink).toHaveBeenCalledWith('secret');
    expect(component.navigateTo).toHaveBeenCalledWith('https://idp/authorize?x=1');
  });

  it('closes the dialog before navigating', () => {
    const order: string[] = [];
    dialogRef.close.and.callFake(() => order.push('close'));
    (component.navigateTo as jasmine.Spy).and.callFake(() => order.push('navigate'));
    oidc.startLink.and.returnValue(of({ authorizeUrl: 'https://idp/authorize' }));
    component.password.setValue('secret');

    component.submit();

    expect(order).toEqual(['close', 'navigate']);
  });

  it('link dialog 401 shows incorrect password', () => {
    oidc.startLink.and.returnValue(throwError(() => new HttpErrorResponse({ status: 401 })));
    component.password.setValue('wrong');

    component.submit();
    fixture.detectChanges();

    expect(component.navigateTo).not.toHaveBeenCalled();
    expect(component.password.value).toBe('');
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('Incorrect password.');
  });
});
