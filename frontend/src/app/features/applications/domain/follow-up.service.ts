import {Injectable} from '@angular/core';
import {JobApplication, Suggestion} from '@app/features/applications/models/application.model';

@Injectable({providedIn: 'root'})
export class FollowUpService {
    getDue(applications: JobApplication[], now = new Date()): JobApplication[] {
        const tomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
        return applications
            .filter(app => app.status !== 'Accepté' && app.status !== 'Refusé' && !!app.followUpDate && app.followUpDate < tomorrow)
            .sort((a, b) => (a.followUpDate?.getTime() ?? 0) - (b.followUpDate?.getTime() ?? 0));
    }

    generateSuggestions(applications: JobApplication[], now = new Date()): Suggestion[] {
        const suggestions: Suggestion[] = [];
        const oneWeekAgo = new Date(now.getTime() - 7 * 86400000);
        const twoWeeksAgo = new Date(now.getTime() - 14 * 86400000);

        this.getDue(applications, now).forEach(app => {
            const daysLate = app.followUpDate ? Math.floor(this.daysBetween(app.followUpDate, now)) : 0;
            const timing = daysLate > 0 ? `en retard de ${daysLate} jour${daysLate > 1 ? 's' : ''}` : 'prévue aujourd\'hui';
            suggestions.push({
                id: `follow-up-${app.id}`,
                type: 'warning',
                message: `Relance ${timing} : ${app.company} — ${app.position}.`,
                relatedApplicationId: app.id
            });
        });

        applications
            .filter(app => app.status === 'Envoyé' && !app.followUpDate && app.applicationDate < oneWeekAgo)
            .forEach(app => suggestions.push({
                id: `pending-${app.id}`,
                type: 'warning',
                message: `Aucune relance planifiée pour ${app.company}. Candidature envoyée il y a ${Math.floor(this.daysBetween(app.applicationDate, now))} jours.`,
                relatedApplicationId: app.id
            }));

        const latest = applications.reduce<JobApplication | undefined>((current, app) =>
            !current || app.applicationDate > current.applicationDate ? app : current, undefined);
        if (latest && latest.applicationDate < twoWeeksAgo) {
            suggestions.push({id: 'no-recent-applications', type: 'info', message: 'Vous n\'avez pas postulé depuis 2 semaines. Pensez à relancer votre pipeline.'});
        }
        if (applications.filter(app => app.status === 'Refusé').length >= 3) {
            suggestions.push({id: 'multiple-rejections', type: 'info', message: 'Plusieurs candidatures ont été refusées. Comparez les postes ciblés et adaptez votre CV ou votre approche.'});
        }
        return suggestions;
    }

    private daysBetween(start: Date, end: Date): number {
        return Math.max(0, (end.getTime() - start.getTime()) / 86400000);
    }
}
