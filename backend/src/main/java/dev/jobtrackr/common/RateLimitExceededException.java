package dev.jobtrackr.common;

public class RateLimitExceededException extends RuntimeException {
    public RateLimitExceededException() {
        super("Too many requests");
    }
}
