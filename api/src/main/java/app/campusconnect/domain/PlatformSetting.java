package app.campusconnect.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.Instant;

/**
 * Admin-tunable configuration — marketplace fee, provider auto-approve.
 * Key/value rather than columns so adding a setting needs no migration.
 */
@Entity
@Table(name = "platform_settings")
@Getter
@Setter
@NoArgsConstructor
public class PlatformSetting {

    public static final String PLATFORM_FEE_PERCENT = "platform_fee_percent";
    public static final String PROVIDER_AUTO_APPROVE = "provider_auto_approve";

    @Id
    @Column(name = "setting_key", length = 80)
    private String key;

    @Column(name = "setting_value", nullable = false, length = 500)
    private String value;

    @Column(nullable = false)
    private Instant updatedAt = Instant.now();

    public PlatformSetting(String key, String value) {
        this.key = key;
        this.value = value;
    }
}
