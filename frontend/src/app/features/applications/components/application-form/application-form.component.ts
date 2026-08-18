import {Component, EventEmitter, Input, OnChanges, OnInit, Output, SimpleChanges} from '@angular/core';
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
import {NotificationService} from '@app/core/notifications/notification.service';
import {ApplicationWorkflowService} from '@app/features/applications/domain/application-workflow.service';
import {Interview, JobApplication} from '@app/features/applications/models/application.model';

@Component({
    selector: 'app-application-form',
    standalone: true,
    imports: [
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
    templateUrl: './application-form.component.html',
    styleUrl: './application-form.component.css'
})
export class ApplicationFormComponent implements OnInit, OnChanges {
    @Input() editMode = false;
    @Input() application: JobApplication | null = null;
    @Input() embedded = false;
    @Input() hideOfferUrl = false;
    @Output() formSubmit = new EventEmitter<JobApplication>();
    @Output() cancel = new EventEmitter<void>();

    jobForm!: FormGroup;

    constructor(
        private readonly fb: FormBuilder,
        private readonly notificationService: NotificationService,
        private readonly workflow: ApplicationWorkflowService
    ) {}

    ngOnInit(): void {
        this.initForm();
    }

    ngOnChanges(changes: SimpleChanges): void {
        if (this.jobForm && (changes['application'] || changes['editMode'])) {
            this.initForm();
        }
    }

    get interviews(): FormArray {
        return this.jobForm.get('interviews') as FormArray;
    }

    get isDirty(): boolean {
        return this.jobForm?.dirty ?? false;
    }

    get isInvalid(): boolean {
        return this.jobForm?.invalid ?? true;
    }

    get companyValue(): string {
        return String(this.jobForm?.get('company')?.value ?? '').trim();
    }

    get positionValue(): string {
        return String(this.jobForm?.get('position')?.value ?? '').trim();
    }

    get contractTypeValue(): string {
        return String(this.jobForm?.get('contractType')?.value ?? 'CDI');
    }

    get stageValue(): string {
        return String(this.jobForm?.get('stage')?.value ?? 'Candidature');
    }

    get priorityValue(): string {
        return String(this.jobForm?.get('priority')?.value ?? 'Moyenne');
    }

    get followUpDateValue(): Date | null {
        return this.jobForm?.get('followUpDate')?.value ?? null;
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
        this.jobForm.markAsDirty();
    }

    removeInterview(index: number): void {
        this.interviews.removeAt(index);
        this.jobForm.markAsDirty();
    }

    async onSubmit(): Promise<void> {
        if (this.jobForm.invalid) {
            this.jobForm.markAllAsTouched();
            queueMicrotask(() => this.focusFirstInvalidField());
            return;
        }

        const formValue = this.jobForm.getRawValue();
        const status = this.workflow.statusForStage(formValue.stage);
        const hasReminder = formValue.interviews.some((interview: Interview) => interview.reminderSet);

        if (hasReminder) {
            await this.notificationService.ensurePermission();
        }

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
            status,
            stage: formValue.stage,
            priority: formValue.priority,
            followUpDate: formValue.followUpDate || undefined,
            recruiterName: formValue.recruiterName?.trim() || undefined,
            recruiterEmail: formValue.recruiterEmail?.trim() || undefined,
            recruiterPhone: formValue.recruiterPhone?.trim() || undefined,
            notes: formValue.notes?.trim() ?? '',
            interviews: formValue.interviews,
            lastUpdated: new Date(),
            responseDate: this.getResponseDate(status)
        };

        this.formSubmit.emit(jobApplication);
    }

    onCancel(): void {
        this.cancel.emit();
    }

    private focusFirstInvalidField(): void {
        const invalid = document.querySelector<HTMLElement>('.application-studio .ng-invalid[formControlName]');
        invalid?.focus();
    }

    private getResponseDate(status: JobApplication['status']): Date | undefined {
        if (status === 'Envoyé') {
            return undefined;
        }
        return this.application?.responseDate ?? new Date();
    }

    private generateId(): string {
        return globalThis.crypto?.randomUUID?.()
            ?? Date.now().toString(36) + Math.random().toString(36).slice(2);
    }
}
