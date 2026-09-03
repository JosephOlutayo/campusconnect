package app.campusconnect.web.dto;

import app.campusconnect.domain.User;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.util.UUID;

public final class AuthDtos {

    private AuthDtos() {
    }

    public record SignupRequest(
            @NotBlank(message = "Tell us your name.")
            @Size(min = 2, max = 80, message = "Tell us your name.")
            String name,

            @NotBlank(message = "Enter your email.")
            @Email(message = "That does not look like a valid email.")
            String email,

            @NotBlank(message = "Passwords need at least 8 characters.")
            @Size(min = 8, max = 200, message = "Passwords need at least 8 characters.")
            String password,

            @NotNull(message = "Pick your university.")
            UUID universityId,

            /** STUDENT or PROVIDER — only decides where we land after signup. */
            String intent) {
    }

    public record LoginRequest(
            @NotBlank(message = "Enter your email.") String email,
            @NotBlank(message = "Enter your password.") String password) {
    }

    /** Never contains the password hash. */
    public record UserDto(UUID id, String email, String name, String role, String avatarSeed,
                          String bio, String phone, UUID universityId, String universityName,
                          String universityShortName, boolean studentVerified,
                          UUID providerProfileId, String providerBusinessName) {

        public static UserDto of(User user) {
            var provider = user.getProviderProfile();
            return new UserDto(
                    user.getId(), user.getEmail(), user.getName(), user.getRole().name(),
                    user.getAvatarSeed(), user.getBio(), user.getPhone(),
                    user.getUniversity() == null ? null : user.getUniversity().getId(),
                    user.getUniversity() == null ? null : user.getUniversity().getName(),
                    user.getUniversity() == null ? null : user.getUniversity().getShortName(),
                    user.isStudentVerified(),
                    provider == null ? null : provider.getId(),
                    provider == null ? null : provider.getBusinessName());
        }
    }

    /** Returned by signup and login. The token also lands in an httpOnly cookie. */
    public record SessionResponse(String token, UserDto user, String next, boolean studentVerified) {
    }

    public record ProfileUpdateRequest(
            @NotBlank @Size(min = 2, max = 80) String name,
            @Size(max = 600) String bio,
            @Size(max = 40) String phone,
            @NotNull UUID universityId) {
    }
}
