import {describe, expect, it} from 'vitest';
import {ApplicationFiltersComponent} from './application-filters.component';

describe('ApplicationFiltersComponent', () => {
    it('emits typed filter criteria and can reset them', () => {
        const component = new ApplicationFiltersComponent();
        const emissions: unknown[] = [];
        component.filtersChange.subscribe(criteria => emissions.push(criteria));

        component.searchTerm = 'Acme';
        component.status = 'Entretien';
        component.contractType = 'CDI';
        component.priority = 'Haute';
        component.emitFilters();

        expect(emissions.at(-1)).toEqual({
            searchTerm: 'Acme',
            status: 'Entretien',
            contractType: 'CDI',
            priority: 'Haute'
        });

        component.resetFilters();
        expect(emissions.at(-1)).toEqual({
            searchTerm: '',
            status: '',
            contractType: '',
            priority: ''
        });
    });
});
