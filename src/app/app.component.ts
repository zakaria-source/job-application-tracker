import {Component} from '@angular/core';
import {CommonModule} from '@angular/common';
import {MatToolbarModule} from '@angular/material/toolbar';
import {MatButtonModule} from '@angular/material/button';
import {MatIconModule} from '@angular/material/icon';
import {MatSidenavModule} from '@angular/material/sidenav';
import {MatListModule} from '@angular/material/list';
import {MatTabsModule} from '@angular/material/tabs';
import {JobFormComponent} from './components/job-form/job-form.component';
import {JobListComponent} from './components/job-list/job-list.component';
import {DashboardComponent} from './components/dashboard/dashboard.component';

@Component({
    selector: 'app-root',
    standalone: true,
    imports: [
        CommonModule,
        MatToolbarModule,
        MatButtonModule,
        MatIconModule,
        MatSidenavModule,
        MatListModule,
        MatTabsModule,
        JobFormComponent,
        JobListComponent,
        DashboardComponent
    ],
    template: `
    <div class="app-container">
      <mat-toolbar color="primary" class="app-toolbar">
        <span>Suivi des Candidatures</span>
        <span class="toolbar-spacer"></span>
        <button mat-icon-button aria-label="Aide">
          <mat-icon>help_outline</mat-icon>
        </button>
      </mat-toolbar>

      <div class="app-content">
        <mat-tab-group animationDuration="0ms">
          <mat-tab label="Tableau de bord">
            <div class="tab-content">
              <app-dashboard></app-dashboard>
            </div>
          </mat-tab>
          <mat-tab label="Mes candidatures">
            <div class="tab-content">
              <app-job-list></app-job-list>
            </div>
          </mat-tab>
          <mat-tab label="Nouvelle candidature">
            <div class="tab-content">
              <app-job-form (formSubmit)="onFormSubmit($event)" (cancel)="onCancel()"></app-job-form>
            </div>
          </mat-tab>
        </mat-tab-group>
      </div>
    </div>
  `,
    styles: [`
    .app-container {
      display: flex;
      flex-direction: column;
      height: 100vh;
    }
    .app-toolbar {
      position: sticky;
      top: 0;
      z-index: 1000;
    }
    .toolbar-spacer {
      flex: 1 1 auto;
    }
    .app-content {
      flex: 1;
      overflow: auto;
    }
    .tab-content {
      padding: 20px;
    }
  `]
})
export class App {
    activeTabIndex = 0;

    onFormSubmit(event: any): void {
        // Redirect to the job list tab after form submission
        this.activeTabIndex = 1;
    }

    onCancel(): void {
        // Redirect to the job list tab after cancellation
        this.activeTabIndex = 1;
    }
}