import { NgModule } from '@angular/core';
import { RouterModule } from '@angular/router';

import { MyRoute } from '@models/routes.model';

import { AuthComponent } from '@src/app/auth/auth.component';
import { SsoCallbackComponent } from '@src/app/auth/sso-callback/sso-callback.component';
import { IsAuth } from '@src/app/core/_guards/login.guard';

const routes: MyRoute[] = [
  {
    path: 'auth',
    children: [
      {
        path: '',
        component: AuthComponent,
        canActivate: [IsAuth]
      },
      {
        // No IsAuth guard: the user is not yet authenticated on arrival
        path: 'sso',
        component: SsoCallbackComponent
      }
    ]
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class AuthRoutingModule {}
