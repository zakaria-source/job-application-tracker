package dev.jobtrackr.jobimport;

import org.springframework.stereotype.Component;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

import java.io.IOException;
import java.io.InputStream;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.net.http.HttpTimeoutException;
import java.time.Duration;
import java.util.Set;

@Component
public class SafePublicJsonFetcher implements PublicJsonFetcher {

    private static final int MAX_BODY_BYTES = 1_000_000;
    private static final int MAX_REDIRECTS = 3;
    private static final Set<Integer> REDIRECT_STATUSES = Set.of(301, 302, 303, 307, 308);
    private static final String USER_AGENT = "JobTrackr/1.0 (job import preview; +https://trackmyjob-zakaria.netlify.app/)";

    private final SafeJobUrlValidator validator;
    private final JsonMapper jsonMapper;
    private final HttpClient client;

    public SafePublicJsonFetcher(SafeJobUrlValidator validator, JsonMapper jsonMapper) {
        this.validator = validator;
        this.jsonMapper = jsonMapper;
        this.client = HttpClient.newBuilder()
            .connectTimeout(Duration.ofSeconds(3))
            .followRedirects(HttpClient.Redirect.NEVER)
            .build();
    }

    @Override
    public JsonNode fetch(URI uri) {
        URI current = validator.validate(uri.toString());

        for (int redirect = 0; redirect <= MAX_REDIRECTS; redirect++) {
            current = validator.validate(current.toString());
            HttpRequest request = HttpRequest.newBuilder(current)
                .GET()
                .timeout(Duration.ofSeconds(6))
                .header("Accept", "application/json")
                .header("User-Agent", USER_AGENT)
                .build();

            try {
                HttpResponse<InputStream> response = client.send(request, HttpResponse.BodyHandlers.ofInputStream());
                if (REDIRECT_STATUSES.contains(response.statusCode())) {
                    try (InputStream ignored = response.body()) {
                        String location = response.headers().firstValue("Location")
                            .orElseThrow(() -> new JobImportException("Le service d’offres a renvoyé une redirection invalide."));
                        if (redirect == MAX_REDIRECTS) {
                            throw new JobImportException("Le service d’offres effectue trop de redirections.");
                        }
                        current = validator.validate(current.resolve(location).toString());
                        continue;
                    }
                }

                if (response.statusCode() == 401 || response.statusCode() == 403) {
                    closeQuietly(response.body());
                    throw new JobImportException("Le service d’offres refuse l’accès public à cette ressource.");
                }
                if (response.statusCode() == 429) {
                    closeQuietly(response.body());
                    throw new JobImportException("Le service d’offres limite temporairement les analyses.");
                }
                if (response.statusCode() < 200 || response.statusCode() >= 300) {
                    closeQuietly(response.body());
                    throw new JobImportException("Le service public d’offres n’est pas accessible pour cette annonce.");
                }

                String contentType = response.headers().firstValue("Content-Type").orElse("").toLowerCase();
                if (!contentType.isBlank() && !contentType.contains("application/json") && !contentType.contains("text/json")) {
                    closeQuietly(response.body());
                    throw new JobImportException("Le service d’offres n’a pas renvoyé des données JSON exploitables.");
                }

                byte[] body;
                try (InputStream stream = response.body()) {
                    body = stream.readNBytes(MAX_BODY_BYTES + 1);
                }
                if (body.length > MAX_BODY_BYTES) {
                    throw new JobImportException("La réponse du service d’offres est trop volumineuse.");
                }
                return jsonMapper.readTree(body);
            } catch (HttpTimeoutException exception) {
                throw new JobImportException("Le service d’offres met trop de temps à répondre.", exception);
            } catch (InterruptedException exception) {
                Thread.currentThread().interrupt();
                throw new JobImportException("L’analyse de l’offre a été interrompue.", exception);
            } catch (IOException exception) {
                throw new JobImportException("Impossible de lire les données publiques de cette offre.", exception);
            }
        }
        throw new JobImportException("Impossible de suivre les redirections du service d’offres.");
    }

    private static void closeQuietly(InputStream stream) {
        try {
            stream.close();
        } catch (IOException ignored) {
            // The rejected response is already being discarded.
        }
    }
}
