# --- build ------------------------------------------------------------------
# Dependencies resolve in their own layer so a code change does not re-download
# the whole Maven universe on every build.
FROM maven:3.9-eclipse-temurin-21 AS build
WORKDIR /build

COPY pom.xml .
RUN mvn -B -q dependency:go-offline

COPY src ./src
RUN mvn -B -q clean package -DskipTests

# --- run --------------------------------------------------------------------
FROM eclipse-temurin:21-jre-alpine
WORKDIR /app

# Never run the API as root.
RUN addgroup --system app && adduser --system --ingroup app app
COPY --from=build /build/target/campusconnect-api-*.jar app.jar
USER app

EXPOSE 8080

# Container memory is not the host's memory; let the JVM read the cgroup limit.
ENV JAVA_OPTS="-XX:MaxRAMPercentage=75 -XX:+UseSerialGC"
ENV SPRING_PROFILES_ACTIVE=prod

ENTRYPOINT ["sh", "-c", "exec java $JAVA_OPTS -jar app.jar"]
