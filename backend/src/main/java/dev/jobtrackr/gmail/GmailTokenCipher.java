package dev.jobtrackr.gmail;

import org.springframework.stereotype.Component;

import javax.crypto.Cipher;
import javax.crypto.spec.GCMParameterSpec;
import javax.crypto.spec.SecretKeySpec;
import java.nio.ByteBuffer;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.SecureRandom;
import java.util.Base64;

@Component
class GmailTokenCipher {
    private static final int IV_BYTES = 12;
    private static final int GCM_TAG_BITS = 128;
    private final GmailProperties properties;
    private final SecureRandom random = new SecureRandom();

    GmailTokenCipher(GmailProperties properties) {
        this.properties = properties;
    }

    String encrypt(String plaintext) {
        try {
            byte[] iv = new byte[IV_BYTES];
            random.nextBytes(iv);
            Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
            cipher.init(Cipher.ENCRYPT_MODE, key(), new GCMParameterSpec(GCM_TAG_BITS, iv));
            byte[] encrypted = cipher.doFinal(plaintext.getBytes(StandardCharsets.UTF_8));
            return Base64.getUrlEncoder().withoutPadding().encodeToString(
                ByteBuffer.allocate(iv.length + encrypted.length).put(iv).put(encrypted).array()
            );
        } catch (Exception exception) {
            throw new IllegalStateException("Unable to encrypt Gmail refresh token", exception);
        }
    }

    String decrypt(String ciphertext) {
        try {
            byte[] payload = Base64.getUrlDecoder().decode(ciphertext);
            if (payload.length <= IV_BYTES) throw new IllegalArgumentException("Invalid encrypted Gmail token");
            byte[] iv = new byte[IV_BYTES];
            byte[] encrypted = new byte[payload.length - IV_BYTES];
            System.arraycopy(payload, 0, iv, 0, IV_BYTES);
            System.arraycopy(payload, IV_BYTES, encrypted, 0, encrypted.length);
            Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
            cipher.init(Cipher.DECRYPT_MODE, key(), new GCMParameterSpec(GCM_TAG_BITS, iv));
            return new String(cipher.doFinal(encrypted), StandardCharsets.UTF_8);
        } catch (Exception exception) {
            throw new IllegalStateException("Unable to decrypt Gmail refresh token", exception);
        }
    }

    private SecretKeySpec key() throws Exception {
        String secret = properties.getTokenEncryptionKey();
        if (secret.length() < 32) throw new IllegalStateException("GMAIL_TOKEN_ENCRYPTION_KEY must be at least 32 characters");
        byte[] digest = MessageDigest.getInstance("SHA-256").digest(secret.getBytes(StandardCharsets.UTF_8));
        return new SecretKeySpec(digest, "AES");
    }
}
