import {Component, Input} from '@angular/core';

@Component({
  selector: 'app-brand-mark',
  standalone: true,
  template: `
    <span class="mark" [class.compact]="compact" aria-hidden="true">
      <svg viewBox="0 0 32 32" role="img">
        <rect x="1" y="1" width="30" height="30" rx="8" fill="currentColor"/>
        <path d="M9 10.5h8.25M9 16h5.75M9 21.5h8.75" stroke="white" stroke-width="1.65" stroke-linecap="round" opacity=".78"/>
        <path d="m17 16.2 2.25 2.3L24 13.4" fill="none" stroke="#9B93FF" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
    </span>
  `,
  styles: [`
    :host { display: inline-flex; flex: 0 0 auto; }
    .mark { width: 32px; height: 32px; display: inline-flex; color: #121316; }
    .mark.compact { width: 28px; height: 28px; }
    svg { width: 100%; height: 100%; display: block; }
  `]
})
export class BrandMarkComponent {
  @Input() compact = false;
}
