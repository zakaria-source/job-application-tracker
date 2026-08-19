import {HttpContextToken, HttpErrorResponse, HttpInterceptorFn, HttpRequest} from '@angular/common/http';
import {inject} from '@angular/core';
import {Router} from '@angular/router';
import {catchError, switchMap, throwError} from 'rxjs';
import {AuthService} from '@app/core/auth/auth.service';
import {SessionStore} from '@app/core/auth/session.store';

const AUTH_RETRY = new HttpContextToken<boolean>(() => false);
const PUBLIC_AUTH_ENDPOINTS = new Set([
  '/api/v1/auth/login',
  '/api/v1/auth/register',
  '/api/v1/auth/refresh',
  '/api/v1/auth/logout',
  '/api/v1/auth/csrf',
  '/api/v1/auth/capabilities'
]);

export const authInterceptor: HttpInterceptorFn = (request, next) => {
  const sessions = inject(SessionStore);
  const auth = inject(AuthService);
  const router = inject(Router);
  const outgoing = prepareApiRequest(request);

  return next(outgoing).pipe(
    catchError(error => {
      const protectedApiRequest = isProtectedApiRequest(request);
      const canRefresh = protectedApiRequest
        && error instanceof HttpErrorResponse
        && error.status === 401
        && !request.context.get(AUTH_RETRY)
        && sessions.current !== null;

      if (canRefresh) {
        return auth.refreshSession().pipe(
          switchMap(() => next(prepareApiRequest(
            request.clone({context: request.context.set(AUTH_RETRY, true)})
          ))),
          catchError(refreshError => {
            sessions.clear();
            void router.navigate(['/account']);
            return throwError(() => refreshError);
          })
        );
      }

      if (protectedApiRequest && error instanceof HttpErrorResponse && error.status === 401) {
        sessions.clear();
        void router.navigate(['/account']);
      }
      return throwError(() => error);
    })
  );
};

function prepareApiRequest(request: HttpRequest<unknown>): HttpRequest<unknown> {
  return request.url.startsWith('/api/v1/')
    ? request.clone({withCredentials: true})
    : request;
}

function isProtectedApiRequest(request: HttpRequest<unknown>): boolean {
  return request.url.startsWith('/api/v1/') && !PUBLIC_AUTH_ENDPOINTS.has(request.url);
}
