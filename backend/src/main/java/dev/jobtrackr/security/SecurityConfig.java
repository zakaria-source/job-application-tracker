package dev.jobtrackr.security;

import dev.jobtrackr.common.RequestLoggingFilter;
import dev.jobtrackr.identity.UserAccountRepository;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.annotation.Order;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.config.Customizer;
import org.springframework.security.config.annotation.authentication.configuration.AuthenticationConfiguration;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.core.userdetails.User;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.oauth2.jose.jws.MacAlgorithm;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.security.oauth2.jwt.JwtEncoder;
import org.springframework.security.oauth2.jwt.JwtValidators;
import org.springframework.security.oauth2.jwt.NimbusJwtDecoder;
import org.springframework.security.oauth2.jwt.NimbusJwtEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.HttpStatusEntryPoint;
import org.springframework.security.web.csrf.CookieCsrfTokenRepository;
import org.springframework.security.web.csrf.CsrfFilter;
import org.springframework.security.web.util.matcher.RequestMatcher;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;

import javax.crypto.SecretKey;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.util.List;

@Configuration
@EnableConfigurationProperties(JwtProperties.class)
public class SecurityConfig {

    private static final RequestMatcher BEARER_API_CLIENT = request -> {
        String authorization = request.getHeader(HttpHeaders.AUTHORIZATION);
        return authorization != null && authorization.regionMatches(true, 0, "Bearer ", 0, 7);
    };

    /**
     * Explicit API clients authenticate with the Authorization header. The credential
     * is not ambient browser state, so CSRF does not apply to this chain.
     */
    @Bean
    @Order(1)
    SecurityFilterChain bearerApiSecurityFilterChain(HttpSecurity http) throws Exception {
        http
            .securityMatcher(BEARER_API_CLIENT)
            .csrf(AbstractHttpConfigurer::disable)
            .cors(Customizer.withDefaults())
            .sessionManagement(session -> session.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
            .authorizeHttpRequests(authorize -> authorize.anyRequest().authenticated())
            .oauth2ResourceServer(oauth2 -> oauth2.jwt(Customizer.withDefaults()));
        return http.build();
    }

    /**
     * Browser traffic authenticates through a dedicated HttpOnly-cookie JWT filter.
     * We deliberately do not use Resource Server for browser cookies: Resource Server
     * treats bearer credentials as CSRF-exempt, which is correct for Authorization
     * headers but not for ambient browser cookies.
     */
    @Bean
    @Order(2)
    SecurityFilterChain browserSecurityFilterChain(
        HttpSecurity http,
        CookieJwtAuthenticationFilter cookieJwtAuthenticationFilter,
        CookieCsrfTokenRepository csrfTokens
    ) throws Exception {
        http
            .csrf(csrf -> csrf
                .spa()
                .csrfTokenRepository(csrfTokens)
                .ignoringRequestMatchers(
                    "/api/v1/auth/register",
                    "/api/v1/auth/login",
                    "/api/v1/auth/refresh"
                ))
            .cors(Customizer.withDefaults())
            .sessionManagement(session -> session.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
            .exceptionHandling(exceptions -> exceptions
                .authenticationEntryPoint(new HttpStatusEntryPoint(HttpStatus.UNAUTHORIZED)))
            .authorizeHttpRequests(authorize -> authorize
                .requestMatchers(
                    "/api/v1/auth/register",
                    "/api/v1/auth/login",
                    "/api/v1/auth/refresh",
                    "/api/v1/auth/logout",
                    "/api/v1/auth/csrf",
                    "/api/v1/auth/capabilities",
                    "/actuator/health"
                ).permitAll()
                .requestMatchers(HttpMethod.OPTIONS, "/**").permitAll()
                .anyRequest().authenticated())
            .addFilterBefore(cookieJwtAuthenticationFilter, CsrfFilter.class);
        return http.build();
    }

    @Bean
    CookieCsrfTokenRepository csrfTokenRepository(JwtProperties properties) {
        CookieCsrfTokenRepository repository = CookieCsrfTokenRepository.withHttpOnlyFalse();
        repository.setCookieCustomizer(cookie -> cookie
            .secure(properties.secureCookies())
            .sameSite("Strict")
            .path("/"));
        return repository;
    }

    @Bean
    PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder();
    }

    @Bean
    UserDetailsService userDetailsService(UserAccountRepository users) {
        return username -> users.findByEmailIgnoreCase(username)
            .map(user -> User.withUsername(user.getEmail())
                .password(user.getPasswordHash())
                .roles("USER")
                .build())
            .orElseThrow(() -> new org.springframework.security.core.userdetails.UsernameNotFoundException(username));
    }

    @Bean
    AuthenticationManager authenticationManager(AuthenticationConfiguration configuration) throws Exception {
        return configuration.getAuthenticationManager();
    }

    @Bean
    SecretKey jwtSecretKey(JwtProperties properties) {
        byte[] secret = properties.jwtSecret().getBytes(StandardCharsets.UTF_8);
        if (secret.length < 32) {
            throw new IllegalStateException("JWT_SECRET must be at least 32 bytes");
        }
        return new SecretKeySpec(secret, "HmacSHA256");
    }

    @Bean
    JwtEncoder jwtEncoder(SecretKey key) {
        return NimbusJwtEncoder.withSecretKey(key)
            .algorithm(MacAlgorithm.HS256)
            .build();
    }

    @Bean
    JwtDecoder jwtDecoder(SecretKey key) {
        NimbusJwtDecoder decoder = NimbusJwtDecoder.withSecretKey(key)
            .macAlgorithm(MacAlgorithm.HS256)
            .build();
        decoder.setJwtValidator(JwtValidators.createDefaultWithIssuer("jobtrackr"));
        return decoder;
    }

    @Bean
    CorsConfigurationSource corsConfigurationSource(JwtProperties properties) {
        CorsConfiguration configuration = new CorsConfiguration();
        configuration.setAllowedOrigins(properties.allowedOrigins());
        configuration.setAllowedMethods(List.of("GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"));
        configuration.setAllowedHeaders(List.of(
            "Authorization",
            "Content-Type",
            "If-Match",
            "X-XSRF-TOKEN",
            RequestLoggingFilter.REQUEST_ID_HEADER
        ));
        configuration.setExposedHeaders(List.of("ETag", RequestLoggingFilter.REQUEST_ID_HEADER));
        configuration.setAllowCredentials(true);
        configuration.setMaxAge(3600L);

        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/api/**", configuration);
        return source;
    }
}
