import {CommonModule} from '@angular/common';
import {Component, EventEmitter, Input, Output} from '@angular/core';
import {MatButtonModule} from '@angular/material/button';
import {MatCardModule} from '@angular/material/card';
import {MatIconModule} from '@angular/material/icon';
import {JobApplication} from '../../models/job-application.model';

@Component({
    selector: 'app-application-details',
    standalone: true,
    imports: [CommonModule, MatButtonModule, MatCardModule, MatIconModule],
    templateUrl: './application-details.component.html',
    styleUrl: './application-details.component.css'
})
export class ApplicationDetailsComponent {
    @Input({required: true}) application!: JobApplication;
    @Output() close = new EventEmitter<void>();
    @Output() edit = new EventEmitter<JobApplication>();
    @Output() delete = new EventEmitter<JobApplication>();

    isFollowUpDue(): boolean {
        if (!this.application.followUpDate
            || this.application.status === 'Accepté'
            || this.application.status === 'Refusé') {
            return false;
        }

        const tomorrow = new Date();
        tomorrow.setHours(24, 0, 0, 0);
        return this.application.followUpDate < tomorrow;
    }

    formatTargetSalary(): string {
        if (!this.application.salaryTarget) {
            return '—';
        }

        const formatted = new Intl.NumberFormat('fr-FR').format(this.application.salaryTarget);
        return this.application.salaryPeriod === 'Journalier'
            ? `${formatted} €/j`
            : `${formatted} € brut/an`;
    }
}
