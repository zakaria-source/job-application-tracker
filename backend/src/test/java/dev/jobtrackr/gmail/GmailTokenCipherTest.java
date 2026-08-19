package dev.jobtrackr.gmail;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class GmailTokenCipherTest {

    @Test
    void encryptsAndDecryptsRefreshTokenWithoutStoringPlaintext() {
        GmailProperties properties = new GmailProperties();
        properties.setTokenEncryptionKey("test-key-that-is-definitely-longer-than-thirty-two-characters");
        GmailTokenCipher cipher = new GmailTokenCipher(properties);

        String plaintext = "1//google-refresh-token-example";
        String encrypted = cipher.encrypt(plaintext);

        assertThat(encrypted).isNotEqualTo(plaintext).doesNotContain(plaintext);
        assertThat(cipher.decrypt(encrypted)).isEqualTo(plaintext);
    }

    @Test
    void refusesEncryptionWithWeakConfigurationKey() {
        GmailProperties properties = new GmailProperties();
        properties.setTokenEncryptionKey("too-short");
        GmailTokenCipher cipher = new GmailTokenCipher(properties);

        assertThatThrownBy(() -> cipher.encrypt("refresh-token"))
            .isInstanceOf(IllegalStateException.class)
            .hasMessageContaining("Unable to encrypt Gmail refresh token");
    }
}
