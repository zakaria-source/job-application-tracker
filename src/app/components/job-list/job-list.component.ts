import {Component, DestroyRef, OnInit, inject} from '@angular/core';
import {CommonModule} from '@angular/common';
import {FormsModule} from '@angular/forms';
import {MatButtonModule} from '@angular/material/button';
import {MatCardModule} from '@angular/material/card';
import {MatFormFieldModule} from '@angular/material/form-field';
import {MatIconModule} from '@angular/material/icon';
import {MatInputModule} from '@angular/material/input';
import {MatPaginatorModule, PageEvent} from '@angular/material/paginator';
import {MatSelectModule} from '@angular/material/select';
import {MatSortModule, Sort} from '@angular/material/sort';
import {MatTableModule} from '@angular/material/table';
import {MatTooltipModule} from '@angular/material/tooltip';
import {takeUntilDestroyed} from '@angular/core/rxjs-interop';
import {JobApplication} from '../../models/job-application.model';
import {StorageService} from '../../services/storage.service';
import {JobFormComponent} from '../job-form/job-form.component';

@Component({
    selector: 'app-job-list',
    standalone: true,
    imports: [
        CommonModule,
        FormsModule,
        MatButtonModule,
        MatCardModule,
        MatFormFieldModule,
        MatIconModule,
        MatInputModule,
        MatPaginatorModule,
        MatSelectModule,
        MatSortModule,
        MatTableModule,
        MatTooltipModule,
        JobFormComponent
    ],
    template: `
    <mat-card>
      <mat-card-header>
        <mat-card-title>Mes candidatures</mat-card-title>
        <mat-card-subtitle>Votre pipeline : priorités, relances, étapes et contacts.</mat-card-subtitle>
      </mat-card-header>
      <mat-card-content>
        @if (applications.length > 0) {
          <div class="filters">
            <mat-form-field appearance="outline" class="search-field">
              <mat-label>Rechercher</mat-label>
              <input matInput [(ngModel)]="searchTerm" (input)="applyFilters()" placeholder="Entreprise, poste, recruteur...">
              @if (searchTerm) {
                <button matSuffix mat-icon-button aria-label="Effacer la recherche" (click)="searchTerm=''; applyFilters()">
                  <mat-icon>close</mat-icon>
                </button>
              }
            </mat-form-field>
            <mat-form-field appearance="outline">
              <mat-label>Statut</mat-label>
              <mat-select [(ngModel)]="statusFilter" (selectionChange)="applyFilters()">
                <mat-option value="">Tous</mat-option>
                <mat-option value="Envoyé">Envoyé</mat-option>
                <mat-option value="Entretien">Entretien</mat-option>
                <mat-option value="Accepté">Accepté</mat-option>
                <mat-option value="Refusé">Refusé</mat-option>
              </mat-select>
            </mat-form-field>
            <mat-form-field appearance="outline">
              <mat-label>Contrat</mat-label>
              <mat-select [(ngModel)]="contractFilter" (selectionChange)="applyFilters()">
                <mat-option value="">Tous</mat-option>
                <mat-option value="CDI">CDI</mat-option>
                <mat-option value="CDD">CDD</mat-option>
                <mat-option value="Freelance">Freelance</mat-option>
                <mat-option value="Stage">Stage</mat-option>
                <mat-option value="Alternance">Alternance</mat-option>
                <mat-option value="Autre">Autre</mat-option>
              </mat-select>
            </mat-form-field>
            <mat-form-field appearance="outline">
              <mat-label>Priorité</mat-label>
              <mat-select [(ngModel)]="priorityFilter" (selectionChange)="applyFilters()">
                <mat-option value="">Toutes</mat-option>
                <mat-option value="Haute">Haute</mat-option>
                <mat-option value="Moyenne">Moyenne</mat-option>
                <mat-option value="Basse">Basse</mat-option>
              </mat-select>
            </mat-form-field>
          </div>
        }
    
        @if (applications.length === 0) {
          <div class="no-data">
            <mat-icon>work_outline</mat-icon>
            <h3>Commencez votre suivi</h3>
            <p>Ajoutez votre première candidature pour alimenter votre cockpit.</p>
            <button mat-raised-button color="primary" (click)="showAddForm()">
              <mat-icon>add</mat-icon> Ajouter une candidature
            </button>
          </div>
        }
    
        @if (applications.length > 0 && filteredApplications.length === 0) {
          <div class="no-data">
            <mat-icon>search_off</mat-icon>
            <h3>Aucun résultat</h3>
            <p>Aucune candidature ne correspond à vos filtres.</p>
            <button mat-stroked-button (click)="clearFilters()">Réinitialiser les filtres</button>
          </div>
        }
    
        @if (filteredApplications.length > 0) {
          <div class="table-container">
            <table mat-table
              [dataSource]="paginatedApplications"
              matSort
              [matSortActive]="sortField"
              [matSortDirection]="sortDirection"
              (matSortChange)="sortData($event)">
              <ng-container matColumnDef="company">
                <th mat-header-cell *matHeaderCellDef mat-sort-header>Entreprise</th>
                <td mat-cell *matCellDef="let application">
                  <div class="company-cell">
                    <strong>{{ application.company }}</strong>
                    <span>{{ application.stage }}</span>
                  </div>
                </td>
              </ng-container>
              <ng-container matColumnDef="position">
                <th mat-header-cell *matHeaderCellDef mat-sort-header>Poste</th>
                <td mat-cell *matCellDef="let application">{{ application.position }}</td>
              </ng-container>
              <ng-container matColumnDef="contractType">
                <th mat-header-cell *matHeaderCellDef mat-sort-header>Contrat</th>
                <td mat-cell *matCellDef="let application">{{ application.contractType }}</td>
              </ng-container>
              <ng-container matColumnDef="priority">
                <th mat-header-cell *matHeaderCellDef mat-sort-header>Priorité</th>
                <td mat-cell *matCellDef="let application">
                  <span class="priority-badge" [ngClass]="'priority-' + application.priority.toLowerCase()">
                    {{ application.priority }}
                  </span>
                </td>
              </ng-container>
              <ng-container matColumnDef="followUpDate">
                <th mat-header-cell *matHeaderCellDef mat-sort-header>Relance</th>
                <td mat-cell *matCellDef="let application">
                  @if (application.followUpDate) {
                    <span [class.follow-up-due]="isFollowUpDue(application)">
                      {{ application.followUpDate | date:'dd/MM/yyyy' }}
                    </span>
                  } @else {
                    —
                  }
                </td>
              </ng-container>
              <ng-container matColumnDef="status">
                <th mat-header-cell *matHeaderCellDef mat-sort-header>Statut</th>
                <td mat-cell *matCellDef="let application">
                  <span class="status-badge"
                      [ngClass]="{
                        'status-sent': application.status === 'Envoyé',
                        'status-interview': application.status === 'Entretien',
                        'status-accepted': application.status === 'Accepté',
                        'status-rejected': application.status === 'Refusé'
                      }">
                    {{ application.status }}
                  </span>
                </td>
              </ng-container>
              <ng-container matColumnDef="actions">
                <th mat-header-cell *matHeaderCellDef>Actions</th>
                <td mat-cell *matCellDef="let application">
                  @if (application.offerUrl) {
                    <a
                      mat-icon-button
                      [href]="application.offerUrl"
                      target="_blank"
                      rel="noopener noreferrer"
                      (click)="$event.stopPropagation()"
                      matTooltip="Ouvrir l'offre"
                      aria-label="Ouvrir l'offre">
                      <mat-icon>open_in_new</mat-icon>
                    </a>
                  }
                  <button mat-icon-button color="primary"
                    (click)="$event.stopPropagation(); editApplication(application)"
                    matTooltip="Modifier"
                    aria-label="Modifier la candidature">
                    <mat-icon>edit</mat-icon>
                  </button>
                  <button mat-icon-button color="warn"
                    (click)="$event.stopPropagation(); deleteApplication(application)"
                    matTooltip="Supprimer"
                    aria-label="Supprimer la candidature">
                    <mat-icon>delete</mat-icon>
                  </button>
                </td>
              </ng-container>
              <tr mat-header-row *matHeaderRowDef="displayedColumns"></tr>
              <tr mat-row *matRowDef="let row; columns: displayedColumns;"
                (click)="viewApplicationDetails(row)"
              class="application-row"></tr>
            </table>
            <mat-paginator
              [length]="filteredApplications.length"
              [pageSize]="pageSize"
              [pageSizeOptions]="[5, 10, 25, 50]"
              (page)="onPageChange($event)">
            </mat-paginator>
          </div>
        }
      </mat-card-content>
    
      @if (applications.length > 0 && !showForm) {
        <mat-card-actions>
          <button mat-raised-button color="primary" (click)="showAddForm()">
            <mat-icon>add</mat-icon> Ajouter une candidature
          </button>
        </mat-card-actions>
      }
    </mat-card>
    
    @if (showForm) {
      <div class="secondary-panel">
        <app-job-form
          [editMode]="editMode"
          [application]="selectedApplication"
          (formSubmit)="onFormSubmit($event)"
          (cancel)="cancelForm()">
        </app-job-form>
      </div>
    }
    
    @if (selectedApplication && showDetails) {
      <div class="details-card">
        <mat-card>
          <mat-card-header>
            <mat-card-title>{{ selectedApplication.position }} — {{ selectedApplication.company }}</mat-card-title>
            <mat-card-subtitle>
              {{ selectedApplication.contractType }} · {{ selectedApplication.stage }} · Priorité {{ selectedApplication.priority.toLowerCase() }}
            </mat-card-subtitle>
            <button mat-icon-button (click)="closeDetails()" class="close-button" aria-label="Fermer les détails">
              <mat-icon>close</mat-icon>
            </button>
          </mat-card-header>
          <mat-card-content>
            <div class="details-grid">
              <div class="detail-item">
                <strong>Statut</strong>
                <span>{{ selectedApplication.status }}</span>
              </div>
              <div class="detail-item">
                <strong>Date de candidature</strong>
                <span>{{ selectedApplication.applicationDate | date:'dd/MM/yyyy' }}</span>
              </div>
              @if (selectedApplication.followUpDate) {
                <div class="detail-item">
                  <strong>Prochaine relance</strong>
                  <span [class.follow-up-due]="isFollowUpDue(selectedApplication)">{{ selectedApplication.followUpDate | date:'dd/MM/yyyy' }}</span>
                </div>
              }
              @if (selectedApplication.salaryTarget) {
                <div class="detail-item">
                  <strong>{{ selectedApplication.salaryPeriod === 'Journalier' ? 'TJM cible' : 'Salaire cible' }}</strong>
                  <span>{{ formatTargetSalary(selectedApplication) }}</span>
                </div>
              }
              @if (selectedApplication.recruiterName) {
                <div class="detail-item">
                  <strong>Recruteur</strong>
                  <span>{{ selectedApplication.recruiterName }}</span>
                </div>
              }
              @if (selectedApplication.recruiterEmail) {
                <div class="detail-item">
                  <strong>Email</strong>
                  <a [href]="'mailto:' + selectedApplication.recruiterEmail">{{ selectedApplication.recruiterEmail }}</a>
                </div>
              }
              @if (selectedApplication.recruiterPhone) {
                <div class="detail-item">
                  <strong>Téléphone</strong>
                  <span>{{ selectedApplication.recruiterPhone }}</span>
                </div>
              }
              @if (selectedApplication.responseDate) {
                <div class="detail-item">
                  <strong>Première réponse</strong>
                  <span>{{ selectedApplication.responseDate | date:'dd/MM/yyyy' }}</span>
                </div>
              }
            </div>
            @if (selectedApplication.offerUrl) {
              <a
                mat-stroked-button
                color="primary"
                [href]="selectedApplication.offerUrl"
                target="_blank"
                rel="noopener noreferrer">
                <mat-icon>open_in_new</mat-icon> Voir l'offre
              </a>
            }
            @if (selectedApplication.notes) {
              <div class="notes-section">
                <h3>Notes</h3>
                <p>{{ selectedApplication.notes }}</p>
              </div>
            }
            @if (selectedApplication.interviews?.length) {
              <div class="interviews-section">
                <h3>Entretiens</h3>
                @for (interview of selectedApplication.interviews; track interview) {
                  <div class="interview-item">
                    <div class="interview-header">
                      <span>{{ interview.date | date:'dd/MM/yyyy HH:mm' }}</span>
                      <span class="interview-type">{{ interview.type }}</span>
                    </div>
                    @if (interview.notes) {
                      <p>{{ interview.notes }}</p>
                    }
                  </div>
                }
              </div>
            }
          </mat-card-content>
          <mat-card-actions>
            <button mat-button color="primary" (click)="editApplication(selectedApplication)">
              <mat-icon>edit</mat-icon> Modifier
            </button>
            <button mat-button color="warn" (click)="deleteApplication(selectedApplication)">
              <mat-icon>delete</mat-icon> Supprimer
            </button>
          </mat-card-actions>
        </mat-card>
      </div>
    }
    `,
    styles: [`
    .filters {
      display: grid;
      grid-template-columns: minmax(260px, 2fr) repeat(3, minmax(145px, 1fr));
      gap: 12px;
      margin: 20px 0 8px;
    }
    .table-container {
      overflow-x: auto;
    }
    table {
      width: 100%;
      min-width: 980px;
    }
    .application-row {
      cursor: pointer;
    }
    .application-row:hover {
      background-color: rgba(0, 0, 0, 0.04);
    }
    .company-cell {
      display: flex;
      flex-direction: column;
      gap: 2px;
    }
    .company-cell span {
      font-size: 12px;
      color: #757575;
    }
    .no-data {
      display: flex;
      flex-direction: column;
      align-items: center;
      text-align: center;
      padding: 40px 20px;
      color: #757575;
    }
    .no-data > mat-icon {
      width: 48px;
      height: 48px;
      font-size: 48px;
    }
    .no-data h3 {
      margin: 8px 0 0;
      color: #424242;
    }
    .no-data p {
      margin: 8px 0 18px;
    }
    .status-badge,
    .priority-badge {
      display: inline-flex;
      padding: 4px 8px;
      border-radius: 999px;
      font-size: 12px;
      font-weight: 600;
    }
    .priority-haute {
      background: #ffebee;
      color: #c62828;
    }
    .priority-moyenne {
      background: #fff8e1;
      color: #ef6c00;
    }
    .priority-basse {
      background: #f1f8e9;
      color: #558b2f;
    }
    .follow-up-due {
      color: #d84315;
      font-weight: 700;
    }
    .secondary-panel,
    .details-card {
      margin-top: 20px;
    }
    .close-button {
      position: absolute;
      top: 8px;
      right: 8px;
    }
    .details-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(190px, 1fr));
      gap: 16px;
      margin: 20px 0;
    }
    .detail-item {
      display: flex;
      flex-direction: column;
      gap: 4px;
    }
    .notes-section,
    .interviews-section {
      margin-top: 24px;
    }
    .notes-section p {
      white-space: pre-wrap;
    }
    .interview-item {
      padding: 12px;
      border-left: 3px solid #3f51b5;
      background: rgba(0, 0, 0, 0.02);
      margin-bottom: 12px;
    }
    .interview-header {
      display: flex;
      justify-content: space-between;
      gap: 12px;
      margin-bottom: 8px;
      font-weight: 500;
    }
    .interview-type {
      color: #3f51b5;
    }
    @media (max-width: 950px) {
      .filters {
        grid-template-columns: 1fr 1fr;
      }
      .search-field {
        grid-column: 1 / -1;
      }
    }
    @media (max-width: 600px) {
      .filters {
        grid-template-columns: 1fr;
      }
      .search-field {
        grid-column: auto;
      }
    }
  `]
})
export class JobListComponent implements OnInit {
    private readonly destroyRef = inject(DestroyRef);

    applications: JobApplication[] = [];
    filteredApplications: JobApplication[] = [];
    paginatedApplications: JobApplication[] = [];

    displayedColumns: string[] = ['company', 'position', 'contractType', 'priority', 'followUpDate', 'status', 'actions'];

    searchTerm = '';
    statusFilter = '';
    contractFilter = '';
    priorityFilter = '';
    sortField = 'followUpDate';
    sortDirection: 'asc' | 'desc' = 'asc';

    pageSize = 10;
    currentPage = 0;

    showForm = false;
    editMode = false;
    selectedApplication: JobApplication | null = null;
    showDetails = false;

    constructor(private readonly storageService: StorageService) {
    }

    ngOnInit(): void {
        this.storageService.getApplications()
            .pipe(takeUntilDestroyed(this.destroyRef))
            .subscribe(applications => {
                this.applications = applications;
                this.applyFilters(false);
            });
    }

    applyFilters(resetPage = true): void {
        let filtered = [...this.applications];
        const search = this.searchTerm.trim().toLowerCase();

        if (search) {
            filtered = filtered.filter(app =>
                app.company.toLowerCase().includes(search)
                || app.position.toLowerCase().includes(search)
                || app.notes.toLowerCase().includes(search)
                || app.stage.toLowerCase().includes(search)
                || (app.recruiterName ?? '').toLowerCase().includes(search)
            );
        }

        if (this.statusFilter) {
            filtered = filtered.filter(app => app.status === this.statusFilter);
        }
        if (this.contractFilter) {
            filtered = filtered.filter(app => app.contractType === this.contractFilter);
        }
        if (this.priorityFilter) {
            filtered = filtered.filter(app => app.priority === this.priorityFilter);
        }

        if (resetPage) {
            this.currentPage = 0;
        }

        this.filteredApplications = filtered;
        this.applySort();
    }

    clearFilters(): void {
        this.searchTerm = '';
        this.statusFilter = '';
        this.contractFilter = '';
        this.priorityFilter = '';
        this.applyFilters();
    }

    applySort(): void {
        const priorityOrder: Record<JobApplication['priority'], number> = {Haute: 3, Moyenne: 2, Basse: 1};

        this.filteredApplications = [...this.filteredApplications].sort((a, b) => {
            let comparison = 0;

            switch (this.sortField) {
                case 'company':
                    comparison = a.company.localeCompare(b.company);
                    break;
                case 'position':
                    comparison = a.position.localeCompare(b.position);
                    break;
                case 'contractType':
                    comparison = a.contractType.localeCompare(b.contractType);
                    break;
                case 'priority':
                    comparison = priorityOrder[a.priority] - priorityOrder[b.priority];
                    break;
                case 'followUpDate':
                    comparison = (a.followUpDate?.getTime() ?? Number.MAX_SAFE_INTEGER)
                        - (b.followUpDate?.getTime() ?? Number.MAX_SAFE_INTEGER);
                    break;
                case 'status':
                    comparison = a.status.localeCompare(b.status);
                    break;
                default:
                    comparison = a.applicationDate.getTime() - b.applicationDate.getTime();
            }

            return this.sortDirection === 'asc' ? comparison : -comparison;
        });

        this.updatePaginatedApplications();
    }

    sortData(sort: Sort): void {
        this.sortField = sort.active;
        this.sortDirection = (sort.direction || 'asc') as 'asc' | 'desc';
        this.applySort();
    }

    updatePaginatedApplications(): void {
        const startIndex = this.currentPage * this.pageSize;
        this.paginatedApplications = this.filteredApplications.slice(startIndex, startIndex + this.pageSize);
    }

    onPageChange(event: PageEvent): void {
        this.currentPage = event.pageIndex;
        this.pageSize = event.pageSize;
        this.updatePaginatedApplications();
    }

    showAddForm(): void {
        this.editMode = false;
        this.selectedApplication = null;
        this.showForm = true;
        this.showDetails = false;
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
        if (!confirm(`Supprimer la candidature ${application.position} chez ${application.company} ?`)) {
            return;
        }

        this.storageService.deleteApplication(application.id);
        if (this.selectedApplication?.id === application.id) {
            this.closeDetails();
        }
    }

    onFormSubmit(application: JobApplication): void {
        if (this.editMode) {
            this.storageService.updateApplication(application);
        } else {
            this.storageService.addApplication(application);
        }
        this.cancelForm();
    }

    cancelForm(): void {
        this.showForm = false;
        this.editMode = false;
        this.selectedApplication = null;
    }

    isFollowUpDue(application: JobApplication): boolean {
        if (!application.followUpDate || application.status === 'Accepté' || application.status === 'Refusé') {
            return false;
        }
        const tomorrow = new Date();
        tomorrow.setHours(24, 0, 0, 0);
        return application.followUpDate < tomorrow;
    }

    formatTargetSalary(application: JobApplication): string {
        if (!application.salaryTarget) {
            return '—';
        }
        const formatted = new Intl.NumberFormat('fr-FR').format(application.salaryTarget);
        return application.salaryPeriod === 'Journalier' ? `${formatted} €/j` : `${formatted} € brut/an`;
    }
}
