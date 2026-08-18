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
          <div>
            <span class="eyebrow">{{ isEditing ? 'PROFIL' : 'BIENVENUE' }}</span>
            <h1>{{ isEditing ? 'Votre profil' : 'Configurez votre espace' }}</h1>
            <p>
              {{ isEditing
                ? 'Mettez à jour les informations utiles à votre recherche.'
                : 'Votre nom et votre objectif suffisent pour commencer. Tout le reste est facultatif.' }}
            </p>
          </div>
          <span class="required-note">* requis</span>
        </div>

        <form [formGroup]="form" (ngSubmit)="save()">
          <section class="form-section">
            <div class="section-heading">
              <h2>L’essentiel</h2>
              <p>Les informations affichées sur votre tableau de bord.</p>
            </div>

            <div class="form-grid">
              <label>
                <span>Nom affiché *</span>
                <input formControlName="name" autocomplete="name" placeholder="Ex. Alex Martin" />
                @if (form.controls.name.touched && form.controls.name.invalid) {
                  <small class="field-error">Indiquez le nom à afficher.</small>
                }
              </label>

              <label>
                <span>Métier / titre cible *</span>
                <input formControlName="headline" placeholder="Ex. Backend Engineer" />
                @if (form.controls.headline.touched && form.controls.headline.invalid) {
                  <small class="field-error">Indiquez le poste recherché.</small>
                }
              </label>

              <label>
                <span>Expérience</span>
                <input formControlName="experienceLabel" placeholder="Ex. 4 ans d’expérience" />
              </label>

              <label>
                <span>Localisation / mobilité</span>
                <input formControlName="location" placeholder="Ex. Paris · Remote Europe" />
              </label>
            </div>
          </section>

          <section class="form-section">
            <div class="section-heading">
              <h2>Informations complémentaires</h2>
              <p>Facultatif. Ajoutez uniquement ce qui vous est utile.</p>
            </div>

            <div class="form-grid">
              <label class="wide">
                <span>Résumé</span>
                <textarea formControlName="summary" rows="3" placeholder="Votre spécialité, ce que vous recherchez et vos principaux points forts."></textarea>
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
          </section>

          @if (!isEditing) {
            <label class="demo-option">
              <input type="checkbox" formControlName="loadDemo" />
              <span class="demo-checkmark"></span>
              <span>
                <strong>Ajouter 3 candidatures de démonstration</strong>
                <small>Pour découvrir immédiatement le dashboard et le Kanban.</small>
              </span>
            </label>
          }

          <div class="form-actions">
            @if (isEditing) {
              <button type="button" class="secondary" (click)="cancel()">Annuler</button>
            }
            <button type="submit" class="primary" [disabled]="form.invalid">
              {{ isEditing ? 'Enregistrer' : 'Commencer' }}
            </button>
          </div>
        </form>
      </div>
    </section>
  `,
  styles: [`
    :host { display: block; }
    .profile-editor { max-width: 900px; margin: 0 auto; }
    .editor-card { border: 1px solid var(--jt-border); border-radius: 20px; padding: 28px; background: #fff; box-shadow: var(--jt-shadow-sm); }
    .editor-heading { display: flex; align-items: flex-start; justify-content: space-between; gap: 18px; margin-bottom: 24px; padding-bottom: 22px; border-bottom: 1px solid var(--jt-border); }
    .eyebrow { display: inline-block; margin-bottom: 7px; color: var(--jt-text-soft); font-size: 9px; font-weight: 800; letter-spacing: .12em; }
    .editor-heading h1 { margin: 0; color: var(--jt-text); font-size: clamp(26px, 3vw, 34px); font-weight: 780; letter-spacing: -.04em; }
    .editor-heading p { max-width: 620px; margin: 7px 0 0; color: var(--jt-text-muted); font-size: 13px; line-height: 1.55; }
    .required-note { margin-top: 3px; color: var(--jt-text-soft); font-size: 10px; white-space: nowrap; }
    .form-section { padding: 2px 0 24px; }
    .form-section + .form-section { padding-top: 24px; border-top: 1px solid var(--jt-border); }
    .section-heading { margin-bottom: 16px; }
    .section-heading h2 { margin: 0; color: var(--jt-text); font-size: 15px; font-weight: 750; letter-spacing: -.015em; }
    .section-heading p { margin: 3px 0 0; color: var(--jt-text-muted); font-size: 11px; }
    .form-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 15px; }
    label { display: flex; flex-direction: column; gap: 6px; color: #334155; font-size: 11px; font-weight: 680; }
    label.wide { grid-column: 1 / -1; }
    input, textarea { width: 100%; box-sizing: border-box; border: 1px solid var(--jt-border-strong); border-radius: 11px; padding: 11px 12px; color: var(--jt-text); background: #fff; font: inherit; font-size: 12px; font-weight: 480; transition: border-color 150ms ease, box-shadow 150ms ease; }
    textarea { resize: vertical; min-height: 92px; line-height: 1.5; }
    input:hover, textarea:hover { border-color: #b8c2d1; }
    input:focus, textarea:focus { outline: none; border-color: #818cf8; box-shadow: 0 0 0 3px rgba(79,70,229,.08); }
    input::placeholder, textarea::placeholder { color: #a8b2c2; }
    small { color: var(--jt-text-soft); font-size: 9px; font-weight: 500; line-height: 1.4; }
    .field-error { color: var(--jt-danger); font-weight: 620; }
    .demo-option { position: relative; margin-top: 4px; padding: 14px; border: 1px solid #c7d2fe; border-radius: 13px; background: #f8faff; flex-direction: row; align-items: flex-start; gap: 10px; cursor: pointer; }
    .demo-option > input { position: absolute; opacity: 0; pointer-events: none; }
    .demo-checkmark { width: 19px; height: 19px; flex: 0 0 19px; margin-top: 1px; border: 1.5px solid #a5b4fc; border-radius: 6px; background: #fff; }
    .demo-option > input:checked + .demo-checkmark { border-color: var(--jt-primary); background: var(--jt-primary); box-shadow: inset 0 0 0 4px #fff; }
    .demo-option > span:last-child { display: flex; flex-direction: column; gap: 3px; }
    .demo-option strong { color: var(--jt-text); font-size: 11px; }
    .demo-option small { color: var(--jt-text-muted); }
    .form-actions { display: flex; justify-content: flex-end; gap: 9px; margin-top: 24px; padding-top: 18px; border-top: 1px solid var(--jt-border); }
    button { min-height: 40px; border: 0; border-radius: 10px; padding: 0 17px; font: inherit; font-size: 11px; font-weight: 750; cursor: pointer; }
    button.primary { min-width: 130px; color: #fff; background: var(--jt-text); }
    button.primary:disabled { opacity: .42; cursor: not-allowed; }
    button.secondary { border: 1px solid var(--jt-border); color: #334155; background: #fff; }
    @media (max-width: 620px) { .editor-card { padding: 20px; border-radius: 17px; } .form-grid { grid-template-columns: 1fr; } label.wide { grid-column: auto; } .editor-heading { margin-bottom: 20px; } .form-actions { flex-direction: column-reverse; } .form-actions button { width: 100%; } }
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
