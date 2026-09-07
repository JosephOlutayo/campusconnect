package app.campusconnect.security;

import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.AuthenticationException;
import org.springframework.security.web.AuthenticationEntryPoint;
import org.springframework.security.web.access.AccessDeniedHandler;
import org.springframework.stereotype.Component;

import java.io.IOException;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.util.LinkedHashMap;
import java.util.Map;

/**
 * Makes 401s and 403s useful, for both kinds of caller.
 *
 * Spring Security's defaults send an empty body, which means an API client that
 * parses {ok, data, error} on every call gets a parse error instead of a usable
 * message. So API callers get that envelope.
 *
 * A browser asking for a page is a different situation: showing someone raw
 * JSON reading "sign in to continue" is not an answer, it is a dead end. Those
 * are redirected to the sign-in page, with where they were headed remembered.
 */
@Component
public class JsonAuthEntryPoint implements AuthenticationEntryPoint, AccessDeniedHandler {

    private final ObjectMapper mapper = new ObjectMapper();

    private void write(HttpServletResponse response, HttpStatus status, String message)
            throws IOException {
        response.setStatus(status.value());
        response.setContentType(MediaType.APPLICATION_JSON_VALUE);
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("ok", false);
        body.put("error", message);
        mapper.writeValue(response.getOutputStream(), body);
    }

    /**
     * A page request from a browser, rather than a call from a script.
     *
     * Decided on what the caller asked for, not the path: an HTML page under
     * /api would still be a page, and a fetch() for JSON under /admin is still
     * a script.
     */
    private boolean wantsHtml(HttpServletRequest request) {
        String accept = request.getHeader(HttpHeaders.ACCEPT);
        return accept != null
                && accept.contains(MediaType.TEXT_HTML_VALUE)
                && !request.getRequestURI().startsWith("/api/");
    }

    /** Not signed in. */
    @Override
    public void commence(HttpServletRequest request, HttpServletResponse response,
                         AuthenticationException ex) throws IOException {
        if (wantsHtml(request)) {
            // Remember where they were going, so signing in resumes it rather
            // than dumping them on the home page.
            String target = request.getRequestURI();
            response.sendRedirect("/login?next="
                    + URLEncoder.encode(target, StandardCharsets.UTF_8));
            return;
        }
        write(response, HttpStatus.UNAUTHORIZED, "Sign in to continue.");
    }

    /** Signed in, but not allowed to do this. */
    @Override
    public void handle(HttpServletRequest request, HttpServletResponse response,
                       AccessDeniedException ex) throws IOException {
        if (wantsHtml(request)) {
            // Signing in again would not help — they are already signed in and
            // still not allowed — so send them somewhere that works.
            response.sendRedirect("/?denied=1");
            return;
        }
        write(response, HttpStatus.FORBIDDEN, "You do not have access to that.");
    }
}
