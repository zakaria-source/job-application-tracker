package dev.jobtrackr.jobimport;

import org.springframework.stereotype.Component;

import java.net.InetAddress;
import java.net.URI;
import java.net.URISyntaxException;
import java.net.UnknownHostException;
import java.util.Locale;
import java.util.Set;

@Component
public class SafeJobUrlValidator {

    private static final Set<String> BLOCKED_HOST_SUFFIXES = Set.of("linkedin.com");
    private static final Set<String> BLOCKED_HOSTS = Set.of(
        "localhost",
        "metadata.google.internal",
        "metadata.amazonaws.com"
    );

    public URI validate(String rawUrl) {
        final URI parsed;
        try {
            parsed = new URI(rawUrl == null ? "" : rawUrl.trim());
        } catch (URISyntaxException exception) {
            throw new UnsafeJobUrlException("L’URL fournie n’est pas valide.");
        }

        if (!"https".equalsIgnoreCase(parsed.getScheme())) {
            throw new UnsafeJobUrlException("Seules les URL HTTPS publiques sont acceptées.");
        }
        if (parsed.getHost() == null || parsed.getHost().isBlank() || parsed.getUserInfo() != null) {
            throw new UnsafeJobUrlException("L’URL doit cibler un domaine public valide.");
        }
        if (parsed.getPort() != -1 && parsed.getPort() != 443) {
            throw new UnsafeJobUrlException("Les ports personnalisés ne sont pas autorisés pour l’import d’offres.");
        }

        String host = parsed.getHost().toLowerCase(Locale.ROOT);
        if (BLOCKED_HOSTS.contains(host) || host.endsWith(".localhost") || host.endsWith(".local")) {
            throw new UnsafeJobUrlException("Cette destination réseau n’est pas autorisée.");
        }
        if (BLOCKED_HOST_SUFFIXES.stream().anyMatch(suffix -> host.equals(suffix) || host.endsWith("." + suffix))) {
            throw new UnsafeJobUrlException("Ce site ne prend pas en charge l’import automatique. Utilisez la saisie manuelle.");
        }

        try {
            InetAddress[] addresses = InetAddress.getAllByName(host);
            if (addresses.length == 0) {
                throw new UnsafeJobUrlException("Le domaine de cette URL est introuvable.");
            }
            for (InetAddress address : addresses) {
                if (!isPublic(address)) {
                    throw new UnsafeJobUrlException("Cette destination réseau n’est pas autorisée.");
                }
            }
        } catch (UnknownHostException exception) {
            throw new JobImportException("Impossible de résoudre le domaine de cette offre.", exception);
        }

        try {
            return new URI("https", null, host, parsed.getPort(),
                parsed.getRawPath() == null || parsed.getRawPath().isBlank() ? "/" : parsed.getRawPath(),
                parsed.getRawQuery(), null);
        } catch (URISyntaxException exception) {
            throw new UnsafeJobUrlException("L’URL fournie n’est pas valide.");
        }
    }

    private boolean isPublic(InetAddress address) {
        if (address.isAnyLocalAddress()
            || address.isLoopbackAddress()
            || address.isLinkLocalAddress()
            || address.isSiteLocalAddress()
            || address.isMulticastAddress()) {
            return false;
        }

        byte[] bytes = address.getAddress();
        if (bytes.length == 4) {
            int first = Byte.toUnsignedInt(bytes[0]);
            int second = Byte.toUnsignedInt(bytes[1]);
            if (first == 0 || first >= 224) return false;
            if (first == 100 && second >= 64 && second <= 127) return false;
            if (first == 192 && second == 0) return false;
            if (first == 198 && (second == 18 || second == 19)) return false;
        }
        if (bytes.length == 16) {
            int first = Byte.toUnsignedInt(bytes[0]);
            if ((first & 0xfe) == 0xfc) return false;
        }
        return true;
    }
}
