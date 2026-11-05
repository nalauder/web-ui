import { SSO_REDIRECT_KEY } from '@constants/sso.config';
import { Observable, Subject, asyncScheduler, observeOn, of, throwError } from 'rxjs';

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
import { DEFAULT_OIDC_CONFIG, OidcConfigResponse, OidcService } from '@services/access/oidc.service';
import { ConfigService } from '@services/shared/config.service';
import { SessionStorageService } from '@services/storage/session-storage.service';

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

  const defaultConfig: OidcConfigResponse = DEFAULT_OIDC_CONFIG;

  const setup = async (
    config: OidcConfigResponse | Observable<OidcConfigResponse> = defaultConfig,
    query: Record<string, string> = {}
  ) => {
    TestBed.resetTestingModule();
    mockAuthService = jasmine.createSpyObj('AuthService', ['logIn', 'completeSsoLogin'], { redirectUrl: '' });
    mockOidc = jasmine.createSpyObj('OidcService', ['getConfig', 'loginUrl', 'linkPending']);
    mockOidc.getConfig.and.returnValue(config instanceof Observable ? config : of(config));
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
    const queryElement = (sel: string) => fixture.nativeElement.querySelector(sel) as HTMLElement | null;
    const renderedText = () => fixture.nativeElement.textContent as string;

    afterEach(() => TestBed.inject(SessionStorageService).removeItem(SSO_REDIRECT_KEY));

    it('shows SSO button when enabled', async () => {
      await setup(ssoConfig);
      const btn = queryElement('[data-testid="button-sso-login"]');
      expect(btn).toBeTruthy();
      expect(btn?.textContent).toContain('Sign in with Acme ID');
    });

    it('hides SSO button when disabled', () => {
      expect(queryElement('[data-testid="button-sso-login"]')).toBeNull();
    });

    it('hides form when local login disabled', async () => {
      await setup({ ...ssoConfig, localLoginEnabled: false });
      expect(queryElement('form')).toBeNull();
      expect(queryElement('[data-testid="button-sso-login"]')).toBeTruthy();
    });

    it('shows form in link-required mode even when local login disabled', async () => {
      await setup({ ...ssoConfig, localLoginEnabled: false }, { sso: 'link-required' });
      expect(queryElement('form')).toBeTruthy();
      expect(queryElement('[data-testid="button-sso-login"]')).toBeNull();
      expect(renderedText()).toContain(
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
      expect(renderedText()).toContain('Incorrect username or password.');
      expect(queryElement('form')).toBeTruthy();
      expect(mockAuthService.completeSsoLogin).not.toHaveBeenCalled();
      expect(component.isLoading).toBeFalse();
    });

    it('link-required non-401 error shows the expired message', async () => {
      await setup(ssoConfig, { sso: 'link-required' });
      mockOidc.linkPending.and.returnValue(throwError(() => new HttpErrorResponse({ status: 404 })));
      component.loginForm.setValue({ username: 'user', password: 'pass' });
      component.onSubmit();
      fixture.detectChanges();
      expect(renderedText()).toContain('Your sign-in attempt expired. Please try again.');
      expect(component.isLoading).toBeFalse();
    });

    it('link-required 403 shows the disabled account message', async () => {
      await setup(ssoConfig, { sso: 'link-required' });
      mockOidc.linkPending.and.returnValue(throwError(() => new HttpErrorResponse({ status: 403 })));
      component.loginForm.setValue({ username: 'user', password: 'pass' });
      component.onSubmit();
      fixture.detectChanges();
      expect(renderedText()).toContain('Your account is disabled. Please contact your administrator.');
      expect(component.isLoading).toBeFalse();
    });

    it('link-required 409 shows the already linked message', async () => {
      await setup(ssoConfig, { sso: 'link-required' });
      mockOidc.linkPending.and.returnValue(throwError(() => new HttpErrorResponse({ status: 409 })));
      component.loginForm.setValue({ username: 'user', password: 'pass' });
      component.onSubmit();
      fixture.detectChanges();
      expect(renderedText()).toContain('That account is already linked to another Hashtopolis user.');
      expect(component.isLoading).toBeFalse();
    });

    it('shows the forgot password link while local login is enabled', async () => {
      await setup(ssoConfig);
      expect(queryElement('.forgot-password-link')).toBeTruthy();
    });

    it('hides the forgot password link in link-required mode', async () => {
      await setup({ ...ssoConfig, localLoginEnabled: false }, { sso: 'link-required' });
      expect(queryElement('form')).toBeTruthy();
      expect(queryElement('.forgot-password-link')).toBeNull();
    });

    it('renders neither the form nor the SSO button until the config has resolved', async () => {
      const config$ = new Subject<OidcConfigResponse>();
      await setup(config$);
      expect(queryElement('form')).toBeNull();
      expect(queryElement('[data-testid="button-sso-login"]')).toBeNull();

      config$.next({ ...ssoConfig, localLoginEnabled: false });
      fixture.detectChanges();
      expect(queryElement('form')).toBeNull();
      expect(queryElement('[data-testid="button-sso-login"]')).toBeTruthy();
    });

    it('renders the form once the config has resolved with local login enabled', async () => {
      const config$ = new Subject<OidcConfigResponse>();
      await setup(config$);
      config$.next(ssoConfig);
      fixture.detectChanges();
      expect(queryElement('form')).toBeTruthy();
    });

    it('link-required completeSsoLogin failure shows the expired message', async () => {
      await setup(ssoConfig, { sso: 'link-required' });
      mockOidc.linkPending.and.returnValue(of(void 0));
      mockAuthService.completeSsoLogin.and.returnValue(throwError(() => new Error('x')));
      component.loginForm.setValue({ username: 'user', password: 'pass' });
      component.onSubmit();
      fixture.detectChanges();
      expect(renderedText()).toContain('Your sign-in attempt expired. Please try again.');
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
        expect(renderedText()).toContain(message);
      }
    });

    it('unknown reason falls back to provider_error message', async () => {
      await setup(ssoConfig, { sso: 'error', reason: '<b>evil</b>' });
      expect(renderedText()).toContain('Single sign-on failed. Please try again or contact your administrator.');
      expect(renderedText()).not.toContain('evil');
    });

    it('SSO click stores redirectUrl and navigates to loginUrl', async () => {
      await setup(ssoConfig);
      Object.defineProperty(mockAuthService, 'redirectUrl', { value: '/hashlists', configurable: true });
      const nav = spyOn(component, 'navigateTo');
      (queryElement('[data-testid="button-sso-login"]') as HTMLElement).click();
      expect(TestBed.inject(SessionStorageService).getItem(SSO_REDIRECT_KEY)).toBe('/hashlists');
      expect(nav).toHaveBeenCalledWith('https://api.test/auth/oidc/login?returnTo=x');
    });

    it('SSO click does not store an empty redirectUrl', async () => {
      await setup(ssoConfig);
      spyOn(component, 'navigateTo');
      component.onSsoLogin();
      expect(TestBed.inject(SessionStorageService).getItem(SSO_REDIRECT_KEY)).toBeNull();
    });
  });
});
