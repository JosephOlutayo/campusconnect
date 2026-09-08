package app.campusconnect.web;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.dao.CannotAcquireLockException;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.dao.PessimisticLockingFailureException;
import com.fasterxml.jackson.databind.exc.MismatchedInputException;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException;

import java.util.List;

/**
 * One error funnel for the whole API. Domain failures carry their own status;
 * anything unexpected is logged server-side and returned as a generic 500 so
 * internals never leak to a client.
 *
 * Scoped to this package deliberately. Unscoped, it also caught exceptions from
 * the page controllers and answered them with JSON — which a browser asking for
 * HTML cannot accept, so the response died as a blank 500 instead of showing
 * the message. Pages are handled by ViewExceptionHandler.
 *
 * Every response here also pins Content-Type to JSON. Left to negotiate, a
 * request that asks for HTML — somebody opening an /api/ URL in a browser —
 * finds no converter that can answer it, and the error dies as a blank 500.
 */
@RestControllerAdvice(basePackages = "app.campusconnect.web")
public class GlobalExceptionHandler {

    private static final Logger log = LoggerFactory.getLogger(GlobalExceptionHandler.class);

    @ExceptionHandler(ApiException.class)
    public ResponseEntity<ApiResponse<Void>> handleApi(ApiException ex) {
        return ResponseEntity.status(ex.getStatus()).contentType(MediaType.APPLICATION_JSON).body(ApiResponse.fail(ex.getMessage()));
    }

    /** Bean-validation failures become a 422 with per-field detail. */
    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<ApiResponse<Void>> handleValidation(MethodArgumentNotValidException ex) {
        List<ApiResponse.FieldIssue> issues = ex.getBindingResult().getFieldErrors().stream()
                .map(error -> new ApiResponse.FieldIssue(error.getField(), error.getDefaultMessage()))
                .toList();
        String first = issues.isEmpty() ? "Invalid input." : issues.get(0).message();
        return ResponseEntity.unprocessableEntity().contentType(MediaType.APPLICATION_JSON).body(ApiResponse.fail(first, issues));
    }

    /**
     * Two students hitting the same slot can surface as a lock timeout or a
     * serialisation failure rather than our own overlap check. Either way the
     * honest answer to the loser is "that time just went", not "server error".
     */
    @ExceptionHandler({PessimisticLockingFailureException.class, CannotAcquireLockException.class})
    public ResponseEntity<ApiResponse<Void>> handleLock(Exception ex) {
        log.debug("Lock contention on booking write", ex);
        return ResponseEntity.status(HttpStatus.CONFLICT).contentType(MediaType.APPLICATION_JSON)
                .body(ApiResponse.fail("That time was just booked. Please choose another slot."));
    }

    @ExceptionHandler(DataIntegrityViolationException.class)
    public ResponseEntity<ApiResponse<Void>> handleIntegrity(DataIntegrityViolationException ex) {
        log.debug("Constraint violation", ex);
        return ResponseEntity.status(HttpStatus.CONFLICT).contentType(MediaType.APPLICATION_JSON)
                .body(ApiResponse.fail("That conflicts with something that already exists."));
    }

    /**
     * A malformed id in the path is a client mistake, not a server fault —
     * without this it surfaces as a 500 and hides real errors in the logs.
     */
    @ExceptionHandler(MethodArgumentTypeMismatchException.class)
    public ResponseEntity<ApiResponse<Void>> handleBadParam(MethodArgumentTypeMismatchException ex) {
        return ResponseEntity.badRequest().contentType(MediaType.APPLICATION_JSON)
                .body(ApiResponse.fail("Invalid value for '" + ex.getName() + "'."));
    }

    /**
     * A body Jackson cannot read is the caller's mistake too. This shows up
     * when a field's shape is wrong — sending a JSON array where the API wants
     * a comma-separated string, say — and a 500 there sends people hunting for
     * a server fault that does not exist.
     */
    @ExceptionHandler(HttpMessageNotReadableException.class)
    public ResponseEntity<ApiResponse<Void>> handleUnreadableBody(HttpMessageNotReadableException ex) {
        String field = "";
        if (ex.getCause() instanceof MismatchedInputException mie && !mie.getPath().isEmpty()) {
            String name = mie.getPath().get(mie.getPath().size() - 1).getFieldName();
            if (name != null) {
                field = " Check the '" + name + "' field.";
            }
        }
        return ResponseEntity.badRequest().contentType(MediaType.APPLICATION_JSON)
                .body(ApiResponse.fail("That request body could not be read." + field));
    }

    @ExceptionHandler(AccessDeniedException.class)
    public ResponseEntity<ApiResponse<Void>> handleDenied(AccessDeniedException ex) {
        return ResponseEntity.status(HttpStatus.FORBIDDEN).contentType(MediaType.APPLICATION_JSON).body(ApiResponse.fail("Not allowed."));
    }

    @ExceptionHandler(Exception.class)
    public ResponseEntity<ApiResponse<Void>> handleUnexpected(Exception ex) {
        log.error("Unhandled exception", ex);
        return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).contentType(MediaType.APPLICATION_JSON)
                .body(ApiResponse.fail("Something went wrong. Please try again."));
    }
}
