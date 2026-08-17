import {Component} from '@angular/core';
import {MatToolbarModule} from '@angular/material/toolbar';
import {MatTabsModule} from '@angular/material/tabs';
import {JobListComponent} from './components/job-list/job-list.component';
import {DashboardComponent} from './components/dashboard/dashboard.component';

@Component({
    selector: 'app-root',
    standalone: true,
    imports: [
        MatToolbarModule,
        MatTabsModule,
        JobListComponent,
        DashboardComponent
    ],
    template: `
    <div class="app-container">
      <mat-toolbar color="primary" class="app-toolbar">
        <span>JobTrackr</span>
        <span class="toolbar-spacer"></span>
        <span class="toolbar-subtitle">Suivi de candidatures</span>
      </mat-toolbar>

      <main class="app-content">
        <mat-tab-group animationDuration="0ms">
          <mat-tab label="Tableau de bord">
            <div class="tab-content">
              <app-dashboard></app-dashboard>
            </div>
          </mat-tab>

          <mat-tab label="Candidatures">
            <div class="tab-content">
              <app-job-list></app-job-list>
            </div>
          </mat-tab>
        </mat-tab-group>
      </main>
    </div>
  `,
    styles: [`
    .app-container {
      display: flex;
      flex-direction: column;
      min-height: 100vh;
    }

    .app-toolbar {
      position: sticky;
      top: 0;
      z-index: 1000;
    }

    .toolbar-spacer {
      flex: 1 1 auto;
    }

    .toolbar-subtitle {
      font-size: 14px;
      font-weight: 400;
      opacity: 0.85;
    }

    .app-content {
      flex: 1;
    }

    .tab-content {
      max-width: 1400px;
      margin: 0 auto;
      padding: 20px;
    }

    @media (max-width: 600px) {
      .toolbar-subtitle {
        display: none;
      }

      .tab-content {
        padding: 12px;
      }
    }
  `]
})
export class App {
}
