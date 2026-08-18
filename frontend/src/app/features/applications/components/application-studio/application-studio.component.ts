import {Component, EventEmitter, HostListener, Input, OnChanges, Output, SimpleChanges, ViewChild} from '@angular/core';
import {MatButtonModule} from '@angular/material/button';
import {MatIconModule} from '@angular/material/icon';
import {JobTrackrApiService} from '@app/core/api/jobtrackr-api.service';
import {ApplicationFormComponent} from '@app/features/applications/components/application-form/application-form.component';
import {ApplicationUrlImportService} from '@app/features/applications/data-access/application-url-import.service';
import {JobApplication} from '@app/features/applications/models/application.model';
import {JobImportPreview} from '@app/features/applications/models/job-import.model';

@Component({
  selector: 'app-application-studio',
  standalone: true,
  imports: [MatButtonModule, MatIconModule, ApplicationFormComponent],
  templateUrl: './application-studio.component.html',
  styleUrl: './application-studio.component.css'
})
export class ApplicationStudioComponent implements OnChanges {
  @Input() editMode = false;
  @Input() application: JobApplication | null = null;
  @Output() save = new EventEmitter<JobApplication>();
  @Output() closed = new EventEmitter<void>();

  @ViewChild(ApplicationFormComponent) private formComponent?: ApplicationFormComponent;

  jobUrl = '';
  jobUrlLoading = false;
  jobUrlError = '';
  jobUrlPreview: JobImportPreview | null = null;
  showDiscardConfirm = false;

  constructor(
    private readonly api: JobTrackrApiService,
    private readonly urlImportService: ApplicationUrlImportService
  ) {}

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['application'] || changes['editMode']) {
      this.jobUrl = this.application?.offerUrl ?? '';
      this.jobUrlError = '';
      this.jobUrlPreview = null;
      this.showDiscardConfirm = false;
    }
  }

  @HostListener('document:keydown', ['$event'])
  handleKeyboard(event: KeyboardEvent): void {
    if (this.showDiscardConfirm && event.key === 'Escape') {
      event.preventDefault();
      this.showDiscardConfirm = false;
      return;
    }

    if (event.key === 'Escape') {
      event.preventDefault();
      this.requestClose();
      return;
    }

    if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
      event.preventDefault();
      this.submit();
    }
  }

  get company(): string {
    return this.formComponent?.companyValue || this.application?.company || '';
  }

  get position(): string {
    return this.formComponent?.positionValue || this.application?.position || '';
  }

  get contractType(): string {
    return this.formComponent?.contractTypeValue || this.application?.contractType || 'CDI';
  }

  get stage(): string {
    return this.formComponent?.stageValue || this.application?.stage || 'Candidature';
  }

  get priority(): string {
    return this.formComponent?.priorityValue || this.application?.priority || 'Moyenne';
  }

  get companyInitial(): string {
    return (this.company || '?').charAt(0).toUpperCase();
  }

  get detectedFields(): number {
    const preview = this.jobUrlPreview;
    if (!preview) return 0;
    return [
      preview.company,
      preview.position,
      preview.location,
      preview.description,
      preview.employmentType,
      preview.salary,
      preview.datePosted,
      preview.canonicalUrl
    ].filter(Boolean).length;
  }

  onJobUrlInput(value: string): void {
    this.jobUrl = value;
    this.formComponent?.setOfferUrl(value);
  }

  onJobUrlPaste(event: ClipboardEvent): void {
    const pasted = event.clipboardData?.getData('text')?.trim();
    if (!pasted?.startsWith('https://')) return;
    event.preventDefault();
    this.jobUrl = pasted;
    this.formComponent?.setOfferUrl(pasted);
    this.analyzeJobUrl();
  }

  analyzeJobUrl(): void {
    const url = this.jobUrl.trim();
    if (!url || this.jobUrlLoading) return;

    this.jobUrlLoading = true;
    this.jobUrlError = '';
    this.api.previewJobUrl(url).subscribe({
      next: preview => {
        this.jobUrlPreview = preview;
        this.jobUrl = preview.canonicalUrl || preview.sourceUrl || url;
        this.formComponent?.applyImportedDraft(this.urlImportService.buildDraft(preview));
        this.jobUrlLoading = false;
      },
      error: (error: {error?: {detail?: string}}) => {
        this.jobUrlLoading = false;
        this.jobUrlError = error?.error?.detail || 'Impossible d’analyser cette page. Vous pouvez continuer en saisie manuelle.';
      }
    });
  }

  submit(): void {
    void this.formComponent?.onSubmit();
  }

  onFormSubmit(application: JobApplication): void {
    this.save.emit(application);
  }

  requestClose(): void {
    if (this.formComponent?.isDirty) {
      this.showDiscardConfirm = true;
      return;
    }
    this.closed.emit();
  }

  keepEditing(): void {
    this.showDiscardConfirm = false;
  }

  discardAndClose(): void {
    this.showDiscardConfirm = false;
    this.closed.emit();
  }

  extractionSourceLabel(source: JobImportPreview['extractionSource']): string {
    switch (source) {
      case 'GREENHOUSE_API': return 'Greenhouse';
      case 'LEVER_API': return 'Lever';
      case 'WORKDAY': return 'Workday';
      case 'WELCOME_TO_THE_JUNGLE': return 'Welcome to the Jungle';
      case 'JSON_LD': return 'Données structurées';
      default: return 'HTML public';
    }
  }

  confidenceLabel(confidence: JobImportPreview['confidence']): string {
    return confidence === 'HIGH' ? 'Confiance élevée' : confidence === 'MEDIUM' ? 'Confiance moyenne' : 'À vérifier';
  }
}
