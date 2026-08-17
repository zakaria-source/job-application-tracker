import {Component, EventEmitter, Input, OnInit, Output} from '@angular/core';
import {CommonModule} from '@angular/common';
import {FormArray, FormBuilder, FormGroup, ReactiveFormsModule, Validators} from '@angular/forms';
import {MatButtonModule} from '@angular/material/button';
import {MatCardModule} from '@angular/material/card';
import {MatCheckboxModule} from '@angular/material/checkbox';
import {MatNativeDateModule} from '@angular/material/core';
import {MatDatepickerModule} from '@angular/material/datepicker';
import {MatDividerModule} from '@angular/material/divider';
import {MatFormFieldModule} from '@angular/material/form-field';
import {MatIconModule} from '@angular/material/icon';
import {MatInputModule} from '@angular/material/input';
import {MatSelectModule} from '@angular/material/select';
import {Interview, JobApplication} from '../../models/job-application.model';
import {NotificationService} from '../../services/notification.service';

@Component({
    selector: 'app-job-form',
    standalone: true,
    imports: [
        CommonModule,
        ReactiveFormsModule,
        MatButtonModule,
        MatCardModule,
        MatCheckboxModule,
        MatDatepickerModule,
        MatDividerModule,
        MatFormFieldModule,
        MatIconModule,
        MatInputModule,
        MatNativeDateModule,
        MatSelectModule
    ],
    template: `
    <mat-card>
      <mat-card-header>
        <mat-card-title>{{ editMode ? 'Modifier la candidature' : 'Ajouter une candidature' }}</mat-card-title>
        <mat-card-subtitle>Centralisez l'offre, le suivi recruteur et les prochaines actions.</mat-card-subtitle>
      </mat-card-header>
      <mat-card-content>
        <form [formGroup]="jobForm" (ngSubmit)="onSubmit()">
          <h3>Poste et offre</h3>

          <div class="form-grid two-columns">
            <mat-form-field>
              <mat-label>Entreprise</mat-label>
              <input matInput formControlName="company" required>
              <mat-error *ngIf="jobForm.get('company')?.hasError('required')">L'entreprise est requise</mat-error>
            </mat-form-field>

            <mat-form-field>
              <mat-label>Poste</mat-label>
              <input matInput formControlName="position" required>
              <mat-error *ngIf="jobForm.get('position')?.hasError('required')">Le poste est requis</mat-error>
            </mat-form-field>
          </div>

          <mat-form-field class="full-width">
            <mat-label>Lien de l'offre</mat-label>
            <input matInput formControlName="offerUrl" type="url" placeholder="https://...">
            <mat-icon matSuffix>link</mat-icon>
            <mat-error *ngIf="jobForm.get('offerUrl')?.hasError('pattern')">Utilisez une URL commençant par http:// ou https://</mat-error>
          </mat-form-field>

          <div class="form-grid three-columns">
            <mat-form-field>
              <mat-label>Type de contrat</mat-label>
              <mat-select formControlName="contractType">
                <mat-option value="CDI">CDI</mat-option>
                <mat-option value="CDD">CDD</mat-option>
                <mat-option value="Freelance">Freelance</mat-option>
                <mat-option value="Stage">Stage</mat-option>
                <mat-option value="Alternance">Alternance</mat-option>
                <mat-option value="Autre">Autre</mat-option>
              </mat-select>
            </mat-form-field>

            <mat-form-field>
              <mat-label>Salaire / TJM cible</mat-label>
              <input matInput formControlName="salaryTarget" type="number" min="0">
              <mat-error *ngIf="jobForm.get('salaryTarget')?.hasError('min')">La valeur doit être positive</mat-error>
            </mat-form-field>

            <mat-form-field>
              <mat-label>Période</mat-label>
              <mat-select formControlName="salaryPeriod">
                <mat-option value="Annuel">Brut annuel</mat-option>
                <mat-option value="Journalier">TJM</mat-option>
              </mat-select>
            </mat-form-field>
          </div>

          <mat-divider></mat-divider>
          <h3>Suivi de candidature</h3>

          <div class="form-grid three-columns">
            <mat-form-field>
              <mat-label>Date de candidature</mat-label>
              <input matInput [matDatepicker]="applicationPicker" formControlName="applicationDate" required>
              <mat-datepicker-toggle matIconSuffix [for]="applicationPicker"></mat-datepicker-toggle>
              <mat-datepicker #applicationPicker></mat-datepicker>
            </mat-form-field>

            <mat-form-field>
              <mat-label>Statut</mat-label>
              <mat-select formControlName="status" required>
                <mat-option value="Envoyé">Envoyé</mat-option>
                <mat-option value="Entretien">Entretien</mat-option>
                <mat-option value="Accepté">Accepté</mat-option>
                <mat-option value="Refusé">Refusé</mat-option>
              </mat-select>
            </mat-form-field>

            <mat-form-field>
              <mat-label>Priorité</mat-label>
              <mat-select formControlName="priority">
                <mat-option value="Haute">Haute</mat-option>
                <mat-option value="Moyenne">Moyenne</mat-option>
                <mat-option value="Basse">Basse</mat-option>
              </mat-select>
            </mat-form-field>
          </div>

          <div class="form-grid two-columns">
            <mat-form-field>
              <mat-label>Étape de recrutement</mat-label>
              <mat-select formControlName="stage">
                <mat-option value="Candidature">Candidature</mat-option>
                <mat-option value="Screening RH">Screening RH</mat-option>
                <mat-option value="Entretien technique">Entretien technique</mat-option>
                <mat-option value="Hiring Manager">Hiring Manager</mat-option>
                <mat-option value="Entretien final">Entretien final</mat-option>
                <mat-option value="Offre">Offre</mat-option>
                <mat-option value="Clôturé">Clôturé</mat-option>
              </mat-select>
            </mat-form-field>

            <mat-form-field>
              <mat-label>Prochaine relance</mat-label>
              <input matInput [matDatepicker]="followUpPicker" formControlName="followUpDate">
              <mat-datepicker-toggle matIconSuffix [for]="followUpPicker"></mat-datepicker-toggle>
              <mat-datepicker #followUpPicker></mat-datepicker>
              <mat-hint>Laissez vide si aucune relance n'est prévue.</mat-hint>
            </mat-form-field>
          </div>

          <mat-divider></mat-divider>
          <h3>Recruteur / contact</h3>

          <div class="form-grid three-columns">
            <mat-form-field>
              <mat-label>Nom du recruteur</mat-label>
              <input matInput formControlName="recruiterName">
            </mat-form-field>

            <mat-form-field>
              <mat-label>Email</mat-label>
              <input matInput formControlName="recruiterEmail" type="email">
              <mat-error *ngIf="jobForm.get('recruiterEmail')?.hasError('email')">Veuillez entrer un email valide</mat-error>
            </mat-form-field>

            <mat-form-field>
              <mat-label>Téléphone</mat-label>
              <input matInput formControlName="recruiterPhone">
            </mat-form-field>
          </div>

          <mat-form-field class="full-width">
            <mat-label>Notes</mat-label>
            <textarea matInput formControlName="notes" rows="4" placeholder="Contexte, process, éléments à préparer, feedback..."></textarea>
          </mat-form-field>

          <mat-divider></mat-divider>
          <div class="section-heading">
            <div>
              <h3>Entretiens</h3>
              <p>Ajoutez les rendez-vous liés à cette candidature.</p>
            </div>
            <button type="button" mat-stroked-button color="primary" (click)="addInterview()">
              <mat-icon>add</mat-icon> Ajouter
            </button>
          </div>

          <div formArrayName="interviews">
            <div *ngFor="let interview of interviews.controls; let i = index" [formGroupName]="i" class="interview-item">
              <div class="form-grid two-columns">
                <mat-form-field>
                  <mat-label>Date de l'entretien</mat-label>
                  <input matInput [matDatepicker]="interviewPicker" formControlName="date" required>
                  <mat-datepicker-toggle matIconSuffix [for]="interviewPicker"></mat-datepicker-toggle>
                  <mat-datepicker #interviewPicker></mat-datepicker>
                </mat-form-field>

                <mat-form-field>
                  <mat-label>Type</mat-label>
                  <mat-select formControlName="type" required>
                    <mat-option value="Téléphone">Téléphone</mat-option>
                    <mat-option value="Visioconférence">Visioconférence</mat-option>
                    <mat-option value="En personne">En personne</mat-option>
                  </mat-select>
                </mat-form-field>
              </div>

              <mat-form-field class="full-width">
                <mat-label>Notes de l'entretien</mat-label>
                <textarea matInput formControlName="notes" rows="2"></textarea>
              </mat-form-field>

              <div class="interview-actions">
                <mat-checkbox formControlName="reminderSet">Rappel 1 h avant</mat-checkbox>
                <button type="button" mat-icon-button color="warn" (click)="removeInterview(i)" aria-label="Supprimer l'entretien">
                  <mat-icon>delete</mat-icon>
                </button>
              </div>
            </div>
          </div>

          <div class="form-actions">
            <button type="button" mat-stroked-button (click)="onCancel()">Annuler</button>
            <button type="submit" mat-raised-button color="primary" [disabled]="jobForm.invalid">
              {{ editMode ? 'Mettre à jour' : 'Ajouter la candidature' }}
            </button>
          </div>
        </form>
      </mat-card-content>
    </mat-card>
  `,
    styles: [`
    h3 {
      margin: 24px 0 14px;
    }
    mat-divider {
      margin-top: 8px;
    }
    .form-grid {
      display: grid;
      gap: 16px;
    }
    .two-columns {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }
    .three-columns {
      grid-template-columns: repeat(3, minmax(0, 1fr));
    }
    .full-width {
      width: 100%;
    }
    .section-heading {
      display: flex;
      justify-content: space-between;
      gap: 16px;
      align-items: center;
    }
    .section-heading h3 {
      margin-bottom: 4px;
    }
    .section-heading p {
      margin: 0;
      color: #757575;
    }
    .interview-item {
      padding: 16px;
      border-radius: 12px;
      background: #f6f7fb;
      margin: 16px 0;
    }
    .interview-actions {
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .form-actions {
      display: flex;
      justify-content: flex-end;
      gap: 12px;
      margin-top: 28px;
    }
    @media (max-width: 850px) {
      .three-columns {
        grid-template-columns: 1fr 1fr;
      }
    }
    @media (max-width: 620px) {
      .two-columns,
      .three-columns {
        grid-template-columns: 1fr;
      }
      .section-heading {
        align-items: flex-start;
        flex-direction: column;
      }
    }
  `]
})
export class JobFormComponent implements OnInit {
    @Input() editMode = false;
    @Input() application: JobApplication | null = null;
    @Output() formSubmit = new EventEmitter<JobApplication>();
    @Output() cancel = new EventEmitter<void>();

    jobForm!: FormGroup;

    constructor(
        private readonly fb: FormBuilder,
        private readonly notificationService: NotificationService
    ) {
    }

    ngOnInit(): void {
        this.initForm();
    }

    private initForm(): void {
        this.jobForm = this.fb.group({
            company: ['', Validators.required],
            position: ['', Validators.required],
            offerUrl: ['', Validators.pattern(/^https?:\/\/.+/i)],
            contractType: ['CDI', Validators.required],
            salaryTarget: [null, Validators.min(0)],
            salaryPeriod: ['Annuel', Validators.required],
            applicationDate: [new Date(), Validators.required],
            status: ['Envoyé', Validators.required],
            stage: ['Candidature', Validators.required],
            priority: ['Moyenne', Validators.required],
            followUpDate: [null],
            recruiterName: [''],
            recruiterEmail: ['', Validators.email],
            recruiterPhone: [''],
            notes: [''],
            interviews: this.fb.array([])
        });

        if (!this.application) {
            return;
        }

        this.jobForm.patchValue({
            company: this.application.company,
            position: this.application.position,
            offerUrl: this.application.offerUrl ?? '',
            contractType: this.application.contractType,
            salaryTarget: this.application.salaryTarget ?? null,
            salaryPeriod: this.application.salaryPeriod,
            applicationDate: this.application.applicationDate,
            status: this.application.status,
            stage: this.application.stage,
            priority: this.application.priority,
            followUpDate: this.application.followUpDate ?? null,
            recruiterName: this.application.recruiterName ?? this.application.contactPerson ?? '',
            recruiterEmail: this.application.recruiterEmail ?? this.application.contactEmail ?? '',
            recruiterPhone: this.application.recruiterPhone ?? this.application.contactPhone ?? '',
            notes: this.application.notes
        });

        (this.application.interviews ?? []).forEach(interview => {
            this.interviews.push(this.createInterviewFormGroup(interview));
        });
    }

    get interviews(): FormArray {
        return this.jobForm.get('interviews') as FormArray;
    }

    private createInterviewFormGroup(interview?: Interview): FormGroup {
        return this.fb.group({
            id: [interview?.id ?? this.generateId()],
            date: [interview?.date ?? new Date(), Validators.required],
            type: [interview?.type ?? 'Téléphone', Validators.required],
            notes: [interview?.notes ?? ''],
            reminderSet: [interview?.reminderSet ?? false]
        });
    }

    addInterview(): void {
        this.interviews.push(this.createInterviewFormGroup());
    }

    removeInterview(index: number): void {
        this.interviews.removeAt(index);
    }

    onSubmit(): void {
        if (this.jobForm.invalid) {
            this.jobForm.markAllAsTouched();
            return;
        }

        const formValue = this.jobForm.getRawValue();
        const jobApplication: JobApplication = {
            id: this.application?.id ?? this.generateId(),
            company: formValue.company.trim(),
            position: formValue.position.trim(),
            offerUrl: formValue.offerUrl?.trim() || undefined,
            contractType: formValue.contractType,
            salaryTarget: formValue.salaryTarget === null || formValue.salaryTarget === ''
                ? undefined
                : Number(formValue.salaryTarget),
            salaryPeriod: formValue.salaryPeriod,
            applicationDate: formValue.applicationDate,
            status: formValue.status,
            stage: formValue.stage,
            priority: formValue.priority,
            followUpDate: formValue.followUpDate || undefined,
            recruiterName: formValue.recruiterName?.trim() || undefined,
            recruiterEmail: formValue.recruiterEmail?.trim() || undefined,
            recruiterPhone: formValue.recruiterPhone?.trim() || undefined,
            notes: formValue.notes?.trim() ?? '',
            interviews: formValue.interviews,
            lastUpdated: new Date(),
            responseDate: this.getResponseDate(formValue.status)
        };

        (jobApplication.interviews ?? []).forEach(interview => {
            if (interview.reminderSet) {
                this.notificationService.scheduleInterviewReminder(jobApplication, interview);
            }
        });

        this.formSubmit.emit(jobApplication);
    }

    onCancel(): void {
        this.cancel.emit();
    }

    private getResponseDate(status: JobApplication['status']): Date | undefined {
        if (status === 'Envoyé') {
            return undefined;
        }
        return this.application?.responseDate ?? new Date();
    }

    private generateId(): string {
        return Date.now().toString(36) + Math.random().toString(36).substring(2);
    }
}
