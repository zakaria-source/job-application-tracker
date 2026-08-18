import {CommonModule} from '@angular/common';
import {Component, EventEmitter, Input, OnChanges, Output} from '@angular/core';
import {MatButtonModule} from '@angular/material/button';
import {MatIconModule} from '@angular/material/icon';
import {MatPaginatorModule, PageEvent} from '@angular/material/paginator';
import {MatSortModule, Sort} from '@angular/material/sort';
import {MatTableModule} from '@angular/material/table';
import {MatTooltipModule} from '@angular/material/tooltip';
import {JobApplication} from '../../models/job-application.model';

@Component({
    selector: 'app-application-list',
    standalone: true,
    imports: [
        CommonModule,
        MatButtonModule,
        MatIconModule,
        MatPaginatorModule,
        MatSortModule,
        MatTableModule,
        MatTooltipModule
    ],
    templateUrl: './application-list.component.html',
    styleUrl: './application-list.component.css'
})
export class ApplicationListComponent implements OnChanges {
    @Input() applications: JobApplication[] = [];
    @Output() viewApplication = new EventEmitter<JobApplication>();
    @Output() editApplication = new EventEmitter<JobApplication>();
    @Output() deleteApplication = new EventEmitter<JobApplication>();

    readonly displayedColumns = [
        'company',
        'position',
        'contractType',
        'priority',
        'followUpDate',
        'actions'
    ];

    sortedApplications: JobApplication[] = [];
    paginatedApplications: JobApplication[] = [];
    sortField = 'followUpDate';
    sortDirection: 'asc' | 'desc' = 'asc';
    pageSize = 10;
    currentPage = 0;

    ngOnChanges(): void {
        this.currentPage = 0;
        this.sortAndPaginate();
    }

    sortData(sort: Sort): void {
        this.sortField = sort.active;
        this.sortDirection = (sort.direction || 'asc') as 'asc' | 'desc';
        this.currentPage = 0;
        this.sortAndPaginate();
    }

    onPageChange(event: PageEvent): void {
        this.currentPage = event.pageIndex;
        this.pageSize = event.pageSize;
        this.updatePage();
    }

    openDetails(application: JobApplication): void {
        this.viewApplication.emit(application);
    }

    requestEdit(event: Event, application: JobApplication): void {
        event.stopPropagation();
        this.editApplication.emit(application);
    }

    requestDelete(event: Event, application: JobApplication): void {
        event.stopPropagation();
        this.deleteApplication.emit(application);
    }

    isFollowUpDue(application: JobApplication): boolean {
        if (!application.followUpDate || application.status === 'Accepté' || application.status === 'Refusé') {
            return false;
        }

        const tomorrow = new Date();
        tomorrow.setHours(24, 0, 0, 0);
        return application.followUpDate < tomorrow;
    }

    private sortAndPaginate(): void {
        const priorityOrder: Record<JobApplication['priority'], number> = {
            Haute: 3,
            Moyenne: 2,
            Basse: 1
        };

        this.sortedApplications = [...this.applications].sort((a, b) => {
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
                default:
                    comparison = a.applicationDate.getTime() - b.applicationDate.getTime();
            }

            return this.sortDirection === 'asc' ? comparison : -comparison;
        });

        this.updatePage();
    }

    private updatePage(): void {
        const start = this.currentPage * this.pageSize;
        this.paginatedApplications = this.sortedApplications.slice(start, start + this.pageSize);
    }
}
