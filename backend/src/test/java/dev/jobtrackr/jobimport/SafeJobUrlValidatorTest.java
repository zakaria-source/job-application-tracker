package dev.jobtrackr.jobimport;

import org.junit.jupiter.api.Test;

import java.net.URI;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class SafeJobUrlValidatorTest {

    private final SafeJobUrlValidator validator = new SafeJobUrlValidator();

    @Test
    void rejectsNonHttpsAndPrivateDestinations() {
        assertThatThrownBy(() -> validator.validate("http://example.com/jobs/1"))
            .isInstanceOf(UnsafeJobUrlException.class);
        assertThatThrownBy(() -> validator.validate("https://127.0.0.1/jobs/1"))
            .isInstanceOf(UnsafeJobUrlException.class);
        assertThatThrownBy(() -> validator.validate("https://169.254.169.254/latest/meta-data"))
            .isInstanceOf(UnsafeJobUrlException.class);
        assertThatThrownBy(() -> validator.validate("https://www.linkedin.com/jobs/view/1"))
            .isInstanceOf(UnsafeJobUrlException.class);
    }

    @Test
    void acceptsARegularPublicHttpsAddress() {
        URI uri = validator.validate("https://93.184.216.34/jobs/42?source=test#ignored");
        assertThat(uri.getScheme()).isEqualTo("https");
        assertThat(uri.getHost()).isEqualTo("93.184.216.34");
        assertThat(uri.getFragment()).isNull();
    }
}
