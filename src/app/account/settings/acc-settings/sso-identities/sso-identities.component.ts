import { SsoErrorReason, isSsoErrorReason } from '@constants/sso.config';

import { Component, DestroyRef, OnInit, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatDialog } from '@angular/material/dialog';
import { ActivatedRoute, Router } from '@angular/router';

import { OidcConfigResponse, OidcIdentityView, OidcService } from '@services/access/oidc.service';
import { ConfirmDialogService } from '@services/confirm/confirm-dialog.service';
import { AlertService } from '@services/shared/alert.service';

import { LinkSsoDialogComponent } from '@src/app/account/settings/acc-settings/sso-identities/link-sso-dialog.component';

const GENERIC_ERROR = 'Single sign-on failed. Please try again or contact your administrator.';
const LINK_ERROR_MESSAGES: Partial<Record<SsoErrorReason, string>> = {
  [SsoErrorReason.ALREADY_LINKED]: 'That account is already linked to another Hashtopolis user.',
  [SsoErrorReason.EXPIRED]: 'Your sign-in attempt expired. Please try again.'
};

/** Account settings section to list, link and unlink SSO identities. Renders nothing when SSO is disabled. */
@Component({
  selector: 'app-sso-identities',
  templateUrl: './sso-identities.component.html',
  standalone: false
})
export class SsoIdentitiesComponent implements OnInit {
  config: OidcConfigResponse | null = null;
  identities: OidcIdentityView[] = [];

  private readonly oidc = inject(OidcService);
  private readonly confirmDialog = inject(ConfirmDialogService);
  private readonly alert = inject(AlertService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly dialog = inject(MatDialog);
  private readonly destroyRef = inject(DestroyRef);

  ngOnInit(): void {
    this.handleLinkResult();
    this.oidc
      .getConfig()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((config) => {
        this.config = config;
        if (config.enabled) {
          this.load();
        }
      });
  }

  load(): void {
    this.oidc
      .listIdentities()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((identities) => (this.identities = identities));
  }

  unlink(identity: OidcIdentityView): void {
    this.confirmDialog
      .confirmYesNo(
        `Unlink ${identity.label}?`,
        `Unlink ${identity.label}? You will no longer be able to sign in with it.`
      )
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((confirmed) => {
        if (!confirmed) {
          return;
        }
        this.oidc
          .unlink(identity.id)
          .pipe(takeUntilDestroyed(this.destroyRef))
          .subscribe(() => this.load());
      });
  }

  openLinkDialog(): void {
    this.dialog.open(LinkSsoDialogComponent, { width: '450px' });
  }

  /** Shows the outcome of a link flow the server redirected back with, then clears the query params. */
  private handleLinkResult(): void {
    const params = this.route.snapshot.queryParamMap;
    const sso = params.get('sso');
    if (sso === 'linked') {
      this.alert.showSuccessMessage('Single sign-on account linked.');
    } else if (sso === 'error') {
      const reason = params.get('reason');
      this.alert.showErrorMessage(
        (isSsoErrorReason(reason) ? LINK_ERROR_MESSAGES[reason] : undefined) ?? GENERIC_ERROR
      );
    } else {
      return;
    }
    void this.router.navigate([], { queryParams: {}, replaceUrl: true });
  }
}
