import {Inject, Injectable, Optional} from '@angular/core';
import {BehaviorSubject, Observable} from 'rxjs';
import {CloudApiService} from '../cloud/cloud-api.service';
import {UserProfile} from '../models/user-profile.model';

@Injectable({providedIn: 'root'})
export class UserProfileService {
  private readonly storageKey = 'jobtrackr-user-profile-v1';
  private readonly profileSubject = new BehaviorSubject<UserProfile | null>(this.readLocalProfile());
  private cloudMode = false;

  constructor(
    @Optional() @Inject(CloudApiService) private readonly cloudApi: CloudApiService | null = null
  ) {}

  profileChanges(): Observable<UserProfile | null> {
    return this.profileSubject.asObservable();
  }

  isCloudMode(): boolean {
    return this.cloudMode;
  }

  hasProfile(): boolean {
    const profile = this.getProfile();
    return !!profile?.name.trim() && !!profile?.headline.trim();
  }

  getProfile(): UserProfile | null {
    if (this.cloudMode) {
      return this.profileSubject.value;
    }

    const local = this.readLocalProfile();
    this.profileSubject.next(local);
    return local;
  }

  getLocalProfileSnapshot(): UserProfile | null {
    return this.readLocalProfile();
  }

  connectCloud(profile: UserProfile): void {
    this.cloudMode = true;
    this.profileSubject.next(this.normalize(profile));
  }

  disconnectCloud(): void {
    this.cloudMode = false;
    this.profileSubject.next(this.readLocalProfile());
  }

  saveProfile(profile: UserProfile): void {
    const normalized = this.normalize(profile);
    this.profileSubject.next(normalized);

    if (this.cloudMode && this.cloudApi) {
      this.cloudApi.updateProfile(normalized).subscribe({
        next: saved => this.profileSubject.next(this.normalize(saved)),
        error: error => console.error('Unable to persist cloud profile', error)
      });
      return;
    }

    localStorage.setItem(this.storageKey, JSON.stringify(normalized));
  }

  clearProfile(): void {
    localStorage.removeItem(this.storageKey);
    if (!this.cloudMode) {
      this.profileSubject.next(null);
    }
  }

  private readLocalProfile(): UserProfile | null {
    const raw = localStorage.getItem(this.storageKey);
    if (!raw) {
      return null;
    }

    try {
      const candidate = JSON.parse(raw) as Partial<UserProfile>;
      if (!candidate.name?.trim() || !candidate.headline?.trim()) {
        return null;
      }
      return this.normalize(candidate as UserProfile);
    } catch {
      return null;
    }
  }

  private normalize(profile: UserProfile): UserProfile {
    return {
      name: profile.name?.trim() ?? '',
      headline: profile.headline?.trim() ?? '',
      experienceLabel: profile.experienceLabel?.trim() ?? '',
      location: profile.location?.trim() ?? '',
      summary: profile.summary?.trim() ?? '',
      coreSkills: this.normalizeList(profile.coreSkills),
      certifications: this.normalizeList(profile.certifications),
      education: profile.education?.trim() ?? '',
      targetCompensation: profile.targetCompensation?.trim() ?? ''
    };
  }

  private normalizeList(values?: readonly string[]): string[] {
    return (values ?? [])
      .map(value => value.trim())
      .filter((value, index, all) => value.length > 0 && all.indexOf(value) === index);
  }
}
