package nl.tools.app;

import org.junit.Test;
import static org.junit.Assert.*;

public class HomeNavigationTest {
    private static final String APP = "https://localhost";

    @Test public void onlyLocalLandingPagesMayExit() {
        assertTrue(HomeNavigation.isLandingPage(APP, APP));
        assertTrue(HomeNavigation.isLandingPage(APP + "/", APP));
        assertTrue(HomeNavigation.isLandingPage(APP + "/index.html", APP));
        assertTrue(HomeNavigation.isLandingPage(APP + "/index.html?mode=dark#top", APP));
        assertTrue(HomeNavigation.isLandingPage("https://LOCALHOST:443/index.html", APP));
    }

    @Test public void toolsAlwaysReturnHome() {
        for (String tool : new String[]{"kopermetingen", "tv-codes", "fiber%20route", "pop-checklist", "info"}) {
            assertFalse(tool, HomeNavigation.isLandingPage(APP + "/tools/" + tool + "/index.html", APP));
        }
    }

    @Test public void missingErrorAndExternalPagesMustNotExit() {
        for (String url : new String[]{null, "", "about:blank", "chrome-error://chromewebdata/", "invalid URL",
                "https://example.com/index.html", "http://localhost/index.html", "https://localhost:8443/index.html",
                "https://localhost/missing.html", "https://user@localhost/index.html"}) {
            assertFalse(String.valueOf(url), HomeNavigation.isLandingPage(url, APP));
        }
    }

    @Test public void projectSubpathsAreRespected() {
        String base = "https://localhost/ToolsAPK/";
        assertEquals(base + "index.html", HomeNavigation.landingUrl(base));
        assertTrue(HomeNavigation.isLandingPage(base, base));
        assertTrue(HomeNavigation.isLandingPage(base + "index.html", base));
        assertFalse(HomeNavigation.isLandingPage(APP + "/index.html", base));
    }

    @Test public void defaultLandingAddressIsExplicit() {
        assertEquals("https://localhost/index.html", HomeNavigation.landingUrl(null));
        assertEquals("https://localhost/index.html", HomeNavigation.landingUrl(APP));
    }
}
