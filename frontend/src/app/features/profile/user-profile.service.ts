import {Injectable} from '@angular/core';
import {BehaviorSubject, Observable, catchError, map, tap, throwError} from 'rxjs';
import {JobTrackrApiService} from '@app/core/api/jobtrackr-api.service';
import {UserProfile} from '@app/features/profile/user-profile.model';

@Injectable({providedIn: 'root'})
export class UserProfileService {
  private readonly profileSubject = new BehaviorSubject<UserProfile | null>(null);

  constructor(private readonly api: JobTrackrApiService) {}

  profileChanges(): Observable<UserProfile | null> {
    return this.profileSubject.asObservable();
  }

  hasProfile(): boolean {
    const profile = this.profileSubject.value;
    return !!profile?.name.trim() && !!profile?.headline.trim();
  }

  getProfile(): UserProfile | null {
    return this.profileSubject.value;
  }

  connect(profile: UserProfile): void {
    this.profileSubject.next(this.normalize(profile));
  }

  clear(): void {
    this.profileSubject.next(null);
  }

  saveProfile(profile: UserProfile): Observable<UserProfile> {
    const normalized = this.normalize(profile);
    const previous = this.profileSubject.value;
    this.profileSubject.next(normalized);

    return this.api.updateProfile(normalized).pipe(
      map(saved => this.normalize(saved)),
      tap(saved => this.profileSubject.next(saved)),
      catchError(error => {
        this.profileSubject.next(previous);
        return throwError(() => error);
      })
    );
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
