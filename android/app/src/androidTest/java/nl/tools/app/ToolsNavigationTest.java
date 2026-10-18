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
        while (SystemClock.uptimeMillis() < deadline) {
            assertNotEquals("App closed while navigating", Lifecycle.State.DESTROYED, scenario.getState());
            scenario.onActivity(activity -> {
                String url = activity.getBridge().getWebView().getUrl();
                boolean matching = suffix == null
                        ? HomeNavigation.isLandingPage(url, activity.getBridge().getAppUrl())
                        : url != null && url.endsWith(suffix);
                ready.set(matching && activity.getBridge().getWebView().getProgress() == 100);
            });
            if (ready.get()) { device.waitForIdle(); return; }
            SystemClock.sleep(100);
        }
        fail("Page did not load: " + suffix);
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
}
