package dev.jobtrackr;

import dev.jobtrackr.security.SessionCookieService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.testcontainers.service.connection.ServiceConnection;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import tools.jackson.databind.json.JsonMapper;

import static org.assertj.core.api.Assertions.assertThat;
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
class ApplicationConcurrencyIntegrationTest {

    @Container
    @ServiceConnection
    static PostgreSQLContainer<?> postgres = new PostgreSQLContainer<>("postgres:17-alpine");

    @Autowired MockMvc mockMvc;
    @Autowired JsonMapper jsonMapper;

    @Test
    void rejectsAStaleClientVersionWithPreconditionFailed() throws Exception {
        String token = register();
        String created = mockMvc.perform(post("/api/v1/applications")
                .header(HttpHeaders.AUTHORIZATION, "Bearer " + token)
                .contentType(MediaType.APPLICATION_JSON)
                .content(applicationJson("Initial notes")))
            .andExpect(status().isCreated())
            .andExpect(header().string(HttpHeaders.ETAG, "\"0\""))
            .andExpect(jsonPath("$.version").value(0))
            .andReturn().getResponse().getContentAsString();

        String applicationId = jsonMapper.readTree(created).path("id").asText();

        mockMvc.perform(put("/api/v1/applications/{id}", applicationId)
                .header(HttpHeaders.AUTHORIZATION, "Bearer " + token)
                .header(HttpHeaders.IF_MATCH, "\"0\"")
                .contentType(MediaType.APPLICATION_JSON)
                .content(applicationJson("First accepted update")))
            .andExpect(status().isOk())
            .andExpect(header().string(HttpHeaders.ETAG, "\"1\""))
            .andExpect(jsonPath("$.version").value(1))
            .andExpect(jsonPath("$.notes").value("First accepted update"));

        mockMvc.perform(put("/api/v1/applications/{id}", applicationId)
                .header(HttpHeaders.AUTHORIZATION, "Bearer " + token)
                .header(HttpHeaders.IF_MATCH, "\"0\"")
                .contentType(MediaType.APPLICATION_JSON)
                .content(applicationJson("Stale overwrite")))
            .andExpect(status().isPreconditionFailed())
            .andExpect(jsonPath("$.title").value("Application changed"));
    }

    private String register() throws Exception {
        var result = mockMvc.perform(post("/api/v1/auth/register")
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                    {
                      "email": "concurrency@example.com",
                      "password": "long-enough-password",
                      "displayName": "Concurrency User"
                    }
                    """))
            .andExpect(status().isCreated())
            .andExpect(jsonPath("$.accessToken").doesNotExist())
            .andReturn();

        var cookie = result.getResponse().getCookie(SessionCookieService.COOKIE_NAME);
        assertThat(cookie).isNotNull();
        return cookie.getValue();
    }

    private String applicationJson(String notes) {
        return """
            {
              "company": "Concurrency Labs",
              "position": "Backend Engineer",
              "applicationDate": "2026-08-18",
              "status": "Envoyé",
              "notes": "%s",
              "contractType": "CDI",
              "salaryPeriod": "Annuel",
              "stage": "Candidature",
              "priority": "Haute",
              "interviews": []
            }
            """.formatted(notes);
    }
}
