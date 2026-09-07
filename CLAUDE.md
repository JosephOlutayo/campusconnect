# CampusConnect

A Java web application: Spring Boot serves both the HTML pages (Thymeleaf) and
the JSON API from one process. There is no separate frontend and no Node in the
build — this is a class project with a Java requirement, so JavaScript stays a
progressive-enhancement layer (`api/src/main/resources/static/js/app.js`) and
never a rendering layer.

- Pages: `api/src/main/java/app/campusconnect/view/` + `resources/templates/`
- API: `api/src/main/java/app/campusconnect/web/`
- Backend detail (slot engine, locking, payments, JWT): `api/README.md`

Two things bite repeatedly and are worth remembering:

- **`open-in-view` is off.** Anything a template reads must be touched inside the
  controller's transaction, or the page fails while rendering.
- **The app is STATELESS.** Flash attributes are silently discarded, so messages
  that need to survive a redirect travel as query parameters.
