package app.campusconnect.security;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;

import java.util.Arrays;
import java.util.List;

@Configuration
@EnableMethodSecurity
public class SecurityConfig {

    private final JwtAuthFilter jwtAuthFilter;
    private final JsonAuthEntryPoint jsonAuthEntryPoint;
    private final String corsOrigins;

    public SecurityConfig(JwtAuthFilter jwtAuthFilter,
                          JsonAuthEntryPoint jsonAuthEntryPoint,
                          @Value("${campusconnect.cors-origins}") String corsOrigins) {
        this.jwtAuthFilter = jwtAuthFilter;
        this.jsonAuthEntryPoint = jsonAuthEntryPoint;
        this.corsOrigins = corsOrigins;
    }

    @Bean
    public PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder(10);
    }

    @Bean
    public CorsConfigurationSource corsConfigurationSource() {
        CorsConfiguration config = new CorsConfiguration();
        config.setAllowedOrigins(Arrays.stream(corsOrigins.split(",")).map(String::trim).toList());
        config.setAllowedMethods(List.of("GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"));
        config.setAllowedHeaders(List.of("*"));
        // Required for the cc_token cookie to travel cross-origin from Next.js.
        config.setAllowCredentials(true);

        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/**", config);
        return source;
    }

    @Bean
    public SecurityFilterChain filterChain(HttpSecurity http) throws Exception {
        http
                .cors(cors -> cors.configurationSource(corsConfigurationSource()))
                // Stateless JWT: there is no session cookie for CSRF to protect,
                // and the token is sent explicitly rather than ambiently.
                .csrf(csrf -> csrf.disable())
                .sessionManagement(session ->
                        session.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
                .authorizeHttpRequests(auth -> auth
                        // Server-rendered pages and their assets. Browsing the
                        // marketplace has never needed an account, and the HTML
                        // pages are the same content the JSON endpoints serve.
                        .requestMatchers(HttpMethod.GET,
                                "/", "/explore", "/categories", "/campuses",
                                "/providers/**", "/campuses/**", "/legal/**",
                                "/login", "/signup", "/verify-email",
                                "/css/**", "/js/**", "/favicon.ico",
                                "/icon-*.png", "/apple-touch-icon.png",
                                "/manifest.webmanifest").permitAll()
                        // The HTML sign-in and sign-up forms post here.
                        // Without this any server-side error is answered with 401
                        // instead of its real status, which sends you hunting for an
                        // auth problem that does not exist.
                        .requestMatchers("/error").permitAll()
                        .requestMatchers(HttpMethod.POST, "/login", "/signup").permitAll()
                        .requestMatchers("/api/auth/**").permitAll()
                        // Browsing the marketplace does not require an account.
                        // Note /api/stats/me is deliberately NOT here — campus
                        // figures are public, a person's own numbers are not.
                        .requestMatchers(HttpMethod.GET,
                                "/api/search/**",
                                "/api/providers/**",
                                "/api/categories/**",
                                "/api/universities/**",
                                "/api/availability/**",
                                "/api/stats/campus",
                                "/api/stats/settings").permitAll()
                        // Server-rendered pages anyone may see, plus the assets
                        // they pull. Signed-in pages fall through to authenticated
                        // below, same as the API.
                        .requestMatchers(HttpMethod.GET,
                                "/",
                                "/explore",
                                "/categories",
                                "/campuses",
                                "/campuses/**",
                                "/providers/**",
                                "/login",
                                "/signup",
                                "/verify-email",
                                "/legal/**").permitAll()
                        .requestMatchers(
                                "/css/**",
                                "/js/**",
                                "/images/**",
                                "/favicon.ico",
                                "/manifest.webmanifest",
                                "/apple-touch-icon.png",
                                "/icon-*.png").permitAll()
                        .requestMatchers("/ws/**").permitAll()
                        .requestMatchers("/h2-console/**").permitAll()
                        .requestMatchers("/actuator/health").permitAll()
                        .requestMatchers("/api/admin/**").hasRole("ADMIN")
                        // The server-rendered console needs the same role as
                        // the JSON endpoints behind it. Without this line the
                        // pages fall through to anyRequest().authenticated(),
                        // which any signed-in student satisfies.
                        .requestMatchers("/admin/**").hasRole("ADMIN")
                        .anyRequest().authenticated())
                // 401/403 come back as the same {ok,error} envelope as everything else.
                .exceptionHandling(handling -> handling
                        .authenticationEntryPoint(jsonAuthEntryPoint)
                        .accessDeniedHandler(jsonAuthEntryPoint))
                .addFilterBefore(jwtAuthFilter, UsernamePasswordAuthenticationFilter.class)
                // The H2 console renders in a frame; only relevant in dev.
                .headers(headers -> headers.frameOptions(frame -> frame.sameOrigin()));

        return http.build();
    }
}
