package dev.jobtrackr.gmail;

import tools.jackson.databind.JsonNode;
import org.jsoup.Jsoup;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.util.MultiValueMap;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientResponseException;

import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Base64;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;

class GmailApiClient {
    private static final String GMAIL_SCOPE = "https://www.googleapis.com/auth/gmail.readonly";
    private final RestClient oauth = RestClient.builder().baseUrl("https://oauth2.googleapis.com").build();
    private final RestClient gmail = RestClient.builder().baseUrl("https://gmail.googleapis.com/gmail/v1").build();
    private final GmailProperties properties;

    GmailApiClient(GmailProperties properties) {
        this.properties = properties;
    }

    String scope() {
        return GMAIL_SCOPE;
    }

    OAuthTokens exchangeCode(String code) {
        MultiValueMap<String, String> form = new LinkedMultiValueMap<>();
        form.add("code", code);
        form.add("client_id", properties.getClientId());
        form.add("client_secret", properties.getClientSecret());
        form.add("redirect_uri", properties.getRedirectUri());
        form.add("grant_type", "authorization_code");
        JsonNode json = oauth.post()
            .uri("/token")
            .contentType(MediaType.APPLICATION_FORM_URLENCODED)
            .body(form)
            .retrieve()
            .body(JsonNode.class);
        return new OAuthTokens(text(json, "access_token"), text(json, "refresh_token"));
    }

    String refreshAccessToken(String refreshToken) {
        MultiValueMap<String, String> form = new LinkedMultiValueMap<>();
        form.add("client_id", properties.getClientId());
        form.add("client_secret", properties.getClientSecret());
        form.add("refresh_token", refreshToken);
        form.add("grant_type", "refresh_token");
        JsonNode json = oauth.post()
            .uri("/token")
            .contentType(MediaType.APPLICATION_FORM_URLENCODED)
            .body(form)
            .retrieve()
            .body(JsonNode.class);
        String token = text(json, "access_token");
        if (token.isBlank()) throw new IllegalStateException("Google did not return an access token");
        return token;
    }

    GmailProfile profile(String accessToken) {
        JsonNode json = gmail.get()
            .uri("/users/me/profile")
            .header(HttpHeaders.AUTHORIZATION, bearer(accessToken))
            .retrieve()
            .body(JsonNode.class);
        return new GmailProfile(text(json, "emailAddress"), text(json, "historyId"));
    }

    List<String> recentMessageIds(String accessToken, int lookbackDays) {
        Set<String> ids = new LinkedHashSet<>();
        String pageToken = null;
        for (int page = 0; page < 3; page++) {
            final String token = pageToken;
            JsonNode json = gmail.get()
                .uri(builder -> {
                    builder.path("/users/me/messages")
                        .queryParam("maxResults", 100)
                        .queryParam("labelIds", "INBOX")
                        .queryParam("q", "newer_than:" + Math.max(1, lookbackDays) + "d -category:promotions -category:social");
                    if (token != null && !token.isBlank()) builder.queryParam("pageToken", token);
                    return builder.build();
                })
                .header(HttpHeaders.AUTHORIZATION, bearer(accessToken))
                .retrieve()
                .body(JsonNode.class);
            for (JsonNode message : array(json, "messages")) {
                String id = text(message, "id");
                if (!id.isBlank()) ids.add(id);
            }
            pageToken = text(json, "nextPageToken");
            if (pageToken.isBlank()) break;
        }
        return List.copyOf(ids);
    }

    HistoryChanges addedMessageIds(String accessToken, String startHistoryId) {
        Set<String> ids = new LinkedHashSet<>();
        String pageToken = null;
        String latestHistoryId = startHistoryId;
        try {
            for (int page = 0; page < 10; page++) {
                final String token = pageToken;
                JsonNode json = gmail.get()
                    .uri(builder -> {
                        builder.path("/users/me/history")
                            .queryParam("startHistoryId", startHistoryId)
                            .queryParam("historyTypes", "messageAdded")
                            .queryParam("labelId", "INBOX")
                            .queryParam("maxResults", 500);
                        if (token != null && !token.isBlank()) builder.queryParam("pageToken", token);
                        return builder.build();
                    })
                    .header(HttpHeaders.AUTHORIZATION, bearer(accessToken))
                    .retrieve()
                    .body(JsonNode.class);
                for (JsonNode history : array(json, "history")) {
                    for (JsonNode added : array(history, "messagesAdded")) {
                        String id = text(added.path("message"), "id");
                        if (!id.isBlank()) ids.add(id);
                    }
                }
                String responseHistoryId = text(json, "historyId");
                if (!responseHistoryId.isBlank()) latestHistoryId = responseHistoryId;
                pageToken = text(json, "nextPageToken");
                if (pageToken.isBlank()) break;
            }
        } catch (RestClientResponseException exception) {
            if (exception.getStatusCode().value() == 404) throw new HistoryExpiredException();
            throw exception;
        }
        return new HistoryChanges(List.copyOf(ids), latestHistoryId);
    }

    GmailMessage message(String accessToken, String messageId) {
        JsonNode json = gmail.get()
            .uri(builder -> builder.path("/users/me/messages/{id}").queryParam("format", "full").build(messageId))
            .header(HttpHeaders.AUTHORIZATION, bearer(accessToken))
            .retrieve()
            .body(JsonNode.class);
        JsonNode payload = json == null ? null : json.path("payload");
        String subject = header(payload, "Subject");
        String from = header(payload, "From");

        String plain = findMime(payload, "text/plain");
        String html = findMime(payload, "text/html");
        String htmlText = html.isBlank() ? "" : Jsoup.parse(html).text();
        String snippet = text(json, "snippet");
        String body = mergeBody(plain, htmlText, snippet);

        Instant date = parseInternalDate(text(json, "internalDate"));
        return new GmailMessage(
            text(json, "id"),
            text(json, "threadId"),
            text(json, "historyId"),
            subject,
            from,
            body,
            date
        );
    }

    private static String header(JsonNode payload, String name) {
        if (payload == null || payload.isMissingNode()) return "";
        for (JsonNode header : array(payload, "headers")) {
            if (name.equalsIgnoreCase(text(header, "name"))) return text(header, "value");
        }
        return "";
    }

    private static String findMime(JsonNode part, String wantedMimeType) {
        if (part == null || part.isMissingNode()) return "";
        List<String> values = new ArrayList<>();
        collectMime(part, wantedMimeType, values);
        return String.join("\n", values).trim();
    }

    private static void collectMime(JsonNode part, String wantedMimeType, List<String> values) {
        if (part == null || part.isMissingNode()) return;
        if (wantedMimeType.equalsIgnoreCase(text(part, "mimeType"))) {
            String data = text(part.path("body"), "data");
            if (!data.isBlank()) {
                String decoded = decode(data).trim();
                if (!decoded.isBlank()) values.add(decoded);
            }
        }
        for (JsonNode child : array(part, "parts")) {
            collectMime(child, wantedMimeType, values);
        }
    }

    private static String mergeBody(String plain, String htmlText, String snippet) {
        LinkedHashSet<String> parts = new LinkedHashSet<>();
        if (plain != null && !plain.isBlank()) parts.add(plain.trim());
        if (htmlText != null && !htmlText.isBlank()) parts.add(htmlText.trim());
        if (snippet != null && !snippet.isBlank()) parts.add(snippet.trim());
        return String.join("\n", parts).trim();
    }

    private static String decode(String data) {
        try {
            return new String(Base64.getUrlDecoder().decode(data), StandardCharsets.UTF_8);
        } catch (IllegalArgumentException exception) {
            return "";
        }
    }

    private static Instant parseInternalDate(String value) {
        try {
            return value.isBlank() ? null : Instant.ofEpochMilli(Long.parseLong(value));
        } catch (NumberFormatException exception) {
            return null;
        }
    }

    private static List<JsonNode> array(JsonNode parent, String field) {
        if (parent == null) return List.of();
        JsonNode node = parent.path(field);
        if (!node.isArray()) return List.of();
        List<JsonNode> values = new ArrayList<>();
        node.forEach(values::add);
        return values;
    }

    private static String text(JsonNode node, String field) {
        if (node == null) return "";
        JsonNode value = node.path(field);
        return value.isString() || value.isNumber() ? value.asString("") : "";
    }

    private static String bearer(String token) {
        return "Bearer " + token;
    }

    record OAuthTokens(String accessToken, String refreshToken) {}
    record GmailProfile(String emailAddress, String historyId) {}
    record HistoryChanges(List<String> messageIds, String historyId) {}
    record GmailMessage(String id, String threadId, String historyId, String subject, String from, String body, Instant date) {}

    static final class HistoryExpiredException extends RuntimeException {}
}
