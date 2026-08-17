import {Component, DestroyRef, OnInit, ViewChild, inject} from '@angular/core';
import {takeUntilDestroyed} from '@angular/core/rxjs-interop';
import {MatButtonModule} from '@angular/material/button';
import {MatCardModule} from '@angular/material/card';
import {MatIconModule} from '@angular/material/icon';
import {JobApplication} from '../../models/job-application.model';
import {StorageService} from '../../services/storage.service';
import {
    ApplicationFilterCriteria,
    ApplicationFiltersComponent
} from '../application-filters/application-filters.component';
import {ApplicationListComponent} from '../application-list/application-list.component';
import {ApplicationDetailsComponent} from '../application-details/application-details.component';
import {JobFormComponent} from '../job-form/job-form.component';

const EMPTY_FILTERS: ApplicationFilterCriteria = {
    searchTerm: '',
    status: '',
    contractType: '',
    priority: ''
};

@Component({
    selector: 'app-job-list',
    standalone: true,
    imports: [
        MatButtonModule,
        MatCardModule,
        MatIconModule,
        ApplicationFiltersComponent,
        ApplicationListComponent,
        ApplicationDetailsComponent,
        JobFormComponent
    ],
    templateUrl: './job-list.component.html',
    styleUrl: './job-list.component.css'
})
export class JobListComponent implements OnInit {
    private readonly destroyRef = inject(DestroyRef);

    @ViewChild(ApplicationFiltersComponent)
    private filtersComponent?: ApplicationFiltersComponent;

    applications: JobApplication[] = [];
    filteredApplications: JobApplication[] = [];
    selectedApplication: JobApplication | null = null;
    showForm = false;
    showDetails = false;
    editMode = false;

    private activeFilters: ApplicationFilterCriteria = EMPTY_FILTERS;

    constructor(private readonly storageService: StorageService) {}

    ngOnInit(): void {
        this.storageService.getApplications()
            .pipe(takeUntilDestroyed(this.destroyRef))
            .subscribe(applications => {
                this.applications = applications;
                this.applyFilters(this.activeFilters);
            });
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

    exportApplications(): void {
        const blob = new Blob([this.storageService.exportData()], {type: 'application/json'});
        const url = URL.createObjectURL(blob);
        const anchor = document.createElement('a');

        anchor.href = url;
        anchor.download = `jobtrackr-backup-${new Date().toISOString().slice(0, 10)}.json`;
        anchor.click();
        URL.revokeObjectURL(url);
    }

    importApplications(event: Event): void {
        const input = event.target as HTMLInputElement;
        const file = input.files?.[0];
        if (!file) {
            return;
        }

        const reader = new FileReader();
        reader.onload = () => {
            try {
                if (!confirm('Importer ce fichier remplacera les candidatures actuellement stockées. Continuer ?')) {
                    return;
                }
                this.storageService.importData(String(reader.result ?? ''));
            } catch (error) {
                console.error(error);
                alert('Le fichier sélectionné n’est pas un export JobTrackr valide.');
            } finally {
                input.value = '';
            }
        };
        reader.readAsText(file);
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
