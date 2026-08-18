import {
  AfterViewInit,
  Component,
  EventEmitter,
  HostListener,
  Input,
  OnChanges,
  OnDestroy,
  Output,
  SimpleChanges,
  ViewChild
} from '@angular/core';
import {MatButtonModule} from '@angular/material/button';
import {MatIconModule} from '@angular/material/icon';
import {JobTrackrApiService} from '@app/core/api/jobtrackr-api.service';
import {ApplicationFormComponent} from '@app/features/applications/components/application-form/application-form.component';
import {ApplicationDraftService} from '@app/features/applications/data-access/application-draft.service';
import {ApplicationUrlImportService} from '@app/features/applications/data-access/application-url-import.service';
import {ApplicationStudioDraft} from '@app/features/applications/models/application-draft.model';
import {JobApplication} from '@app/features/applications/models/application.model';
import {JobImportPreview} from '@app/features/applications/models/job-import.model';

@Component({
  selector: 'app-application-studio',
  standalone: true,
  imports: [MatButtonModule, MatIconModule, ApplicationFormComponent],
  templateUrl: './application-studio.component.html',
  styleUrl: './application-studio.component.css'
})
export class ApplicationStudioComponent implements OnChanges, AfterViewInit, OnDestroy {
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
  availableDraft: ApplicationStudioDraft | null = null;
  draftSavedAt: Date | null = null;

  private draftTimer?: ReturnType<typeof setTimeout>;

  constructor(
    private readonly api: JobTrackrApiService,
    private readonly urlImportService: ApplicationUrlImportService,
    private readonly draftService: ApplicationDraftService
  ) {}

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['application'] || changes['editMode']) {
      this.jobUrl = this.application?.offerUrl ?? '';
      this.jobUrlError = '';
      this.jobUrlPreview = null;
      this.showDiscardConfirm = false;
      this.availableDraft = null;
      this.draftSavedAt = null;
    }
  }

  ngAfterViewInit(): void {
    if (this.editMode) return;
    queueMicrotask(() => {
      const draft = this.draftService.load();
      if (draft) this.availableDraft = draft;
    });
  }

  ngOnDestroy(): void {
    if (this.draftTimer) clearTimeout(this.draftTimer);
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

  get draftSummary(): string {
    const draft = this.availableDraft?.form;
    if (!draft) return '';
    const company = draft.company.trim() || 'Entreprise à compléter';
    const position = draft.position.trim();
    return position ? `${company} · ${position}` : company;
  }

  get draftAgeLabel(): string {
    const updatedAt = this.availableDraft?.updatedAt;
    if (!updatedAt) return '';
    const elapsedMinutes = Math.max(0, Math.floor((Date.now() - new Date(updatedAt).getTime()) / 60000));
    if (elapsedMinutes < 1) return 'à l’instant';
    if (elapsedMinutes < 60) return `il y a ${elapsedMinutes} min`;
    const hours = Math.floor(elapsedMinutes / 60);
    if (hours < 24) return `il y a ${hours} h`;
    const days = Math.floor(hours / 24);
    return `il y a ${days} j`;
  }

  get draftSavedLabel(): string {
    if (!this.draftSavedAt) return '';
    return `Brouillon enregistré à ${this.draftSavedAt.toLocaleTimeString('fr-FR', {hour: '2-digit', minute: '2-digit'})}`;
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

  onFormDraftChange(): void {
    if (this.editMode || this.availableDraft) return;
    if (this.draftTimer) clearTimeout(this.draftTimer);
    this.draftTimer = setTimeout(() => this.persistDraftNow(), 500);
  }

  resumeDraft(): void {
    const draft = this.availableDraft;
    if (!draft || !this.formComponent) return;
    this.jobUrl = draft.jobUrl || draft.form.offerUrl;
    this.formComponent.restoreDraft(draft.form);
    this.draftSavedAt = new Date(draft.updatedAt);
    this.availableDraft = null;
  }

  deleteAvailableDraft(): void {
    this.draftService.clear();
    this.availableDraft = null;
    this.draftSavedAt = null;
  }

  submit(): void {
    void this.formComponent?.onSubmit();
  }

  onFormSubmit(application: JobApplication): void {
    this.persistDraftNow();
    this.save.emit(application);
  }

  requestClose(): void {
    if (this.formComponent?.isDirty) {
      if (!this.editMode) this.persistDraftNow();
      this.showDiscardConfirm = true;
      return;
    }
    this.closed.emit();
  }

  keepEditing(): void {
    this.showDiscardConfirm = false;
  }

  confirmClose(): void {
    if (!this.editMode) this.persistDraftNow();
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

  private persistDraftNow(): void {
    if (this.draftTimer) {
      clearTimeout(this.draftTimer);
      this.draftTimer = undefined;
    }
    if (this.editMode || this.availableDraft || !this.formComponent?.isDirty) return;

    const saved = this.draftService.save(this.formComponent.exportDraft(), this.jobUrl);
    if (saved) this.draftSavedAt = new Date(saved.updatedAt);
  }
}
