package nl.tools.app;

import android.Manifest;
import android.app.Activity;
import android.os.SystemClock;
import androidx.lifecycle.Lifecycle;
import androidx.test.core.app.ActivityScenario;
import androidx.test.ext.junit.runners.AndroidJUnit4;
import androidx.test.platform.app.InstrumentationRegistry;
import androidx.test.rule.GrantPermissionRule;
import androidx.test.runner.lifecycle.ActivityLifecycleMonitorRegistry;
import androidx.test.runner.lifecycle.Stage;
import androidx.test.uiautomator.UiDevice;
import org.junit.After;
import org.junit.Before;
import org.junit.Rule;
import org.junit.Test;
import org.junit.runner.RunWith;
import java.io.File;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.concurrent.atomic.AtomicReference;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;
import org.json.JSONArray;
import org.json.JSONObject;
import static org.junit.Assert.*;
import static androidx.test.espresso.Espresso.onView;
import static androidx.test.espresso.action.ViewActions.click;
import static androidx.test.espresso.matcher.ViewMatchers.withText;

@RunWith(AndroidJUnit4.class)
public class ToolsNavigationTest {
    @Rule public GrantPermissionRule camera = GrantPermissionRule.grant(Manifest.permission.CAMERA);
    private ActivityScenario<MainActivity> scenario;
    private UiDevice device;

    @Before public void launch() {
        device = UiDevice.getInstance(InstrumentationRegistry.getInstrumentation());
        scenario = ActivityScenario.launch(MainActivity.class);
        awaitPage(null);
    }

    @After public void close() {
        if (scenario != null) scenario.close();
    }

    private void openTool(String path) {
        scenario.onActivity(activity -> activity.getBridge().getWebView().loadUrl(
                activity.getBridge().getAppUrl() + "/tools/" + path + "/index.html"));
        awaitPage("/tools/" + path + "/index.html");
    }

    private void awaitPage(String suffix) {
        long deadline = SystemClock.uptimeMillis() + 20000;
        AtomicBoolean ready = new AtomicBoolean();
        AtomicReference<String> diagnostic = new AtomicReference<>("no WebView observation");
        while (SystemClock.uptimeMillis() < deadline) {
            assertNotEquals("App closed while navigating", Lifecycle.State.DESTROYED, scenario.getState());
            scenario.onActivity(activity -> {
                String url = activity.getBridge().getWebView().getUrl();
                boolean matching = suffix == null
                        ? HomeNavigation.isLandingPage(url, activity.getBridge().getAppUrl())
                        : url != null && url.endsWith(suffix);
                int progress = activity.getBridge().getWebView().getProgress();
                diagnostic.set("url=" + url + " appUrl=" + activity.getBridge().getAppUrl()
                        + " home=" + HomeNavigation.landingUrl(activity.getBridge().getAppUrl())
                        + " progress=" + progress + " matching=" + matching);
                ready.set(matching && progress == 100);
            });
            if (ready.get()) { device.waitForIdle(); return; }
            SystemClock.sleep(100);
        }
        screenshot("failed-page-load");
        fail("Page did not load: " + suffix + " (" + diagnostic.get() + ")");
    }

    private void screenshot(String name) {
        File dir = new File(InstrumentationRegistry.getInstrumentation().getTargetContext()
                .getExternalFilesDir(null), "screenshots");
        dir.mkdirs();
        assertTrue(device.takeScreenshot(new File(dir, name + ".png")));
    }

    @Test public void hardwareBackFromEveryToolReturnsToHome() {
        for (String path : new String[]{"kopermetingen", "tv-codes", "fiber%20route", "pop-checklist", "assistant"}) {
            openTool(path);
            device.pressBack();
            awaitPage(null);
        }
        screenshot("hardware-back-home");
    }

    @Test public void gestureBackFromEveryMainToolReturnsToHome() {
        for (String path : new String[]{"kopermetingen", "tv-codes", "fiber%20route"}) {
            openTool(path);
            int y = device.getDisplayHeight() / 2;
            assertTrue(device.swipe(1, y, device.getDisplayWidth() / 2, y, 25));
            awaitPage(null);
        }
        screenshot("gesture-back-home");
    }

    @Test public void backOnHomeClosesTheActivity() {
        device.pressBack();
        long deadline = SystemClock.uptimeMillis() + 10000;
        while (scenario.getState() != Lifecycle.State.DESTROYED && SystemClock.uptimeMillis() < deadline) {
            SystemClock.sleep(100);
        }
        assertEquals(Lifecycle.State.DESTROYED, scenario.getState());
    }

    private void openHio() {
        openTool("kopermetingen");
        scenario.onActivity(activity -> activity.getBridge().getWebView().evaluateJavascript(
                "window.Android.startHioScan('{}')", null));
        long deadline = SystemClock.uptimeMillis() + 15000;
        AtomicBoolean visible = new AtomicBoolean();
        while (SystemClock.uptimeMillis() < deadline) {
            InstrumentationRegistry.getInstrumentation().runOnMainSync(() -> {
                for (Activity activity : ActivityLifecycleMonitorRegistry.getInstance()
                        .getActivitiesInStage(Stage.RESUMED)) {
                    if (activity instanceof HioScanActivity) visible.set(true);
                }
            });
            if (visible.get()) { device.waitForIdle(); return; }
            SystemClock.sleep(100);
        }
        fail("Native HIO scanner did not open through the JavaScript bridge");
    }

    @Test public void hioCancelReturnsToCopper() {
        openHio();
        onView(withText("Annuleren")).perform(click());
        awaitPage("/tools/kopermetingen/index.html");
        screenshot("hio-cancel-copper");
    }

    @Test public void hioBackReturnsToCopper() {
        openHio();
        device.pressBack();
        awaitPage("/tools/kopermetingen/index.html");
    }
    private String javascript(String script) throws Exception {
        CountDownLatch done = new CountDownLatch(1);
        AtomicReference<String> result = new AtomicReference<>();
        scenario.onActivity(activity -> activity.getBridge().getWebView().evaluateJavascript(script, value -> {
            result.set(value);
            done.countDown();
        }));
        assertTrue("JavaScript callback timed out", done.await(15, TimeUnit.SECONDS));
        return result.get();
    }

    @Test public void confirmedHioTransferPreservesSingleLettersPositionsAndOtherRoutes() throws Exception {
        openTool("kopermetingen");
        javascript("ensureStoredServiceId('KEEP12345');"
                + "state.services['KEEP12345']='dik2';"
                + "storeRouteForService('KEEP12345',{hvd:'OLD',kvds:['X'],routeLengths:{hvd:'',kvds:['']}});"
                + "captureOgOriginalRoute('KEEP12345',false);"
                + "window.hioOriginalOG=JSON.stringify(state.ogOriginalRoutes['KEEP12345']);");
        JSONArray points = new JSONArray();
        String[] names = {"A", "B", "AA", "AD"};
        for (int i = 0; i < names.length; i++) {
            points.put(new JSONObject().put("type", "kvd").put("name", names[i])
                    .put("vStijl", String.valueOf(i + 1)).put("vStift", String.valueOf(i + 11)));
        }
        JSONObject scan = new JSONObject().put("serviceId", "CJF12345").put("dikader", "1").put("items", points);
        javascript("window.receiveHioScanResult(" + scan + ")");
        assertEquals("true", javascript("document.getElementById('confirmModal').classList.contains('open')"));
        javascript("document.getElementById('acceptConfirmButton').click()");
        assertEquals("true", javascript("state.serviceRoutes['CJF12345'].kvds.join(',')==='A,B,AA,AD'"));
        assertEquals("true", javascript("state.serviceRouteInfo['CJF12345'].kvds[0].vStijl==='001'"
                + " && state.serviceRouteInfo['CJF12345'].kvds[3].vStift==='014'"));
        assertEquals("true", javascript("JSON.stringify(state.ogOriginalRoutes['KEEP12345'])===window.hioOriginalOG"
                + " && state.serviceRoutes['KEEP12345'].kvds.join(',')==='X'"));
        screenshot("hio-single-letter-transfer");
        // Reload the HTML document to exercise the existing localStorage format.
        openTool("kopermetingen");
        assertEquals("true", javascript("state.serviceRoutes['CJF12345'].kvds.join(',')==='A,B,AA,AD'"
                + " && state.serviceRoutes['KEEP12345'].kvds.join(',')==='X'"));
    }

}
