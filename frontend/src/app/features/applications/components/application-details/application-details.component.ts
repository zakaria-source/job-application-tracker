import {CommonModule} from '@angular/common';
import {Component, EventEmitter, Input, OnChanges, Output} from '@angular/core';
import {FormsModule} from '@angular/forms';
import {MatButtonModule} from '@angular/material/button';
import {MatCardModule} from '@angular/material/card';
import {MatIconModule} from '@angular/material/icon';
import {JobTrackrApiService} from '@app/core/api/jobtrackr-api.service';
import {JobApplication, RecruitmentStage} from '@app/features/applications/models/application.model';
import {ApplicationEvent, ApplicationHealth, FollowUp, InterviewDebrief, InterviewDebriefInput} from '@app/features/applications/models/application-tracking.model';

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
const SHORT_DATE = new Intl.DateTimeFormat('fr-FR', {day: '2-digit', month: 'short'});

@Component({
    selector: 'app-application-details',
    standalone: true,
    imports: [CommonModule, FormsModule, MatButtonModule, MatCardModule, MatIconModule],
    templateUrl: './application-details.component.html',
    styleUrl: './application-details.component.css'
})
export class ApplicationDetailsComponent implements OnChanges {
    @Input({required: true}) application!: JobApplication;
    @Output() close = new EventEmitter<void>();
    @Output() edit = new EventEmitter<JobApplication>();
    @Output() delete = new EventEmitter<JobApplication>();
    @Output() stageChange = new EventEmitter<RecruitmentStage>();
    @Output() followUpComplete = new EventEmitter<JobApplication>();

    activity: ApplicationEvent[] = [];
    followUps: FollowUp[] = [];
    health: ApplicationHealth | null = null;
    debriefs: Record<string, InterviewDebrief> = {};
    debriefDrafts: Record<string, InterviewDebriefInput> = {};
    trackingLoading = false;
    trackingError = '';
    savingDebriefId = '';

    constructor(private readonly api?: JobTrackrApiService) {}

    ngOnChanges(): void {
        if (this.application?.id) {
            this.ensureDebriefDrafts();
            this.loadTracking();
        }
    }

    get nextStage(): RecruitmentStage | null {
        const index = ACTIVE_STAGES.indexOf(this.application.stage);
        return index < 0 || index >= ACTIVE_STAGES.length - 1 ? null : ACTIVE_STAGES[index + 1];
    }

    get nextActionLabel(): string {
        if (this.application.status === 'Accepté') return 'Offre acceptée';
        if (this.application.status === 'Refusé') return 'Candidature clôturée';
        if (this.currentFollowUp?.status === 'OVERDUE') return 'Traiter la relance en retard';
        if (this.currentFollowUp?.status === 'DUE' || this.isFollowUpDue()) return 'Effectuer la relance prévue';
        const nextInterview = this.nextInterview;
        if (nextInterview) return `Préparer l’entretien du ${SHORT_DATE.format(nextInterview.date)}`;
        if (this.currentFollowUp) return `Relancer le ${SHORT_DATE.format(this.currentFollowUp.scheduledFor)}`;
        if (this.nextStage) return `Faire avancer vers « ${this.nextStage} »`;
        return 'Mettre à jour le contexte';
    }

    get currentFollowUp(): FollowUp | null {
        return this.followUps.find(item => ['PLANNED', 'DUE', 'OVERDUE'].includes(item.status)) ?? null;
    }

    get healthLabel(): string {
        return this.health?.level === 'HEALTHY' ? 'Saine' : this.health?.level === 'WATCH' ? 'À surveiller' : 'À risque';
    }

    get timeline(): TimelineEvent[] {
        const events: TimelineEvent[] = this.activity.map(event => ({
            id: event.id,
            date: event.createdAt,
            title: event.title,
            detail: event.details,
            icon: this.iconForEvent(event.type)
        }));
        if (!this.activity.some(event => event.type === 'APPLICATION_CREATED')) {
            events.push({
                id: 'applied',
                date: this.application.applicationDate,
                title: 'Candidature envoyée',
                detail: `${this.application.company} · ${this.application.position}`,
                icon: 'outgoing_mail'
            });
        }
        const now = Date.now();
        for (const interview of this.application.interviews ?? []) {
            if (interview.date.getTime() > now) {
                events.push({
                    id: `future-${interview.id}`,
                    date: interview.date,
                    title: `Entretien à venir · ${interview.type}`,
                    detail: interview.notes || 'Rendez-vous planifié',
                    icon: 'event',
                    future: true
                });
            }
        }
        return events.sort((a, b) => a.date.getTime() - b.date.getTime());
    }

    get nextInterview() {
        const now = Date.now();
        return [...(this.application.interviews ?? [])]
            .filter(interview => interview.date.getTime() >= now)
            .sort((a, b) => a.date.getTime() - b.date.getTime())[0] ?? null;
    }

    isFollowUpDue(): boolean {
        if (!this.application.followUpDate || ['Accepté', 'Refusé'].includes(this.application.status)) return false;
        const tomorrow = new Date();
        tomorrow.setHours(24, 0, 0, 0);
        return this.application.followUpDate < tomorrow;
    }

    formatTargetSalary(): string {
        if (!this.application.salaryTarget) return '—';
        const formatted = new Intl.NumberFormat('fr-FR').format(this.application.salaryTarget);
        return this.application.salaryPeriod === 'Journalier' ? `${formatted} €/j` : `${formatted} € brut/an`;
    }

    advanceStage(): void {
        if (this.nextStage) this.stageChange.emit(this.nextStage);
    }

    saveDebrief(interviewId: string): void {
        if (!this.api) return;
        const draft = this.debriefDrafts[interviewId];
        if (!draft || this.savingDebriefId) return;

        this.savingDebriefId = interviewId;
        this.api.saveInterviewDebrief(this.application.id, interviewId, draft).subscribe({
            next: saved => {
                this.debriefs[interviewId] = saved;
                this.savingDebriefId = '';
                this.loadActivityOnly();
            },
            error: () => {
                this.savingDebriefId = '';
                this.trackingError = 'Impossible d’enregistrer le débrief.';
            }
        });
    }

    followUpStatusLabel(status: FollowUp['status']): string {
        return ({
            PLANNED: 'Planifiée',
            DUE: 'Aujourd’hui',
            OVERDUE: 'En retard',
            COMPLETED: 'Terminée',
            CANCELLED: 'Annulée'
        } as const)[status];
    }

    private loadTracking(): void {
        if (!this.api) return;
        this.trackingLoading = true;
        this.trackingError = '';
        this.api.getTrackingOverview(this.application.id).subscribe({
            next: overview => {
                this.activity = overview.activity;
                this.followUps = overview.followUps;
                this.health = overview.health;
                this.debriefs = Object.fromEntries(overview.debriefs.map(item => [item.interviewId, item]));
                this.ensureDebriefDrafts();
                this.trackingLoading = false;
            },
            error: () => {
                this.trackingLoading = false;
                this.trackingError = 'Certaines données de suivi sont indisponibles.';
            }
        });
    }

    private loadActivityOnly(): void {
        if (!this.api) return;
        this.api.getApplicationActivity(this.application.id).subscribe({
            next: items => this.activity = items,
            error: () => this.trackingError = 'Impossible de rafraîchir l’activité.'
        });
    }

    private ensureDebriefDrafts(): void {
        for (const interview of this.application.interviews ?? []) {
            const saved = this.debriefs[interview.id];
            if (!this.debriefDrafts[interview.id]) {
                this.debriefDrafts[interview.id] = {
                    sentiment: saved?.sentiment ?? 'NEUTRAL',
                    questions: saved?.questions ?? '',
                    strengths: saved?.strengths ?? '',
                    improvements: saved?.improvements ?? '',
                    nextAction: saved?.nextAction ?? ''
                };
            } else if (saved) {
                this.debriefDrafts[interview.id] = {
                    sentiment: saved.sentiment,
                    questions: saved.questions,
                    strengths: saved.strengths,
                    improvements: saved.improvements,
                    nextAction: saved.nextAction
                };
            }
        }
    }

    private iconForEvent(type: string): string {
        if (type.includes('FOLLOW_UP')) return 'outgoing_mail';
        if (type === 'STAGE_CHANGED') return 'conversion_path';
        if (type.includes('INTERVIEW') || type === 'DEBRIEF_SAVED') return 'event_note';
        if (type === 'APPLICATION_CREATED') return 'add_circle';
        return 'history';
    }
}
