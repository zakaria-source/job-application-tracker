import {Injectable} from '@angular/core';
import {JobApplication} from '../models/job-application.model';

@Injectable({providedIn: 'root'})
export class NotificationService {
    private readonly timers = new Map<string, ReturnType<typeof setTimeout>>();
    private readonly maxTimeout = 2_147_000_000;

    async ensurePermission(): Promise<boolean> {
        if (!('Notification' in window)) return false;
        if (Notification.permission === 'granted') return true;
        if (Notification.permission === 'denied') return false;
        return (await Notification.requestPermission()) === 'granted';
    }

    syncReminders(applications: JobApplication[]): void {
        this.clearTimers();
        if (!('Notification' in window) || Notification.permission !== 'granted') return;

        applications.forEach(application => {
            (application.interviews ?? [])
                .filter(interview => interview.reminderSet)
                .forEach(interview => {
                    const reminderTime = interview.date.getTime() - 60 * 60 * 1000;
                    if (reminderTime > Date.now()) {
                        this.scheduleAt(`${application.id}:${interview.id}`, reminderTime, () => {
                            this.showNotification(
                                `Rappel d'entretien avec ${application.company}`,
                                `Vous avez un entretien ${interview.type} dans 1 heure pour le poste de ${application.position}.`
                            );
                        });
                    }
                });
        });
    }

    showNotification(title: string, body: string): void {
        if (!('Notification' in window) || Notification.permission !== 'granted') return;
        try {
            new Notification(title, {body});
        } catch (error) {
            console.error('Error showing notification:', error);
        }
    }

    private scheduleAt(key: string, targetTime: number, callback: () => void): void {
        const remaining = targetTime - Date.now();
        if (remaining <= 0) return;
        const timer = setTimeout(() => {
            this.timers.delete(key);
            if (targetTime - Date.now() > 1000) {
                this.scheduleAt(key, targetTime, callback);
            } else {
                callback();
            }
        }, Math.min(remaining, this.maxTimeout));
        this.timers.set(key, timer);
    }

    private clearTimers(): void {
        this.timers.forEach(timer => clearTimeout(timer));
        this.timers.clear();
    }
}
