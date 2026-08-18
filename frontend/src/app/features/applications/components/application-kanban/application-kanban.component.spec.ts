import {CdkDragDrop} from '@angular/cdk/drag-drop';
import {describe, expect, it, vi} from 'vitest';
import {JobApplication} from '@app/features/applications/models/application.model';
import {ApplicationKanbanComponent} from './application-kanban.component';

const application: JobApplication = {
    id: '1',
    company: 'Acme',
    position: 'Backend Engineer',
    applicationDate: new Date('2026-08-17'),
    status: 'Envoyé',
    notes: '',
    lastUpdated: new Date('2026-08-17'),
    contractType: 'CDI',
    salaryPeriod: 'Annuel',
    stage: 'Candidature',
    priority: 'Haute'
};

describe('ApplicationKanbanComponent', () => {
    it('groups applications by recruitment stage', () => {
        const component = new ApplicationKanbanComponent();
        component.applications = [application];

        const candidature = component.columns.find(column => column.stage === 'Candidature');
        const screening = component.columns.find(column => column.stage === 'Screening RH');

        expect(candidature?.applications).toEqual([application]);
        expect(screening?.applications).toEqual([]);
    });

    it('emits a stage change when a card moves to another column', () => {
        const component = new ApplicationKanbanComponent();
        const emit = vi.spyOn(component.stageChange, 'emit');
        const event = {
            item: {data: application},
            container: {data: {stage: 'Screening RH', applications: []}}
        } as unknown as CdkDragDrop<{stage: JobApplication['stage']; applications: JobApplication[]}>;

        component.drop(event);

        expect(emit).toHaveBeenCalledWith({applicationId: '1', stage: 'Screening RH'});
    });

    it('does not emit when a card stays in the same stage', () => {
        const component = new ApplicationKanbanComponent();
        const emit = vi.spyOn(component.stageChange, 'emit');
        const event = {
            item: {data: application},
            container: {data: {stage: 'Candidature', applications: [application]}}
        } as unknown as CdkDragDrop<{stage: JobApplication['stage']; applications: JobApplication[]}>;

        component.drop(event);

        expect(emit).not.toHaveBeenCalled();
    });

    it('exposes the adjacent active stages for quick navigation', () => {
        const component = new ApplicationKanbanComponent();
        const screening = {...application, stage: 'Screening RH' as const, status: 'Entretien' as const};

        expect(component.previousStage(screening)).toBe('Candidature');
        expect(component.nextStage(screening)).toBe('Entretien technique');
    });

    it('does not offer a quick next action from an accepted offer to the rejected closed stage', () => {
        const component = new ApplicationKanbanComponent();
        const offer = {...application, stage: 'Offre' as const, status: 'Accepté' as const};

        expect(component.nextStage(offer)).toBeNull();
    });

    it('emits the next stage from the quick navigation action', () => {
        const component = new ApplicationKanbanComponent();
        const emit = vi.spyOn(component.stageChange, 'emit');
        const event = {stopPropagation: vi.fn()} as unknown as Event;

        component.moveNext(event, application);

        expect(event.stopPropagation).toHaveBeenCalled();
        expect(emit).toHaveBeenCalledWith({applicationId: '1', stage: 'Screening RH'});
    });

    it('calculates active-stage progress without treating closed as a forward step', () => {
        const component = new ApplicationKanbanComponent();

        expect(component.stageProgress('Candidature')).toBe(0);
        expect(component.stageProgress('Entretien technique')).toBe(40);
        expect(component.stageProgress('Offre')).toBe(100);
        expect(component.stageStepLabel('Clôturé')).toBe('Clôturé');
    });
});
