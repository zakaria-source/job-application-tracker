import {Injectable} from '@angular/core';
import {CURRENT_APPLICATIONS} from '../data/current-applications.data';
import {StorageService} from './storage.service';

@Injectable({providedIn: 'root'})
export class PortfolioBootstrapService {
  private readonly seedVersion = '2026-08-18-v1';
  private readonly seedVersionKey = 'jobtrackr-current-data-version';

  constructor(private readonly storageService: StorageService) {}

  bootstrap(): number {
    if (localStorage.getItem(this.seedVersionKey) === this.seedVersion) {
      return 0;
    }

    const added = this.storageService.mergeApplications(CURRENT_APPLICATIONS);
    localStorage.setItem(this.seedVersionKey, this.seedVersion);
    return added;
  }
}
