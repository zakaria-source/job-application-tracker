import {Component, OnInit} from '@angular/core';
import {CommonModule} from '@angular/common';
import {FormsModule} from '@angular/forms';
import {MatCardModule} from '@angular/material/card';
import {MatTableModule} from '@angular/material/table';
import {MatSortModule, Sort} from '@angular/material/sort';
import {MatPaginatorModule, PageEvent} from '@angular/material/paginator';
import {MatButtonModule} from '@angular/material/button';
import {MatIconModule} from '@angular/material/icon';
import {MatInputModule} from '@angular/material/input';
import {MatFormFieldModule} from '@angular/material/form-field';
import {MatSelectModule} from '@angular/material/select';
import {MatChipsModule} from '@angular/material/chips';
import {MatMenuModule} from '@angular/material/menu';
import {MatTooltipModule} from '@angular/material/tooltip';
import {MatDialogModule} from '@angular/material/dialog';
import {JobApplication} from '../../models/job-application.model';
import {StorageService} from '../../services/storage.service';
import {JobFormComponent} from '../job-form/job-form.component';

@Component({
    selector: 'app-job-list',
    standalone: true,
    imports: [
        CommonModule,
        FormsModule,
        MatCardModule,
        MatTableModule,
        MatSortModule,
        MatPaginatorModule,
        MatButtonModule,
        MatIconModule,
        MatInputModule,
        MatFormFieldModule,
        MatSelectModule,
        MatChipsModule,
        MatMenuModule,
        MatTooltipModule,
        MatDialogModule,
        JobFormComponent
    ],
    template: `
    <mat-card>
      <mat-card-header>
        <mat-card-title>Mes Candidatures</mat-card-title>
      </mat-card-header>
      <mat-card-content>
        <div class="filters">
          <mat-form-field appearance="outline">
            <mat-label>Rechercher</mat-label>
            <input matInput [(ngModel)]="searchTerm" (input)="applyFilters()">
            <button *ngIf="searchTerm" matSuffix mat-icon-button aria-label="Clear" (click)="searchTerm=''; applyFilters()">
              <mat-icon>close</mat-icon>
            </button>
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
            <mat-label>Trier par</mat-label>
            <mat-select [(ngModel)]="sortField" (selectionChange)="applySort()">
              <mat-option value="applicationDate">Date de candidature</mat-option>
              <mat-option value="company">Entreprise</mat-option>
              <mat-option value="position">Poste</mat-option>
              <mat-option value="status">Statut</mat-option>
            </mat-select>
          </mat-form-field>

          <button mat-icon-button [matMenuTriggerFor]="sortMenu" matTooltip="Ordre de tri">
            <mat-icon>{{ sortDirection === 'asc' ? 'arrow_upward' : 'arrow_downward' }}</mat-icon>
          </button>
          <mat-menu #sortMenu="matMenu">
            <button mat-menu-item (click)="setSortDirection('asc')">
              <mat-icon>arrow_upward</mat-icon>
              <span>Croissant</span>
            </button>
            <button mat-menu-item (click)="setSortDirection('desc')">
              <mat-icon>arrow_downward</mat-icon>
              <span>Décroissant</span>
            </button>
          </mat-menu>
        </div>

        <div *ngIf="filteredApplications.length === 0" class="no-data">
          <p>Aucune candidature trouvée.</p>
          <button mat-raised-button color="primary" (click)="showAddForm()">
            <mat-icon>add</mat-icon> Ajouter une candidature
          </button>
        </div>

        <div *ngIf="filteredApplications.length > 0" class="table-container">
          <table mat-table [dataSource]="paginatedApplications" matSort (matSortChange)="sortData($event)">
            <ng-container matColumnDef="company">
              <th mat-header-cell *matHeaderCellDef mat-sort-header>Entreprise</th>
              <td mat-cell *matCellDef="let application">{{ application.company }}</td>
            </ng-container>

            <ng-container matColumnDef="position">
              <th mat-header-cell *matHeaderCellDef mat-sort-header>Poste</th>
              <td mat-cell *matCellDef="let application">{{ application.position }}</td>
            </ng-container>

            <ng-container matColumnDef="applicationDate">
              <th mat-header-cell *matHeaderCellDef mat-sort-header>Date</th>
              <td mat-cell *matCellDef="let application">{{ application.applicationDate | date:'dd/MM/yyyy' }}</td>
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
                <button mat-icon-button color="primary" (click)="editApplication(application)" matTooltip="Modifier">
                  <mat-icon>edit</mat-icon>
                </button>
                <button mat-icon-button color="warn" (click)="deleteApplication(application)" matTooltip="Supprimer">
                  <mat-icon>delete</mat-icon>
                </button>
              </td>
            </ng-container>

            <tr mat-header-row *matHeaderRowDef="displayedColumns"></tr>
            <tr mat-row *matRowDef="let row; columns: displayedColumns;" (click)="viewApplicationDetails(row)" class="application-row"></tr>
          </table>

          <mat-paginator 
            [length]="filteredApplications.length"
            [pageSize]="pageSize"
            [pageSizeOptions]="[5, 10, 25, 50]"
            (page)="onPageChange($event)">
          </mat-paginator>
        </div>
      </mat-card-content>
      <mat-card-actions>
        <button mat-raised-button color="primary" (click)="showAddForm()" *ngIf="!showForm">
          <mat-icon>add</mat-icon> Ajouter une candidature
        </button>
      </mat-card-actions>
    </mat-card>

    <div *ngIf="showForm">
      <app-job-form 
        [editMode]="editMode" 
        [application]="selectedApplication"
        (formSubmit)="onFormSubmit($event)"
        (cancel)="cancelForm()">
      </app-job-form>
    </div>

    <div *ngIf="selectedApplication && showDetails" class="details-card">
      <mat-card>
        <mat-card-header>
          <mat-card-title>{{ selectedApplication.position }} - {{ selectedApplication.company }}</mat-card-title>
          <mat-card-subtitle>
            <span class="status-badge" 
                  [ngClass]="{
                    'status-sent': selectedApplication.status === 'Envoyé',
                    'status-interview': selectedApplication.status === 'Entretien',
                    'status-accepted': selectedApplication.status === 'Accepté',
                    'status-rejected': selectedApplication.status === 'Refusé'
                  }">
              {{ selectedApplication.status }}
            </span>
          </mat-card-subtitle>
          <button mat-icon-button (click)="closeDetails()" class="close-button">
            <mat-icon>close</mat-icon>
          </button>
        </mat-card-header>
        <mat-card-content>
          <div class="details-grid">
            <div class="detail-item">
              <strong>Date de candidature:</strong>
              <span>{{ selectedApplication.applicationDate | date:'dd/MM/yyyy' }}</span>
            </div>
            <div class="detail-item" *ngIf="selectedApplication.responseDate">
              <strong>Date de réponse:</strong>
              <span>{{ selectedApplication.responseDate | date:'dd/MM/yyyy' }}</span>
            </div>
            <div class="detail-item" *ngIf="selectedApplication.contactPerson">
              <strong>Contact:</strong>
              <span>{{ selectedApplication.contactPerson }}</span>
            </div>
            <div class="detail-item" *ngIf="selectedApplication.contactEmail">
              <strong>Email:</strong>
              <span>{{ selectedApplication.contactEmail }}</span>
            </div>
            <div class="detail-item" *ngIf="selectedApplication.contactPhone">
              <strong>Téléphone:</strong>
              <span>{{ selectedApplication.contactPhone }}</span>
            </div>
          </div>

          <div *ngIf="selectedApplication.notes" class="notes-section">
            <h3>Notes</h3>
            <p>{{ selectedApplication.notes }}</p>
          </div>

          <div *ngIf="selectedApplication.interviews && selectedApplication.interviews.length > 0" class="interviews-section">
            <h3>Entretiens</h3>
            <div *ngFor="let interview of selectedApplication.interviews" class="interview-item">
              <div class="interview-header">
                <span class="interview-date">{{ interview.date | date:'dd/MM/yyyy HH:mm' }}</span>
                <span class="interview-type">{{ interview.type }}</span>
              </div>
              <p *ngIf="interview.notes">{{ interview.notes }}</p>
            </div>
          </div>
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
  `,
    styles: [`
    .filters {
      display: flex;
      gap: 16px;
      align-items: center;
      margin-bottom: 16px;
      flex-wrap: wrap;
    }
    .filters mat-form-field {
      flex: 1;
      min-width: 200px;
    }
    .table-container {
      overflow-x: auto;
    }
    table {
      width: 100%;
    }
    .application-row {
      cursor: pointer;
    }
    .application-row:hover {
      background-color: rgba(0, 0, 0, 0.04);
    }
    .no-data {
      text-align: center;
      padding: 20px;
    }
    .status-badge {
      padding: 4px 8px;
      border-radius: 4px;
      font-size: 12px;
      font-weight: 500;
    }
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
      grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
      gap: 16px;
      margin-bottom: 20px;
    }
    .detail-item {
      display: flex;
      flex-direction: column;
    }
    .notes-section, .interviews-section {
      margin-top: 20px;
    }
    .interview-item {
      padding: 12px;
      border-left: 3px solid #3f51b5;
      background-color: rgba(0, 0, 0, 0.02);
      margin-bottom: 12px;
    }
    .interview-header {
      display: flex;
      justify-content: space-between;
      margin-bottom: 8px;
      font-weight: 500;
    }
    .interview-type {
      color: #3f51b5;
    }
  `]
})
export class JobListComponent implements OnInit {
    applications: JobApplication[] = [];
    filteredApplications: JobApplication[] = [];
    paginatedApplications: JobApplication[] = [];

    displayedColumns: string[] = ['company', 'position', 'applicationDate', 'status', 'actions'];

    // Filters and sorting
    searchTerm = '';
    statusFilter = '';
    sortField = 'applicationDate';
    sortDirection: 'asc' | 'desc' = 'desc';

    // Pagination
    pageSize = 10;
    currentPage = 0;

    // Form handling
    showForm = false;
    editMode = false;
    selectedApplication: JobApplication | null = null;
    showDetails = false;

    constructor(private storageService: StorageService) {
    }

    ngOnInit(): void {
        this.loadApplications();
    }

    loadApplications(): void {
        this.storageService.getApplications().subscribe(applications => {
            this.applications = applications;
            this.applyFilters();
        });
    }

    applyFilters(): void {
        let filtered = [...this.applications];

        // Apply search filter
        if (this.searchTerm) {
            const searchLower = this.searchTerm.toLowerCase();
            filtered = filtered.filter(app =>
                app.company.toLowerCase().includes(searchLower) ||
                app.position.toLowerCase().includes(searchLower) ||
                app.notes.toLowerCase().includes(searchLower)
            );
        }

        // Apply status filter
        if (this.statusFilter) {
            filtered = filtered.filter(app => app.status === this.statusFilter);
        }

        this.filteredApplications = filtered;
        this.applySort();
    }

    applySort(): void {
        const sorted = [...this.filteredApplications].sort((a, b) => {
            let comparison = 0;

            switch (this.sortField) {
                case 'applicationDate':
                    comparison = new Date(a.applicationDate).getTime() - new Date(b.applicationDate).getTime();
                    break;
                case 'company':
                    comparison = a.company.localeCompare(b.company);
                    break;
                case 'position':
                    comparison = a.position.localeCompare(b.position);
                    break;
                case 'status':
                    comparison = a.status.localeCompare(b.status);
                    break;
                default:
                    comparison = new Date(a.applicationDate).getTime() - new Date(b.applicationDate).getTime();
            }

            return this.sortDirection === 'asc' ? comparison : -comparison;
        });

        this.filteredApplications = sorted;
        this.updatePaginatedApplications();
    }

    sortData(sort: Sort): void {
        this.sortField = sort.active;
        this.sortDirection = sort.direction as 'asc' | 'desc' || 'asc';
        this.applySort();
    }

    setSortDirection(direction: 'asc' | 'desc'): void {
        this.sortDirection = direction;
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
        if (confirm(`Êtes-vous sûr de vouloir supprimer la candidature pour ${application.position} chez ${application.company} ?`)) {
            this.storageService.deleteApplication(application.id);
            if (this.showDetails && this.selectedApplication?.id === application.id) {
                this.closeDetails();
            }
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
}