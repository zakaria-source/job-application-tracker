package dev.jobtrackr.jobimport;

import org.jsoup.Jsoup;
import org.jsoup.nodes.Document;
import org.springframework.stereotype.Component;

import java.io.ByteArrayInputStream;
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
public class SafeJobPageFetcher {

    private static final int MAX_BODY_BYTES = 1_500_000;
    private static final int MAX_REDIRECTS = 3;
    private static final Set<Integer> REDIRECT_STATUSES = Set.of(301, 302, 303, 307, 308);
    private static final String USER_AGENT = "JobTrackr/1.0 (job import preview; +https://trackmyjob-zakaria.netlify.app/)";

    private final SafeJobUrlValidator validator;
    private final HttpClient client;

    public SafeJobPageFetcher(SafeJobUrlValidator validator) {
        this.validator = validator;
        this.client = HttpClient.newBuilder()
            .connectTimeout(Duration.ofSeconds(3))
            .followRedirects(HttpClient.Redirect.NEVER)
            .build();
    }

    public FetchedJobPage fetch(String rawUrl) {
        URI current = validator.validate(rawUrl);

        for (int redirect = 0; redirect <= MAX_REDIRECTS; redirect++) {
            current = validator.validate(current.toString());
            HttpRequest request = HttpRequest.newBuilder(current)
                .GET()
                .timeout(Duration.ofSeconds(6))
                .header("Accept", "text/html,application/xhtml+xml;q=0.9")
                .header("User-Agent", USER_AGENT)
                .build();

            try {
                HttpResponse<InputStream> response = client.send(request, HttpResponse.BodyHandlers.ofInputStream());
                if (REDIRECT_STATUSES.contains(response.statusCode())) {
                    try (InputStream ignored = response.body()) {
                        String location = response.headers().firstValue("Location")
                            .orElseThrow(() -> new JobImportException("Le site a renvoyé une redirection invalide."));
                        if (redirect == MAX_REDIRECTS) {
                            throw new JobImportException("Cette page effectue trop de redirections.");
                        }
                        current = validator.validate(current.resolve(location).toString());
                        continue;
                    }
                }

                if (response.statusCode() == 401 || response.statusCode() == 403) {
                    closeQuietly(response.body());
                    throw new JobImportException("Le site refuse l’analyse automatique de cette page.");
                }
                if (response.statusCode() == 429) {
                    closeQuietly(response.body());
                    throw new JobImportException("Le site limite temporairement les analyses. Réessayez plus tard.");
                }
                if (response.statusCode() < 200 || response.statusCode() >= 300) {
                    closeQuietly(response.body());
                    throw new JobImportException("La page d’offre n’est pas accessible publiquement.");
                }

                String contentType = response.headers().firstValue("Content-Type").orElse("").toLowerCase();
                if (!contentType.isBlank() && !contentType.contains("text/html") && !contentType.contains("application/xhtml+xml")) {
                    closeQuietly(response.body());
                    throw new JobImportException("Cette URL ne renvoie pas une page HTML exploitable.");
                }

                byte[] body;
                try (InputStream stream = response.body()) {
                    body = stream.readNBytes(MAX_BODY_BYTES + 1);
                }
                if (body.length > MAX_BODY_BYTES) {
                    throw new JobImportException("Cette page est trop volumineuse pour être analysée en toute sécurité.");
                }

                Document document = Jsoup.parse(new ByteArrayInputStream(body), null, current.toString());
                return new FetchedJobPage(current, document);
            } catch (HttpTimeoutException exception) {
                throw new JobImportException("Le site met trop de temps à répondre.", exception);
            } catch (InterruptedException exception) {
                Thread.currentThread().interrupt();
                throw new JobImportException("L’analyse de l’offre a été interrompue.", exception);
            } catch (IOException exception) {
                throw new JobImportException("Impossible de télécharger cette page d’offre.", exception);
            }
        }
        throw new JobImportException("Impossible de suivre les redirections de cette page.");
    }

    private static void closeQuietly(InputStream stream) {
        try {
            stream.close();
        } catch (IOException ignored) {
            // Nothing useful to do: the response is already being rejected.
        }
    }
}
