import {A11yModule} from '@angular/cdk/a11y';
import {Component, DestroyRef, HostListener, OnInit, ViewChild, inject} from '@angular/core';
import {takeUntilDestroyed} from '@angular/core/rxjs-interop';
import {MatButtonModule} from '@angular/material/button';
import {MatCardModule} from '@angular/material/card';
import {MatIconModule} from '@angular/material/icon';
import {WorkspaceService, WorkspaceState} from '@app/core/workspace/workspace.service';
import {ApplicationDetailsComponent} from '@app/features/applications/components/application-details/application-details.component';
import {ApplicationFilterCriteria, ApplicationFiltersComponent} from '@app/features/applications/components/application-filters/application-filters.component';
import {ApplicationKanbanComponent, ApplicationStageChange} from '@app/features/applications/components/application-kanban/application-kanban.component';
import {ApplicationListComponent} from '@app/features/applications/components/application-list/application-list.component';
import {ApplicationStudioComponent} from '@app/features/applications/components/application-studio/application-studio.component';
import {ApplicationDraftService} from '@app/features/applications/data-access/application-draft.service';
import {ApplicationExportService} from '@app/features/applications/data-access/application-export.service';
import {ApplicationImportService, ImportPreview} from '@app/features/applications/data-access/application-import.service';
import {ApplicationStore} from '@app/features/applications/data-access/application.store';
import {JobApplication, RecruitmentStage} from '@app/features/applications/models/application.model';

const EMPTY_FILTERS: ApplicationFilterCriteria = {searchTerm: '', status: '', contractType: '', priority: ''};

@Component({
  selector: 'app-applications-page',
  standalone: true,
  imports: [
    A11yModule,
    MatButtonModule,
    MatCardModule,
    MatIconModule,
    ApplicationFiltersComponent,
    ApplicationListComponent,
    ApplicationKanbanComponent,
    ApplicationDetailsComponent,
    ApplicationStudioComponent
  ],
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
  private activeFilters: ApplicationFilterCriteria = EMPTY_FILTERS;

  constructor(
    private readonly applicationStore: ApplicationStore,
    private readonly draftService: ApplicationDraftService,
    private readonly importService: ApplicationImportService,
    private readonly exportService: ApplicationExportService,
    private readonly workspace: WorkspaceService
  ) {
    this.workspaceState = workspace.state;
    workspace.state$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(state => this.workspaceState = state);
  }

  get hasActiveFilters(): boolean { return Object.values(this.activeFilters).some(Boolean); }

  ngOnInit(): void {
    this.applicationStore.getApplications().pipe(takeUntilDestroyed(this.destroyRef)).subscribe(applications => {
      this.applications = applications;
      this.applyFilters(this.activeFilters);
      if (this.selectedApplication && !this.showForm) {
        this.selectedApplication = applications.find(item => item.id === this.selectedApplication?.id) ?? this.selectedApplication;
      }
    });
  }

  @HostListener('document:keydown', ['$event'])
  handleKeyboardShortcut(event: KeyboardEvent): void {
    if (this.showForm) return;
    const target = event.target as HTMLElement | null;
    const typing = target?.matches('input, textarea, select, [contenteditable="true"]') ?? false;
    if (event.key === 'Escape') {
      if (this.importPreview || this.importError) this.closeImportPreview();
      else if (this.pendingDelete) this.pendingDelete = null;
      else if (this.showDetails) this.closeDetails();
      return;
    }
    if (typing || event.metaKey || event.ctrlKey || event.altKey) return;
    if (event.key.toLowerCase() === 'n') { event.preventDefault(); this.showAddForm(); }
    if (event.key === '/') { event.preventDefault(); this.filtersComponent?.focusSearch(); }
  }

  retryWorkspace(): void { this.workspace.connect().subscribe({error: () => undefined}); }
  onFiltersChange(criteria: ApplicationFilterCriteria): void { this.activeFilters = criteria; this.applyFilters(criteria); }
  clearFilters(): void { if (this.filtersComponent) { this.filtersComponent.resetFilters(); return; } this.onFiltersChange(EMPTY_FILTERS); }

  onStageChange(change: ApplicationStageChange): void {
    this.applicationStore.updateApplicationStage(change.applicationId, change.stage).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: () => this.showFeedback(`Étape mise à jour · ${change.stage}`),
      error: () => this.showFeedback('Mise à jour impossible · le changement a été annulé')
    });
  }

  advanceSelectedStage(stage: RecruitmentStage): void {
    if (!this.selectedApplication) return;
    this.applicationStore.updateApplicationStage(this.selectedApplication.id, stage).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: () => this.showFeedback(`Candidature avancée vers ${stage}`),
      error: () => this.showFeedback('Impossible de faire avancer la candidature')
    });
  }

  completeFollowUp(application: JobApplication): void {
    this.applicationStore.completeFollowUp(application.id).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: () => this.showFeedback(`Relance marquée comme effectuée · ${application.company}`),
      error: () => this.showFeedback('Impossible de terminer la relance · le changement a été annulé')
    });
  }

  showAddForm(): void { this.editMode = false; this.selectedApplication = null; this.showForm = true; this.showDetails = false; }
  editApplication(application: JobApplication): void { this.editMode = true; this.selectedApplication = {...application}; this.showForm = true; this.showDetails = false; }
  viewApplicationDetails(application: JobApplication): void { this.selectedApplication = {...application}; this.showDetails = true; this.showForm = false; }
  closeDetails(): void { this.showDetails = false; this.selectedApplication = null; }
  deleteApplication(application: JobApplication): void { this.pendingDelete = application; }

  confirmDelete(): void {
    const application = this.pendingDelete;
    if (!application) return;
    this.applicationStore.deleteApplication(application.id).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: () => {
        this.pendingDelete = null;
        if (this.selectedApplication?.id === application.id) this.closeDetails();
        this.showFeedback(`Candidature supprimée · ${application.company}`);
      },
      error: () => this.showFeedback('Suppression impossible · la candidature a été restaurée')
    });
  }

  onFormSubmit(application: JobApplication): void {
    if (this.editMode) {
      this.applicationStore.updateApplication(application).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
        next: saved => { this.showFeedback(`Candidature mise à jour · ${saved.company}`); this.cancelForm(); },
        error: error => this.showFeedback(this.updateErrorMessage(error))
      });
      return;
    }
    this.applicationStore.addApplication(application).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: saved => { this.draftService.clear(); this.showFeedback(`Candidature ajoutée au pipeline · ${saved.company}`); this.cancelForm(); },
      error: () => this.showFeedback('Ajout impossible · votre brouillon a été conservé')
    });
  }

  cancelForm(): void { this.showForm = false; this.editMode = false; this.selectedApplication = null; }

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
      try { this.importPreview = this.importService.preview(String(reader.result ?? ''), this.applications); }
      catch (error) { console.error(error); this.importPreview = null; this.importError = 'Ce fichier ne correspond pas à un export JobTrackr valide.'; }
      finally { input.value = ''; }
    };
    reader.readAsText(file);
  }

  confirmImport(): void {
    if (!this.importPreview) return;
    const applications = this.importPreview.applications;
    this.applicationStore.mergeApplications(applications).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: count => {
        this.closeImportPreview();
        this.showFeedback(count > 0 ? `${count} candidature${count > 1 ? 's' : ''} importée${count > 1 ? 's' : ''}` : 'Aucune nouvelle candidature à importer');
      },
      error: () => { this.importError = 'Import impossible pour le moment. Aucun succès n’est affiché avant confirmation serveur.'; }
    });
  }

  closeImportPreview(): void { this.importPreview = null; this.importError = ''; this.importFileName = ''; }

  private updateErrorMessage(error: unknown): string {
    const status = (error as {status?: number})?.status;
    return status === 412 ? 'Cette candidature a été modifiée ailleurs · rechargez la version récente avant de réessayer' : 'Mise à jour impossible · vos modifications restent ouvertes';
  }

  private showFeedback(message: string): void {
    this.feedbackMessage = message;
    if (this.feedbackTimer) clearTimeout(this.feedbackTimer);
    this.feedbackTimer = setTimeout(() => this.feedbackMessage = '', 3200);
  }

  private applyFilters(criteria: ApplicationFilterCriteria): void {
    const search = criteria.searchTerm.trim().toLowerCase();
    this.filteredApplications = this.applications.filter(application => {
      const matchesSearch = !search || application.company.toLowerCase().includes(search) || application.position.toLowerCase().includes(search) || application.notes.toLowerCase().includes(search) || application.stage.toLowerCase().includes(search) || (application.recruiterName ?? '').toLowerCase().includes(search);
      return matchesSearch && (!criteria.status || application.status === criteria.status) && (!criteria.contractType || application.contractType === criteria.contractType) && (!criteria.priority || application.priority === criteria.priority);
    });
  }
}
