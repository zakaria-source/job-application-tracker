package dev.jobtrackr;

import dev.jobtrackr.security.SessionCookieService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.testcontainers.service.connection.ServiceConnection;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest(properties = {
    "jobtrackr.security.jwt-secret=test-secret-that-is-long-enough-for-hs256-signing-0123456789"
})
@AutoConfigureMockMvc
@Testcontainers
class CloudApiIntegrationTest {

    @Container
    @ServiceConnection
    static PostgreSQLContainer<?> postgres = new PostgreSQLContainer<>("postgres:17-alpine");

    @Autowired
    MockMvc mockMvc;

    @Autowired
    JsonMapper jsonMapper;

    @Test
    void isolatesApplicationsBetweenAuthenticatedUsers() throws Exception {
        String tokenA = register("alice@example.com", "Alice Example");
        String tokenB = register("bob@example.com", "Bob Example");

        mockMvc.perform(post("/api/v1/applications")
                .header("Authorization", "Bearer " + tokenA)
                .contentType(MediaType.APPLICATION_JSON)
                .content(applicationJson("Acme Cloud", "Backend Engineer", "[]")))
            .andExpect(status().isCreated())
            .andExpect(jsonPath("$.company").value("Acme Cloud"))
            .andExpect(jsonPath("$.status").value("Envoyé"));

        mockMvc.perform(get("/api/v1/applications")
                .header("Authorization", "Bearer " + tokenA))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.length()").value(1));

        mockMvc.perform(get("/api/v1/applications")
                .header("Authorization", "Bearer " + tokenB))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.length()").value(0));
    }

    @Test
    void persistsAndReadsAuthenticatedProfile() throws Exception {
        String token = register("profile@example.com", "Initial Name");

        mockMvc.perform(put("/api/v1/profile")
                .header("Authorization", "Bearer " + token)
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                    {
                      "name": "Cloud Candidate",
                      "headline": "Backend Engineer",
                      "experienceLabel": "4 years",
                      "location": "Paris",
                      "summary": "Cloud profile",
                      "coreSkills": ["Java", "Spring Boot"],
                      "certifications": ["CKA"],
                      "education": "Computer Science",
                      "targetCompensation": "65 k€ / year"
                    }
                    """))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.name").value("Cloud Candidate"))
            .andExpect(jsonPath("$.headline").value("Backend Engineer"))
            .andExpect(jsonPath("$.coreSkills[0]").value("Java"));

        mockMvc.perform(get("/api/v1/profile")
                .header("Authorization", "Bearer " + token))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.name").value("Cloud Candidate"))
            .andExpect(jsonPath("$.certifications[0]").value("CKA"));
    }

    @Test
    void replacesInterviewsWhenUpdatingAnApplication() throws Exception {
        String token = register("interviews@example.com", "Interview User");

        String created = mockMvc.perform(post("/api/v1/applications")
                .header("Authorization", "Bearer " + token)
                .contentType(MediaType.APPLICATION_JSON)
                .content(applicationJson("Nova Labs", "Java Engineer", "[]")))
            .andExpect(status().isCreated())
            .andReturn().getResponse().getContentAsString();
        String id = jsonMapper.readTree(created).path("id").asText();

        String interview = """
            [{
              "date": "2026-08-20T10:00:00+02:00",
              "type": "Visioconférence",
              "notes": "Technical round",
              "reminderSet": true
            }]
            """;

        mockMvc.perform(put("/api/v1/applications/{id}", id)
                .header("Authorization", "Bearer " + token)
                .contentType(MediaType.APPLICATION_JSON)
                .content(applicationJson("Nova Labs", "Java Engineer", interview)))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.interviews.length()").value(1))
            .andExpect(jsonPath("$.interviews[0].type").value("Visioconférence"));

        mockMvc.perform(put("/api/v1/applications/{id}", id)
                .header("Authorization", "Bearer " + token)
                .contentType(MediaType.APPLICATION_JSON)
                .content(applicationJson("Nova Labs", "Java Engineer", "[]")))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.interviews.length()").value(0));
    }

    @Test
    void rejectsDuplicateEmailAndUnauthenticatedApiAccess() throws Exception {
        register("duplicate@example.com", "First User");

        mockMvc.perform(post("/api/v1/auth/register")
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                    {
                      "email": "duplicate@example.com",
                      "password": "long-enough-password",
                      "displayName": "Second User"
                    }
                    """))
            .andExpect(status().isConflict());

        mockMvc.perform(get("/api/v1/applications"))
            .andExpect(status().isUnauthorized());
    }

    @Test
    void returnsAndPreservesRequestCorrelationId() throws Exception {
        mockMvc.perform(post("/api/v1/auth/register")
                .header("X-Request-Id", "integration-request-123")
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                    {
                      "email": "correlation@example.com",
                      "password": "long-enough-password",
                      "displayName": "Correlation User"
                    }
                    """))
            .andExpect(status().isCreated())
            .andExpect(header().string("X-Request-Id", "integration-request-123"));

        mockMvc.perform(get("/api/v1/applications"))
            .andExpect(status().isUnauthorized())
            .andExpect(header().exists("X-Request-Id"));
    }

    @Test
    void authenticatesWithHttpOnlySessionCookieAndClearsItOnCsrfProtectedLogout() throws Exception {
        var result = mockMvc.perform(post("/api/v1/auth/register")
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                    {
                      "email": "cookie@example.com",
                      "password": "long-enough-password",
                      "displayName": "Cookie User"
                    }
                    """))
            .andExpect(status().isCreated())
            .andExpect(jsonPath("$.accessToken").doesNotExist())
            .andReturn();

        var accessCookie = result.getResponse().getCookie(SessionCookieService.ACCESS_COOKIE_NAME);
        var refreshCookie = result.getResponse().getCookie(SessionCookieService.REFRESH_COOKIE_NAME);
        assertThat(accessCookie).isNotNull();
        assertThat(refreshCookie).isNotNull();
        assertThat(accessCookie.isHttpOnly()).isTrue();
        assertThat(refreshCookie.isHttpOnly()).isTrue();

        mockMvc.perform(get("/api/v1/applications").cookie(accessCookie))
            .andExpect(status().isOk());

        var csrfResult = mockMvc.perform(get("/api/v1/auth/csrf").cookie(accessCookie))
            .andExpect(status().isOk())
            .andReturn();
        var csrfCookie = csrfResult.getResponse().getCookie("XSRF-TOKEN");
        assertThat(csrfCookie).isNotNull();

        mockMvc.perform(post("/api/v1/auth/logout")
                .cookie(accessCookie, refreshCookie, csrfCookie)
                .header("X-XSRF-TOKEN", csrfCookie.getValue()))
            .andExpect(status().isNoContent())
            .andExpect(header().stringValues("Set-Cookie",
                org.hamcrest.Matchers.hasItem(org.hamcrest.Matchers.containsString(SessionCookieService.ACCESS_COOKIE_NAME + "=")),
                org.hamcrest.Matchers.hasItem(org.hamcrest.Matchers.containsString(SessionCookieService.REFRESH_COOKIE_NAME + "="))))
            .andExpect(header().string("Set-Cookie", org.hamcrest.Matchers.containsString("Max-Age=0")));
    }

    private String register(String email, String displayName) throws Exception {
        var result = mockMvc.perform(post("/api/v1/auth/register")
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                    {
                      "email": "%s",
                      "password": "long-enough-password",
                      "displayName": "%s"
                    }
                    """.formatted(email, displayName)))
            .andExpect(status().isCreated())
            .andExpect(header().exists("X-Request-Id"))
            .andExpect(jsonPath("$.accessToken").doesNotExist())
            .andReturn();

        var cookie = result.getResponse().getCookie(SessionCookieService.COOKIE_NAME);
        assertThat(cookie).isNotNull();
        assertThat(cookie.getValue()).isNotBlank();
        return cookie.getValue();
    }

    private String applicationJson(String company, String position, String interviews) {
        return """
            {
              "company": "%s",
              "position": "%s",
              "applicationDate": "2026-08-18",
              "status": "Envoyé",
              "notes": "",
              "contractType": "CDI",
              "salaryPeriod": "Annuel",
              "stage": "Candidature",
              "priority": "Haute",
              "interviews": %s
            }
            """.formatted(company, position, interviews);
    }
}
