import {HttpInterceptorFn} from '@angular/common/http';
import {inject} from '@angular/core';
import {CloudSessionStore} from './cloud-session.store';

export const cloudAuthInterceptor: HttpInterceptorFn = (request, next) => {
  if (!request.url.startsWith('/api/v1/')) {
    return next(request);
  }

  const token = inject(CloudSessionStore).accessToken;
  if (!token) {
    return next(request);
  }

  return next(request.clone({
    setHeaders: {Authorization: `Bearer ${token}`}
  }));
};
