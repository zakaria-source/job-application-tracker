import {Component, DestroyRef, ElementRef, EventEmitter, Output, ViewChild, inject} from '@angular/core';
import {takeUntilDestroyed} from '@angular/core/rxjs-interop';
import {FormsModule} from '@angular/forms';
import {MatButtonModule} from '@angular/material/button';
import {MatFormFieldModule} from '@angular/material/form-field';
import {MatIconModule} from '@angular/material/icon';
import {MatInputModule} from '@angular/material/input';
import {MatSelectModule} from '@angular/material/select';
import {Subject, debounceTime, distinctUntilChanged} from 'rxjs';
import {
    ApplicationPriority,
    ApplicationStatus,
    ContractType
} from '@app/features/applications/models/application.model';

export interface ApplicationFilterCriteria {
    searchTerm: string;
    status: ApplicationStatus | '';
    contractType: ContractType | '';
    priority: ApplicationPriority | '';
}

@Component({
    selector: 'app-application-filters',
    standalone: true,
    imports: [FormsModule, MatButtonModule, MatFormFieldModule, MatIconModule, MatInputModule, MatSelectModule],
    templateUrl: './application-filters.component.html',
    styleUrl: './application-filters.component.css'
})
export class ApplicationFiltersComponent {
    private readonly destroyRef = inject(DestroyRef);
    private readonly searchChanges = new Subject<string>();
    @Output() filtersChange = new EventEmitter<ApplicationFilterCriteria>();
    @ViewChild('searchInput') private searchInput?: ElementRef<HTMLInputElement>;

    searchTerm = '';
    status: ApplicationStatus | '' = '';
    contractType: ContractType | '' = '';
    priority: ApplicationPriority | '' = '';

    constructor() {
        this.searchChanges.pipe(
            debounceTime(180),
            distinctUntilChanged(),
            takeUntilDestroyed(this.destroyRef)
        ).subscribe(() => this.emitFilters());
    }

    get advancedFilterCount(): number {
        return [this.status, this.contractType, this.priority].filter(Boolean).length;
    }

    get activeFilterLabels(): string[] {
        return [
            this.status ? `Statut · ${this.status}` : '',
            this.contractType ? `Contrat · ${this.contractType}` : '',
            this.priority ? `Priorité · ${this.priority}` : ''
        ].filter(Boolean);
    }

    focusSearch(): void {
        this.searchInput?.nativeElement.focus();
    }

    onSearchInput(): void {
        this.searchChanges.next(this.searchTerm);
    }

    emitFilters(): void {
        this.filtersChange.emit(this.currentCriteria());
    }

    clearSearch(): void {
        this.searchTerm = '';
        this.emitFilters();
        this.focusSearch();
    }

    clearStatus(): void { this.status = ''; this.emitFilters(); }
    clearContractType(): void { this.contractType = ''; this.emitFilters(); }
    clearPriority(): void { this.priority = ''; this.emitFilters(); }

    resetFilters(): void {
        this.searchTerm = '';
        this.status = '';
        this.contractType = '';
        this.priority = '';
        this.emitFilters();
    }

    private currentCriteria(): ApplicationFilterCriteria {
        return {searchTerm: this.searchTerm, status: this.status, contractType: this.contractType, priority: this.priority};
    }
}
