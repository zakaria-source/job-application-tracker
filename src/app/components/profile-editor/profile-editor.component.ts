import {Component, inject} from '@angular/core';
import {ReactiveFormsModule, FormBuilder, Validators} from '@angular/forms';
import {Router} from '@angular/router';
import {UserProfile} from '../../models/user-profile.model';
import {UserProfileService} from '../../services/user-profile.service';

@Component({
  selector: 'app-profile-editor',
  standalone: true,
  imports: [ReactiveFormsModule],
  template: `
    <section class="profile-editor">
      <div class="editor-card">
        <div class="editor-heading">
          <span class="eyebrow">{{ isEditing ? 'PROFIL PROFESSIONNEL' : 'CONFIGURATION' }}</span>
          <h1>{{ isEditing ? 'Informations principales' : 'Configurez votre espace' }}</h1>
          <p>{{ isEditing ? 'Les informations utilisées pour personnaliser votre suivi.' : 'Renseignez uniquement l’essentiel pour démarrer.' }}</p>
        </div>

        <form [formGroup]="form" (ngSubmit)="save()">
          <div class="form-grid">
            <label>
              <span>Nom *</span>
              <input formControlName="name" autocomplete="name" placeholder="Alex Martin" />
              @if (form.controls.name.touched && form.controls.name.invalid) {
                <small class="field-error">Indiquez votre nom.</small>
              }
            </label>

            <label>
              <span>Poste recherché *</span>
              <input formControlName="headline" placeholder="Backend Engineer" />
              @if (form.controls.headline.touched && form.controls.headline.invalid) {
                <small class="field-error">Indiquez le poste recherché.</small>
              }
            </label>

            <label>
              <span>Expérience</span>
              <input formControlName="experienceLabel" placeholder="4 ans d’expérience" />
            </label>

            <label>
              <span>Localisation</span>
              <input formControlName="location" placeholder="Paris · Remote Europe" />
            </label>

            <label class="wide">
              <span>Compétences principales</span>
              <input formControlName="skills" placeholder="Java, Spring Boot, Kafka, Kubernetes" />
              <small>Séparez les compétences par des virgules.</small>
            </label>
          </div>

          <div class="form-actions">
            @if (isEditing) {
              <button type="button" class="secondary" (click)="cancel()">Annuler</button>
            }
            <button type="submit" class="primary" [disabled]="form.invalid">
              {{ isEditing ? 'Enregistrer' : 'Continuer' }}
            </button>
          </div>
        </form>
      </div>
    </section>
  `,
  styles: [`
    :host { display: block; }
    .profile-editor { max-width: 760px; margin: 0 auto; }
    .editor-card { border: 1px solid var(--jt-border); border-radius: 12px; background: #fff; box-shadow: var(--jt-shadow-sm); overflow: hidden; }
    .editor-heading { padding: 28px 30px 24px; border-bottom: 1px solid var(--jt-border); background: #fafafa; }
    .eyebrow { display: block; margin-bottom: 8px; color: #8b93a3; font-size: 9px; font-weight: 720; letter-spacing: .14em; }
    .editor-heading h1 { margin: 0; color: var(--jt-text); font-size: clamp(24px, 3vw, 29px); font-weight: 630; letter-spacing: -.04em; }
    .editor-heading p { margin: 7px 0 0; color: var(--jt-text-muted); font-size: 12px; line-height: 1.55; }
    form { padding: 28px 30px 26px; }
    .form-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 16px; }
    label { display: flex; flex-direction: column; gap: 7px; color: #344054; font-size: 11px; font-weight: 620; }
    label.wide { grid-column: 1 / -1; }
    input { width: 100%; min-height: 43px; box-sizing: border-box; border: 1px solid var(--jt-border-strong); border-radius: 8px; padding: 0 12px; color: var(--jt-text); background: #fff; font: inherit; font-size: 12px; font-weight: 480; }
    input:focus { outline: none; border-color: var(--jt-accent); box-shadow: 0 0 0 3px rgba(98,91,246,.11); }
    input::placeholder { color: #a1a8b5; }
    small { color: var(--jt-text-soft); font-size: 10px; font-weight: 500; line-height: 1.4; }
    .field-error { color: var(--jt-danger); font-weight: 620; }
    .form-actions { display: flex; justify-content: flex-end; gap: 8px; margin-top: 24px; padding-top: 18px; border-top: 1px solid var(--jt-border); }
    button { min-height: 39px; border-radius: 8px; padding: 0 16px; font: inherit; font-size: 12px; font-weight: 650; cursor: pointer; }
    button.primary { min-width: 116px; border: 0; color: #fff; background: var(--jt-primary); }
    button.primary:hover { background: var(--jt-primary-strong); }
    button.primary:disabled { opacity: .45; cursor: not-allowed; }
    button.secondary { border: 1px solid var(--jt-border-strong); color: var(--jt-text-muted); background: #fff; }
    @media (max-width: 620px) { .editor-heading, form { padding: 22px; } .form-grid { grid-template-columns: 1fr; } label.wide { grid-column: auto; } .form-actions { flex-direction: column-reverse; } .form-actions button { width: 100%; } }
  `]
})
export class ProfileEditorComponent {
  private readonly fb = inject(FormBuilder);
  private readonly router = inject(Router);
  private readonly profileService = inject(UserProfileService);
  private readonly existingProfile = this.profileService.getProfile();

  readonly isEditing = this.profileService.hasProfile();

  readonly form = this.fb.nonNullable.group({
    name: [this.existingProfile?.name ?? '', Validators.required],
    headline: [this.existingProfile?.headline ?? '', Validators.required],
    experienceLabel: [this.existingProfile?.experienceLabel ?? ''],
    location: [this.existingProfile?.location ?? ''],
    skills: [this.existingProfile?.coreSkills.join(', ') ?? '']
  });

  save(): void {
    if (this.form.invalid) {
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

    this.profileService.saveProfile(profile);
    void this.router.navigate(['/dashboard']);
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
}
