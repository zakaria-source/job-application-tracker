package dev.jobtrackr.gmail;

import dev.jobtrackr.gmail.dto.GmailAuthorizationResponse;
import dev.jobtrackr.gmail.dto.GmailStatusResponse;
import dev.jobtrackr.gmail.dto.GmailSyncResponse;
import dev.jobtrackr.security.CurrentUser;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import java.net.URI;

@RestController
@RequestMapping("/api/v1/gmail")
public class GmailController {
    private final GmailOAuthService oauth;
    private final GmailSyncService sync;

    public GmailController(GmailOAuthService oauth, GmailSyncService sync) {
        this.oauth = oauth;
        this.sync = sync;
    }

    @GetMapping("/status")
    public GmailStatusResponse status(@AuthenticationPrincipal Jwt jwt) {
        return sync.status(CurrentUser.id(jwt));
    }

    @GetMapping("/authorization-url")
    public GmailAuthorizationResponse authorizationUrl(@AuthenticationPrincipal Jwt jwt) {
        return oauth.authorizationUrl(CurrentUser.id(jwt));
    }

    @GetMapping("/oauth/callback")
    public ResponseEntity<Void> callback(
        @RequestParam(required = false) String code,
        @RequestParam(required = false) String state,
        @RequestParam(required = false) String error
    ) {
        URI redirect = oauth.callback(code, state, error);
        return ResponseEntity.status(HttpStatus.FOUND)
            .header(HttpHeaders.LOCATION, redirect.toString())
            .build();
    }

    @PostMapping("/sync")
    public GmailSyncResponse synchronize(@AuthenticationPrincipal Jwt jwt) {
        return sync.syncUser(CurrentUser.id(jwt));
    }

    @DeleteMapping
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void disconnect(@AuthenticationPrincipal Jwt jwt) {
        sync.disconnect(CurrentUser.id(jwt));
    }
}
