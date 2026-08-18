import {Injectable} from '@angular/core';
import {ApplicationStatus, RecruitmentStage} from '@app/features/applications/models/application.model';

@Injectable({providedIn: 'root'})
export class ApplicationWorkflowService {
    readonly stages: readonly RecruitmentStage[] = [
        'Candidature',
        'Screening RH',
        'Entretien technique',
        'Hiring Manager',
        'Entretien final',
        'Offre',
        'Clôturé'
    ];

    readonly statuses: readonly ApplicationStatus[] = ['Envoyé', 'Entretien', 'Accepté', 'Refusé'];

    statusForStage(stage: RecruitmentStage): ApplicationStatus {
        switch (stage) {
            case 'Candidature':
                return 'Envoyé';
            case 'Screening RH':
            case 'Entretien technique':
            case 'Hiring Manager':
            case 'Entretien final':
                return 'Entretien';
            case 'Offre':
                return 'Accepté';
            case 'Clôturé':
                return 'Refusé';
        }
    }

    defaultStageForStatus(status: ApplicationStatus): RecruitmentStage {
        switch (status) {
            case 'Entretien':
                return 'Screening RH';
            case 'Accepté':
                return 'Offre';
            case 'Refusé':
                return 'Clôturé';
            case 'Envoyé':
                return 'Candidature';
        }
    }

    normalize(status: ApplicationStatus, stage: RecruitmentStage): {status: ApplicationStatus; stage: RecruitmentStage} {
        return {status: this.statusForStage(stage), stage};
    }

    isStage(value: unknown): value is RecruitmentStage {
        return typeof value === 'string' && this.stages.includes(value as RecruitmentStage);
    }

    isStatus(value: unknown): value is ApplicationStatus {
        return typeof value === 'string' && this.statuses.includes(value as ApplicationStatus);
    }
}
