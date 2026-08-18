import {CommonModule} from '@angular/common';
import {Component, EventEmitter, Input, Output} from '@angular/core';
import {
    CdkDrag,
    CdkDragDrop,
    CdkDragHandle,
    CdkDropList,
    CdkDropListGroup
} from '@angular/cdk/drag-drop';
import {MatButtonModule} from '@angular/material/button';
import {MatIconModule} from '@angular/material/icon';
import {MatTooltipModule} from '@angular/material/tooltip';
import {JobApplication, RecruitmentStage} from '../../models/job-application.model';

export interface ApplicationStageChange {
    applicationId: string;
    stage: RecruitmentStage;
}

interface KanbanColumn {
    stage: RecruitmentStage;
    applications: JobApplication[];
}

@Component({
    selector: 'app-application-kanban',
    standalone: true,
    imports: [
        CommonModule,
        CdkDrag,
        CdkDragHandle,
        CdkDropList,
        CdkDropListGroup,
        MatButtonModule,
        MatIconModule,
        MatTooltipModule
    ],
    templateUrl: './application-kanban.component.html',
    styleUrl: './application-kanban.component.css'
})
export class ApplicationKanbanComponent {
    @Input({required: true}) applications: JobApplication[] = [];

    @Output() readonly viewApplication = new EventEmitter<JobApplication>();
    @Output() readonly editApplication = new EventEmitter<JobApplication>();
    @Output() readonly stageChange = new EventEmitter<ApplicationStageChange>();

    private readonly stages: readonly RecruitmentStage[] = [
        'Candidature',
        'Screening RH',
        'Entretien technique',
        'Hiring Manager',
        'Entretien final',
        'Offre',
        'Clôturé'
    ];

    private readonly activeStages: readonly RecruitmentStage[] = [
        'Candidature',
        'Screening RH',
        'Entretien technique',
        'Hiring Manager',
        'Entretien final',
        'Offre'
    ];

    get columns(): KanbanColumn[] {
        return this.stages.map(stage => ({
            stage,
            applications: this.applications.filter(application => application.stage === stage)
        }));
    }

    drop(event: CdkDragDrop<KanbanColumn>): void {
        const application = event.item.data as JobApplication;
        const targetStage = event.container.data.stage;

        if (!application || application.stage === targetStage) {
            return;
        }

        this.stageChange.emit({applicationId: application.id, stage: targetStage});
    }

    movePrevious(event: Event, application: JobApplication): void {
        event.stopPropagation();
        const stage = this.previousStage(application);
        if (stage) {
            this.stageChange.emit({applicationId: application.id, stage});
        }
    }

    moveNext(event: Event, application: JobApplication): void {
        event.stopPropagation();
        const stage = this.nextStage(application);
        if (stage) {
            this.stageChange.emit({applicationId: application.id, stage});
        }
    }

    previousStage(application: JobApplication): RecruitmentStage | null {
        const index = this.activeStages.indexOf(application.stage);
        return index > 0 ? this.activeStages[index - 1] : null;
    }

    nextStage(application: JobApplication): RecruitmentStage | null {
        const index = this.activeStages.indexOf(application.stage);
        return index >= 0 && index < this.activeStages.length - 1
            ? this.activeStages[index + 1]
            : null;
    }

    stageStepLabel(stage: RecruitmentStage): string {
        const index = this.activeStages.indexOf(stage);
        return index < 0 ? 'Clôturé' : `Étape ${index + 1}/${this.activeStages.length}`;
    }

    stageProgress(stage: RecruitmentStage): number {
        const index = this.activeStages.indexOf(stage);
        if (index < 0) {
            return 100;
        }
        if (index === 0) {
            return 0;
        }
        return Math.round((index / (this.activeStages.length - 1)) * 100);
    }

    companyInitial(application: JobApplication): string {
        return application.company.trim().charAt(0).toUpperCase() || '?';
    }

    isFollowUpDue(application: JobApplication, now = new Date()): boolean {
        if (!application.followUpDate || application.status === 'Accepté' || application.status === 'Refusé') {
            return false;
        }

        const endOfToday = new Date(now);
        endOfToday.setHours(23, 59, 59, 999);
        return application.followUpDate <= endOfToday;
    }

    formatTargetSalary(application: JobApplication): string | null {
        if (!application.salaryTarget) {
            return null;
        }

        const formatted = new Intl.NumberFormat('fr-FR').format(application.salaryTarget);
        return application.salaryPeriod === 'Journalier'
            ? `${formatted} €/j`
            : `${formatted} € / an`;
    }

    stageIcon(stage: RecruitmentStage): string {
        switch (stage) {
            case 'Candidature':
                return 'send';
            case 'Screening RH':
                return 'record_voice_over';
            case 'Entretien technique':
                return 'code';
            case 'Hiring Manager':
                return 'groups';
            case 'Entretien final':
                return 'verified';
            case 'Offre':
                return 'celebration';
            case 'Clôturé':
                return 'archive';
        }
    }
}
