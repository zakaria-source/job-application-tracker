package dev.jobtrackr.auth;

import org.springframework.security.authentication.BadCredentialsException;

final class InvalidRefreshTokenException extends BadCredentialsException {
    InvalidRefreshTokenException() {
        super("Invalid refresh token");
    }
}
