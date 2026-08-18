import {inject} from '@angular/core';
import {CanActivateFn, Router} from '@angular/router';
import {CloudSessionStore} from '../cloud/cloud-session.store';

export const authRequiredGuard: CanActivateFn = () => {
  const sessions = inject(CloudSessionStore);
  const router = inject(Router);

  return sessions.isAuthenticated()
    ? true
    : router.createUrlTree(['/account']);
};
