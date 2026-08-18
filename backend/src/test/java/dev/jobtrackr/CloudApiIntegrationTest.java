package dev.jobtrackr;

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
                .content("""
                    {
                      "company": "Acme Cloud",
                      "position": "Backend Engineer",
                      "applicationDate": "2026-08-18",
                      "status": "Envoyé",
                      "notes": "",
                      "contractType": "CDI",
                      "salaryPeriod": "Annuel",
                      "stage": "Candidature",
                      "priority": "Haute",
                      "interviews": []
                    }
                    """))
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

    private String register(String email, String displayName) throws Exception {
        String response = mockMvc.perform(post("/api/v1/auth/register")
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                    {
                      "email": "%s",
                      "password": "long-enough-password",
                      "displayName": "%s"
                    }
                    """.formatted(email, displayName)))
            .andExpect(status().isCreated())
            .andReturn()
            .getResponse()
            .getContentAsString();

        JsonNode json = jsonMapper.readTree(response);
        String token = json.path("accessToken").asText();
        assertThat(token).isNotBlank();
        return token;
    }
}
