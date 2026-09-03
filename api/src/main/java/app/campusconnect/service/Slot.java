package app.campusconnect.service;

import java.time.LocalDateTime;

/** One offerable appointment time. */
public record Slot(LocalDateTime startAt, LocalDateTime endAt) {
}
