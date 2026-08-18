import {Component, inject} from '@angular/core';
import {ReactiveFormsModule, FormBuilder, Validators} from '@angular/forms';
import {Router} from '@angular/router';
import {UserProfile} from '../../models/user-profile.model';
import {DemoDataService} from '../../services/demo-data.service';
import {UserProfileService} from '../../services/user-profile.service';

@Component({
  selector: 'app-profile-editor',
  standalone: true,
  imports: [ReactiveFormsModule],
  template: `
    <section class="profile-editor">
      <div class="editor-card">
        <div class="editor-heading">
          <span class="eyebrow">{{ isEditing ? 'PROFIL & PRÉFÉRENCES' : 'BIENVENUE SUR JOBTRACKR' }}</span>
          <h2>{{ isEditing ? 'Personnaliser votre espace' : 'Configurez votre recherche d’emploi' }}</h2>
          <p>
            Ces informations restent dans ce navigateur. Elles personnalisent le dashboard mais ne sont jamais
            nécessaires pour suivre une candidature.
          </p>
        </div>

        <form [formGroup]="form" (ngSubmit)="save()">
          <div class="form-grid">
            <label>
              <span>Nom affiché *</span>
              <input formControlName="name" autocomplete="name" placeholder="Ex. Alex Martin" />
            </label>

            <label>
              <span>Métier / titre cible *</span>
              <input formControlName="headline" placeholder="Ex. Backend Engineer" />
            </label>

            <label>
              <span>Expérience</span>
              <input formControlName="experienceLabel" placeholder="Ex. 4 ans d’expérience" />
            </label>

            <label>
              <span>Localisation / mobilité</span>
              <input formControlName="location" placeholder="Ex. Paris · remote Europe" />
            </label>

            <label class="wide">
              <span>Résumé</span>
              <textarea formControlName="summary" rows="4" placeholder="Votre positionnement, ce que vous recherchez et vos points forts."></textarea>
            </label>

            <label class="wide">
              <span>Compétences principales</span>
              <input formControlName="skills" placeholder="Java, Spring Boot, Kafka, Kubernetes" />
              <small>Séparez les compétences par des virgules.</small>
            </label>

            <label class="wide">
              <span>Certifications</span>
              <input formControlName="certifications" placeholder="CKA, AWS Developer Associate" />
              <small>Séparez les certifications par des virgules.</small>
            </label>

            <label>
              <span>Formation</span>
              <input formControlName="education" placeholder="Ex. Master Informatique" />
            </label>

            <label>
              <span>Objectif de rémunération</span>
              <input formControlName="targetCompensation" placeholder="Ex. 65 k€ / an" />
            </label>
          </div>

          <label class="demo-option">
            <input type="checkbox" formControlName="loadDemo" />
            <span>
              <strong>Ajouter 3 candidatures fictives</strong>
              <small>Utile pour découvrir le Kanban et les analytics. Rien n’écrase vos données existantes.</small>
            </span>
          </label>

          <div class="form-actions">
            @if (isEditing) {
              <button type="button" class="secondary" (click)="cancel()">Annuler</button>
            }
            <button type="submit" class="primary" [disabled]="form.invalid">
              {{ isEditing ? 'Enregistrer' : 'Créer mon espace' }}
            </button>
          </div>
        </form>
      </div>
    </section>
  `,
  styles: [`
    .profile-editor { max-width: 920px; margin: 0 auto; }
    .editor-card { background: #fff; border: 1px solid #e5e7eb; border-radius: 18px; padding: 28px; box-shadow: 0 12px 30px rgba(15, 23, 42, .06); }
    .editor-heading { margin-bottom: 24px; }
    .eyebrow { display: inline-block; margin-bottom: 8px; font-size: 12px; font-weight: 800; letter-spacing: .12em; color: #4f46e5; }
    h2 { margin: 0 0 8px; font-size: 28px; }
    p { margin: 0; color: #64748b; line-height: 1.6; }
    .form-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 18px; }
    label { display: flex; flex-direction: column; gap: 7px; font-weight: 650; color: #1e293b; }
    label.wide { grid-column: 1 / -1; }
    input, textarea { width: 100%; box-sizing: border-box; border: 1px solid #cbd5e1; border-radius: 10px; padding: 11px 12px; font: inherit; font-weight: 450; color: #0f172a; background: #fff; }
    input:focus, textarea:focus { outline: 3px solid rgba(79, 70, 229, .12); border-color: #6366f1; }
    small { color: #64748b; font-weight: 450; line-height: 1.4; }
    .demo-option { margin-top: 22px; padding: 14px; border: 1px solid #dbeafe; border-radius: 12px; background: #f8fbff; flex-direction: row; align-items: flex-start; gap: 12px; }
    .demo-option input { width: auto; margin-top: 3px; }
    .demo-option span { display: flex; flex-direction: column; gap: 3px; }
    .form-actions { display: flex; justify-content: flex-end; gap: 10px; margin-top: 24px; }
    button { border: 0; border-radius: 10px; padding: 11px 18px; font: inherit; font-weight: 750; cursor: pointer; }
    button.primary { background: #4f46e5; color: #fff; }
    button.primary:disabled { opacity: .45; cursor: not-allowed; }
    button.secondary { background: #eef2f7; color: #334155; }
    @media (max-width: 720px) { .form-grid { grid-template-columns: 1fr; } label.wide { grid-column: auto; } .editor-card { padding: 20px; } }
  `]
})
export class ProfileEditorComponent {
  private readonly fb = inject(FormBuilder);
  private readonly router = inject(Router);
  private readonly profileService = inject(UserProfileService);
  private readonly demoData = inject(DemoDataService);

  readonly isEditing = this.profileService.hasProfile();
  readonly form = this.fb.nonNullable.group({
    name: ['', Validators.required],
    headline: ['', Validators.required],
    experienceLabel: [''],
    location: [''],
    summary: [''],
    skills: [''],
    certifications: [''],
    education: [''],
    targetCompensation: [''],
    loadDemo: [false]
  });

  constructor() {
    const existing = this.profileService.getProfile();
    if (existing) {
      this.form.patchValue({
        name: existing.name,
        headline: existing.headline,
        experienceLabel: existing.experienceLabel,
        location: existing.location,
        summary: existing.summary,
        skills: existing.coreSkills.join(', '),
        certifications: existing.certifications.join(', '),
        education: existing.education,
        targetCompensation: existing.targetCompensation
      });
    }
  }

  save(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const value = this.form.getRawValue();
    const profile: UserProfile = {
      name: value.name,
      headline: value.headline,
      experienceLabel: value.experienceLabel,
      location: value.location,
      summary: value.summary,
      coreSkills: this.splitList(value.skills),
      certifications: this.splitList(value.certifications),
      education: value.education,
      targetCompensation: value.targetCompensation
    };

    this.profileService.saveProfile(profile);
    if (value.loadDemo) {
      this.demoData.load();
    }

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
