import {inject} from '@angular/core';
import {CanActivateFn, Router} from '@angular/router';
import {UserProfileService} from '../services/user-profile.service';

export const profileRequiredGuard: CanActivateFn = () => {
  const profileService = inject(UserProfileService);
  const router = inject(Router);

  return profileService.hasProfile()
    ? true
    : router.createUrlTree(['/onboarding']);
};
