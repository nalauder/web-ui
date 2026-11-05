import { Component, OnInit, inject } from '@angular/core';
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

  ngOnInit(): void {
    this.authService.completeSsoLogin().subscribe({
      error: () => {
        this.router.navigate(['/auth'], { queryParams: { sso: 'error', reason: 'expired' }, replaceUrl: true });
      }
    });
  }
}
