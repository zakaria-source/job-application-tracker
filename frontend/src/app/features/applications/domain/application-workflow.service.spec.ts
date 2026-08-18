import {describe, expect, it} from 'vitest';
import {ApplicationWorkflowService} from '@app/features/applications/domain/application-workflow.service';

describe('ApplicationWorkflowService', () => {
    const service = new ApplicationWorkflowService();
    it('derives interview status from interview stages', () => {
        expect(service.statusForStage('Entretien technique')).toBe('Entretien');
        expect(service.statusForStage('Hiring Manager')).toBe('Entretien');
    });
    it('normalizes inconsistent legacy status from the stage', () => {
        expect(service.normalize('Envoyé', 'Offre')).toEqual({status: 'Accepté', stage: 'Offre'});
    });
});
