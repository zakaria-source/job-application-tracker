import {Component, OnInit} from '@angular/core';
import {CommonModule} from '@angular/common';
import {MatCardModule} from '@angular/material/card';
import {MatIconModule} from '@angular/material/icon';
import {MatButtonModule} from '@angular/material/button';
import {MatChipsModule} from '@angular/material/chips';
import {MatDividerModule} from '@angular/material/divider';
import {MatListModule} from '@angular/material/list';
import {MatTooltipModule} from '@angular/material/tooltip';
import {NgChartsModule} from 'ng2-charts';
import {ChartConfiguration, ChartData} from 'chart.js';
import {JobApplication, JobStatistics, Suggestion} from '../../models/job-application.model';
import {StorageService} from '../../services/storage.service';
import {NotificationService} from '../../services/notification.service';

@Component({
    selector: 'app-dashboard',
    standalone: true,
    imports: [
        CommonModule,
        MatCardModule,
        MatIconModule,
        MatButtonModule,
        MatChipsModule,
        MatDividerModule,
        MatListModule,
        MatTooltipModule,
        NgChartsModule
    ],
    template: `
    <div class="dashboard-container">
      <div class="flex-container">
        <!-- Statistiques générales -->
        <mat-card class="flex-item stats-card">
          <mat-card-header>
            <mat-card-title>Statistiques générales</mat-card-title>
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
                <div class="stat-label">Acceptées</div>
              </div>
            </div>

            <mat-divider class="my-3"></mat-divider>

            <div class="status-distribution">
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

        <!-- Suggestions et rappels -->
        <mat-card class="flex-item">
          <mat-card-header>
            <mat-card-title>Suggestions et rappels</mat-card-title>
          </mat-card-header>
          <mat-card-content>
            <div *ngIf="suggestions.length === 0" class="no-suggestions">
              <mat-icon>check_circle</mat-icon>
              <p>Aucune suggestion pour le moment.</p>
            </div>

            <div *ngFor="let suggestion of suggestions" class="suggestion-item">
              <mat-card class="notification-card">
                <mat-card-content>
                  <div class="suggestion-header">
                    <mat-chip [ngClass]="getSuggestionClass(suggestion.type)">
                      <mat-icon>{{ getSuggestionIcon(suggestion.type) }}</mat-icon>
                      {{ getSuggestionLabel(suggestion.type) }}
                    </mat-chip>
                  </div>
                  <p class="suggestion-message">{{ suggestion.message }}</p>
                </mat-card-content>
              </mat-card>
            </div>
          </mat-card-content>
        </mat-card>
      </div>

      <div class="flex-container">
        <!-- Évolution des candidatures -->
        <mat-card class="flex-item">
          <mat-card-header>
            <mat-card-title>Évolution des candidatures</mat-card-title>
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

        <!-- Entreprises les plus réactives -->
        <mat-card class="flex-item">
          <mat-card-header>
            <mat-card-title>Entreprises les plus réactives</mat-card-title>
          </mat-card-header>
          <mat-card-content>
            <div *ngIf="statistics.mostResponsiveCompanies.length === 0" class="no-data">
              <p>Pas assez de données pour afficher ce graphique.</p>
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
      </div>

      <!-- Entretiens à venir -->
      <mat-card *ngIf="upcomingInterviews.length > 0" class="calendar-card">
        <mat-card-header>
          <mat-card-title>Entretiens à venir</mat-card-title>
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
                  <mat-icon>access_time</mat-icon>
                  {{ interview.date | date:'HH:mm' }} - {{ interview.type }}
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
    .flex-container {
      display: flex;
      flex-wrap: wrap;
      gap: 20px;
      margin-bottom: 20px;
    }
    .flex-item {
      flex: 1;
      min-width: 300px;
    }
    .stats-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 16px;
      margin-bottom: 20px;
    }
    .stat-item {
      text-align: center;
      padding: 16px;
      background-color: #f5f5f5;
      border-radius: 8px;
    }
    .stat-value {
      font-size: 24px;
      font-weight: 500;
      color: #3f51b5;
    }
    .stat-label {
      font-size: 14px;
      color: #666;
      margin-top: 4px;
    }
    .chart-container {
      height: 300px;
      position: relative;
    }
    .my-3 {
      margin-top: 24px;
      margin-bottom: 24px;
    }
    .suggestion-item {
      margin-bottom: 16px;
    }
    .suggestion-header {
      margin-bottom: 8px;
    }
    .suggestion-message {
      margin: 8px 0;
    }
    .no-suggestions, .no-data {
      text-align: center;
      padding: 20px;
      color: #666;
    }
    .no-suggestions mat-icon {
      font-size: 48px;
      height: 48px;
      width: 48px;
      color: #4caf50;
    }
    .calendar-card {
      margin-top: 20px;
    }
    .interviews-list {
      display: flex;
      flex-direction: column;
      gap: 16px;
    }
    .interview-item {
      display: flex;
      align-items: center;
      padding: 16px;
      background-color: #f5f5f5;
      border-radius: 8px;
    }
    .interview-date {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      width: 60px;
      height: 60px;
      background-color: #3f51b5;
      color: white;
      border-radius: 8px;
      margin-right: 16px;
    }
    .date-day {
      font-size: 20px;
      font-weight: 500;
    }
    .date-month {
      font-size: 14px;
    }
    .interview-details {
      flex: 1;
    }
    .interview-company {
      font-weight: 500;
      font-size: 16px;
    }
    .interview-position {
      color: #666;
      margin-bottom: 4px;
    }
    .interview-time {
      display: flex;
      align-items: center;
      font-size: 14px;
      color: #666;
    }
    .interview-time mat-icon {
      font-size: 16px;
      height: 16px;
      width: 16px;
      margin-right: 4px;
    }
  `]
})
export class DashboardComponent implements OnInit {
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
    upcomingInterviews: any[] = [];

    // Chart configurations
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
            legend: {
                position: 'right',
            }
        }
    };

    weeklyChartData: ChartData<'line'> = {
        labels: [],
        datasets: [{
            label: 'Candidatures',
            data: [],
            borderColor: '#3f51b5',
            backgroundColor: 'rgba(63, 81, 181, 0.1)',
            tension: 0.4,
            fill: true
        }]
    };

    weeklyChartOptions: ChartConfiguration['options'] = {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
            y: {
                beginAtZero: true,
                ticks: {
                    precision: 0
                }
            }
        },
        plugins: {
            legend: {
                display: false
            }
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
            legend: {
                display: false
            }
        }
    };

    constructor(
        private storageService: StorageService,
        private notificationService: NotificationService
    ) {
    }

    ngOnInit(): void {
        this.loadData();

        // Refresh data every minute to update statistics and suggestions
        setInterval(() => {
            this.loadData();
        }, 60000);
    }

    loadData(): void {
        this.storageService.getApplications().subscribe(applications => {
            this.statistics = this.storageService.calculateStatistics();
            this.suggestions = this.storageService.generateSuggestions();
            this.updateCharts();
            this.getUpcomingInterviews(applications);
        });
    }

    updateCharts(): void {
        // Update status chart
        this.statusChartData.datasets[0].data = [
            this.statistics.statusCounts.sent,
            this.statistics.statusCounts.interview,
            this.statistics.statusCounts.accepted,
            this.statistics.statusCounts.rejected
        ];

        // Update weekly applications chart
        this.weeklyChartData.labels = this.statistics.applicationsByWeek.map(item => item.week);
        this.weeklyChartData.datasets[0].data = this.statistics.applicationsByWeek.map(item => item.count);

        // Update responsive companies chart
        this.companiesChartData.labels = this.statistics.mostResponsiveCompanies.map(item => item.company);
        this.companiesChartData.datasets[0].data = this.statistics.mostResponsiveCompanies.map(item => item.responseTime);
    }

    getUpcomingInterviews(applications: JobApplication[]): void {
        const now = new Date();
        const twoWeeksLater = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);

        this.upcomingInterviews = applications
            .flatMap(app =>
                (app.interviews || [])
                    .filter(interview => {
                        const interviewDate = new Date(interview.date);
                        return interviewDate >= now && interviewDate <= twoWeeksLater;
                    })
                    .map(interview => ({
                        id: interview.id,
                        date: new Date(interview.date),
                        type: interview.type,
                        company: app.company,
                        position: app.position,
                        applicationId: app.id
                    }))
            )
            .sort((a, b) => a.date.getTime() - b.date.getTime());
    }

    getSuggestionClass(type: string): string {
        switch (type) {
            case 'info':
                return 'info-chip';
            case 'warning':
                return 'warning-chip';
            case 'success':
                return 'success-chip';
            case 'error':
                return 'error-chip';
            default:
                return '';
        }
    }

    getSuggestionIcon(type: string): string {
        switch (type) {
            case 'info':
                return 'info';
            case 'warning':
                return 'warning';
            case 'success':
                return 'check_circle';
            case 'error':
                return 'error';
            default:
                return 'info';
        }
    }

    getSuggestionLabel(type: string): string {
        switch (type) {
            case 'info':
                return 'Info';
            case 'warning':
                return 'Attention';
            case 'success':
                return 'Succès';
            case 'error':
                return 'Erreur';
            default:
                return 'Info';
        }
    }
}