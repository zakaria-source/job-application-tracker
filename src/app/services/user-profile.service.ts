import {Injectable} from '@angular/core';
import {UserProfile} from '../models/user-profile.model';

@Injectable({providedIn: 'root'})
export class UserProfileService {
  private readonly storageKey = 'jobtrackr-user-profile-v1';

  hasProfile(): boolean {
    return this.getProfile() !== null;
  }

  getProfile(): UserProfile | null {
    const raw = localStorage.getItem(this.storageKey);
    if (!raw) {
      return null;
    }

    try {
      const candidate = JSON.parse(raw) as Partial<UserProfile>;
      if (!candidate.name?.trim() || !candidate.headline?.trim()) {
        return null;
      }

      return {
        name: candidate.name.trim(),
        headline: candidate.headline.trim(),
        experienceLabel: candidate.experienceLabel?.trim() ?? '',
        location: candidate.location?.trim() ?? '',
        summary: candidate.summary?.trim() ?? '',
        coreSkills: this.normalizeList(candidate.coreSkills),
        certifications: this.normalizeList(candidate.certifications),
        education: candidate.education?.trim() ?? '',
        targetCompensation: candidate.targetCompensation?.trim() ?? ''
      };
    } catch {
      return null;
    }
  }

  saveProfile(profile: UserProfile): void {
    const normalized: UserProfile = {
      ...profile,
      name: profile.name.trim(),
      headline: profile.headline.trim(),
      experienceLabel: profile.experienceLabel.trim(),
      location: profile.location.trim(),
      summary: profile.summary.trim(),
      coreSkills: this.normalizeList(profile.coreSkills),
      certifications: this.normalizeList(profile.certifications),
      education: profile.education.trim(),
      targetCompensation: profile.targetCompensation.trim()
    };

    localStorage.setItem(this.storageKey, JSON.stringify(normalized));
  }

  clearProfile(): void {
    localStorage.removeItem(this.storageKey);
  }

  private normalizeList(values?: readonly string[]): string[] {
    return (values ?? [])
      .map(value => value.trim())
      .filter((value, index, all) => value.length > 0 && all.indexOf(value) === index);
  }
}
