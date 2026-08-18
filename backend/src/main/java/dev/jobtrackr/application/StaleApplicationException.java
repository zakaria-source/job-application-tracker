package dev.jobtrackr.application;

public class StaleApplicationException extends RuntimeException {
    public StaleApplicationException() {
        super("The application has changed since it was loaded.");
    }
}
