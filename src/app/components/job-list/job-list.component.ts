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
    templateUrl: './job-list.component.html',
    styleUrl: './job-list.component.css'
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
