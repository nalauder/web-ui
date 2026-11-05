import { asyncScheduler, observeOn, of, throwError } from 'rxjs';

import { HttpErrorResponse } from '@angular/common/http';
import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { ReactiveFormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { By } from '@angular/platform-browser';
import { ActivatedRoute, convertToParamMap } from '@angular/router';

import { AuthService } from '@services/access/auth.service';
import { OidcConfigResponse, OidcService } from '@services/access/oidc.service';
import { ConfigService } from '@services/shared/config.service';

import { AuthComponent } from '@src/app/auth/auth.component';
import { ButtonsModule } from '@src/app/shared/buttons/buttons.module';
import { ComponentsModule } from '@src/app/shared/components.module';
import { InputModule } from '@src/app/shared/input/input.module';

describe('AuthComponent', () => {
  let component: AuthComponent;
  let fixture: ComponentFixture<AuthComponent>;

  // Mocks
  let mockAuthService: jasmine.SpyObj<AuthService>;
  let mockConfigService: jasmine.SpyObj<ConfigService>;
  let mockOidc: jasmine.SpyObj<OidcService>;

  const defaultConfig: OidcConfigResponse = { enabled: false, displayName: 'SSO', localLoginEnabled: true };

  const setup = async (config: OidcConfigResponse = defaultConfig, query: Record<string, string> = {}) => {
    TestBed.resetTestingModule();
    mockAuthService = jasmine.createSpyObj('AuthService', ['logIn', 'completeSsoLogin'], { redirectUrl: '' });
    mockOidc = jasmine.createSpyObj('OidcService', ['getConfig', 'loginUrl', 'linkPending']);
    mockOidc.getConfig.and.returnValue(of(config));
    mockOidc.loginUrl.and.returnValue('https://api.test/auth/oidc/login?returnTo=x');
    mockConfigService = jasmine.createSpyObj('ConfigService', ['getEndpoint']);

    await TestBed.configureTestingModule({
      imports: [
        ReactiveFormsModule,
        MatCardModule,
        MatFormFieldModule,
        MatInputModule,
        MatIconModule,
        MatButtonModule,
        InputModule,
        ButtonsModule,
        ComponentsModule,
        MatProgressSpinnerModule
      ],
      declarations: [AuthComponent],
      providers: [
        { provide: AuthService, useValue: mockAuthService },
        { provide: ConfigService, useValue: mockConfigService },
        { provide: OidcService, useValue: mockOidc },
        { provide: ActivatedRoute, useValue: { snapshot: { queryParamMap: convertToParamMap(query) } } }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(AuthComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  };

  beforeEach(async () => {
    await setup();
  });

  it('should create the component and initialize form', () => {
    expect(component).toBeTruthy();
    expect(component.loginForm).toBeTruthy();
    expect(component.loginForm.controls.username).toBeTruthy();
    expect(component.loginForm.controls.password).toBeTruthy();
  });

  it('should mark form invalid if empty', () => {
    component.loginForm.setValue({ username: '', password: '' });
    expect(component.loginForm.invalid).toBeTrue();
  });

  it('should call authService.logIn on valid form submission via button click', fakeAsync(() => {
    const fakeResponse = of(void 0).pipe(observeOn(asyncScheduler));
    mockAuthService.logIn.and.returnValue(fakeResponse);
    component.loginForm.setValue({ username: 'user', password: 'pass' });

    const submitButtonDebugEl = fixture.debugElement.query(By.css('button-submit button'));
    submitButtonDebugEl.nativeElement.click();

    expect(component.isLoading).toBeTrue();
    expect(mockAuthService.logIn).toHaveBeenCalledWith('user', 'pass');

    tick();

    expect(component.isLoading).toBeFalse();
    expect(component.loginForm.value.username).toBeNull();
    expect(component.loginForm.value.password).toBeNull();
  }));

  it('should stop loading when login fails on submit button click', fakeAsync(() => {
    const errorResponse = throwError(() => new Error('Login failed')).pipe(observeOn(asyncScheduler));
    mockAuthService.logIn.and.returnValue(errorResponse);

    component.loginForm.setValue({ username: 'user', password: 'wrong' });

    const submitButtonDebugEl = fixture.debugElement.query(By.css('button-submit button'));
    submitButtonDebugEl.nativeElement.click();

    expect(component.isLoading).toBeTrue();
    expect(mockAuthService.logIn).toHaveBeenCalledWith('user', 'wrong');

    tick();

    expect(component.isLoading).toBeFalse();
  }));

  it('should stop loading when login fails without a specific error message', fakeAsync(() => {
    const errorResponse = throwError(() => ({})).pipe(observeOn(asyncScheduler));
    mockAuthService.logIn.and.returnValue(errorResponse);

    component.loginForm.setValue({ username: 'user', password: 'wrong' });

    const submitButtonDebugEl = fixture.debugElement.query(By.css('button-submit button'));
    submitButtonDebugEl.nativeElement.click();

    expect(component.isLoading).toBeTrue();
    expect(mockAuthService.logIn).toHaveBeenCalledWith('user', 'wrong');

    tick();

    expect(component.isLoading).toBeFalse();
  }));

  describe('SSO', () => {
    const ssoConfig: OidcConfigResponse = { enabled: true, displayName: 'Acme ID', localLoginEnabled: true };
    const q = (sel: string) => fixture.nativeElement.querySelector(sel) as HTMLElement | null;
    const text = () => fixture.nativeElement.textContent as string;

    afterEach(() => sessionStorage.removeItem(OidcService.REDIRECT_KEY));

    it('shows SSO button when enabled', async () => {
      await setup(ssoConfig);
      const btn = q('[data-testid="button-sso-login"]');
      expect(btn).toBeTruthy();
      expect(btn?.textContent).toContain('Sign in with Acme ID');
    });

    it('hides SSO button when disabled', () => {
      expect(q('[data-testid="button-sso-login"]')).toBeNull();
    });

    it('hides form when local login disabled', async () => {
      await setup({ ...ssoConfig, localLoginEnabled: false });
      expect(q('form')).toBeNull();
      expect(q('[data-testid="button-sso-login"]')).toBeTruthy();
    });

    it('shows form in link-required mode even when local login disabled', async () => {
      await setup({ ...ssoConfig, localLoginEnabled: false }, { sso: 'link-required' });
      expect(q('form')).toBeTruthy();
      expect(q('[data-testid="button-sso-login"]')).toBeNull();
      expect(text()).toContain(
        "Your Acme ID account isn't linked to a Hashtopolis account yet. Sign in with your Hashtopolis username and password to link it."
      );
    });

    it('link-required submit calls linkPending then completeSsoLogin', async () => {
      await setup(ssoConfig, { sso: 'link-required' });
      mockOidc.linkPending.and.returnValue(of(void 0));
      mockAuthService.completeSsoLogin.and.returnValue(of(void 0));
      component.loginForm.setValue({ username: 'user', password: 'pass' });
      component.onSubmit();
      expect(mockOidc.linkPending).toHaveBeenCalledWith('user', 'pass');
      expect(mockAuthService.completeSsoLogin).toHaveBeenCalledTimes(1);
      expect(mockAuthService.logIn).not.toHaveBeenCalled();
    });

    it('link-required 401 shows incorrect credentials message', async () => {
      await setup(ssoConfig, { sso: 'link-required' });
      mockOidc.linkPending.and.returnValue(throwError(() => new HttpErrorResponse({ status: 401 })));
      component.loginForm.setValue({ username: 'user', password: 'bad' });
      component.onSubmit();
      fixture.detectChanges();
      expect(text()).toContain('Incorrect username or password.');
      expect(q('form')).toBeTruthy();
      expect(mockAuthService.completeSsoLogin).not.toHaveBeenCalled();
      expect(component.isLoading).toBeFalse();
    });

    it('link-required non-401 error shows the expired message', async () => {
      await setup(ssoConfig, { sso: 'link-required' });
      mockOidc.linkPending.and.returnValue(throwError(() => new HttpErrorResponse({ status: 404 })));
      component.loginForm.setValue({ username: 'user', password: 'pass' });
      component.onSubmit();
      fixture.detectChanges();
      expect(text()).toContain('Your sign-in attempt expired. Please try again.');
      expect(component.isLoading).toBeFalse();
    });

    it('link-required completeSsoLogin failure shows the expired message', async () => {
      await setup(ssoConfig, { sso: 'link-required' });
      mockOidc.linkPending.and.returnValue(of(void 0));
      mockAuthService.completeSsoLogin.and.returnValue(throwError(() => new Error('x')));
      component.loginForm.setValue({ username: 'user', password: 'pass' });
      component.onSubmit();
      fixture.detectChanges();
      expect(text()).toContain('Your sign-in attempt expired. Please try again.');
      expect(component.isLoading).toBeFalse();
    });

    it('maps each reason code to its message', async () => {
      const expected: Record<string, string> = {
        expired: 'Your sign-in attempt expired. Please try again.',
        provider_error: 'Single sign-on failed. Please try again or contact your administrator.',
        user_disabled: 'Your account is disabled. Please contact your administrator.'
      };
      for (const [reason, message] of Object.entries(expected)) {
        await setup(ssoConfig, { sso: 'error', reason });
        expect(text()).toContain(message);
      }
    });

    it('unknown reason falls back to provider_error message', async () => {
      await setup(ssoConfig, { sso: 'error', reason: '<b>evil</b>' });
      expect(text()).toContain('Single sign-on failed. Please try again or contact your administrator.');
      expect(text()).not.toContain('evil');
    });

    it('SSO click stores redirectUrl and navigates to loginUrl', async () => {
      await setup(ssoConfig);
      Object.defineProperty(mockAuthService, 'redirectUrl', { value: '/hashlists', configurable: true });
      const nav = spyOn(component, 'navigateTo');
      (q('[data-testid="button-sso-login"]') as HTMLElement).click();
      expect(sessionStorage.getItem(OidcService.REDIRECT_KEY)).toBe('/hashlists');
      expect(nav).toHaveBeenCalledWith('https://api.test/auth/oidc/login?returnTo=x');
    });

    it('SSO click does not store an empty redirectUrl', async () => {
      await setup(ssoConfig);
      spyOn(component, 'navigateTo');
      component.onSsoLogin();
      expect(sessionStorage.getItem(OidcService.REDIRECT_KEY)).toBeNull();
    });
  });
});
