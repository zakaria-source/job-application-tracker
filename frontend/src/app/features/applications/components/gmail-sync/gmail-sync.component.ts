import {Component, EventEmitter, OnInit, Output} from '@angular/core';
import {MatButtonModule} from '@angular/material/button';
import {MatIconModule} from '@angular/material/icon';
import {JobTrackrApiService} from '@app/core/api/jobtrackr-api.service';
import {GmailStatus, GmailSyncResult} from '@app/features/applications/models/gmail-sync.model';

@Component({
  selector: 'app-gmail-sync',
  standalone: true,
  imports: [MatButtonModule, MatIconModule],
  templateUrl: './gmail-sync.component.html',
  styleUrl: './gmail-sync.component.css'
})
export class GmailSyncComponent implements OnInit {
  @Output() readonly synced = new EventEmitter<GmailSyncResult>();

  status: GmailStatus | null = null;
  loading = true;
  connecting = false;
  syncing = false;
  disconnecting = false;
  message = '';
  error = '';

  constructor(private readonly api: JobTrackrApiService) {}

  ngOnInit(): void {
    const oauthStatus = new URLSearchParams(window.location.search).get('gmail');
    const oauthReason = new URLSearchParams(window.location.search).get('reason');
    this.loadStatus(oauthStatus === 'connected');
    if (oauthStatus === 'error') {
      this.error = `Connexion Gmail annulée ou impossible${oauthReason ? ` · ${oauthReason}` : ''}.`;
    }
    if (oauthStatus) {
      window.history.replaceState({}, '', `${window.location.pathname}${window.location.hash}`);
    }
  }

  connect(): void {
    if (this.connecting) return;
    this.connecting = true;
    this.error = '';
    this.api.getGmailAuthorizationUrl().subscribe({
      next: response => window.location.assign(response.authorizationUrl),
      error: () => {
        this.connecting = false;
        this.error = 'Impossible de démarrer la connexion Gmail.';
      }
    });
  }

  synchronize(): void {
    if (this.syncing || !this.status?.connected) return;
    this.syncing = true;
    this.error = '';
    this.message = '';
    this.api.syncGmail().subscribe({
      next: result => {
        this.syncing = false;
        if (result.created > 0) {
          this.message = `${result.created} candidature${result.created > 1 ? 's' : ''} créée${result.created > 1 ? 's' : ''} · ${result.applied} mail${result.applied > 1 ? 's' : ''} enregistré${result.applied > 1 ? 's' : ''}`;
        } else if (result.applied > 0) {
          this.message = `${result.applied} mail${result.applied > 1 ? 's' : ''} rattaché${result.applied > 1 ? 's' : ''} aux candidatures`;
        } else {
          this.message = `${result.scanned} mail${result.scanned > 1 ? 's' : ''} analysé${result.scanned > 1 ? 's' : ''}`;
        }
        this.status = this.status ? {...this.status, lastSyncAt: result.syncedAt, lastError: null} : this.status;
        this.synced.emit(result);
      },
      error: () => {
        this.syncing = false;
        this.error = 'Synchronisation Gmail impossible pour le moment.';
        this.loadStatus(false);
      }
    });
  }

  disconnect(): void {
    if (this.disconnecting || !this.status?.connected) return;
    this.disconnecting = true;
    this.error = '';
    this.api.disconnectGmail().subscribe({
      next: () => {
        this.disconnecting = false;
        this.status = this.status ? {...this.status, connected: false, emailAddress: null, lastSyncAt: null, lastError: null} : this.status;
        this.message = 'Compte Gmail déconnecté.';
      },
      error: () => {
        this.disconnecting = false;
        this.error = 'Impossible de déconnecter Gmail.';
      }
    });
  }

  formatLastSync(): string {
    if (!this.status?.lastSyncAt) return 'Jamais synchronisé';
    return new Intl.DateTimeFormat('fr-FR', {
      day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit'
    }).format(this.status.lastSyncAt);
  }

  intervalLabel(): string {
    const minutes = Math.max(1, Math.round((this.status?.syncDelayMs ?? 900000) / 60000));
    return `${minutes} min`;
  }

  private loadStatus(syncAfterConnect: boolean): void {
    this.loading = true;
    this.api.getGmailStatus().subscribe({
      next: status => {
        this.status = status;
        this.loading = false;
        if (syncAfterConnect && status.connected) this.synchronize();
      },
      error: () => {
        this.loading = false;
        this.error = 'Statut Gmail indisponible.';
      }
    });
  }
}
