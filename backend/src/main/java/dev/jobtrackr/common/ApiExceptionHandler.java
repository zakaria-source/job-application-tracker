package dev.jobtrackr.common;

import dev.jobtrackr.application.ApplicationService;
import dev.jobtrackr.auth.AuthController;
import jakarta.validation.ConstraintViolationException;
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

    @ExceptionHandler(ApplicationService.ResourceNotFoundException.class)
    ResponseEntity<ProblemDetail> notFound() {
        return problem(HttpStatus.NOT_FOUND, "Resource not found", "The requested resource does not exist.");
    }

    @ExceptionHandler({AuthController.DuplicateEmailException.class, DataIntegrityViolationException.class})
    ResponseEntity<ProblemDetail> conflict() {
        return problem(HttpStatus.CONFLICT, "Conflict", "A resource with the same unique identity already exists.");
    }

    @ExceptionHandler(BadCredentialsException.class)
    ResponseEntity<ProblemDetail> badCredentials() {
        return problem(HttpStatus.UNAUTHORIZED, "Authentication failed", "Invalid email or password.");
    }

    @ExceptionHandler(HttpMessageNotReadableException.class)
    ResponseEntity<ProblemDetail> unreadable() {
        return problem(HttpStatus.BAD_REQUEST, "Invalid request", "The request body contains an unsupported or malformed value.");
    }

    @ExceptionHandler(ConstraintViolationException.class)
    ResponseEntity<ProblemDetail> constraintViolation(ConstraintViolationException exception) {
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

        ProblemDetail detail = base(HttpStatus.BAD_REQUEST, "Validation failed", "One or more request fields are invalid.");
        detail.setProperty("errors", errors);
        return ResponseEntity.badRequest().body(detail);
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
