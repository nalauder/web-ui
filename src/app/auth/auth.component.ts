import { HttpStatus } from '@constants/http.config';
import {
  SSO_ERROR_MESSAGES,
  SSO_REDIRECT_KEY,
  SsoErrorReason,
  isSsoErrorReason,
  ssoRedirectSchema
} from '@constants/sso.config';

import { HttpErrorResponse } from '@angular/common/http';
import { AfterViewInit, ChangeDetectionStrategy, Component, DestroyRef, ElementRef, OnInit, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormGroup } from '@angular/forms';
import { FormControl } from '@angular/forms';
import { Validators } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';

import { AuthService } from '@services/access/auth.service';
import { DEFAULT_OIDC_CONFIG, OidcConfigResponse, OidcService } from '@services/access/oidc.service';
import { ConfigService } from '@services/shared/config.service';
import { ThemeService } from '@services/shared/theme.service';
import { SessionStorageService } from '@services/storage/session-storage.service';

import { HeaderConfig } from '@src/config/default/app/config.model';
import { environment } from '@src/environments/environment';

export interface LoginForm {
  username: FormControl<string | null>;
  password: FormControl<string | null>;
}

@Component({
  selector: 'app-login',
  templateUrl: './auth.component.html',
  styleUrls: ['./auth.component.scss'],
  changeDetection: ChangeDetectionStrategy.Eager,
  standalone: false
})
export class AuthComponent implements OnInit, AfterViewInit {
  private destroyRef = inject(DestroyRef);
  private configService = inject(ConfigService);
  private authService = inject(AuthService);
  private themeService = inject(ThemeService);
  private host = inject(ElementRef);
  private oidcService = inject(OidcService);
  private sessionStorage = inject<SessionStorageService<string>>(SessionStorageService);
  private route = inject(ActivatedRoute);

  /** Form group for the new SuperHashlist. */
  loginForm: FormGroup<LoginForm>;

  public isVisible = true;
  headerConfig: HeaderConfig;
  isDarkMode = false;

  /** on loggin loading */
  isLoading = false;

  oidcConfig: OidcConfigResponse = DEFAULT_OIDC_CONFIG;
  /** False until the OIDC config has resolved, so the form and SSO button never flash the wrong state. */
  configLoaded = false;
  /** True after returning from the provider with an identity that still has to be linked. */
  isLinkRequired = false;
  /** Message shown above the form (SSO error or link failure). */
  ssoMessage = '';

  constructor() {
    this.headerConfig = environment.config.header;
    this.buildForm();
  }

  /**
   * Lifecycle hook called after component initialization.
   */
  ngOnInit(): void {
    this.themeService.isDarkMode$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((isDark) => {
      this.isDarkMode = isDark;
    });
    this.setupConfig();
    this.configService.getEndpoint();

    const params = this.route.snapshot.queryParamMap;
    const sso = params.get('sso');
    this.isLinkRequired = sso === 'link-required';
    if (sso === 'error') {
      this.ssoMessage = this.errorMessage(params.get('reason'));
    }
    this.oidcService
      .getConfig()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((config) => {
        this.oidcConfig = config;
        this.configLoaded = true;
      });
  }

  get showSsoButton(): boolean {
    return this.configLoaded && this.oidcConfig.enabled && !this.isLinkRequired;
  }

  get showForm(): boolean {
    return this.configLoaded && (this.oidcConfig.localLoginEnabled || this.isLinkRequired);
  }

  /** Password reset only makes sense for a local login, which link-required mode is not. */
  get showForgotPassword(): boolean {
    return this.oidcConfig.localLoginEnabled && !this.isLinkRequired;
  }

  get linkRequiredMessage(): string {
    return `Your ${this.oidcConfig.displayName} account isn't linked to a Hashtopolis account yet. Sign in with your Hashtopolis username and password to link it.`;
  }

  /** Starts the SSO login, remembering where to return to afterwards. */
  onSsoLogin(): void {
    const redirect = this.authService.redirectUrl;
    if (redirect) {
      this.sessionStorage.setItem(SSO_REDIRECT_KEY, redirect, 0, ssoRedirectSchema);
    }
    this.navigateTo(this.oidcService.loginUrl());
  }

  /** Full-page navigation; a method so tests can spy on it. */
  navigateTo(url: string): void {
    window.location.href = url;
  }

  private errorMessage(reason: string | null): string {
    return SSO_ERROR_MESSAGES[isSsoErrorReason(reason) ? reason : SsoErrorReason.PROVIDER_ERROR];
  }

  /**
   * Lifecycle hook called after the component's view has been fully initialized.
   * Sets focus to the username input field for better user experience.
   * Uses a timeout to ensure that the view is fully rendered before trying to access the input element.
   */
  ngAfterViewInit(): void {
    setTimeout(() => {
      const input = this.host.nativeElement.querySelector(
        'input-text[formControlName="username"] input'
      ) as HTMLInputElement | null;
      input?.focus();
    });
  }

  private setupConfig(): void {
    this.configService.getEndpoint();
  }

  /**
   * Builds the form for Logging an user in
   */
  buildForm(): void {
    this.loginForm = new FormGroup<LoginForm>({
      username: new FormControl<string | null>(null, [Validators.required, Validators.minLength(2)]),
      password: new FormControl<string | null>(null, [Validators.required, Validators.minLength(3)])
    });
  }

  /**
   * Handle login, when user submits the login form.
   */
  onSubmit() {
    if (this.loginForm.invalid) {
      this.loginForm.markAllAsTouched();
      this.loginForm.updateValueAndValidity();
      return;
    }
    const username = this.loginForm.value.username ?? '';
    const password = this.loginForm.value.password ?? '';

    this.isLoading = true; // Show spinner

    if (this.isLinkRequired) {
      this.submitLink(username, password);
      return;
    }

    const authObs = this.authService.logIn(username, password);

    authObs.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: () => {
        this.loginForm.reset();
      },
      error: () => {
        // The global HTTP response interceptor already surfaces the error to the
        // user (modal dialog), so we only need to stop the loading spinner here.
        this.isLoading = false;
      },
      complete: () => {
        this.isLoading = false; // Hide spinner after attempting to log in
      }
    });
  }

  /** Link-required mode: verify the local credentials, then finish the SSO login. */
  private submitLink(username: string, password: string): void {
    this.ssoMessage = '';
    this.oidcService
      .linkPending(username, password)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => this.finishLink(),
        error: (err: HttpErrorResponse) => {
          this.isLoading = false;
          this.ssoMessage = this.linkErrorMessage(err.status);
        }
      });
  }

  /** 401 = wrong credentials (the pending request is still valid); anything else unmapped means it is gone. */
  private linkErrorMessage(status: number): string {
    switch (status) {
      case HttpStatus.UNAUTHORIZED:
        return 'Incorrect username or password.';
      case HttpStatus.FORBIDDEN:
        return SSO_ERROR_MESSAGES[SsoErrorReason.USER_DISABLED];
      case HttpStatus.CONFLICT:
        return SSO_ERROR_MESSAGES[SsoErrorReason.ALREADY_LINKED];
      default:
        return SSO_ERROR_MESSAGES[SsoErrorReason.EXPIRED];
    }
  }

  private finishLink(): void {
    this.authService
      .completeSsoLogin()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => this.loginForm.reset(),
        error: () => {
          this.isLoading = false;
          this.ssoMessage = SSO_ERROR_MESSAGES[SsoErrorReason.EXPIRED];
        },
        complete: () => (this.isLoading = false)
      });
  }
}
