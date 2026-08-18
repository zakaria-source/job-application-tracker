import {inject} from '@angular/core';
import {CanActivateFn, Router} from '@angular/router';
import {CloudSessionStore} from '../cloud/cloud-session.store';
import {UserProfileService} from '../services/user-profile.service';

export const profileRequiredGuard: CanActivateFn = () => {
  const profileService = inject(UserProfileService);
  const sessions = inject(CloudSessionStore);
  const router = inject(Router);

  return profileService.hasProfile() || sessions.isAuthenticated()
    ? true
    : router.createUrlTree(['/onboarding']);
};
