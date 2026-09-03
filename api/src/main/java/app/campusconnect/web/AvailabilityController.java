package app.campusconnect.web;

import app.campusconnect.service.AvailabilityService;
import app.campusconnect.web.dto.BookingDtos.SlotDto;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * The two shapes the calendar UI needs:
 *   ?date=YYYY-MM-DD  -> bookable start times that day
 *   ?from=...&days=N  -> which days in the window have anything at all
 */
@RestController
@Transactional(readOnly = true)
@RequestMapping("/api/availability")
public class AvailabilityController {

    private final AvailabilityService availabilityService;

    public AvailabilityController(AvailabilityService availabilityService) {
        this.availabilityService = availabilityService;
    }

    @GetMapping
    public ApiResponse<Map<String, Object>> availability(
            @RequestParam UUID serviceId,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam(required = false, defaultValue = "30") int days,
            @RequestParam(required = false) UUID exclude) {

        if (date != null) {
            List<SlotDto> slots = availabilityService.slotsForDay(serviceId, date, exclude).stream()
                    .map(slot -> new SlotDto(slot.startAt(), slot.endAt()))
                    .toList();
            return ApiResponse.ok(Map.of("date", date.toString(), "slots", slots));
        }

        LocalDate start = from == null ? LocalDate.now() : from;
        int window = Math.min(90, Math.max(1, days));
        List<LocalDate> open = availabilityService.openDays(serviceId, start, window, exclude);

        return ApiResponse.ok(Map.of(
                "from", start.toString(),
                "to", start.plusDays(window).toString(),
                "openDays", open.stream().map(LocalDate::toString).toList()));
    }

    /** Convenience for the "Next available" line on a provider profile. */
    @GetMapping("/next")
    public ApiResponse<Map<String, Object>> next(@RequestParam UUID providerId,
                                                 @RequestParam int durationMinutes,
                                                 @RequestParam(defaultValue = "21") int lookaheadDays) {
        var when = availabilityService.nextAvailable(providerId, durationMinutes, lookaheadDays);
        return ApiResponse.ok(when == null
                ? Map.of("nextAvailable", "")
                : Map.of("nextAvailable", when.toString()));
    }

    /** Exposed for tests and debugging: is this exact time still offerable? */
    @GetMapping("/check")
    public ApiResponse<Map<String, Object>> check(
            @RequestParam UUID serviceId,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) java.time.LocalDateTime startAt,
            @RequestParam(required = false) UUID exclude) {
        boolean offered = availabilityService.isSlotOffered(serviceId, startAt, exclude);
        return ApiResponse.ok(Map.of("offered", offered));
    }
}
