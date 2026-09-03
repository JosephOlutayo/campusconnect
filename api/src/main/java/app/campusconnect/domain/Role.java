package app.campusconnect.domain;

/**
 * Account role. Stored as a string via {@code @Enumerated(EnumType.STRING)} so the
 * column stays readable and adding a role later never renumbers existing rows.
 */
public enum Role {
    STUDENT,
    PROVIDER,
    ADMIN
}
