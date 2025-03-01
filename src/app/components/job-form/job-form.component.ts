import {Component, EventEmitter, Input, OnInit, Output} from '@angular/core';
import {FormArray, FormBuilder, FormGroup, ReactiveFormsModule, Validators} from '@angular/forms';
import {MatButtonModule} from '@angular/material/button';
import {MatCardModule} from '@angular/material/card';
import {MatDatepickerModule} from '@angular/material/datepicker';
import {MatFormFieldModule} from '@angular/material/form-field';
import {MatInputModule} from '@angular/material/input';
import {MatSelectModule} from '@angular/material/select';
import {MatNativeDateModule} from '@angular/material/core';
import {MatIconModule} from '@angular/material/icon';
import {MatDividerModule} from '@angular/material/divider';
import {CommonModule} from '@angular/common';
import {Interview, JobApplication} from '../../models/job-application.model';
import {StorageService} from '../../services/storage.service';
import {NotificationService} from '../../services/notification.service';
import {MatCheckbox} from "@angular/material/checkbox";

@Component({
    selector: 'app-job-form',
    standalone: true,
    imports: [
        CommonModule,
        ReactiveFormsModule,
        MatCardModule,
        MatFormFieldModule,
        MatInputModule,
        MatSelectModule,
        MatButtonModule,
        MatDatepickerModule,
        MatNativeDateModule,
        MatIconModule,
        MatDividerModule,
        MatCheckbox
    ],
    template: `
    <mat-card>
      <mat-card-header>
        <mat-card-title>{{ editMode ? 'Modifier la candidature' : 'Ajouter une nouvelle candidature' }}</mat-card-title>
      </mat-card-header>
      <mat-card-content>
        <form [formGroup]="jobForm" (ngSubmit)="onSubmit()">
          <div class="flex-container">
            <mat-form-field class="flex-item">
              <mat-label>Entreprise</mat-label>
              <input matInput formControlName="company" required>
              <mat-error *ngIf="jobForm.get('company')?.hasError('required')">
                L'entreprise est requise
              </mat-error>
            </mat-form-field>

            <mat-form-field class="flex-item">
              <mat-label>Poste</mat-label>
              <input matInput formControlName="position" required>
              <mat-error *ngIf="jobForm.get('position')?.hasError('required')">
                Le poste est requis
              </mat-error>
            </mat-form-field>
          </div>

          <div class="flex-container">
            <mat-form-field class="flex-item">
              <mat-label>Date de candidature</mat-label>
              <input matInput [matDatepicker]="picker" formControlName="applicationDate" required>
              <mat-datepicker-toggle matIconSuffix [for]="picker"></mat-datepicker-toggle>
              <mat-datepicker #picker></mat-datepicker>
              <mat-error *ngIf="jobForm.get('applicationDate')?.hasError('required')">
                La date de candidature est requise
              </mat-error>
            </mat-form-field>

            <mat-form-field class="flex-item">
              <mat-label>Statut</mat-label>
              <mat-select formControlName="status" required>
                <mat-option value="Envoyé">Envoyé</mat-option>
                <mat-option value="Entretien">Entretien</mat-option>
                <mat-option value="Accepté">Accepté</mat-option>
                <mat-option value="Refusé">Refusé</mat-option>
              </mat-select>
              <mat-error *ngIf="jobForm.get('status')?.hasError('required')">
                Le statut est requis
              </mat-error>
            </mat-form-field>
          </div>

          <div class="flex-container">
            <mat-form-field class="flex-item">
              <mat-label>Personne de contact</mat-label>
              <input matInput formControlName="contactPerson">
            </mat-form-field>

            <mat-form-field class="flex-item">
              <mat-label>Email de contact</mat-label>
              <input matInput formControlName="contactEmail" type="email">
              <mat-error *ngIf="jobForm.get('contactEmail')?.hasError('email')">
                Veuillez entrer un email valide
              </mat-error>
            </mat-form-field>
          </div>

          <mat-form-field class="full-width">
            <mat-label>Téléphone de contact</mat-label>
            <input matInput formControlName="contactPhone">
          </mat-form-field>

          <mat-form-field class="full-width">
            <mat-label>Notes</mat-label>
            <textarea matInput formControlName="notes" rows="4"></textarea>
          </mat-form-field>

          <mat-divider class="my-3"></mat-divider>
          
          <div *ngIf="editMode">
            <h3>Entretiens</h3>
            
            <div formArrayName="interviews">
              <div *ngFor="let interview of interviews.controls; let i = index" [formGroupName]="i" class="interview-item">
                <div class="flex-container">
                  <mat-form-field class="flex-item">
                    <mat-label>Date de l'entretien</mat-label>
                    <input matInput [matDatepicker]="interviewPicker" formControlName="date" required>
                    <mat-datepicker-toggle matIconSuffix [for]="interviewPicker"></mat-datepicker-toggle>
                    <mat-datepicker #interviewPicker></mat-datepicker>
                  </mat-form-field>

                  <mat-form-field class="flex-item">
                    <mat-label>Type d'entretien</mat-label>
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
                  <mat-checkbox formControlName="reminderSet">Définir un rappel</mat-checkbox>
                  <button type="button" mat-icon-button color="warn" (click)="removeInterview(i)">
                    <mat-icon>delete</mat-icon>
                  </button>
                </div>

                <mat-divider *ngIf="i < interviews.controls.length - 1" class="my-2"></mat-divider>
              </div>
            </div>

            <button type="button" mat-stroked-button color="primary" (click)="addInterview()" class="mt-2">
              <mat-icon>add</mat-icon> Ajouter un entretien
            </button>
          </div>

          <div class="form-actions">
            <button type="button" mat-stroked-button (click)="onCancel()">Annuler</button>
            <button type="submit" mat-raised-button color="primary" [disabled]="jobForm.invalid">
              {{ editMode ? 'Mettre à jour' : 'Ajouter' }}
            </button>
          </div>
        </form>
      </mat-card-content>
    </mat-card>
  `,
    styles: [`
    .flex-container {
      display: flex;
      gap: 16px;
    }
    .flex-item {
      flex: 1;
    }
    .full-width {
      width: 100%;
      margin-bottom: 16px;
    }
    .form-actions {
      display: flex;
      justify-content: flex-end;
      gap: 16px;
      margin-top: 16px;
    }
    .my-3 {
      margin-top: 24px;
      margin-bottom: 24px;
    }
    .my-2 {
      margin-top: 16px;
      margin-bottom: 16px;
    }
    .mt-2 {
      margin-top: 16px;
    }
    .interview-actions {
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .interview-item {
      padding: 8px;
      border-radius: 4px;
      background-color: rgba(0, 0, 0, 0.02);
      margin-bottom: 16px;
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
        private fb: FormBuilder,
        private storageService: StorageService,
        private notificationService: NotificationService
    ) {
    }

    ngOnInit(): void {
        this.initForm();
    }

    private initForm(): void {
        this.jobForm = this.fb.group({
            company: ['', Validators.required],
            position: ['', Validators.required],
            applicationDate: [new Date(), Validators.required],
            status: ['Envoyé', Validators.required],
            notes: [''],
            contactPerson: [''],
            contactEmail: ['', Validators.email],
            contactPhone: [''],
            interviews: this.fb.array([])
        });

        if (this.editMode && this.application) {
            this.jobForm.patchValue({
                company: this.application.company,
                position: this.application.position,
                applicationDate: this.application.applicationDate,
                status: this.application.status,
                notes: this.application.notes,
                contactPerson: this.application.contactPerson || '',
                contactEmail: this.application.contactEmail || '',
                contactPhone: this.application.contactPhone || ''
            });

            // Add existing interviews
            if (this.application.interviews && this.application.interviews.length > 0) {
                this.application.interviews.forEach(interview => {
                    this.interviews.push(this.createInterviewFormGroup(interview));
                });
            }
        }
    }

    get interviews(): FormArray {
        return this.jobForm.get('interviews') as FormArray;
    }

    createInterviewFormGroup(interview?: Interview): FormGroup {
        return this.fb.group({
            id: [interview?.id || this.generateId()],
            date: [interview?.date || new Date(), Validators.required],
            type: [interview?.type || 'Téléphone', Validators.required],
            notes: [interview?.notes || ''],
            reminderSet: [interview?.reminderSet || false]
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
            return;
        }

        const formValue = this.jobForm.value;

        const jobApplication: JobApplication = {
            id: this.application?.id || this.generateId(),
            company: formValue.company,
            position: formValue.position,
            applicationDate: formValue.applicationDate,
            status: formValue.status,
            notes: formValue.notes,
            contactPerson: formValue.contactPerson,
            contactEmail: formValue.contactEmail,
            contactPhone: formValue.contactPhone,
            interviews: formValue.interviews,
            lastUpdated: new Date(),
            responseDate: this.getResponseDate(formValue.status)
        };

        // Schedule reminders for interviews with reminderSet = true
        if (formValue.interviews) {
            formValue.interviews.forEach((interview: Interview) => {
                if (interview.reminderSet) {
                    this.notificationService.scheduleInterviewReminder(jobApplication, interview);
                }
            });
        }

        this.formSubmit.emit(jobApplication);
    }

    onCancel(): void {
        this.cancel.emit();
    }

    private getResponseDate(status: string): Date | undefined {
        if (status !== 'Envoyé' && !this.application?.responseDate) {
            return new Date();
        }
        return this.application?.responseDate;
    }

    private generateId(): string {
        return Date.now().toString(36) + Math.random().toString(36).substring(2);
    }
}