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
      <aside class="editor-aside">
        <span class="aside-eyebrow">{{ isEditing ? 'VOTRE ESPACE' : 'BIENVENUE' }}</span>
        <h1>{{ isEditing ? 'Gardez votre dashboard pertinent.' : 'Un pipeline clair commence par votre objectif.' }}</h1>
        <p>
          {{ isEditing
            ? 'Mettez à jour votre positionnement quand votre recherche évolue. Vos candidatures restent totalement séparées.'
            : 'Deux informations suffisent pour commencer. Le reste peut être complété maintenant ou plus tard.' }}
        </p>

        <div class="trust-card">
          <div class="trust-icon">✓</div>
          <div>
            <strong>Local-first par défaut</strong>
            <span>Votre profil et vos candidatures restent stockés dans ce navigateur.</span>
          </div>
        </div>

        <div class="aside-points">
          <div><span>01</span><p>Définissez votre cible</p></div>
          <div><span>02</span><p>Ajoutez vos candidatures</p></div>
          <div><span>03</span><p>Pilotez relances & entretiens</p></div>
        </div>
      </aside>

      <div class="editor-card">
        <div class="editor-heading">
          <div>
            <span class="eyebrow">{{ isEditing ? 'PROFIL & PRÉFÉRENCES' : 'CONFIGURATION RAPIDE' }}</span>
            <h2>{{ isEditing ? 'Personnaliser votre espace' : 'Créez votre espace' }}</h2>
          </div>
          <span class="required-note">* requis</span>
        </div>

        <form [formGroup]="form" (ngSubmit)="save()">
          <section class="form-section">
            <div class="section-heading">
              <span>01</span>
              <div>
                <h3>L’essentiel</h3>
                <p>Ces deux informations donnent immédiatement du contexte au dashboard.</p>
              </div>
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
                  <small class="field-error">Indiquez le poste ou positionnement recherché.</small>
                }
              </label>

              <label>
                <span>Expérience</span>
                <input formControlName="experienceLabel" placeholder="Ex. 4 ans d’expérience" />
              </label>

              <label>
                <span>Localisation / mobilité</span>
                <input formControlName="location" placeholder="Ex. Paris · remote Europe" />
              </label>
            </div>
          </section>

          <section class="form-section">
            <div class="section-heading">
              <span>02</span>
              <div>
                <h3>Positionnement</h3>
                <p>Facultatif, mais utile pour transformer le dashboard en véritable cockpit personnel.</p>
              </div>
            </div>

            <div class="form-grid">
              <label class="wide">
                <span>Résumé</span>
                <textarea formControlName="summary" rows="4" placeholder="Ce que vous recherchez, votre spécialité et vos principaux points forts."></textarea>
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
            </div>
          </section>

          <section class="form-section compact-section">
            <div class="section-heading">
              <span>03</span>
              <div>
                <h3>Préférences</h3>
                <p>Quelques repères supplémentaires pour votre espace.</p>
              </div>
            </div>

            <div class="form-grid">
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

          <label class="demo-option">
            <input type="checkbox" formControlName="loadDemo" />
            <span class="demo-checkmark"></span>
            <span>
              <strong>Explorer avec 3 candidatures fictives</strong>
              <small>Idéal pour tester immédiatement le Kanban et les analytics. Vos données existantes ne sont jamais écrasées.</small>
            </span>
          </label>

          <div class="form-actions">
            @if (isEditing) {
              <button type="button" class="secondary" (click)="cancel()">Annuler</button>
            }
            <button type="submit" class="primary" [disabled]="form.invalid">
              {{ isEditing ? 'Enregistrer les modifications' : 'Créer mon espace' }}
            </button>
          </div>
        </form>
      </div>
    </section>
  `,
  styles: [`
    :host { display: block; }
    .profile-editor { display: grid; grid-template-columns: minmax(280px, .72fr) minmax(0, 1.45fr); gap: 28px; align-items: start; }
    .editor-aside { position: sticky; top: 104px; padding: 28px 6px 28px 4px; }
    .aside-eyebrow, .eyebrow { display: inline-block; margin-bottom: 10px; color: var(--jt-primary); font-size: 10px; font-weight: 820; letter-spacing: .15em; }
    .editor-aside h1 { max-width: 480px; margin: 0; color: var(--jt-text); font-size: clamp(30px, 3.1vw, 44px); font-weight: 790; letter-spacing: -.052em; line-height: 1.04; }
    .editor-aside > p { max-width: 460px; margin: 16px 0 0; color: var(--jt-text-muted); font-size: 14px; line-height: 1.7; }
    .trust-card { margin-top: 28px; display: flex; gap: 12px; align-items: flex-start; padding: 15px; border: 1px solid #bbf7d0; border-radius: 15px; background: rgba(240,253,244,.82); }
    .trust-icon { width: 28px; height: 28px; flex: 0 0 28px; display: grid; place-items: center; border-radius: 9px; color: #fff; background: var(--jt-success); font-size: 13px; font-weight: 900; }
    .trust-card div:last-child { display: flex; flex-direction: column; gap: 3px; }
    .trust-card strong { color: #166534; font-size: 12px; }
    .trust-card span { color: #4b6354; font-size: 11px; line-height: 1.45; }
    .aside-points { margin-top: 26px; display: grid; gap: 9px; }
    .aside-points div { display: flex; align-items: center; gap: 10px; color: var(--jt-text-muted); }
    .aside-points span { width: 28px; height: 28px; display: grid; place-items: center; border: 1px solid var(--jt-border); border-radius: 9px; background: #fff; color: var(--jt-primary); font-size: 9px; font-weight: 800; }
    .aside-points p { margin: 0; font-size: 12px; font-weight: 600; }
    .editor-card { border: 1px solid var(--jt-border); border-radius: 22px; padding: 28px; background: rgba(255,255,255,.95); box-shadow: var(--jt-shadow-md); }
    .editor-heading { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; margin-bottom: 26px; padding-bottom: 22px; border-bottom: 1px solid var(--jt-border); }
    .editor-heading h2 { margin: 0; color: var(--jt-text); font-size: 27px; font-weight: 770; letter-spacing: -.035em; }
    .required-note { margin-top: 3px; color: var(--jt-text-soft); font-size: 10px; font-weight: 650; white-space: nowrap; }
    .form-section { padding: 4px 0 28px; }
    .form-section + .form-section { padding-top: 26px; border-top: 1px solid var(--jt-border); }
    .compact-section { padding-bottom: 18px; }
    .section-heading { display: flex; gap: 12px; align-items: flex-start; margin-bottom: 18px; }
    .section-heading > span { width: 30px; height: 30px; flex: 0 0 30px; display: grid; place-items: center; border-radius: 10px; color: var(--jt-primary); background: var(--jt-primary-soft); font-size: 9px; font-weight: 850; }
    .section-heading h3 { margin: 0; color: var(--jt-text); font-size: 14px; font-weight: 760; }
    .section-heading p { margin: 3px 0 0; color: var(--jt-text-muted); font-size: 11px; line-height: 1.45; }
    .form-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 16px; }
    label { display: flex; flex-direction: column; gap: 7px; color: #334155; font-size: 12px; font-weight: 680; }
    label.wide { grid-column: 1 / -1; }
    input, textarea { width: 100%; box-sizing: border-box; border: 1px solid var(--jt-border-strong); border-radius: 12px; padding: 12px 13px; color: var(--jt-text); background: #fff; font: inherit; font-size: 13px; font-weight: 480; transition: border-color 150ms ease, box-shadow 150ms ease, background 150ms ease; }
    textarea { resize: vertical; min-height: 104px; line-height: 1.55; }
    input:hover, textarea:hover { border-color: #b8c2d1; }
    input:focus, textarea:focus { outline: none; border-color: #818cf8; background: #fff; box-shadow: 0 0 0 4px rgba(79,70,229,.09); }
    input::placeholder, textarea::placeholder { color: #a8b2c2; }
    small { color: var(--jt-text-soft); font-size: 10px; font-weight: 500; line-height: 1.4; }
    .field-error { color: var(--jt-danger); font-weight: 620; }
    .demo-option { position: relative; margin-top: 8px; padding: 16px; border: 1px solid #c7d2fe; border-radius: 15px; background: linear-gradient(135deg,#fafaff,#f5f7ff); flex-direction: row; align-items: flex-start; gap: 11px; cursor: pointer; transition: border-color 150ms ease, background 150ms ease; }
    .demo-option:hover { border-color: #a5b4fc; background: #f7f7ff; }
    .demo-option > input { position: absolute; opacity: 0; pointer-events: none; }
    .demo-checkmark { width: 20px; height: 20px; flex: 0 0 20px; margin-top: 1px; border: 1.5px solid #a5b4fc; border-radius: 6px; background: #fff; }
    .demo-option > input:checked + .demo-checkmark { border-color: var(--jt-primary); background: var(--jt-primary); box-shadow: inset 0 0 0 4px #fff; }
    .demo-option > span:last-child { display: flex; flex-direction: column; gap: 4px; }
    .demo-option strong { color: var(--jt-text); font-size: 12px; }
    .demo-option small { color: var(--jt-text-muted); }
    .form-actions { position: sticky; bottom: 0; z-index: 3; display: flex; justify-content: flex-end; gap: 10px; margin: 26px -28px -28px; padding: 16px 28px; border-top: 1px solid var(--jt-border); border-radius: 0 0 22px 22px; background: rgba(255,255,255,.94); backdrop-filter: blur(14px); -webkit-backdrop-filter: blur(14px); }
    button { min-height: 42px; border: 0; border-radius: 11px; padding: 0 18px; font: inherit; font-size: 12px; font-weight: 750; cursor: pointer; transition: transform 150ms ease, opacity 150ms ease, box-shadow 150ms ease; }
    button.primary { min-width: 170px; color: #fff; background: linear-gradient(135deg,var(--jt-primary),var(--jt-blue)); box-shadow: 0 8px 18px rgba(79,70,229,.18); }
    button.primary:not(:disabled):hover { transform: translateY(-1px); box-shadow: 0 11px 22px rgba(79,70,229,.24); }
    button.primary:disabled { opacity: .42; cursor: not-allowed; box-shadow: none; }
    button.secondary { border: 1px solid var(--jt-border); color: #334155; background: #fff; }
    @media (max-width: 920px) { .profile-editor { grid-template-columns: 1fr; } .editor-aside { position: static; padding: 4px 2px 0; } .editor-aside h1 { max-width: 700px; font-size: 34px; } .editor-aside > p { max-width: 700px; } .aside-points { display: none; } }
    @media (max-width: 620px) { .editor-card { padding: 20px; border-radius: 18px; } .form-grid { grid-template-columns: 1fr; } label.wide { grid-column: auto; } .editor-heading { margin-bottom: 22px; } .editor-heading h2 { font-size: 23px; } .form-actions { margin: 24px -20px -20px; padding: 14px 20px; border-radius: 0 0 18px 18px; flex-direction: column-reverse; } .form-actions button { width: 100%; } }
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
