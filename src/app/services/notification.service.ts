import {Injectable} from '@angular/core';
import {Interview, JobApplication} from '../models/job-application.model';

@Injectable({
    providedIn: 'root'
})
export class NotificationService {
    private readonly NOTIFICATION_PERMISSION_KEY = 'notification-permission-requested';

    constructor() {
        this.requestNotificationPermission();
    }

    private async requestNotificationPermission(): Promise<void> {
        const permissionRequested = localStorage.getItem(this.NOTIFICATION_PERMISSION_KEY);

        if (!permissionRequested && 'Notification' in window) {
            const permission = await Notification.requestPermission();
            localStorage.setItem(this.NOTIFICATION_PERMISSION_KEY, 'true');

            if (permission === 'granted') {
                this.showNotification(
                    'Notifications activées',
                    'Vous recevrez des notifications pour vos entretiens à venir.'
                );
            }
        }
    }

    scheduleInterviewReminder(application: JobApplication, interview: Interview): void {
        if (!('Notification' in window) || Notification.permission !== 'granted') {
            console.warn('Notifications not supported or permission not granted');
            return;
        }

        const now = Date.now();
        const reminderTime = interview.date.getTime() - 60 * 60 * 1000;

        if (reminderTime <= now) {
            return;
        }

        const timeUntilReminder = reminderTime - now;
        setTimeout(() => {
            this.showNotification(
                `Rappel d'entretien avec ${application.company}`,
                `Vous avez un entretien ${interview.type} dans 1 heure pour le poste de ${application.position}.`
            );
        }, timeUntilReminder);
    }

    showNotification(title: string, body: string): void {
        if (!('Notification' in window) || Notification.permission !== 'granted') {
            return;
        }

        try {
            new Notification(title, {
                body,
                icon: 'assets/notification-icon.png'
            });
        } catch (error) {
            console.error('Error showing notification:', error);
        }
    }
}
