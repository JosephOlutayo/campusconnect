package app.campusconnect.service;

import app.campusconnect.domain.PlatformSetting;
import app.campusconnect.repository.PlatformSettingRepository;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Admin-tunable platform config, with the .env value as a fallback so a fresh
 * database still behaves sensibly before anyone opens the settings screen.
 */
@Service
public class SettingsService {

    private final PlatformSettingRepository settings;
    private final double defaultFeePercent;

    public SettingsService(PlatformSettingRepository settings,
                           @Value("${campusconnect.platform-fee-percent:10}") double defaultFeePercent) {
        this.settings = settings;
        this.defaultFeePercent = defaultFeePercent;
    }

    @Transactional(readOnly = true)
    public double platformFeePercent() {
        return settings.findById(PlatformSetting.PLATFORM_FEE_PERCENT)
                .map(PlatformSetting::getValue)
                .map(value -> {
                    try {
                        double parsed = Double.parseDouble(value);
                        return (parsed < 0 || parsed > 100) ? defaultFeePercent : parsed;
                    } catch (NumberFormatException ignored) {
                        return defaultFeePercent;
                    }
                })
                .orElse(defaultFeePercent);
    }

    @Transactional(readOnly = true)
    public boolean providerAutoApprove() {
        return settings.findById(PlatformSetting.PROVIDER_AUTO_APPROVE)
                .map(setting -> Boolean.parseBoolean(setting.getValue()))
                .orElse(true);
    }

    @Transactional
    public void put(String key, String value) {
        PlatformSetting setting = settings.findById(key).orElseGet(() -> new PlatformSetting(key, value));
        setting.setValue(value);
        settings.save(setting);
    }
}
