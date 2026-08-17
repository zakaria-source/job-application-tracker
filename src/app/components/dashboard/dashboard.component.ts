import {Component, DestroyRef, OnInit, inject} from '@angular/core';
import {CommonModule} from '@angular/common';
import {MatCardModule} from '@angular/material/card';
import {MatIconModule} from '@angular/material/icon';
import {MatChipsModule} from '@angular/material/chips';
import {MatDividerModule} from '@angular/material/divider';
import {NgChartsModule} from 'ng2-charts';
import {ChartConfiguration, ChartData} from 'chart.js';
import {combineLatest, timer} from 'rxjs';
import {takeUntilDestroyed} from '@angular/core/rxjs-interop';
import {JobApplication, JobStatistics, Suggestion} from '../../models/job-application.model';
import {StorageService} from '../../services/storage.service';

interface UpcomingInterview {
    id: string;
    date: Date;
    type: string;
    company: string;
    position: string;
    applicationId: string;
}

@Component({
    selector: 'app-dashboard',
    standalone: true,
    imports: [
        CommonModule,
        MatCardModule,
        MatIconModule,
        MatChipsModule,
        MatDividerModule,
        NgChartsModule
    ],
    template: `
    <div class="dashboard-container">
      <section class="dashboard-grid">
        <mat-card class="panel stats-card">
          <mat-card-header>
            <mat-card-title>Vue d'ensemble</mat-card-title>
            <mat-card-subtitle>Les indicateurs clés de votre recherche</mat-card-subtitle>
          </mat-card-header>
          <mat-card-content>
            <div class="stats-grid">
              <div class="stat-item">
                <div class="stat-value">{{ statistics.totalApplications }}</div>
                <div class="stat-label">Candidatures</div>
              </div>
              <div class="stat-item">
                <div class="stat-value">{{ statistics.responseRate | number:'1.0-0' }}%</div>
                <div class="stat-label">Taux de réponse</div>
              </div>
              <div class="stat-item">
                <div class="stat-value">{{ statistics.averageResponseTime | number:'1.0-1' }}</div>
                <div class="stat-label">Jours avant réponse</div>
              </div>
              <div class="stat-item">
                <div class="stat-value">{{ statistics.statusCounts.accepted }}</div>
                <div class="stat-label">Offres acceptées</div>
              </div>
            </div>

            <mat-divider></mat-divider>

            <div class="chart-section">
              <h3>Répartition des statuts</h3>
              <div class="chart-container">
                <canvas baseChart
                  [data]="statusChartData"
                  [type]="'doughnut'"
                  [options]="statusChartOptions">
                </canvas>
              </div>
            </div>
          </mat-card-content>
        </mat-card>

        <mat-card class="panel">
          <mat-card-header>
            <mat-card-title>Actions recommandées</mat-card-title>
            <mat-card-subtitle>Relances et entretiens qui demandent votre attention</mat-card-subtitle>
          </mat-card-header>
          <mat-card-content>
            <div *ngIf="suggestions.length === 0" class="empty-state">
              <mat-icon>task_alt</mat-icon>
              <p>Tout est à jour pour le moment.</p>
            </div>

            <div *ngFor="let suggestion of suggestions" class="suggestion-item">
              <div class="suggestion-header">
                <mat-chip [ngClass]="getSuggestionClass(suggestion.type)">
                  <mat-icon>{{ getSuggestionIcon(suggestion.type) }}</mat-icon>
                  {{ getSuggestionLabel(suggestion.type) }}
                </mat-chip>
              </div>
              <p>{{ suggestion.message }}</p>
            </div>
          </mat-card-content>
        </mat-card>
      </section>

      <section class="dashboard-grid">
        <mat-card class="panel">
          <mat-card-header>
            <mat-card-title>Activité hebdomadaire</mat-card-title>
          </mat-card-header>
          <mat-card-content>
            <div class="chart-container">
              <canvas baseChart
                [data]="weeklyChartData"
                [options]="weeklyChartOptions"
                [type]="'line'">
              </canvas>
            </div>
          </mat-card-content>
        </mat-card>

        <mat-card class="panel">
          <mat-card-header>
            <mat-card-title>Entreprises les plus réactives</mat-card-title>
          </mat-card-header>
          <mat-card-content>
            <div *ngIf="statistics.mostResponsiveCompanies.length === 0" class="empty-state compact">
              <mat-icon>insights</mat-icon>
              <p>Pas encore assez de réponses pour calculer ce classement.</p>
            </div>

            <div *ngIf="statistics.mostResponsiveCompanies.length > 0" class="chart-container">
              <canvas baseChart
                [data]="companiesChartData"
                [options]="companiesChartOptions"
                [type]="'bar'">
              </canvas>
            </div>
          </mat-card-content>
        </mat-card>
      </section>

      <mat-card *ngIf="upcomingInterviews.length > 0" class="panel interviews-card">
        <mat-card-header>
          <mat-card-title>Entretiens à venir</mat-card-title>
          <mat-card-subtitle>Les 14 prochains jours</mat-card-subtitle>
        </mat-card-header>
        <mat-card-content>
          <div class="interviews-list">
            <div *ngFor="let interview of upcomingInterviews" class="interview-item">
              <div class="interview-date">
                <div class="date-day">{{ interview.date | date:'dd' }}</div>
                <div class="date-month">{{ interview.date | date:'MMM' }}</div>
              </div>
              <div class="interview-details">
                <div class="interview-company">{{ interview.company }}</div>
                <div class="interview-position">{{ interview.position }}</div>
                <div class="interview-time">
                  <mat-icon>schedule</mat-icon>
                  {{ interview.date | date:'HH:mm' }} · {{ interview.type }}
                </div>
              </div>
            </div>
          </div>
        </mat-card-content>
      </mat-card>
    </div>
  `,
    styles: [`
    .dashboard-container {
      display: flex;
      flex-direction: column;
      gap: 20px;
    }
    .dashboard-grid {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 20px;
    }
    .panel {
      min-width: 0;
    }
    .stats-grid {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 12px;
      margin: 20px 0;
    }
    .stat-item {
      padding: 18px;
      text-align: center;
      background: #f6f7fb;
      border-radius: 12px;
    }
    .stat-value {
      font-size: 28px;
      line-height: 1;
      font-weight: 700;
      color: #3f51b5;
    }
    .stat-label {
      margin-top: 8px;
      font-size: 13px;
      color: #616161;
    }
    .chart-section {
      margin-top: 20px;
    }
    .chart-section h3 {
      margin: 0 0 12px;
      font-size: 16px;
      font-weight: 500;
    }
    .chart-container {
      height: 280px;
      position: relative;
    }
    .suggestion-item {
      padding: 14px 0;
      border-bottom: 1px solid rgba(0, 0, 0, 0.08);
    }
    .suggestion-item:last-child {
      border-bottom: 0;
    }
    .suggestion-item p {
      margin: 10px 0 0;
      line-height: 1.5;
    }
    .suggestion-header mat-icon {
      margin-right: 4px;
    }
    .empty-state {
      min-height: 200px;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      text-align: center;
      color: #757575;
    }
    .empty-state.compact {
      min-height: 280px;
    }
    .empty-state mat-icon {
      width: 44px;
      height: 44px;
      font-size: 44px;
      margin-bottom: 8px;
      color: #4caf50;
    }
    .interviews-list {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
      gap: 12px;
      margin-top: 8px;
    }
    .interview-item {
      display: flex;
      align-items: center;
      padding: 14px;
      background: #f6f7fb;
      border-radius: 12px;
    }
    .interview-date {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      width: 58px;
      height: 58px;
      flex: 0 0 58px;
      margin-right: 14px;
      background: #3f51b5;
      color: white;
      border-radius: 10px;
    }
    .date-day {
      font-size: 20px;
      font-weight: 600;
    }
    .date-month {
      font-size: 12px;
      text-transform: uppercase;
    }
    .interview-details {
      min-width: 0;
    }
    .interview-company {
      font-weight: 600;
    }
    .interview-position {
      margin: 2px 0 6px;
      color: #616161;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .interview-time {
      display: flex;
      align-items: center;
      gap: 4px;
      font-size: 13px;
      color: #616161;
    }
    .interview-time mat-icon {
      width: 16px;
      height: 16px;
      font-size: 16px;
    }
    @media (max-width: 900px) {
      .dashboard-grid {
        grid-template-columns: 1fr;
      }
    }
    @media (max-width: 520px) {
      .stats-grid {
        grid-template-columns: 1fr;
      }
    }
  `]
})
export class DashboardComponent implements OnInit {
    private readonly destroyRef = inject(DestroyRef);

    statistics: JobStatistics = {
        totalApplications: 0,
        responseRate: 0,
        averageResponseTime: 0,
        statusCounts: {
            sent: 0,
            interview: 0,
            accepted: 0,
            rejected: 0
        },
        applicationsByWeek: [],
        mostResponsiveCompanies: []
    };

    suggestions: Suggestion[] = [];
    upcomingInterviews: UpcomingInterview[] = [];

    statusChartData: ChartData<'doughnut'> = {
        labels: ['Envoyé', 'Entretien', 'Accepté', 'Refusé'],
        datasets: [{
            data: [0, 0, 0, 0],
            backgroundColor: ['#e0e0e0', '#bbdefb', '#c8e6c9', '#ffcdd2']
        }]
    };

    statusChartOptions: ChartConfiguration['options'] = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: {position: 'right'}
        }
    };

    weeklyChartData: ChartData<'line'> = {
        labels: [],
        datasets: [{
            label: 'Candidatures',
            data: [],
            borderColor: '#3f51b5',
            backgroundColor: 'rgba(63, 81, 181, 0.1)',
            tension: 0.35,
            fill: true
        }]
    };

    weeklyChartOptions: ChartConfiguration['options'] = {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
            y: {
                beginAtZero: true,
                ticks: {precision: 0}
            }
        },
        plugins: {
            legend: {display: false}
        }
    };

    companiesChartData: ChartData<'bar'> = {
        labels: [],
        datasets: [{
            label: 'Jours avant réponse',
            data: [],
            backgroundColor: '#3f51b5'
        }]
    };

    companiesChartOptions: ChartConfiguration['options'] = {
        responsive: true,
        maintainAspectRatio: false,
        indexAxis: 'y',
        scales: {
            x: {
                beginAtZero: true,
                title: {
                    display: true,
                    text: 'Jours'
                }
            }
        },
        plugins: {
            legend: {display: false}
        }
    };

    constructor(private readonly storageService: StorageService) {
    }

    ngOnInit(): void {
        combineLatest([
            this.storageService.getApplications(),
            timer(0, 60_000)
        ])
            .pipe(takeUntilDestroyed(this.destroyRef))
            .subscribe(([applications]) => this.refreshDashboard(applications));
    }

    private refreshDashboard(applications: JobApplication[]): void {
        this.statistics = this.storageService.calculateStatistics();
        this.suggestions = this.storageService.generateSuggestions();
        this.upcomingInterviews = this.getUpcomingInterviews(applications);
        this.updateCharts();
    }

    private updateCharts(): void {
        this.statusChartData = {
            ...this.statusChartData,
            datasets: [{
                ...this.statusChartData.datasets[0],
                data: [
                    this.statistics.statusCounts.sent,
                    this.statistics.statusCounts.interview,
                    this.statistics.statusCounts.accepted,
                    this.statistics.statusCounts.rejected
                ]
            }]
        };

        this.weeklyChartData = {
            labels: this.statistics.applicationsByWeek.map(item => item.week),
            datasets: [{
                ...this.weeklyChartData.datasets[0],
                data: this.statistics.applicationsByWeek.map(item => item.count)
            }]
        };

        this.companiesChartData = {
            labels: this.statistics.mostResponsiveCompanies.map(item => item.company),
            datasets: [{
                ...this.companiesChartData.datasets[0],
                data: this.statistics.mostResponsiveCompanies.map(item => item.responseTime)
            }]
        };
    }

    private getUpcomingInterviews(applications: JobApplication[]): UpcomingInterview[] {
        const now = new Date();
        const twoWeeksLater = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);

        return applications
            .flatMap(app =>
                (app.interviews ?? [])
                    .filter(interview => {
                        const interviewTime = interview.date.getTime();
                        return interviewTime >= now.getTime() && interviewTime <= twoWeeksLater.getTime();
                    })
                    .map(interview => ({
                        id: interview.id,
                        date: new Date(interview.date.getTime()),
                        type: interview.type,
                        company: app.company,
                        position: app.position,
                        applicationId: app.id
                    }))
            )
            .sort((a, b) => a.date.getTime() - b.date.getTime());
    }

    getSuggestionClass(type: Suggestion['type']): string {
        return `${type}-chip`;
    }

    getSuggestionIcon(type: Suggestion['type']): string {
        const icons: Record<Suggestion['type'], string> = {
            info: 'info',
            warning: 'warning',
            success: 'check_circle',
            error: 'error'
        };
        return icons[type];
    }

    getSuggestionLabel(type: Suggestion['type']): string {
        const labels: Record<Suggestion['type'], string> = {
            info: 'Info',
            warning: 'À faire',
            success: 'À venir',
            error: 'Erreur'
        };
        return labels[type];
    }
}
