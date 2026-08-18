import {CommonModule} from '@angular/common';
import {Component, EventEmitter, Input, Output} from '@angular/core';
import {MatButtonModule} from '@angular/material/button';
import {MatCardModule} from '@angular/material/card';
import {MatIconModule} from '@angular/material/icon';
import {JobApplication, RecruitmentStage} from '@app/features/applications/models/application.model';

interface TimelineEvent {
    id: string;
    date: Date;
    title: string;
    detail: string;
    icon: string;
    future?: boolean;
}

const ACTIVE_STAGES: readonly RecruitmentStage[] = [
    'Candidature',
    'Screening RH',
    'Entretien technique',
    'Hiring Manager',
    'Entretien final',
    'Offre'
];

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
    @Output() stageChange = new EventEmitter<RecruitmentStage>();
    @Output() followUpComplete = new EventEmitter<JobApplication>();

    get nextStage(): RecruitmentStage | null {
        const index = ACTIVE_STAGES.indexOf(this.application.stage);
        if (index < 0 || index >= ACTIVE_STAGES.length - 1) {
            return null;
        }
        return ACTIVE_STAGES[index + 1];
    }

    get nextActionLabel(): string {
        if (this.application.status === 'Accepté') return 'Offre acceptée';
        if (this.application.status === 'Refusé') return 'Candidature clôturée';
        if (this.isFollowUpDue()) return 'Effectuer la relance prévue';

        const nextInterview = this.nextInterview;
        if (nextInterview) return `Préparer l’entretien du ${new Intl.DateTimeFormat('fr-FR', {day: '2-digit', month: 'short'}).format(nextInterview.date)}`;
        if (this.application.followUpDate) return `Relancer le ${new Intl.DateTimeFormat('fr-FR', {day: '2-digit', month: 'short'}).format(this.application.followUpDate)}`;
        if (this.nextStage) return `Faire avancer vers « ${this.nextStage} »`;
        return 'Mettre à jour le contexte';
    }

    get timeline(): TimelineEvent[] {
        const events: TimelineEvent[] = [
            {
                id: 'applied',
                date: this.application.applicationDate,
                title: 'Candidature envoyée',
                detail: `${this.application.company} · ${this.application.position}`,
                icon: 'outgoing_mail'
            }
        ];

        if (this.application.responseDate) {
            events.push({
                id: 'response',
                date: this.application.responseDate,
                title: 'Première réponse reçue',
                detail: `Passage au statut ${this.application.status.toLowerCase()}`,
                icon: 'mark_email_read'
            });
        }

        for (const interview of this.application.interviews ?? []) {
            events.push({
                id: `interview-${interview.id}`,
                date: interview.date,
                title: `Entretien · ${interview.type}`,
                detail: interview.notes || 'Rendez-vous planifié',
                icon: 'event',
                future: interview.date > new Date()
            });
        }

        if (this.application.followUpDate) {
            events.push({
                id: 'follow-up',
                date: this.application.followUpDate,
                title: this.isFollowUpDue() ? 'Relance à effectuer' : 'Relance planifiée',
                detail: this.isFollowUpDue() ? 'Cette relance demande votre attention.' : 'Prochaine action planifiée.',
                icon: 'outgoing_mail',
                future: this.application.followUpDate > new Date()
            });
        }

        if (this.application.lastUpdated.getTime() > this.application.applicationDate.getTime() + 60_000) {
            events.push({
                id: 'updated',
                date: this.application.lastUpdated,
                title: 'Candidature mise à jour',
                detail: `Étape actuelle · ${this.application.stage}`,
                icon: 'history'
            });
        }

        return events.sort((a, b) => a.date.getTime() - b.date.getTime());
    }

    get nextInterview() {
        const now = new Date();
        return [...(this.application.interviews ?? [])]
            .filter(interview => interview.date >= now)
            .sort((a, b) => a.date.getTime() - b.date.getTime())[0] ?? null;
    }

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

    advanceStage(): void {
        if (this.nextStage) {
            this.stageChange.emit(this.nextStage);
        }
    }
}
