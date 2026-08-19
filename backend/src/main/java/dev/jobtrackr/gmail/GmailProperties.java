package dev.jobtrackr.gmail;

import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "jobtrackr.gmail")
public class GmailProperties {
    private String clientId = "";
    private String clientSecret = "";
    private String redirectUri = "http://localhost:8080/api/v1/gmail/oauth/callback";
    private String frontendBaseUrl = "http://localhost:4200";
    private String tokenEncryptionKey = "";
    private long syncDelayMs = 900_000L;
    private int initialLookbackDays = 30;
    private int autoApplyMinMatch = 70;
    private int autoApplyMinConfidence = 80;

    public boolean configured() {
        return !clientId.isBlank()
            && !clientSecret.isBlank()
            && !redirectUri.isBlank()
            && !frontendBaseUrl.isBlank()
            && tokenEncryptionKey.length() >= 32;
    }

    public String getClientId() { return clientId; }
    public void setClientId(String clientId) { this.clientId = value(clientId); }
    public String getClientSecret() { return clientSecret; }
    public void setClientSecret(String clientSecret) { this.clientSecret = value(clientSecret); }
    public String getRedirectUri() { return redirectUri; }
    public void setRedirectUri(String redirectUri) { this.redirectUri = value(redirectUri); }
    public String getFrontendBaseUrl() { return frontendBaseUrl; }
    public void setFrontendBaseUrl(String frontendBaseUrl) { this.frontendBaseUrl = value(frontendBaseUrl); }
    public String getTokenEncryptionKey() { return tokenEncryptionKey; }
    public void setTokenEncryptionKey(String tokenEncryptionKey) { this.tokenEncryptionKey = value(tokenEncryptionKey); }
    public long getSyncDelayMs() { return syncDelayMs; }
    public void setSyncDelayMs(long syncDelayMs) { this.syncDelayMs = syncDelayMs; }
    public int getInitialLookbackDays() { return initialLookbackDays; }
    public void setInitialLookbackDays(int initialLookbackDays) { this.initialLookbackDays = initialLookbackDays; }
    public int getAutoApplyMinMatch() { return autoApplyMinMatch; }
    public void setAutoApplyMinMatch(int autoApplyMinMatch) { this.autoApplyMinMatch = autoApplyMinMatch; }
    public int getAutoApplyMinConfidence() { return autoApplyMinConfidence; }
    public void setAutoApplyMinConfidence(int autoApplyMinConfidence) { this.autoApplyMinConfidence = autoApplyMinConfidence; }

    private static String value(String input) { return input == null ? "" : input.trim(); }
}
