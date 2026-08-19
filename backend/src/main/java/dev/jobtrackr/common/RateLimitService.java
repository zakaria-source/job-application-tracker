package dev.jobtrackr.common;

import org.springframework.stereotype.Service;

import java.time.Duration;
import java.time.Instant;
import java.util.concurrent.ConcurrentHashMap;

@Service
public class RateLimitService {
    private static final int MAX_BUCKETS = 20_000;
    private final ConcurrentHashMap<String, Window> windows = new ConcurrentHashMap<>();

    public void check(String key, int limit, Duration windowSize) {
        Instant now = Instant.now();
        Window result = windows.compute(key, (ignored, current) -> {
            if (current == null || !current.expiresAt.isAfter(now)) {
                return new Window(1, now.plus(windowSize));
            }
            return new Window(current.count + 1, current.expiresAt);
        });
        if (windows.size() > MAX_BUCKETS) {
            windows.entrySet().removeIf(entry -> !entry.getValue().expiresAt.isAfter(now));
        }
        if (result.count > limit) {
            throw new RateLimitExceededException();
        }
    }

    public void reset(String key) {
        windows.remove(key);
    }

    private record Window(int count, Instant expiresAt) {
    }
}
