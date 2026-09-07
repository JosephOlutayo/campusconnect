package app.campusconnect.view;

import app.campusconnect.web.ApiException;
import jakarta.servlet.http.HttpServletResponse;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.ui.Model;
import org.springframework.web.bind.annotation.ControllerAdvice;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException;

/**
 * Errors from the page controllers, rendered as pages.
 *
 * Scoped to this package so it takes precedence over the API's
 * @RestControllerAdvice for these handlers only. Without it, a person who
 * mistypes a URL is shown a raw JSON envelope — correct for a client, useless
 * to somebody in a browser.
 *
 * The template is called page-error, not error: Spring Boot resolves a view
 * literally named "error" for its own fallback error page, and taking that name
 * would start answering API failures with HTML too.
 */
@ControllerAdvice(basePackages = "app.campusconnect.view")
public class ViewExceptionHandler {

    private static final Logger log = LoggerFactory.getLogger(ViewExceptionHandler.class);

    @ExceptionHandler(ApiException.class)
    public String handleApi(ApiException ex, HttpServletResponse response, Model model) {
        response.setStatus(ex.getStatus().value());
        model.addAttribute("status", ex.getStatus().value());
        model.addAttribute("message", ex.getMessage());
        return "page-error";
    }

    /** A malformed id in the path is a mistyped address, not a server fault. */
    @ExceptionHandler(MethodArgumentTypeMismatchException.class)
    public String handleBadParam(HttpServletResponse response, Model model) {
        response.setStatus(HttpStatus.NOT_FOUND.value());
        model.addAttribute("status", 404);
        model.addAttribute("message", "That address does not point at anything.");
        return "page-error";
    }

    /**
     * Anything unexpected is logged in full here and shown as a generic page —
     * an exception message can carry internals, and a page is read by whoever
     * happens to be looking.
     */
    @ExceptionHandler(Exception.class)
    public String handleUnexpected(Exception ex, HttpServletResponse response, Model model) {
        log.error("Unhandled error rendering a page", ex);
        response.setStatus(HttpStatus.INTERNAL_SERVER_ERROR.value());
        model.addAttribute("status", 500);
        model.addAttribute("message", "Something went wrong on our side. Please try again.");
        return "page-error";
    }
}
