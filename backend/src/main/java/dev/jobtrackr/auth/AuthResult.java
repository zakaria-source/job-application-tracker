package dev.jobtrackr.auth;

import dev.jobtrackr.auth.dto.UserResponse;
import dev.jobtrackr.security.IssuedRefreshToken;
import dev.jobtrackr.security.IssuedToken;

record AuthResult(IssuedToken token, IssuedRefreshToken refreshToken, UserResponse user) {
}
