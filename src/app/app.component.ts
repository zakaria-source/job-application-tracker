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
import {JobApplication} from './models/job-application.model';
import {StorageService} from './services/storage.service';

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
        <span>JobTrackr</span>
        <span class="toolbar-spacer"></span>
        <span class="toolbar-subtitle">Suivi de candidatures</span>
      </mat-toolbar>

      <div class="app-content">
        <mat-tab-group [(selectedIndex)]="activeTabIndex" animationDuration="0ms">
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
      padding: 20px;
      max-width: 1400px;
      margin: 0 auto;
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
    activeTabIndex = 0;

    constructor(private readonly storageService: StorageService) {
    }

    onFormSubmit(application: JobApplication): void {
        this.storageService.addApplication(application);
        this.activeTabIndex = 1;
    }

    onCancel(): void {
        this.activeTabIndex = 1;
    }
}
