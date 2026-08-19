import {HttpErrorResponse, HttpInterceptorFn} from '@angular/common/http';
import {inject} from '@angular/core';
import {Router} from '@angular/router';
import {catchError, throwError} from 'rxjs';
import {SessionStore} from '@app/core/auth/session.store';

const PUBLIC_AUTH_ENDPOINTS = new Set([
  '/api/v1/auth/login',
  '/api/v1/auth/register',
  '/api/v1/auth/logout'
]);

export const authInterceptor: HttpInterceptorFn = (request, next) => {
  const sessions = inject(SessionStore);
  const router = inject(Router);
  const apiRequest = request.url.startsWith('/api/v1/');
  const fallbackToken = apiRequest ? sessions.accessToken : null;

  const outgoingRequest = apiRequest
    ? request.clone({
        withCredentials: true,
        ...(fallbackToken ? {setHeaders: {Authorization: `Bearer ${fallbackToken}`}} : {})
      })
    : request;

  return next(outgoingRequest).pipe(
    catchError(error => {
      const protectedApiRequest = request.url.startsWith('/api/v1/') && !PUBLIC_AUTH_ENDPOINTS.has(request.url);
      if (protectedApiRequest && error instanceof HttpErrorResponse && error.status === 401) {
        sessions.clear();
        void router.navigate(['/account']);
      }
      return throwError(() => error);
    })
  );
};
