import {Component, DestroyRef, HostListener, OnInit, ViewChild, inject} from '@angular/core';
import {takeUntilDestroyed} from '@angular/core/rxjs-interop';
import {MatButtonModule} from '@angular/material/button';
import {MatCardModule} from '@angular/material/card';
import {MatIconModule} from '@angular/material/icon';
import {JobTrackrApiService} from '@app/core/api/jobtrackr-api.service';
import {WorkspaceService, WorkspaceState} from '@app/core/workspace/workspace.service';
import {ApplicationDetailsComponent} from '@app/features/applications/components/application-details/application-details.component';
import {ApplicationFilterCriteria, ApplicationFiltersComponent} from '@app/features/applications/components/application-filters/application-filters.component';
import {ApplicationFormComponent} from '@app/features/applications/components/application-form/application-form.component';
import {ApplicationKanbanComponent, ApplicationStageChange} from '@app/features/applications/components/application-kanban/application-kanban.component';
import {ApplicationListComponent} from '@app/features/applications/components/application-list/application-list.component';
import {ApplicationExportService} from '@app/features/applications/data-access/application-export.service';
import {ApplicationImportService, ImportPreview} from '@app/features/applications/data-access/application-import.service';
import {ApplicationStore} from '@app/features/applications/data-access/application.store';
import {ApplicationUrlImportService} from '@app/features/applications/data-access/application-url-import.service';
import {JobApplication, RecruitmentStage} from '@app/features/applications/models/application.model';
import {JobImportPreview} from '@app/features/applications/models/job-import.model';

const EMPTY_FILTERS: ApplicationFilterCriteria = {searchTerm: '', status: '', contractType: '', priority: ''};

@Component({
  selector: 'app-applications-page',
  standalone: true,
  imports: [MatButtonModule, MatCardModule, MatIconModule, ApplicationFiltersComponent, ApplicationListComponent, ApplicationKanbanComponent, ApplicationDetailsComponent, ApplicationFormComponent],
  templateUrl: './applications-page.component.html',
  styleUrl: './applications-page.component.css'
})
export class ApplicationsPageComponent implements OnInit {
  private readonly destroyRef = inject(DestroyRef);
  private feedbackTimer?: ReturnType<typeof setTimeout>;

  @ViewChild(ApplicationFiltersComponent) private filtersComponent?: ApplicationFiltersComponent;

  applications: JobApplication[] = [];
  filteredApplications: JobApplication[] = [];
  selectedApplication: JobApplication | null = null;
  pendingDelete: JobApplication | null = null;
  importPreview: ImportPreview | null = null;
  importFileName = '';
  importError = '';
  feedbackMessage = '';
  showForm = false;
  showDetails = false;
  editMode = false;
  viewMode: 'list' | 'kanban' = 'list';
  workspaceState: WorkspaceState;

  showUrlImport = false;
  jobUrl = '';
  jobUrlLoading = false;
  jobUrlError = '';
  jobUrlPreview: JobImportPreview | null = null;

  private activeFilters: ApplicationFilterCriteria = EMPTY_FILTERS;

  constructor(
    private readonly applicationStore: ApplicationStore,
    private readonly importService: ApplicationImportService,
    private readonly exportService: ApplicationExportService,
    private readonly urlImportService: ApplicationUrlImportService,
    private readonly api: JobTrackrApiService,
    private readonly workspace: WorkspaceService
  ) {
    this.workspaceState = workspace.state;
    workspace.state$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(state => this.workspaceState = state);
  }

  get hasActiveFilters(): boolean {
    return Object.values(this.activeFilters).some(Boolean);
  }

  ngOnInit(): void {
    this.applicationStore.getApplications()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(applications => {
        this.applications = applications;
        this.applyFilters(this.activeFilters);
        if (this.selectedApplication) {
          this.selectedApplication = applications.find(item => item.id === this.selectedApplication?.id) ?? this.selectedApplication;
        }
      });
  }

  @HostListener('document:keydown', ['$event'])
  handleKeyboardShortcut(event: KeyboardEvent): void {
    const target = event.target as HTMLElement | null;
    const typing = target?.matches('input, textarea, select, [contenteditable="true"]') ?? false;

    if (event.key === 'Escape') {
      if (this.showUrlImport) this.closeUrlImport();
      else if (this.importPreview || this.importError) this.closeImportPreview();
      else if (this.pendingDelete) this.pendingDelete = null;
      else if (this.showDetails) this.closeDetails();
      else if (this.showForm) this.cancelForm();
      return;
    }

    if (typing || event.metaKey || event.ctrlKey || event.altKey) return;
    if (event.key.toLowerCase() === 'n') {
      event.preventDefault();
      this.showAddForm();
    }
    if (event.key === '/') {
      event.preventDefault();
      this.filtersComponent?.focusSearch();
    }
  }

  retryWorkspace(): void {
    this.workspace.connect().subscribe({error: () => undefined});
  }

  onFiltersChange(criteria: ApplicationFilterCriteria): void {
    this.activeFilters = criteria;
    this.applyFilters(criteria);
  }

  clearFilters(): void {
    if (this.filtersComponent) {
      this.filtersComponent.resetFilters();
      return;
    }
    this.onFiltersChange(EMPTY_FILTERS);
  }

  onStageChange(change: ApplicationStageChange): void {
    this.applicationStore.updateApplicationStage(change.applicationId, change.stage);
    this.showFeedback(`Étape mise à jour · ${change.stage}`);
  }

  advanceSelectedStage(stage: RecruitmentStage): void {
    if (!this.selectedApplication) return;
    this.applicationStore.updateApplicationStage(this.selectedApplication.id, stage);
    this.showFeedback(`Candidature avancée vers ${stage}`);
  }

  completeFollowUp(application: JobApplication): void {
    this.applicationStore.completeFollowUp(application.id);
    this.showFeedback(`Relance marquée comme effectuée · ${application.company}`);
  }

  showAddForm(): void {
    this.closeUrlImport();
    this.editMode = false;
    this.selectedApplication = null;
    this.showForm = true;
    this.showDetails = false;
  }

  openUrlImport(): void {
    this.jobUrl = '';
    this.jobUrlError = '';
    this.jobUrlPreview = null;
    this.jobUrlLoading = false;
    this.showUrlImport = true;
  }

  closeUrlImport(): void {
    this.showUrlImport = false;
    this.jobUrl = '';
    this.jobUrlError = '';
    this.jobUrlPreview = null;
    this.jobUrlLoading = false;
  }

  analyzeJobUrl(): void {
    const url = this.jobUrl.trim();
    if (!url || this.jobUrlLoading) return;

    this.jobUrlLoading = true;
    this.jobUrlError = '';
    this.jobUrlPreview = null;
    this.api.previewJobUrl(url).subscribe({
      next: preview => {
        this.jobUrlPreview = preview;
        this.jobUrlLoading = false;
      },
      error: (error: {error?: {detail?: string}}) => {
        this.jobUrlLoading = false;
        this.jobUrlError = error?.error?.detail || 'Impossible d’analyser cette page. Vérifiez que l’offre est publique et accessible.';
      }
    });
  }

  useJobUrlPreview(): void {
    const preview = this.jobUrlPreview;
    if (!preview) return;
    const draft = this.urlImportService.buildDraft(preview);
    this.closeUrlImport();
    this.editMode = false;
    this.selectedApplication = draft;
    this.showForm = true;
    this.showDetails = false;
    this.showFeedback('Offre analysée · vérifiez les champs avant d’ajouter la candidature');
  }

  editApplication(application: JobApplication): void {
    this.editMode = true;
    this.selectedApplication = {...application};
    this.showForm = true;
    this.showDetails = false;
  }

  viewApplicationDetails(application: JobApplication): void {
    this.selectedApplication = {...application};
    this.showDetails = true;
    this.showForm = false;
  }

  closeDetails(): void {
    this.showDetails = false;
    this.selectedApplication = null;
  }

  deleteApplication(application: JobApplication): void {
    this.pendingDelete = application;
  }

  confirmDelete(): void {
    const application = this.pendingDelete;
    if (!application) return;
    this.applicationStore.deleteApplication(application.id);
    this.pendingDelete = null;
    if (this.selectedApplication?.id === application.id) this.closeDetails();
    this.showFeedback(`Candidature supprimée · ${application.company}`);
  }

  onFormSubmit(application: JobApplication): void {
    if (this.editMode) {
      this.applicationStore.updateApplication(application);
      this.showFeedback(`Candidature mise à jour · ${application.company}`);
    } else {
      this.applicationStore.addApplication(application);
      this.showFeedback(`Candidature ajoutée · ${application.company}`);
    }
    this.cancelForm();
  }

  cancelForm(): void {
    this.showForm = false;
    this.editMode = false;
    this.selectedApplication = null;
  }

  exportApplications(): void {
    const serialized = this.exportService.serialize(this.applications);
    const blob = new Blob([serialized], {type: 'application/json'});
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `jobtrackr-backup-${new Date().toISOString().slice(0, 10)}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
    this.showFeedback('Backup exporté');
  }

  importApplications(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    this.importFileName = file.name;
    this.importError = '';
    const reader = new FileReader();
    reader.onload = () => {
      try {
        this.importPreview = this.importService.preview(String(reader.result ?? ''), this.applications);
      } catch (error) {
        console.error(error);
        this.importPreview = null;
        this.importError = 'Ce fichier ne correspond pas à un export JobTrackr valide.';
      } finally {
        input.value = '';
      }
    };
    reader.readAsText(file);
  }

  confirmImport(): void {
    if (!this.importPreview) return;
    const count = this.applicationStore.mergeApplications(this.importPreview.applications);
    this.closeImportPreview();
    this.showFeedback(count > 0 ? `${count} candidature${count > 1 ? 's' : ''} importée${count > 1 ? 's' : ''}` : 'Aucune nouvelle candidature à importer');
  }

  closeImportPreview(): void {
    this.importPreview = null;
    this.importError = '';
    this.importFileName = '';
  }

  confidenceLabel(confidence: JobImportPreview['confidence']): string {
    return confidence === 'HIGH' ? 'Élevée' : confidence === 'MEDIUM' ? 'Moyenne' : 'À vérifier';
  }

  extractionSourceLabel(source: JobImportPreview['extractionSource']): string {
    return source === 'JSON_LD' ? 'Données structurées' : 'HTML public';
  }

  private showFeedback(message: string): void {
    this.feedbackMessage = message;
    if (this.feedbackTimer) clearTimeout(this.feedbackTimer);
    this.feedbackTimer = setTimeout(() => this.feedbackMessage = '', 3200);
  }

  private applyFilters(criteria: ApplicationFilterCriteria): void {
    const search = criteria.searchTerm.trim().toLowerCase();
    this.filteredApplications = this.applications.filter(application => {
      const matchesSearch = !search
        || application.company.toLowerCase().includes(search)
        || application.position.toLowerCase().includes(search)
        || application.notes.toLowerCase().includes(search)
        || application.stage.toLowerCase().includes(search)
        || (application.recruiterName ?? '').toLowerCase().includes(search);

      return matchesSearch
        && (!criteria.status || application.status === criteria.status)
        && (!criteria.contractType || application.contractType === criteria.contractType)
        && (!criteria.priority || application.priority === criteria.priority);
    });
  }
}
