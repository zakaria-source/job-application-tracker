import {inject} from '@angular/core';
import {CanActivateFn, Router} from '@angular/router';
import {SessionStore} from '@app/core/auth/session.store';

export const authRequiredGuard: CanActivateFn = () => {
  const sessions = inject(SessionStore);
  const router = inject(Router);

  return sessions.isAuthenticated()
    ? true
    : router.createUrlTree(['/account']);
};
