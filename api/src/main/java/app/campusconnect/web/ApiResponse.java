package app.campusconnect.web;

import java.util.List;

/**
 * The response envelope: {@code {ok, data}} or {@code {ok, error}}.
 *
 * Deliberately identical to what the existing Next.js client already parses, so
 * swapping the TypeScript backend for this one is a base-URL change on the
 * client rather than a rewrite of every fetch call.
 */
public record ApiResponse<T>(boolean ok, T data, String error, List<FieldIssue> issues) {

    public record FieldIssue(String path, String message) {
    }

    public static <T> ApiResponse<T> ok(T data) {
        return new ApiResponse<>(true, data, null, null);
    }

    public static <T> ApiResponse<T> fail(String error) {
        return new ApiResponse<>(false, null, error, null);
    }

    public static <T> ApiResponse<T> fail(String error, List<FieldIssue> issues) {
        return new ApiResponse<>(false, null, error, issues);
    }
}
