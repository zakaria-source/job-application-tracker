package dev.jobtrackr;

import dev.jobtrackr.common.RateLimitExceededException;
import dev.jobtrackr.common.RateLimitService;
import dev.jobtrackr.security.SessionCookieService;
import jakarta.servlet.http.Cookie;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.testcontainers.service.connection.ServiceConnection;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

import java.time.Duration;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest(properties = {
    "jobtrackr.security.jwt-secret=test-secret-that-is-long-enough-for-hs256-signing-0123456789",
    "jobtrackr.security.token-ttl=PT15M",
    "jobtrackr.security.refresh-ttl=P30D"
})
@AutoConfigureMockMvc
@Testcontainers
class AuthSessionIntegrationTest {

    @Container
    @ServiceConnection
    static PostgreSQLContainer<?> postgres = new PostgreSQLContainer<>("postgres:17-alpine");

    @Autowired
    MockMvc mockMvc;

    @Autowired
    JdbcTemplate jdbc;

    @Autowired
    RateLimitService rateLimits;

    @Test
    void rotatesRefreshTokensAndRejectsReplay() throws Exception {
        var registration = register("rotation@example.com", "Rotation User");
        Cookie firstAccess = registration.getResponse().getCookie(SessionCookieService.ACCESS_COOKIE_NAME);
        Cookie firstRefresh = registration.getResponse().getCookie(SessionCookieService.REFRESH_COOKIE_NAME);
        assertThat(firstAccess).isNotNull();
        assertThat(firstRefresh).isNotNull();
        assertThat(firstAccess.isHttpOnly()).isTrue();
        assertThat(firstRefresh.isHttpOnly()).isTrue();

        var refreshed = mockMvc.perform(post("/api/v1/auth/refresh").cookie(firstRefresh))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.user.email").value("rotation@example.com"))
            .andReturn();

        Cookie rotatedAccess = refreshed.getResponse().getCookie(SessionCookieService.ACCESS_COOKIE_NAME);
        Cookie rotatedRefresh = refreshed.getResponse().getCookie(SessionCookieService.REFRESH_COOKIE_NAME);
        assertThat(rotatedAccess).isNotNull();
        assertThat(rotatedRefresh).isNotNull();
        assertThat(rotatedRefresh.getValue()).isNotEqualTo(firstRefresh.getValue());

        mockMvc.perform(get("/api/v1/auth/me").cookie(rotatedAccess))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.email").value("rotation@example.com"));

        mockMvc.perform(post("/api/v1/auth/refresh").cookie(firstRefresh))
            .andExpect(status().isUnauthorized());

        mockMvc.perform(post("/api/v1/auth/refresh").cookie(rotatedRefresh))
            .andExpect(status().isUnauthorized());
    }

    @Test
    void serializesConcurrentRefreshRotationAndRevokesTheReplayedFamily() throws Exception {
        var registration = register("refresh-race@example.com", "Refresh Race User");
        Cookie originalRefresh = registration.getResponse().getCookie(SessionCookieService.REFRESH_COOKIE_NAME);
        assertThat(originalRefresh).isNotNull();

        ExecutorService executor = Executors.newFixedThreadPool(2);
        CountDownLatch ready = new CountDownLatch(2);
        CountDownLatch start = new CountDownLatch(1);
        try {
            Future<MvcResult> first = executor.submit(() -> concurrentRefresh(originalRefresh, ready, start));
            Future<MvcResult> second = executor.submit(() -> concurrentRefresh(originalRefresh, ready, start));

            assertThat(ready.await(5, TimeUnit.SECONDS)).isTrue();
            start.countDown();

            MvcResult firstResult = first.get(10, TimeUnit.SECONDS);
            MvcResult secondResult = second.get(10, TimeUnit.SECONDS);
            assertThat(List.of(
                firstResult.getResponse().getStatus(),
                secondResult.getResponse().getStatus()
            )).containsExactlyInAnyOrder(200, 401);

            MvcResult success = firstResult.getResponse().getStatus() == 200 ? firstResult : secondResult;
            Cookie rotatedRefresh = success.getResponse().getCookie(SessionCookieService.REFRESH_COOKIE_NAME);
            assertThat(rotatedRefresh).isNotNull();
            assertThat(rotatedRefresh.getValue()).isNotEqualTo(originalRefresh.getValue());

            // The losing request is a replay of the one-time token, so the session
            // family is revoked and even the just-rotated token can no longer refresh.
            mockMvc.perform(post("/api/v1/auth/refresh").cookie(rotatedRefresh))
                .andExpect(status().isUnauthorized());
        } finally {
            executor.shutdownNow();
        }
    }

    @Test
    void sharesRateLimitsThroughPostgresWithoutPersistingRawKeys() {
        String key = "login:" + UUID.randomUUID() + "@example.com";
        RateLimitService secondReplica = new RateLimitService(jdbc);

        rateLimits.check(key, 2, Duration.ofMinutes(1));
        secondReplica.check(key, 2, Duration.ofMinutes(1));

        assertThatThrownBy(() -> rateLimits.check(key, 2, Duration.ofMinutes(1)))
            .isInstanceOf(RateLimitExceededException.class);

        Integer rawKeyRows = jdbc.queryForObject(
            "select count(*) from rate_limit_bucket where bucket_key = ?",
            Integer.class,
            key
        );
        assertThat(rawKeyRows).isZero();

        rateLimits.reset(key);
        secondReplica.check(key, 2, Duration.ofMinutes(1));
    }

    @Test
    void protectsCookieMutationsWithCsrfWhileBearerClientsRemainCompatible() throws Exception {
        var registration = register("csrf@example.com", "CSRF User");
        Cookie access = registration.getResponse().getCookie(SessionCookieService.ACCESS_COOKIE_NAME);
        assertThat(access).isNotNull();

        var csrfResponse = mockMvc.perform(get("/api/v1/auth/csrf").cookie(access))
            .andExpect(status().isOk())
            .andReturn();
        Cookie csrf = csrfResponse.getResponse().getCookie("XSRF-TOKEN");
        assertThat(csrf).isNotNull();
        assertThat(csrf.isHttpOnly()).isFalse();

        mockMvc.perform(post("/api/v1/applications")
                .cookie(access)
                .contentType(MediaType.APPLICATION_JSON)
                .content(applicationJson("No CSRF")))
            .andExpect(status().isForbidden());

        mockMvc.perform(post("/api/v1/applications")
                .cookie(access, csrf)
                .header("X-XSRF-TOKEN", csrf.getValue())
                .contentType(MediaType.APPLICATION_JSON)
                .content(applicationJson("Cookie CSRF")))
            .andExpect(status().isCreated());

        // Non-browser API clients authenticate explicitly and do not rely on an ambient cookie.
        mockMvc.perform(post("/api/v1/applications")
                .header("Authorization", "Bearer " + access.getValue())
                .contentType(MediaType.APPLICATION_JSON)
                .content(applicationJson("Bearer client")))
            .andExpect(status().isCreated());
    }

    @Test
    void advertisesEnforcedContractAndRevokesRefreshOnCsrfProtectedLogout() throws Exception {
        mockMvc.perform(get("/api/v1/auth/capabilities"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.version").value("cookie-refresh-csrf-v1"))
            .andExpect(jsonPath("$.refreshRotation").value(true))
            .andExpect(jsonPath("$.csrfEnforced").value(true))
            .andExpect(jsonPath("$.accessTokenTtlSeconds").value(900));

        var registration = register("logout-session@example.com", "Logout User");
        Cookie access = registration.getResponse().getCookie(SessionCookieService.ACCESS_COOKIE_NAME);
        Cookie refresh = registration.getResponse().getCookie(SessionCookieService.REFRESH_COOKIE_NAME);
        assertThat(access).isNotNull();
        assertThat(refresh).isNotNull();

        mockMvc.perform(post("/api/v1/auth/logout").cookie(refresh))
            .andExpect(status().isForbidden());

        var csrfResponse = mockMvc.perform(get("/api/v1/auth/csrf").cookie(access))
            .andExpect(status().isOk())
            .andReturn();
        Cookie csrf = csrfResponse.getResponse().getCookie("XSRF-TOKEN");
        assertThat(csrf).isNotNull();

        var logout = mockMvc.perform(post("/api/v1/auth/logout")
                .cookie(refresh, csrf)
                .header("X-XSRF-TOKEN", csrf.getValue()))
            .andExpect(status().isNoContent())
            .andReturn();

        Cookie clearedAccess = logout.getResponse().getCookie(SessionCookieService.ACCESS_COOKIE_NAME);
        Cookie clearedRefresh = logout.getResponse().getCookie(SessionCookieService.REFRESH_COOKIE_NAME);
        assertThat(clearedAccess).isNotNull();
        assertThat(clearedRefresh).isNotNull();
        assertThat(clearedAccess.getMaxAge()).isZero();
        assertThat(clearedRefresh.getMaxAge()).isZero();

        mockMvc.perform(post("/api/v1/auth/refresh").cookie(refresh))
            .andExpect(status().isUnauthorized());
    }

    private MvcResult concurrentRefresh(Cookie refresh, CountDownLatch ready, CountDownLatch start) throws Exception {
        ready.countDown();
        if (!start.await(5, TimeUnit.SECONDS)) {
            throw new IllegalStateException("Concurrent refresh start timed out");
        }
        return mockMvc.perform(post("/api/v1/auth/refresh")
                .cookie(new Cookie(refresh.getName(), refresh.getValue())))
            .andReturn();
    }

    private org.springframework.test.web.servlet.MvcResult register(String email, String displayName) throws Exception {
        return mockMvc.perform(post("/api/v1/auth/register")
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                    {
                      "email": "%s",
                      "password": "long-enough-password",
                      "displayName": "%s"
                    }
                    """.formatted(email, displayName)))
            .andExpect(status().isCreated())
            .andExpect(jsonPath("$.accessToken").doesNotExist())
            .andExpect(jsonPath("$.sessionExpiresAt").exists())
            .andReturn();
    }

    private static String applicationJson(String company) {
        return """
            {
              "company": "%s",
              "position": "Backend Engineer",
              "applicationDate": "2026-08-19",
              "notes": "",
              "contractType": "CDI",
              "salaryPeriod": "Annuel",
              "stage": "Candidature",
              "priority": "Haute",
              "interviews": []
            }
            """.formatted(company);
    }
}
