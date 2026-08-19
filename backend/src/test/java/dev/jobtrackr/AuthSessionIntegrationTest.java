package dev.jobtrackr;

import dev.jobtrackr.security.SessionCookieService;
import jakarta.servlet.http.Cookie;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.testcontainers.service.connection.ServiceConnection;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest(properties = {
    "jobtrackr.security.jwt-secret=test-secret-that-is-long-enough-for-hs256-signing-0123456789",
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

    @Test
    void rotatesRefreshTokensAndRejectsReplay() throws Exception {
        var registration = mockMvc.perform(post("/api/v1/auth/register")
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                    {
                      "email": "rotation@example.com",
                      "password": "long-enough-password",
                      "displayName": "Rotation User"
                    }
                    """))
            .andExpect(status().isCreated())
            .andExpect(jsonPath("$.accessToken").doesNotExist())
            .andExpect(jsonPath("$.sessionExpiresAt").exists())
            .andReturn();

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

        // Reusing the previous refresh token is treated as credential replay and revokes the session family.
        mockMvc.perform(post("/api/v1/auth/refresh").cookie(firstRefresh))
            .andExpect(status().isUnauthorized());

        mockMvc.perform(post("/api/v1/auth/refresh").cookie(rotatedRefresh))
            .andExpect(status().isUnauthorized());
    }

    @Test
    void exposesMigrationCapabilitiesAndClearsBothCookiesOnLogout() throws Exception {
        mockMvc.perform(get("/api/v1/auth/capabilities"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.version").value("cookie-refresh-v1"))
            .andExpect(jsonPath("$.refreshRotation").value(true))
            .andExpect(jsonPath("$.csrfEnforced").value(false));

        var registration = mockMvc.perform(post("/api/v1/auth/register")
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                    {
                      "email": "logout-session@example.com",
                      "password": "long-enough-password",
                      "displayName": "Logout User"
                    }
                    """))
            .andExpect(status().isCreated())
            .andReturn();
        Cookie refresh = registration.getResponse().getCookie(SessionCookieService.REFRESH_COOKIE_NAME);
        assertThat(refresh).isNotNull();

        var logout = mockMvc.perform(post("/api/v1/auth/logout").cookie(refresh))
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
}
