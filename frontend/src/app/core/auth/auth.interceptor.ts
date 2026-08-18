import {HttpInterceptorFn} from '@angular/common/http';
import {inject} from '@angular/core';
import {SessionStore} from '@app/core/auth/session.store';

export const cloudAuthInterceptor: HttpInterceptorFn = (request, next) => {
  if (!request.url.startsWith('/api/v1/')) {
    return next(request);
  }

  const token = inject(SessionStore).accessToken;
  if (!token) {
    return next(request);
  }

  return next(request.clone({
    setHeaders: {Authorization: `Bearer ${token}`}
  }));
};
