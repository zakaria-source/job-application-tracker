package dev.jobtrackr.common;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.Duration;
import java.time.Instant;
import java.util.HexFormat;
import java.util.concurrent.atomic.AtomicLong;

@Service
public class RateLimitService {
    private static final long CLEANUP_EVERY_OPERATIONS = 256;

    private static final String UPSERT_BUCKET_SQL = """
        insert into rate_limit_bucket (bucket_key, window_started_at, expires_at, request_count)
        values (?, ?, ?, 1)
        on conflict (bucket_key) do update
        set window_started_at = case
                when rate_limit_bucket.expires_at <= excluded.window_started_at then excluded.window_started_at
                else rate_limit_bucket.window_started_at
            end,
            expires_at = case
                when rate_limit_bucket.expires_at <= excluded.window_started_at then excluded.expires_at
                else rate_limit_bucket.expires_at
            end,
            request_count = case
                when rate_limit_bucket.expires_at <= excluded.window_started_at then 1
                else least(rate_limit_bucket.request_count + 1, ?)
            end
        returning request_count
        """;

    private final JdbcTemplate jdbc;
    private final AtomicLong operations = new AtomicLong();

    public RateLimitService(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    /**
     * Uses PostgreSQL as the shared source of truth so every application replica
     * observes the same counter. The method runs in its own transaction so a
     * rejected login/refresh cannot roll the limiter increment back with the
     * surrounding business transaction.
     */
    @Transactional(
        propagation = Propagation.REQUIRES_NEW,
        noRollbackFor = RateLimitExceededException.class
    )
    public void check(String key, int limit, Duration windowSize) {
        if (key == null || key.isBlank()) {
            throw new IllegalArgumentException("Rate-limit key must not be blank");
        }
        if (limit <= 0) {
            throw new IllegalArgumentException("Rate-limit must be positive");
        }
        if (windowSize == null || windowSize.isZero() || windowSize.isNegative()) {
            throw new IllegalArgumentException("Rate-limit window must be positive");
        }

        Instant now = Instant.now();
        int saturation = limit == Integer.MAX_VALUE ? Integer.MAX_VALUE : limit + 1;
        Integer count = jdbc.queryForObject(
            UPSERT_BUCKET_SQL,
            Integer.class,
            fingerprint(key),
            now,
            now.plus(windowSize),
            saturation
        );

        maybeCleanup(now);
        if (count != null && count > limit) {
            throw new RateLimitExceededException();
        }
    }

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void reset(String key) {
        if (key == null || key.isBlank()) {
            return;
        }
        jdbc.update("delete from rate_limit_bucket where bucket_key = ?", fingerprint(key));
    }

    private void maybeCleanup(Instant now) {
        if (operations.incrementAndGet() % CLEANUP_EVERY_OPERATIONS == 0) {
            jdbc.update("delete from rate_limit_bucket where expires_at <= ?", now);
        }
    }

    private static String fingerprint(String key) {
        try {
            byte[] digest = MessageDigest.getInstance("SHA-256")
                .digest(key.getBytes(StandardCharsets.UTF_8));
            return HexFormat.of().formatHex(digest);
        } catch (NoSuchAlgorithmException exception) {
            throw new IllegalStateException("SHA-256 is unavailable", exception);
        }
    }
}
