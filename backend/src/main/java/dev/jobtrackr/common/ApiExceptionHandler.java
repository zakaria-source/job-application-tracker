package dev.jobtrackr.common;

import dev.jobtrackr.auth.exception.DuplicateEmailException;
import dev.jobtrackr.common.exception.ResourceNotFoundException;
import jakarta.validation.ConstraintViolationException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ProblemDetail;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

import java.net.URI;
import java.util.LinkedHashMap;
import java.util.Map;

@RestControllerAdvice
public class ApiExceptionHandler {

    private static final Logger log = LoggerFactory.getLogger(ApiExceptionHandler.class);

    @ExceptionHandler(ResourceNotFoundException.class)
    ResponseEntity<ProblemDetail> notFound() {
        log.warn("api_error type=resource_not_found status=404");
        return problem(HttpStatus.NOT_FOUND, "Resource not found", "The requested resource does not exist.");
    }

    @ExceptionHandler({DuplicateEmailException.class, DataIntegrityViolationException.class})
    ResponseEntity<ProblemDetail> conflict(Exception exception) {
        log.warn("api_error type=conflict status=409 exception={}", exception.getClass().getSimpleName());
        return problem(HttpStatus.CONFLICT, "Conflict", "A resource with the same unique identity already exists.");
    }

    @ExceptionHandler(BadCredentialsException.class)
    ResponseEntity<ProblemDetail> badCredentials() {
        log.warn("api_error type=authentication_failed status=401");
        return problem(HttpStatus.UNAUTHORIZED, "Authentication failed", "Invalid email or password.");
    }

    @ExceptionHandler(HttpMessageNotReadableException.class)
    ResponseEntity<ProblemDetail> unreadable() {
        log.warn("api_error type=invalid_request_body status=400");
        return problem(HttpStatus.BAD_REQUEST, "Invalid request", "The request body contains an unsupported or malformed value.");
    }

    @ExceptionHandler(ConstraintViolationException.class)
    ResponseEntity<ProblemDetail> constraintViolation(ConstraintViolationException exception) {
        log.warn("api_error type=constraint_violation status=400 count={}", exception.getConstraintViolations().size());
        ProblemDetail detail = base(HttpStatus.BAD_REQUEST, "Validation failed", "One or more request values are invalid.");
        detail.setProperty("violations", exception.getConstraintViolations().stream()
            .map(violation -> Map.of(
                "field", violation.getPropertyPath().toString(),
                "message", violation.getMessage()))
            .toList());
        return ResponseEntity.badRequest().body(detail);
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    ResponseEntity<ProblemDetail> validation(MethodArgumentNotValidException exception) {
        Map<String, String> errors = new LinkedHashMap<>();
        exception.getBindingResult().getFieldErrors()
            .forEach(error -> errors.putIfAbsent(error.getField(), error.getDefaultMessage()));

        log.warn("api_error type=validation_failed status=400 fields={}", errors.keySet());
        ProblemDetail detail = base(HttpStatus.BAD_REQUEST, "Validation failed", "One or more request fields are invalid.");
        detail.setProperty("errors", errors);
        return ResponseEntity.badRequest().body(detail);
    }

    @ExceptionHandler(Exception.class)
    ResponseEntity<ProblemDetail> unexpected(Exception exception) {
        log.error("api_error type=unexpected status=500 exception={}", exception.getClass().getSimpleName(), exception);
        return problem(HttpStatus.INTERNAL_SERVER_ERROR, "Internal server error", "An unexpected error occurred.");
    }

    private static ResponseEntity<ProblemDetail> problem(HttpStatus status, String title, String message) {
        return ResponseEntity.status(status).body(base(status, title, message));
    }

    private static ProblemDetail base(HttpStatus status, String title, String message) {
        ProblemDetail detail = ProblemDetail.forStatusAndDetail(status, message);
        detail.setTitle(title);
        detail.setType(URI.create("https://jobtrackr.dev/problems/" + status.value()));
        return detail;
    }
}
