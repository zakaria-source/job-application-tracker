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
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest(properties = {
    "jobtrackr.security.jwt-secret=test-secret-that-is-long-enough-for-hs256-signing-0123456789"
})
@AutoConfigureMockMvc
@Testcontainers
class AdvancedTrackingIntegrationTest {

    @Container
    @ServiceConnection
    static PostgreSQLContainer<?> postgres = new PostgreSQLContainer<>("postgres:17-alpine");

    @Autowired MockMvc mockMvc;
    @Autowired JsonMapper jsonMapper;

    @Test
    void persistsActivityFollowUpsDebriefsAndHealthWithoutLosingInterviewIdentity() throws Exception {
        String token = register();
        String created = mockMvc.perform(post("/api/v1/applications")
                .header("Authorization", "Bearer " + token)
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                    {
                      "company": "Tracking Labs",
                      "position": "Backend Engineer",
                      "applicationDate": "2026-08-18",
                      "status": "Envoyé",
                      "notes": "",
                      "contractType": "CDI",
                      "salaryPeriod": "Annuel",
                      "followUpDate": "2026-08-18",
                      "recruiterName": "Recruiter",
                      "stage": "Candidature",
                      "priority": "Haute",
                      "interviews": [{
                        "date": "2026-08-20T10:00:00+02:00",
                        "type": "Visioconférence",
                        "notes": "Technical round",
                        "reminderSet": true
                      }]
                    }
                    """))
            .andExpect(status().isCreated())
            .andReturn().getResponse().getContentAsString();

        JsonNode application = jsonMapper.readTree(created);
        String applicationId = application.path("id").asText();
        String interviewId = application.path("interviews").get(0).path("id").asText();

        String activityBefore = mockMvc.perform(get("/api/v1/applications/{id}/activity", applicationId)
                .header("Authorization", "Bearer " + token))
            .andExpect(status().isOk())
            .andReturn().getResponse().getContentAsString();
        assertThat(activityBefore).contains("APPLICATION_CREATED", "FOLLOW_UP_SCHEDULED", "INTERVIEWS_UPDATED");

        mockMvc.perform(get("/api/v1/applications/{id}/follow-ups", applicationId)
                .header("Authorization", "Bearer " + token))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.length()").value(1))
            .andExpect(jsonPath("$[0].scheduledFor").value("2026-08-18"));

        mockMvc.perform(get("/api/v1/applications/{id}/health", applicationId)
                .header("Authorization", "Bearer " + token))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.score").isNumber())
            .andExpect(jsonPath("$.level").exists());

        mockMvc.perform(put("/api/v1/applications/{applicationId}/interviews/{interviewId}/debrief", applicationId, interviewId)
                .header("Authorization", "Bearer " + token)
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                    {
                      "sentiment": "POSITIVE",
                      "questions": "Kafka partitions",
                      "strengths": "Clear answers",
                      "improvements": "More metrics",
                      "nextAction": "Send follow-up"
                    }
                    """))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.sentiment").value("POSITIVE"))
            .andExpect(jsonPath("$.questions").value("Kafka partitions"));

        mockMvc.perform(put("/api/v1/applications/{id}", applicationId)
                .header("Authorization", "Bearer " + token)
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                    {
                      "company": "Tracking Labs",
                      "position": "Backend Engineer",
                      "applicationDate": "2026-08-18",
                      "status": "Envoyé",
                      "notes": "Salary updated without touching the interview",
                      "contractType": "CDI",
                      "salaryTarget": 70000,
                      "salaryPeriod": "Annuel",
                      "followUpDate": "2026-08-18",
                      "recruiterName": "Recruiter",
                      "stage": "Candidature",
                      "priority": "Haute",
                      "interviews": [{
                        "id": "%s",
                        "date": "2026-08-20T10:00:00+02:00",
                        "type": "Visioconférence",
                        "notes": "Technical round",
                        "reminderSet": true
                      }]
                    }
                    """.formatted(interviewId)))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.interviews[0].id").value(interviewId))
            .andExpect(jsonPath("$.salaryTarget").value(70000));

        mockMvc.perform(get("/api/v1/applications/{id}/debriefs", applicationId)
                .header("Authorization", "Bearer " + token))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.length()").value(1))
            .andExpect(jsonPath("$[0].interviewId").value(interviewId))
            .andExpect(jsonPath("$[0].questions").value("Kafka partitions"));

        mockMvc.perform(get("/api/v1/applications/{id}/tracking-overview", applicationId)
                .header("Authorization", "Bearer " + token))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.activity").isArray())
            .andExpect(jsonPath("$.followUps.length()").value(1))
            .andExpect(jsonPath("$.health.score").isNumber())
            .andExpect(jsonPath("$.debriefs.length()").value(1));

        mockMvc.perform(patch("/api/v1/applications/{id}/follow-ups/current/complete", applicationId)
                .header("Authorization", "Bearer " + token)
                .contentType(MediaType.APPLICATION_JSON)
                .content("{}"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.status").value("COMPLETED"));

        String activityAfter = mockMvc.perform(get("/api/v1/applications/{id}/activity", applicationId)
                .header("Authorization", "Bearer " + token))
            .andExpect(status().isOk())
            .andReturn().getResponse().getContentAsString();
        assertThat(activityAfter).contains("DEBRIEF_SAVED", "FOLLOW_UP_COMPLETED");
    }

    private String register() throws Exception {
        String response = mockMvc.perform(post("/api/v1/auth/register")
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                    {
                      "email": "advanced-tracking@example.com",
                      "password": "long-enough-password",
                      "displayName": "Tracking User"
                    }
                    """))
            .andExpect(status().isCreated())
            .andReturn().getResponse().getContentAsString();
        return jsonMapper.readTree(response).path("accessToken").asText();
    }
}
