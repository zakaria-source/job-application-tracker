import {Component} from '@angular/core';
import {MatIconModule} from '@angular/material/icon';
import {MatTabsModule} from '@angular/material/tabs';
import {JobListComponent} from './components/job-list/job-list.component';
import {DashboardComponent} from './components/dashboard/dashboard.component';

@Component({
    selector: 'app-root',
    standalone: true,
    imports: [
        MatIconModule,
        MatTabsModule,
        JobListComponent,
        DashboardComponent
    ],
    templateUrl: './app.component.html',
    styleUrl: './app.component.css'
})
export class App {
    selectedTabIndex = 0;
}
