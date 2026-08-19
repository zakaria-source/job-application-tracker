package dev.jobtrackr.security;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContext;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.security.oauth2.jwt.JwtException;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.List;

@Component
public class CookieJwtAuthenticationFilter extends OncePerRequestFilter {
    private static final List<SimpleGrantedAuthority> USER_AUTHORITIES =
        List.of(new SimpleGrantedAuthority("ROLE_USER"));

    private final SessionCookieService cookies;
    private final JwtDecoder decoder;

    public CookieJwtAuthenticationFilter(SessionCookieService cookies, JwtDecoder decoder) {
        this.cookies = cookies;
        this.decoder = decoder;
    }

    @Override
    protected void doFilterInternal(
        HttpServletRequest request,
        HttpServletResponse response,
        FilterChain filterChain
    ) throws ServletException, IOException {
        if (SecurityContextHolder.getContext().getAuthentication() == null) {
            String encoded = cookies.resolve(request);
            if (encoded != null) {
                try {
                    Jwt jwt = decoder.decode(encoded);
                    JwtAuthenticationToken authentication = new JwtAuthenticationToken(jwt, USER_AUTHORITIES);
                    SecurityContext context = SecurityContextHolder.createEmptyContext();
                    context.setAuthentication(authentication);
                    SecurityContextHolder.setContext(context);
                } catch (JwtException ignored) {
                    // Invalid/expired access cookies remain unauthenticated. The
                    // authorization layer returns 401 so Angular can attempt refresh.
                }
            }
        }

        filterChain.doFilter(request, response);
    }
}
