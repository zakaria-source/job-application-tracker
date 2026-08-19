package dev.jobtrackr.gmail;

import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.scheduling.annotation.EnableScheduling;

@Configuration
@EnableScheduling
@EnableConfigurationProperties(GmailProperties.class)
class GmailConfiguration {
    @Bean
    GmailApiClient gmailApiClient(GmailProperties properties) {
        return new GmailApiClient(properties);
    }
}
