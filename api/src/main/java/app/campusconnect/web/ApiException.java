package app.campusconnect.web;

import org.springframework.http.HttpStatus;

/**
 * A failure that is safe to show a user. Anything else becomes a generic 500 in
 * {@link GlobalExceptionHandler}, so internals never leak to the client.
 */
public class ApiException extends RuntimeException {

    private final HttpStatus status;

    public ApiException(String message, HttpStatus status) {
        super(message);
        this.status = status;
    }

    public HttpStatus getStatus() {
        return status;
    }

    public static ApiException badRequest(String message) {
        return new ApiException(message, HttpStatus.BAD_REQUEST);
    }

    public static ApiException notFound(String message) {
        return new ApiException(message, HttpStatus.NOT_FOUND);
    }

    public static ApiException forbidden(String message) {
        return new ApiException(message, HttpStatus.FORBIDDEN);
    }

    public static ApiException unauthorized(String message) {
        return new ApiException(message, HttpStatus.UNAUTHORIZED);
    }

    /** Used when a slot was taken between rendering and submitting. */
    public static ApiException conflict(String message) {
        return new ApiException(message, HttpStatus.CONFLICT);
    }
}
