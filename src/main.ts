import {bootstrapApplication} from '@angular/platform-browser';
import {provideAnimations} from '@angular/platform-browser/animations';
import {App} from './app/app.component';

bootstrapApplication(App, {
    providers: [
        provideAnimations()
    ]
}).catch(err => console.error(err));