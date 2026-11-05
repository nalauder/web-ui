import { HttpStatus } from '@constants/http.config';

import { HttpErrorResponse } from '@angular/common/http';
import { Component, DestroyRef, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, Validators } from '@angular/forms';
import { MatDialogRef } from '@angular/material/dialog';

import { OidcService } from '@services/access/oidc.service';

/** Asks for the current password, then starts the SSO link flow with a full-page redirect. */
@Component({
  selector: 'app-link-sso-dialog',
  templateUrl: './link-sso-dialog.component.html',
  standalone: false
})
export class LinkSsoDialogComponent {
  readonly password = new FormControl('', { nonNullable: true, validators: [Validators.required] });
  errorMessage: string | null = null;
  loading = false;

  private readonly oidc = inject(OidcService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly dialogRef = inject(MatDialogRef<LinkSsoDialogComponent>);

  submit(): void {
    if (this.password.invalid || this.loading) {
      this.password.markAsTouched();
      return;
    }
    this.loading = true;
    this.errorMessage = null;
    this.oidc
      .startLink(this.password.value)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: ({ authorizeUrl }) => {
          this.dialogRef.close();
          this.navigateTo(authorizeUrl);
        },
        error: (err: unknown) => {
          this.loading = false;
          this.password.reset();
          this.errorMessage =
            err instanceof HttpErrorResponse && err.status === HttpStatus.UNAUTHORIZED
              ? 'Incorrect password.'
              : 'Could not start single sign-on. Please try again.';
        }
      });
  }

  /** Full-page navigation; a method so tests can spy on it. */
  navigateTo(url: string): void {
    window.location.href = url;
  }
}
