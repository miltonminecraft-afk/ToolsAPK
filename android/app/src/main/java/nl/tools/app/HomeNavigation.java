package nl.tools.app;

import java.net.URI;

/** Identifies the local landing page without relying on WebView history. */
final class HomeNavigation {
    private HomeNavigation() {}

    static String landingUrl(String appUrl) {
        String base = appUrl == null || appUrl.trim().isEmpty()
                ? "https://localhost/" : appUrl;
        return URI.create(base).resolve("./index.html").toString();
    }

    static boolean isLandingPage(String currentUrl, String appUrl) {
        if (currentUrl == null || currentUrl.trim().isEmpty()) return false;
        try {
            URI current = URI.create(currentUrl).normalize();
            URI home = URI.create(landingUrl(appUrl)).normalize();
            if (current.getHost() == null || home.getHost() == null
                    || current.getUserInfo() != null
                    || !home.getScheme().equalsIgnoreCase(current.getScheme())
                    || !home.getHost().equalsIgnoreCase(current.getHost())
                    || effectivePort(current) != effectivePort(home)) return false;
            String directory = home.resolve("./").getPath();
            String path = current.getPath();
            return home.getPath().equals(path) || directory.equals(path)
                    || ("/".equals(directory) && (path == null || path.isEmpty()));
        } catch (IllegalArgumentException error) {
            return false;
        }
    }

    private static int effectivePort(URI uri) {
        if (uri.getPort() >= 0) return uri.getPort();
        return "https".equalsIgnoreCase(uri.getScheme()) ? 443 : 80;
    }
}
