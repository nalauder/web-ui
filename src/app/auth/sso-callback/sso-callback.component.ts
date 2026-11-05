import { SsoErrorReason } from '@constants/sso.config';

import { Component, DestroyRef, OnInit, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';

import { AuthService } from '@services/access/auth.service';

/**
 * Landing route for the server's SSO callback. The refresh cookie is already set; this exchanges it
 * for a session. On success `AuthService.onAuthenticated` performs the post-login navigation.
 */
@Component({
  selector: 'app-sso-callback',
  templateUrl: './sso-callback.component.html',
  standalone: false
})
export class SsoCallbackComponent implements OnInit {
  private authService = inject(AuthService);
  private router = inject(Router);
  private destroyRef = inject(DestroyRef);

  ngOnInit(): void {
    this.authService
      .completeSsoLogin()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        error: () => {
          this.router.navigate(['/auth'], {
            queryParams: { sso: 'error', reason: SsoErrorReason.EXPIRED },
            replaceUrl: true
          });
        }
      });
  }
}
