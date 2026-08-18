import {Component, EventEmitter, Input, OnChanges, OnDestroy, OnInit, Output, SimpleChanges} from '@angular/core';
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
import {Subscription} from 'rxjs';
import {NotificationService} from '@app/core/notifications/notification.service';
import {ApplicationWorkflowService} from '@app/features/applications/domain/application-workflow.service';
import {ApplicationFormDraft} from '@app/features/applications/models/application-draft.model';
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
export class ApplicationFormComponent implements OnInit, OnChanges, OnDestroy {
    @Input() editMode = false;
    @Input() application: JobApplication | null = null;
    @Input() embedded = false;
    @Input() hideOfferUrl = false;
    @Output() formSubmit = new EventEmitter<JobApplication>();
    @Output() cancel = new EventEmitter<void>();
    @Output() draftChange = new EventEmitter<void>();

    jobForm!: FormGroup;
    private formChangesSubscription?: Subscription;

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

    ngOnDestroy(): void {
        this.formChangesSubscription?.unsubscribe();
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

    setOfferUrl(url: string): void {
        const control = this.jobForm.get('offerUrl');
        if (!control) return;
        control.setValue(url);
        if (url.trim()) control.markAsDirty();
    }

    applyImportedDraft(draft: JobApplication): void {
        const company = this.jobForm.get('company');
        const position = this.jobForm.get('position');
        const notes = this.jobForm.get('notes');
        const contractType = this.jobForm.get('contractType');

        this.jobForm.patchValue({
            company: company?.value?.trim() ? company.value : draft.company,
            position: position?.value?.trim() ? position.value : draft.position,
            offerUrl: draft.offerUrl ?? '',
            contractType: contractType?.dirty ? contractType.value : draft.contractType,
            notes: notes?.value?.trim() ? notes.value : draft.notes
        });
        this.jobForm.markAsDirty();
    }

    exportDraft(): ApplicationFormDraft {
        const value = this.jobForm.getRawValue();
        return {
            company: String(value.company ?? ''),
            position: String(value.position ?? ''),
            offerUrl: String(value.offerUrl ?? ''),
            contractType: value.contractType,
            salaryTarget: value.salaryTarget === null || value.salaryTarget === '' ? null : Number(value.salaryTarget),
            salaryPeriod: value.salaryPeriod,
            applicationDate: this.toIso(value.applicationDate) ?? new Date().toISOString(),
            stage: value.stage,
            priority: value.priority,
            followUpDate: this.toIso(value.followUpDate),
            recruiterName: String(value.recruiterName ?? ''),
            recruiterEmail: String(value.recruiterEmail ?? ''),
            recruiterPhone: String(value.recruiterPhone ?? ''),
            notes: String(value.notes ?? ''),
            interviews: (value.interviews ?? []).map((interview: Interview) => ({
                id: interview.id,
                date: this.toIso(interview.date) ?? new Date().toISOString(),
                type: interview.type,
                notes: interview.notes ?? '',
                reminderSet: !!interview.reminderSet
            }))
        };
    }

    restoreDraft(draft: ApplicationFormDraft): void {
        this.jobForm.patchValue({
            company: draft.company,
            position: draft.position,
            offerUrl: draft.offerUrl,
            contractType: draft.contractType,
            salaryTarget: draft.salaryTarget,
            salaryPeriod: draft.salaryPeriod,
            applicationDate: new Date(draft.applicationDate),
            stage: draft.stage,
            priority: draft.priority,
            followUpDate: draft.followUpDate ? new Date(draft.followUpDate) : null,
            recruiterName: draft.recruiterName,
            recruiterEmail: draft.recruiterEmail,
            recruiterPhone: draft.recruiterPhone,
            notes: draft.notes
        }, {emitEvent: false});

        this.interviews.clear({emitEvent: false});
        draft.interviews.forEach(interview => {
            this.interviews.push(this.createInterviewFormGroup({
                ...interview,
                date: new Date(interview.date)
            }), {emitEvent: false});
        });
        this.jobForm.markAsDirty();
        this.jobForm.updateValueAndValidity({emitEvent: false});
    }

    private initForm(): void {
        this.formChangesSubscription?.unsubscribe();
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

        if (this.application) {
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

        this.formChangesSubscription = this.jobForm.valueChanges.subscribe(() => this.draftChange.emit());
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
            version: this.application?.version,
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

    private toIso(value: Date | string | null | undefined): string | null {
        if (!value) return null;
        const date = value instanceof Date ? value : new Date(value);
        return Number.isNaN(date.getTime()) ? null : date.toISOString();
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
