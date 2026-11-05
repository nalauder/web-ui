import { of, throwError } from 'rxjs';

import { HttpErrorResponse } from '@angular/common/http';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { Router } from '@angular/router';

import { AuthService } from '@services/access/auth.service';

import { SsoCallbackComponent } from '@src/app/auth/sso-callback/sso-callback.component';

describe('SsoCallbackComponent', () => {
  let fixture: ComponentFixture<SsoCallbackComponent>;
  let authService: jasmine.SpyObj<AuthService>;
  let router: jasmine.SpyObj<Router>;

  const setup = (result$: ReturnType<AuthService['completeSsoLogin']>) => {
    authService = jasmine.createSpyObj('AuthService', ['completeSsoLogin']);
    authService.completeSsoLogin.and.returnValue(result$);
    router = jasmine.createSpyObj('Router', ['navigate']);

    TestBed.configureTestingModule({
      declarations: [SsoCallbackComponent],
      imports: [MatProgressSpinnerModule],
      providers: [
        { provide: AuthService, useValue: authService },
        { provide: Router, useValue: router }
      ]
    });
    fixture = TestBed.createComponent(SsoCallbackComponent);
    fixture.detectChanges();
  };

  it('calls completeSsoLogin once', () => {
    setup(of(undefined));
    fixture.detectChanges();
    expect(authService.completeSsoLogin).toHaveBeenCalledTimes(1);
  });

  it('navigates to /auth with sso=error&reason=expired and replaceUrl on failure', () => {
    setup(throwError(() => new HttpErrorResponse({ status: 401 })));
    expect(router.navigate).toHaveBeenCalledOnceWith(['/auth'], {
      queryParams: { sso: 'error', reason: 'expired' },
      replaceUrl: true
    });
  });

  it('does not navigate itself on success', () => {
    setup(of(undefined));
    expect(router.navigate).not.toHaveBeenCalled();
  });
});
