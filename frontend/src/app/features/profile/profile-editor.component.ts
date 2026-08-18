import {HttpErrorResponse} from '@angular/common/http';
import {Component, inject} from '@angular/core';
import {FormBuilder, ReactiveFormsModule, Validators} from '@angular/forms';
import {Router} from '@angular/router';
import {UserProfile} from '@app/features/profile/user-profile.model';
import {UserProfileService} from '@app/features/profile/user-profile.service';

@Component({
  selector: 'app-profile-editor',
  standalone: true,
  imports: [ReactiveFormsModule],
  templateUrl: './profile-editor.component.html',
  styleUrl: './profile-editor.component.css'
})
export class ProfileEditorComponent {
  private readonly fb = inject(FormBuilder);
  private readonly router = inject(Router);
  private readonly profileService = inject(UserProfileService);
  private readonly existingProfile = this.profileService.getProfile();

  readonly isEditing = this.profileService.hasProfile();
  saving = false;
  errorMessage = '';

  readonly form = this.fb.nonNullable.group({
    name: [this.existingProfile?.name ?? '', Validators.required],
    headline: [this.existingProfile?.headline ?? '', Validators.required],
    experienceLabel: [this.existingProfile?.experienceLabel ?? ''],
    location: [this.existingProfile?.location ?? ''],
    skills: [this.existingProfile?.coreSkills.join(', ') ?? '']
  });

  save(): void {
    if (this.form.invalid || this.saving) {
      this.form.markAllAsTouched();
      return;
    }

    const value = this.form.getRawValue();
    const previous = this.existingProfile;
    const profile: UserProfile = {
      name: value.name,
      headline: value.headline,
      experienceLabel: value.experienceLabel,
      location: value.location,
      summary: previous?.summary ?? '',
      coreSkills: this.splitList(value.skills),
      certifications: previous?.certifications ?? [],
      education: previous?.education ?? '',
      targetCompensation: previous?.targetCompensation ?? ''
    };

    this.saving = true;
    this.errorMessage = '';
    this.profileService.saveProfile(profile).subscribe({
      next: () => {
        this.saving = false;
        void this.router.navigate(['/dashboard']);
      },
      error: error => {
        this.saving = false;
        this.errorMessage = this.readError(error);
      }
    });
  }

  cancel(): void {
    void this.router.navigate(['/dashboard']);
  }

  private splitList(value: string): string[] {
    return value
      .split(',')
      .map(item => item.trim())
      .filter((item, index, all) => item.length > 0 && all.indexOf(item) === index);
  }

  private readError(error: unknown): string {
    if (error instanceof HttpErrorResponse && error.status === 0) {
      return 'Le service est momentanément indisponible. Votre profil n’a pas été modifié.';
    }
    return 'Impossible d’enregistrer le profil. Réessayez dans quelques instants.';
  }
}
