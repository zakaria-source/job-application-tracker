package dev.jobtrackr.jobimport;

public class JobImportException extends RuntimeException {
    public JobImportException(String message) {
        super(message);
    }

    public JobImportException(String message, Throwable cause) {
        super(message, cause);
    }
}
