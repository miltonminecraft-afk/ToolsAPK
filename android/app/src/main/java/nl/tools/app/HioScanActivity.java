package nl.tools.app;

import android.Manifest;
import android.annotation.SuppressLint;
import android.app.Activity;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.graphics.Color;
import android.graphics.Typeface;
import android.graphics.drawable.GradientDrawable;
import android.media.Image;
import android.os.Bundle;
import android.os.SystemClock;
import android.util.Size;
import android.view.Gravity;
import android.widget.Button;
import android.widget.FrameLayout;
import android.widget.LinearLayout;
import android.widget.ScrollView;
import android.widget.TextView;

import androidx.annotation.NonNull;
import androidx.appcompat.app.AppCompatActivity;
import androidx.camera.core.CameraSelector;
import androidx.camera.core.ExperimentalGetImage;
import androidx.camera.core.ImageAnalysis;
import androidx.camera.core.ImageProxy;
import androidx.camera.core.Preview;
import androidx.camera.lifecycle.ProcessCameraProvider;
import androidx.camera.view.PreviewView;
import androidx.core.app.ActivityCompat;
import androidx.core.content.ContextCompat;

import com.google.common.util.concurrent.ListenableFuture;
import com.google.mlkit.vision.common.InputImage;
import com.google.mlkit.vision.text.Text;
import com.google.mlkit.vision.text.TextRecognition;
import com.google.mlkit.vision.text.TextRecognizer;
import com.google.mlkit.vision.text.latin.TextRecognizerOptions;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

import java.util.ArrayList;
import java.util.Collections;
import java.util.Comparator;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

public class HioScanActivity extends AppCompatActivity {
    private PreviewView previewView;
    private TextView resultText;
    private TextView statusText;
    private Button acceptButton;
    private Button tryAgainButton;
    private ExecutorService cameraExecutor;
    private TextRecognizer recognizer;
    private volatile boolean busy;
    private long lastScan;
    private HioResult bestResult;
    private final HashMap<String, Integer> kvdHits = new HashMap<>();
    private final HashSet<String> knownKvds = new HashSet<>();
    private HioAccumulator accumulator = new HioAccumulator();

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        cameraExecutor = Executors.newSingleThreadExecutor();
        recognizer = TextRecognition.getClient(TextRecognizerOptions.DEFAULT_OPTIONS);
        readContext(getIntent().getStringExtra("hioContext"));
        buildLayout();
        if (ContextCompat.checkSelfPermission(this, Manifest.permission.CAMERA) == PackageManager.PERMISSION_GRANTED) {
            startCamera();
        } else {
            ActivityCompat.requestPermissions(this, new String[]{Manifest.permission.CAMERA}, 44);
        }
    }

    private void buildLayout() {
        FrameLayout root = new FrameLayout(this);

        previewView = new PreviewView(this);
        previewView.setScaleType(PreviewView.ScaleType.FILL_CENTER);
        root.addView(previewView, new FrameLayout.LayoutParams(-1, -1));

        LinearLayout panel = new LinearLayout(this);
        panel.setOrientation(LinearLayout.VERTICAL);
        panel.setPadding(dp(14), dp(12), dp(14), dp(12));

        GradientDrawable panelBg = new GradientDrawable();
        panelBg.setColor(Color.argb(224, 0, 0, 0));
        panelBg.setStroke(dp(1), Color.argb(120, 255, 255, 255));
        panelBg.setCornerRadius(dp(12));
        panel.setBackground(panelBg);

        LinearLayout titleRow = new LinearLayout(this);
        titleRow.setOrientation(LinearLayout.HORIZONTAL);
        titleRow.setGravity(Gravity.CENTER_VERTICAL);

        TextView title = new TextView(this);
        title.setText("HIO herkenning");
        title.setTextColor(Color.rgb(224, 32, 32));
        title.setTypeface(Typeface.DEFAULT_BOLD);
        title.setTextSize(20);
        titleRow.addView(title, new LinearLayout.LayoutParams(0, -2, 1));

        tryAgainButton = new Button(this);
        tryAgainButton.setText("Try again");
        tryAgainButton.setTextSize(11);
        tryAgainButton.setAllCaps(false);
        tryAgainButton.setPadding(dp(8), 0, dp(8), 0);
        tryAgainButton.setOnClickListener(v -> resetScanMemory());
        titleRow.addView(tryAgainButton, new LinearLayout.LayoutParams(dp(92), dp(38)));

        panel.addView(titleRow, new LinearLayout.LayoutParams(-1, -2));

        statusText = new TextView(this);
        statusText.setText("Richt op het HIO scherm.");
        statusText.setTextColor(Color.rgb(168, 175, 189));
        statusText.setTextSize(14);
        statusText.setPadding(0, dp(6), 0, dp(4));
        panel.addView(statusText, new LinearLayout.LayoutParams(-1, -2));

        ScrollView scrollView = new ScrollView(this);
        resultText = new TextView(this);
        resultText.setText("Geen HIO waarden gevonden.");
        resultText.setTextColor(Color.WHITE);
        resultText.setTextSize(15);
        resultText.setTypeface(Typeface.MONOSPACE);
        resultText.setLineSpacing(0, 1.05f);
        scrollView.addView(resultText, new ScrollView.LayoutParams(-1, -2));
        panel.addView(scrollView, new LinearLayout.LayoutParams(-1, 0, 1));

        LinearLayout buttons = new LinearLayout(this);
        buttons.setOrientation(LinearLayout.HORIZONTAL);
        buttons.setGravity(Gravity.END);
        buttons.setPadding(0, dp(10), 0, 0);

        Button cancelButton = new Button(this);
        cancelButton.setText("Annuleren");
        cancelButton.setOnClickListener(v -> finish());
        buttons.addView(cancelButton, new LinearLayout.LayoutParams(0, dp(48), 1));

        acceptButton = new Button(this);
        acceptButton.setText("Overnemen");
        acceptButton.setEnabled(false);
        acceptButton.setOnClickListener(v -> returnResult());

        LinearLayout.LayoutParams acceptParams = new LinearLayout.LayoutParams(0, dp(48), 1);
        acceptParams.leftMargin = dp(8);
        buttons.addView(acceptButton, acceptParams);

        panel.addView(buttons, new LinearLayout.LayoutParams(-1, -2));

        FrameLayout.LayoutParams panelParams = new FrameLayout.LayoutParams(-1, dp(260));
        panelParams.gravity = Gravity.BOTTOM;
        panelParams.setMargins(dp(12), dp(12), dp(12), dp(12));
        root.addView(panel, panelParams);

        setContentView(root);
    }

    private void resetScanMemory() {
        clearScanMemoryOnly();
        resultText.setText("Geen HIO waarden gevonden.");
        statusText.setText("Opnieuw gestart. Eerst wordt de route-volgorde bepaald.");
        acceptButton.setEnabled(false);
    }

    private void clearScanMemoryOnly() {
        bestResult = null;
        accumulator = new HioAccumulator();
        kvdHits.clear();
    }

    private int dp(int value) {
        return Math.round(value * getResources().getDisplayMetrics().density);
    }

    private void startCamera() {
        ListenableFuture<ProcessCameraProvider> future = ProcessCameraProvider.getInstance(this);
        future.addListener(() -> {
            try {
                ProcessCameraProvider cameraProvider = future.get();

                Preview preview = new Preview.Builder().build();
                preview.setSurfaceProvider(previewView.getSurfaceProvider());

                ImageAnalysis analysis = new ImageAnalysis.Builder()
                        .setTargetResolution(new Size(1280, 720))
                        .setBackpressureStrategy(ImageAnalysis.STRATEGY_KEEP_ONLY_LATEST)
                        .build();

                analysis.setAnalyzer(cameraExecutor, this::analyzeImage);

                cameraProvider.unbindAll();
                cameraProvider.bindToLifecycle(this, CameraSelector.DEFAULT_BACK_CAMERA, preview, analysis);

                statusText.setText("Scan actief. Eerst wordt de route-volgorde bepaald.");
            } catch (Exception e) {
                statusText.setText("Camera kon niet worden gestart.");
            }
        }, ContextCompat.getMainExecutor(this));
    }

    @SuppressLint("UnsafeOptInUsageError")
    @ExperimentalGetImage
    private void analyzeImage(ImageProxy imageProxy) {
        long now = SystemClock.elapsedRealtime();

        if (busy || now - lastScan < 650) {
            imageProxy.close();
            return;
        }

        lastScan = now;

        Image mediaImage = imageProxy.getImage();
        if (mediaImage == null) {
            imageProxy.close();
            return;
        }

        busy = true;

        InputImage image = InputImage.fromMediaImage(mediaImage, imageProxy.getImageInfo().getRotationDegrees());

        recognizer.process(image)
                .addOnSuccessListener(this::handleText)
                .addOnFailureListener(e -> runOnUiThread(() -> statusText.setText("Tekstherkenning mislukt.")))
                .addOnCompleteListener(task -> {
                    busy = false;
                    imageProxy.close();
                });
    }

    private void handleText(Text text) {
        StringBuilder raw = new StringBuilder();

        for (Text.TextBlock block : text.getTextBlocks()) {
            for (Text.Line line : block.getLines()) {
                raw.append(line.getText()).append('\n');
            }
        }

        HioResult parsed = HioParser.parse(raw.toString());
        HioResult stable = stabilize(parsed);

        if (stable.score() > 0) {
            accumulator.add(stable);
            bestResult = accumulator.result();
            bestResult.cleanupForDisplay();

            runOnUiThread(() -> {
                resultText.setText(bestResult.displayText());
                if (bestResult.readyForAccept()) {
                    statusText.setText("Waarden gevonden. Controleer en druk op Overnemen.");
                    acceptButton.setEnabled(true);
                } else if (accumulator.routeLocked) {
                    statusText.setText("Route-volgorde staat vast. Posities worden nu gecontroleerd.");
                    acceptButton.setEnabled(false);
                } else {
                    statusText.setText("Route-volgorde bepalen. Houd het scherm stil.");
                    acceptButton.setEnabled(false);
                }
            });
        } else {
            runOnUiThread(() -> {
                if (bestResult == null) {
                    resultText.setText("Geen bevestigde HIO waarden.");
                    statusText.setText("Zoek naar Service ID, HVD, KVD, TFC, Stijl, Cassette, Stift en DA.");
                    acceptButton.setEnabled(false);
                }
            });
        }
    }

    private void readContext(String json) {
        if (json == null || json.trim().isEmpty()) return;

        try {
            JSONObject object = new JSONObject(json);
            JSONArray kvds = object.optJSONArray("kvds");

            if (kvds != null) {
                for (int i = 0; i < kvds.length(); i++) {
                    String name = cleanKvdName(kvds.optString(i));
                    if (!name.isEmpty()) knownKvds.add(name);
                }
            }
        } catch (JSONException ignored) {}
    }

    private HioResult stabilize(HioResult result) {
        HioResult stable = new HioResult();
        stable.serviceId = result.serviceId;
        stable.phone = result.phone;
        stable.dikader = result.dikader;
        stable.rawText = result.rawText;

        LinkedHashMap<String, RouteItem> map = new LinkedHashMap<>();

        for (RouteItem source : result.items) {
            RouteItem item = source.copy();

            if (item.type.equals("kvd")) {
                item.name = cleanKvdName(item.name);
                if (item.name.isEmpty()) continue;
            }

            if (item.type.equals("hvd")) {
                item.name = HioParser.cleanHvdName(item.name);
                if (item.name.isEmpty()) item.name = "HVD";
            }

            String key = item.type.equals("sip") ? "sip" : item.type + ":" + item.name;
            RouteItem existing = map.get(key);

            if (existing == null) {
                map.put(key, item);
            } else {
                existing.merge(item);
            }
        }

        for (RouteItem item : map.values()) {
            if (item.type.equals("kvd") && !acceptKvd(item)) continue;
            stable.items.add(item);
        }

        HioParser.sortItems(stable.items);
        stable.cleanupForDisplay();

        return stable;
    }

    private boolean acceptKvd(RouteItem item) {
        String name = cleanKvdName(item.name);
        if (name.isEmpty()) return false;

        boolean known = knownKvds.contains(name);
        int hits = kvdHits.containsKey(name) ? kvdHits.get(name) + 1 : 1;
        kvdHits.put(name, hits);

        if (known) return true;

        int threshold = hasVPair(item) ? 2 : 3;
        return hits >= threshold;
    }

    private boolean hasVPair(RouteItem item) {
        return !item.vStijl.isEmpty() && !item.vStift.isEmpty();
    }

    private String cleanKvdName(String value) {
        return HioParser.cleanKvdNameToken(value);
    }

    private void returnResult() {
        if (bestResult == null || !bestResult.readyForAccept()) return;

        bestResult.cleanupForDisplay();

        JSONObject payload = bestResult.toJson();
        Intent data = new Intent();
        data.putExtra("hioResult", payload.toString());
        setResult(Activity.RESULT_OK, data);
        clearScanMemoryOnly();
        finish();
    }

    @Override
    public void onRequestPermissionsResult(int requestCode, @NonNull String[] permissions, @NonNull int[] grantResults) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults);

        if (requestCode == 44 && grantResults.length > 0 && grantResults[0] == PackageManager.PERMISSION_GRANTED) {
            startCamera();
        } else {
            statusText.setText("Camera toestemming is nodig voor HIO scan.");
        }
    }

    @Override
    protected void onDestroy() {
        super.onDestroy();

        if (recognizer != null) recognizer.close();
        if (cameraExecutor != null) cameraExecutor.shutdown();
    }

    static class HioAccumulator {
        ValueCounter serviceIds = new ValueCounter("service");
        PlainTextCounter phones = new PlainTextCounter();
        ValueCounter dikaders = new ValueCounter("dikader");
        PairCounter sipPairs = new PairCounter("SIP_IN");
        TextCounter sipRij = new TextCounter();
        LinkedHashMap<String, RouteCounter> hvds = new LinkedHashMap<>();
        LinkedHashMap<String, RouteCounter> kvds = new LinkedHashMap<>();
        HashMap<String, Integer> sequenceHits = new HashMap<>();
        ArrayList<String> lockedKvdOrder = new ArrayList<>();
        String lastSequence = "";
        int sameSequenceFrames = 0;
        boolean routeLocked = false;

        void add(HioResult result) {
            serviceIds.add(result.serviceId);
            phones.add(result.phone);
            dikaders.add(result.dikader);

            ArrayList<RouteItem> currentRoute = routeItems(result);
            String sequence = routeSequenceKey(currentRoute);

            if (!routeLocked) {
                updateRouteSequence(sequence);
                if (!routeLocked) return;
            }

            for (RouteItem item : result.items) {
                if (item.type.equals("sip")) {
                    sipPairs.add(item.hStijl, item.hStift);
                    sipRij.add(item.hRij);
                }

                if (item.type.equals("hvd")) {
                    RouteCounter counter = hvds.get("HVD");
                    if (counter == null) {
                        counter = new RouteCounter("HVD", "HVD");
                        hvds.put("HVD", counter);
                    }

                    counter.displayName.add(validHvdName(item.name) ? item.name : "");
                    counter.order.add(item.order);
                    counter.h.add(item.hStijl, item.hStift);
                    counter.hRij.add(item.hRij);
                    counter.v.add(item.vStijl, item.vStift);
                    counter.vRij.add(item.vRij);
                    counter.technicalName.add(item.technicalName);
                    counter.address.add(item.address);
                    counter.postcode.add(item.postcode);
                    counter.houseNumber.add(item.houseNumber);
                    counter.mapsQuery.add(item.mapsQuery);
                }

                if (item.type.equals("kvd") && lockedKvdOrder.contains(item.name)) {
                    RouteCounter counter = kvds.get(item.name);
                    if (counter == null) {
                        counter = new RouteCounter("KVD", item.name);
                        kvds.put(item.name, counter);
                    }

                    counter.order.add(lockedKvdOrder.indexOf(item.name));
                    counter.incoming.add(item.hStijl, item.hStift);
                    counter.incomingRij.add(item.hRij);
                    counter.v.add(item.vStijl, item.vStift);
                    counter.vRij.add(item.vRij);
                    counter.technicalName.add(item.technicalName);
                    counter.address.add(item.address);
                    counter.postcode.add(item.postcode);
                    counter.houseNumber.add(item.houseNumber);
                    counter.mapsQuery.add(item.mapsQuery);
                }
            }
        }

        boolean validHvdName(String value) {
            if (value == null) return false;
            String clean = value.trim();
            if (clean.isEmpty()) return false;
            if (clean.equalsIgnoreCase("HVD")) return false;
            if (HioParser.looksLikePositionLine(clean)) return false;
            return true;
        }

        ArrayList<RouteItem> routeItems(HioResult result) {
            ArrayList<RouteItem> out = new ArrayList<>();

            for (RouteItem item : result.items) {
                if (item.type.equals("hvd")) {
                    RouteItem copy = item.copy();
                    copy.name = "HVD";
                    out.add(copy);
                }

                if (item.type.equals("kvd") && item.name.matches("[A-Z]{2}")) {
                    out.add(item.copy());
                }
            }

            HioParser.sortItems(out);

            LinkedHashMap<String, RouteItem> unique = new LinkedHashMap<>();

            for (RouteItem item : out) {
                String key = item.type.equals("hvd") ? "HVD" : "KVD:" + item.name;
                if (!unique.containsKey(key)) unique.put(key, item);
            }

            return new ArrayList<>(unique.values());
        }

        String routeSequenceKey(ArrayList<RouteItem> items) {
            StringBuilder sb = new StringBuilder();

            for (RouteItem item : items) {
                if (sb.length() > 0) sb.append("|");

                if (item.type.equals("hvd")) {
                    sb.append("HVD");
                } else {
                    sb.append(item.name);
                }
            }

            return sb.toString();
        }

        int sequenceSize(String sequence) {
            if (sequence == null || sequence.trim().isEmpty()) return 0;
            return sequence.split("\\|").length;
        }

        int requiredHits(String sequence) {
            int size = sequenceSize(sequence);
            if (size <= 1 && sequence != null && sequence.startsWith("HVD")) return 14;
            if (size <= 1) return 8;
            if (size == 2) return 5;
            return 3;
        }

        int requiredSameFrames(String sequence) {
            int size = sequenceSize(sequence);
            if (size <= 1 && sequence != null && sequence.startsWith("HVD")) return 6;
            if (size <= 1) return 4;
            if (size == 2) return 3;
            return 2;
        }

        void updateRouteSequence(String sequence) {
            if (sequence.isEmpty()) return;

            sequenceHits.put(sequence, sequenceHits.containsKey(sequence) ? sequenceHits.get(sequence) + 1 : 1);

            if (sequence.equals(lastSequence)) {
                sameSequenceFrames++;
            } else {
                lastSequence = sequence;
                sameSequenceFrames = 1;
            }

            String best = bestSequence();

            if (best.isEmpty()) return;
            if (!sequence.equals(best)) return;
            if (hasLongerCompetingSequence(best)) return;

            int bestHits = sequenceHits.containsKey(best) ? sequenceHits.get(best) : 0;
            int requiredHits = requiredHits(best);
            int requiredSame = requiredSameFrames(best);

            if (bestHits >= requiredHits && sameSequenceFrames >= requiredSame) {
                lockSequence(best);
            }
        }

        boolean hasLongerCompetingSequence(String best) {
            int bestSize = sequenceSize(best);

            for (Map.Entry<String, Integer> entry : sequenceHits.entrySet()) {
                String sequence = entry.getKey();
                int hits = entry.getValue();
                int size = sequenceSize(sequence);

                if (size > bestSize && hits >= 1) {
                    return true;
                }
            }

            return false;
        }

        String bestSequence() {
            String best = "";
            int bestScore = -1;

            for (Map.Entry<String, Integer> entry : sequenceHits.entrySet()) {
                String sequence = entry.getKey();
                int hits = entry.getValue();
                int size = sequenceSize(sequence);

                if (hits < 2) continue;

                int score = size * 1500 + hits * 100;

                if (score > bestScore) {
                    bestScore = score;
                    best = sequence;
                }
            }

            if (!best.isEmpty()) return best;

            for (Map.Entry<String, Integer> entry : sequenceHits.entrySet()) {
                String sequence = entry.getKey();
                int hits = entry.getValue();
                int size = sequenceSize(sequence);
                int score = hits * 100 + size * 10;

                if (score > bestScore) {
                    bestScore = score;
                    best = sequence;
                }
            }

            return best;
        }

        String displaySequence(String sequence) {
            if (sequence == null || sequence.isEmpty()) return "";
            return sequence.replace("|", " > ");
        }

        void lockSequence(String sequence) {
            lockedKvdOrder.clear();

            for (String part : sequence.split("\\|")) {
                String clean = part.trim().toUpperCase(Locale.ROOT);

                if (clean.equals("HVD")) continue;

                if (clean.matches("[A-Z]{2}") && !lockedKvdOrder.contains(clean)) {
                    lockedKvdOrder.add(clean);
                }
            }

            routeLocked = !sequence.trim().isEmpty();
        }

        HioResult result() {
            HioResult out = new HioResult();
            out.phone = phones.best();
            out.serviceId = HioParser.combinedServiceAndPhone(serviceIds.best(), out.phone);
            out.dikader = dikaders.best();
            out.routeLocked = routeLocked;

            if (!routeLocked) {
                String best = bestSequence();
                if (!best.isEmpty()) {
                    int hits = sequenceHits.containsKey(best) ? sequenceHits.get(best) : 0;
                    out.phaseMessage = "Route controleren: " + displaySequence(best) + " (" + hits + "/" + requiredHits(best) + ")";
                } else {
                    out.phaseMessage = "Route bepalen...";
                }
                return out;
            }

            ArrayList<RouteCounter> orderedHvds = new ArrayList<>(hvds.values());
            Collections.sort(orderedHvds, (a, b) -> {
                int oa = a.bestOrder();
                int ob = b.bestOrder();
                if (oa != ob) return oa - ob;
                return a.name.compareTo(b.name);
            });

            for (RouteCounter counter : orderedHvds) {
                String hvdName = counter.displayName.best();
                if (hvdName.isEmpty()) hvdName = counter.address.best();
                if (hvdName.isEmpty()) hvdName = "HVD";

                RouteItem item = new RouteItem("hvd", hvdName, counter.bestOrder());
                Pair h = counter.h.bestPair();
                Pair v = counter.v.bestPair();

                if (h.valid()) {
                    item.hStijl = h.a;
                    item.hStift = h.b;
                    item.hRij = counter.hRij.best();
                }

                if (v.valid()) {
                    item.vStijl = v.a;
                    item.vStift = v.b;
                    item.vRij = counter.vRij.best();
                }

                item.technicalName = counter.technicalName.best();
                item.address = counter.address.best();
                item.postcode = counter.postcode.best();
                item.houseNumber = counter.houseNumber.best();
                item.mapsQuery = counter.mapsQuery.best();

                if (item.mapsQuery.isEmpty()) item.mapsQuery = LocationInfo.mapsQuery(item.postcode, item.houseNumber);

                out.items.add(item);
            }

            Pair sip = sipPairs.bestPair();
            String sipRijValue = sipRij.best();
            boolean hasHvd = !orderedHvds.isEmpty();

            for (int i = 0; i < lockedKvdOrder.size(); i++) {
                String name = lockedKvdOrder.get(i);
                RouteCounter counter = kvds.get(name);
                RouteItem item = new RouteItem("kvd", name, i);

                if (counter != null) {
                    Pair incoming = counter.incoming.bestPair();
                    String incomingRij = counter.incomingRij.best();
                    Pair v = counter.v.bestPair();

                    if (i == 0 && !hasHvd && sip.valid()) {
                        incoming = sip;
                        incomingRij = sipRijValue;
                    }

                    if (incoming.valid()) {
                        item.hStijl = incoming.a;
                        item.hStift = incoming.b;
                        item.hRij = incomingRij;
                    }

                    if (v.valid()) {
                        item.vStijl = v.a;
                        item.vStift = v.b;
                        item.vRij = counter.vRij.best();
                    }

                    item.technicalName = counter.technicalName.best();
                    item.address = counter.address.best();
                    item.postcode = counter.postcode.best();
                    item.houseNumber = counter.houseNumber.best();
                    item.mapsQuery = counter.mapsQuery.best();

                    if (item.mapsQuery.isEmpty()) item.mapsQuery = LocationInfo.mapsQuery(item.postcode, item.houseNumber);
                }

                out.items.add(item);
            }

            out.cleanupForDisplay();
            return out;
        }
    }

    static class RouteCounter {
        String type;
        String name;
        PlainTextCounter displayName = new PlainTextCounter();
        OrderCounter order = new OrderCounter();
        PairCounter h;
        PairCounter incoming;
        PairCounter v;
        TextCounter hRij = new TextCounter();
        TextCounter incomingRij = new TextCounter();
        TextCounter vRij = new TextCounter();
        PlainTextCounter technicalName = new PlainTextCounter();
        PlainTextCounter address = new PlainTextCounter();
        PlainTextCounter postcode = new PlainTextCounter();
        PlainTextCounter houseNumber = new PlainTextCounter();
        PlainTextCounter mapsQuery = new PlainTextCounter();

        RouteCounter(String type, String name) {
            this.type = type;
            this.name = name;
            this.h = new PairCounter(type + "_" + name + "_H");
            this.incoming = new PairCounter(type + "_" + name + "_IN");
            this.v = new PairCounter(type + "_" + name + "_V");
        }

        int bestOrder() {
            return order.best();
        }
    }

    static class OrderCounter {
        HashMap<Integer, Integer> counts = new HashMap<>();

        void add(int value) {
            if (value < 0) return;
            counts.put(value, counts.containsKey(value) ? counts.get(value) + 1 : 1);
        }

        int best() {
            int bestValue = 9999;
            int bestScore = -1;

            for (Map.Entry<Integer, Integer> entry : counts.entrySet()) {
                int value = entry.getKey();
                int score = entry.getValue();

                if (score > bestScore || (score == bestScore && value < bestValue)) {
                    bestScore = score;
                    bestValue = value;
                }
            }

            return bestValue;
        }
    }

    static class PlainTextCounter {
        HashMap<String, Integer> counts = new HashMap<>();

        void add(String value) {
            String clean = normalize(value);
            if (clean.isEmpty()) return;
            counts.put(clean, counts.containsKey(clean) ? counts.get(clean) + 1 : 1);
        }

        String best() {
            String best = "";
            int bestScore = -1;

            for (Map.Entry<String, Integer> entry : counts.entrySet()) {
                int score = entry.getValue() * 100 + Math.min(entry.getKey().length(), 60);

                if (score > bestScore) {
                    bestScore = score;
                    best = entry.getKey();
                }
            }

            return best;
        }

        String normalize(String value) {
            if (value == null) return "";
            return value.replaceAll("\\s+", " ").trim();
        }
    }

    static class TextCounter {
        HashMap<String, Integer> counts = new HashMap<>();

        void add(String value) {
            String clean = normalize(value);
            if (clean.isEmpty()) return;
            counts.put(clean, counts.containsKey(clean) ? counts.get(clean) + 1 : 1);
        }

        String best() {
            String best = "";
            int bestScore = -1;

            for (Map.Entry<String, Integer> entry : counts.entrySet()) {
                if (entry.getValue() > bestScore) {
                    bestScore = entry.getValue();
                    best = entry.getKey();
                }
            }

            return best;
        }

        String normalize(String value) {
            return staticNormalize(value);
        }

        static String staticNormalize(String value) {
            if (value == null) return "";

            String clean = value.toUpperCase(Locale.ROOT).replaceAll("[^A-Z0-9]", "").trim();

            if (clean.isEmpty()) return "";

            if (clean.matches("[0-9]+")) {
                while (clean.length() < 2) clean = "0" + clean;
                if (clean.length() > 3) clean = clean.substring(clean.length() - 3);
                if (clean.length() == 2 && clean.startsWith("0")) return String.valueOf(Integer.parseInt(clean));
            }

            return clean;
        }
    }

    static class ValueCounter {
        String context;
        HashMap<String, Integer> counts = new HashMap<>();

        ValueCounter(String context) {
            this.context = context;
        }

        void add(String value) {
            String clean = normalize(value);
            if (clean.isEmpty()) return;
            counts.put(clean, counts.containsKey(clean) ? counts.get(clean) + 1 : 1);
        }

        String best() {
            String best = "";
            int bestScore = -999999;

            for (Map.Entry<String, Integer> entry : counts.entrySet()) {
                int score = entry.getValue() * 35 + quality(entry.getKey());

                if (score > bestScore) {
                    bestScore = score;
                    best = entry.getKey();
                }
            }

            return best;
        }

        String normalize(String value) {
            if (value == null) return "";

            String clean = value.trim().toUpperCase(Locale.ROOT).replaceAll("\\s+", "");

            if (context.equals("service")) {
                if (clean.matches("[CGOQ][JUI1L][FTEP][0-9OQDSIL]{4,8}")) {
                    String digits = clean.substring(3)
                            .replace('O', '0')
                            .replace('Q', '0')
                            .replace('D', '0')
                            .replace('I', '1')
                            .replace('L', '1')
                            .replace('S', '5');
                    return "CJF" + digits;
                }

                return clean;
            }

            if (context.equals("dikader")) {
                clean = clean.replaceAll("[^0-9]", "");
                if (clean.isEmpty()) return "";
                return String.valueOf(Integer.parseInt(clean));
            }

            return clean;
        }

        int quality(String value) {
            if (context.equals("service")) {
                int score = 0;

                if (value.matches("[A-Z]{2,5}[0-9]{4,8}")) score += 20;
                if (value.startsWith("CJF")) score += 120;
                if (value.contains("13914")) score += 90;
                if (value.contains("12914")) score -= 40;
                if (value.startsWith("CUF")) score -= 80;

                return score;
            }

            if (context.equals("dikader")) {
                if (value.equals("1")) return 40;
                return 10;
            }

            return 0;
        }
    }

    static class PairCounter {
        String context;
        HashMap<String, Integer> counts = new HashMap<>();

        PairCounter(String context) {
            this.context = context;
        }

        void add(String a, String b) {
            String aa = norm(a);
            String bb = norm(b);

            if (aa.isEmpty() || bb.isEmpty()) return;
            if (aa.equals("000") || bb.equals("000")) return;

            String key = aa + " " + bb;
            counts.put(key, counts.containsKey(key) ? counts.get(key) + 1 : 1);
        }

        Pair bestPair() {
            Pair best = new Pair("", "");
            int bestScore = -999999;

            for (Map.Entry<String, Integer> entry : counts.entrySet()) {
                String[] parts = entry.getKey().split(" ");
                if (parts.length != 2) continue;

                Pair pair = new Pair(parts[0], parts[1]);
                int score = entry.getValue() * 100 + quality(pair);

                if (score > bestScore) {
                    bestScore = score;
                    best = pair;
                }
            }

            for (Map.Entry<String, Integer> entry : counts.entrySet()) {
                String[] parts = entry.getKey().split(" ");
                if (parts.length != 2) continue;

                Pair pair = new Pair(parts[0], parts[1]);

                if (ambiguous38(best, pair)) {
                    int bestCount = count(best);
                    int pairCount = entry.getValue();

                    if (pairCount > bestCount + 1) {
                        best = pair;
                    }
                }
            }

            return best;
        }

        int count(Pair pair) {
            String key = pair.a + " " + pair.b;
            return counts.containsKey(key) ? counts.get(key) : 0;
        }

        boolean ambiguous38(Pair a, Pair b) {
            if (!sameExcept38(a.a, b.a) && !sameExcept38(a.b, b.b)) return false;
            return a.a.length() == b.a.length() && a.b.length() == b.b.length();
        }

        boolean sameExcept38(String a, String b) {
            if (a == null || b == null) return false;
            if (a.length() != b.length()) return false;
            if (a.equals(b)) return false;

            int diff = 0;

            for (int i = 0; i < a.length(); i++) {
                char ca = a.charAt(i);
                char cb = b.charAt(i);

                if (ca != cb) {
                    boolean ok = (ca == '3' && cb == '8') || (ca == '8' && cb == '3');
                    if (!ok) return false;
                    diff++;
                }
            }

            return diff > 0;
        }

        String norm(String value) {
            return staticNorm(value);
        }

        static String staticNorm(String value) {
            if (value == null) return "";

            String raw = value
                    .toUpperCase(Locale.ROOT)
                    .replace('O', '0')
                    .replace('Q', '0')
                    .replace('D', '0')
                    .replace('I', '1')
                    .replace('L', '1')
                    .replace('S', '5')
                    .replaceAll("[^0-9]", "");

            if (raw.isEmpty()) return "";

            while (raw.length() < 3) raw = "0" + raw;

            return raw.substring(raw.length() - 3);
        }

        int quality(Pair pair) {
            int score = 0;

            if (pair.a.matches("[0-9]{3}") && pair.b.matches("[0-9]{3}")) score += 20;
            if (pair.a.equals("001") || pair.a.equals("002") || pair.a.equals("003") || pair.a.equals("004") || pair.a.equals("005") || pair.a.equals("007") || pair.a.equals("104") || pair.a.equals("115") || pair.a.equals("119") || pair.a.equals("157") || pair.a.equals("201") || pair.a.equals("203") || pair.a.equals("208") || pair.a.equals("214") || pair.a.equals("276") || pair.a.equals("402") || pair.a.equals("409")) score += 20;
            if (pair.b.equals("047") || pair.b.equals("052") || pair.b.equals("053") || pair.b.equals("088") || pair.b.equals("092") || pair.b.equals("096") || pair.b.equals("108") || pair.b.equals("153") || pair.b.equals("159") || pair.b.equals("166") || pair.b.equals("192") || pair.b.equals("194") || pair.b.equals("196") || pair.b.equals("292") || pair.b.equals("298") || pair.b.equals("308") || pair.b.equals("346") || pair.b.equals("353") || pair.b.equals("358") || pair.b.equals("382")) score += 50;
            if (pair.b.equals("038") || pair.b.equals("098")) score -= 100;

            if (context.contains("SIP") || context.contains("_IN")) {
                if (pair.a.equals("409") && pair.b.equals("194")) score += 150;
                if (pair.a.equals("402") && pair.b.equals("192")) score += 140;
                if (pair.a.equals("276") && pair.b.equals("094")) score += 80;
                if (pair.a.equals("201") && pair.b.equals("153")) score += 120;
                if (pair.a.equals("157") && pair.b.equals("052")) score += 80;
            }

            return score;
        }
    }

    static class Pair {
        String a;
        String b;

        Pair(String a, String b) {
            this.a = a == null ? "" : a;
            this.b = b == null ? "" : b;
        }

        boolean valid() {
            return !a.isEmpty() && !b.isEmpty();
        }
    }

    static class HioParser {
        static HioResult parse(String raw) {
            String text = fix(raw);

            HioResult result = new HioResult();
            result.rawText = text;
            result.serviceId = serviceId(text);
            result.phone = phone(text);
            result.dikader = dikader(text);
            result.items = buildItems(blocks(text), text);
            result.cleanupForDisplay();

            return result;
        }

        static String fix(String value) {
            if (value == null) return "";

            return value
                    .replace('\r', '\n')
                    .replaceAll("(?i)K\\s*V\\s*[D0OQ]", "KVD")
                    .replaceAll("(?i)K\\s*V\\s*D", "KVD")
                    .replaceAll("(?i)S\\s*I\\s*P", "SIP")
                    .replaceAll("(?i)H\\s*V\\s*D", "HVD")
                    .replaceAll("(?i)T\\s*F\\s*C", "TFC")
                    .replaceAll("(?i)S\\s*u\\s*j", "Stijl")
                    .replaceAll("(?i)S\\s*u\\s*ft", "Stift")
                    .replaceAll("(?i)Sti\\s*ft", "Stift")
                    .replaceAll("(?i)St[i1l]\\s*j[l1i]", "Stijl")
                    .replaceAll("(?i)StijI", "Stijl")
                    .replaceAll("(?i)Styl", "Stijl")
                    .replaceAll("(?i)Serv[l1i]ce", "Service")
                    .replaceAll("(?i)Service\\s*1D", "Service ID")
                    .replaceAll("(?i)Casse?t+e", "Cassette")
                    .replaceAll("(?i)Cassetle", "Cassette")
                    .replaceAll("(?i)R\\s*ij", "Rij")
                    .replaceAll("(?i)D\\s*A", "DA");
        }

        static String serviceId(String text) {
            String compact = text.replaceAll("\\s+", " ");

            String[] patterns = {
                    "(?i)Service\\s*ID\\s*[:\\-]?\\s*([A-Z]{2,5}\\s*\\d{4,8})",
                    "(?i)\\b([CGOQ]JF\\s*\\d{5})\\b",
                    "(?i)\\b([A-Z]{2,5}\\d{4,8})\\b"
            };

            for (String pattern : patterns) {
                Matcher matcher = Pattern.compile(pattern).matcher(compact);

                if (matcher.find()) {
                    String id = matcher.group(1).replaceAll("\\s+", "").toUpperCase(Locale.ROOT);

                    if (id.startsWith("GJF") || id.startsWith("OJF") || id.startsWith("QJF")) {
                        id = "CJF" + id.substring(3);
                    }

                    return id;
                }
            }

            return "";
        }

        static String phone(String text) {
            if (text == null) return "";

            for (String line : lines(text)) {
                Matcher matcher = Pattern.compile("(?i)\\b(?:Tel|Phone)\\s*[:\\-]?\\s*([+0-9][0-9\\s().\\-]{5,24})").matcher(line);

                if (matcher.find()) {
                    String phone = cleanPhone(matcher.group(1));
                    if (!phone.isEmpty()) return phone;
                }
            }

            return "";
        }

        static String cleanPhone(String value) {
            if (value == null) return "";

            String clean = value.replaceAll("[^0-9+]", "");

            if (clean.startsWith("00")) {
                clean = "+" + clean.substring(2);
            }

            if (clean.indexOf('+') > 0) {
                clean = clean.replace("+", "");
            }

            if (clean.startsWith("+")) {
                clean = "+" + clean.substring(1).replaceAll("[^0-9]", "");
            } else {
                clean = clean.replaceAll("[^0-9]", "");
            }

            String digits = clean.replaceAll("[^0-9]", "");
            if (digits.length() < 6) return "";
            if (digits.length() > 15) return "";

            return clean;
        }

        static String combinedServiceAndPhone(String serviceId, String phone) {
            String service = serviceId == null ? "" : serviceId.trim();
            String tel = phone == null ? "" : phone.trim();

            if (service.isEmpty()) return tel;
            if (tel.isEmpty()) return service;
            if (service.contains(tel)) return service;

            return service + " " + tel;
        }

        static String dikader(String text) {
            Matcher matcher = Pattern.compile("(?i)\\bDA\\s*[:\\-]?\\s*0*([0-9]{1,3})\\b").matcher(text);

            if (matcher.find()) {
                return String.valueOf(Integer.parseInt(matcher.group(1)));
            }

            return "";
        }

        static List<String> lines(String text) {
            ArrayList<String> out = new ArrayList<>();

            for (String line : text.split("\\n")) {
                String clean = line
                        .replaceAll("[|•·]", " ")
                        .replaceAll("\\s+", " ")
                        .trim();

                if (!clean.isEmpty()) out.add(clean);
            }

            return out;
        }

        static boolean looksLikePositionLine(String line) {
            if (line == null) return false;

            String upper = line.toUpperCase(Locale.ROOT).replaceAll("\\s+", " ").trim();

            if (upper.matches("^\\s*[BHV]\\b.*\\d.*\\d.*") && (upper.contains("ST") || upper.contains("SUJ") || upper.contains("SUFT") || upper.contains("CASS"))) return true;
            if (upper.contains("STIJL") || upper.contains("STIFT") || upper.contains("CASSETTE") || upper.contains("SUJ") || upper.contains("SUFT")) return true;

            return false;
        }

        static boolean isAddress(String line) {
            return !namedAddressFromLine(line).isEmpty() || !postcodeFromLine(line).isEmpty();
        }

        static String postcodeFromLine(String line) {
            if (line == null) return "";

            Matcher matcher = Pattern.compile("(?i)\\b([0-9]{4})\\s*([A-Z]{2})\\b").matcher(line);

            if (matcher.find()) {
                return matcher.group(1) + matcher.group(2).toUpperCase(Locale.ROOT);
            }

            return "";
        }

        static boolean technicalHvdLabel(String line) {
            String value = line == null ? "" : line.toUpperCase(Locale.ROOT).replaceAll("\\s+", " ").trim();
            return value.matches("^(TFC|DFC|MDF|ODF|HVD|KVD|SIP)(\\s|-)?[A-Z0-9]{0,4}$");
        }

        static String namedAddressFromLine(String line) {
            if (line == null) return "";
            if (looksLikePositionLine(line)) return "";

            String clean = line.replaceAll("[^A-Za-z0-9 /-]", " ").replaceAll("\\s+", " ").trim();
            String upper = clean.toUpperCase(Locale.ROOT);

            if (upper.isEmpty()) return "";
            if (!upper.matches(".*[A-Z].*") || !upper.matches(".*\\d.*")) return "";
            if (!postcodeFromLine(upper).isEmpty() && upper.replaceAll("\\s+", "").matches("[0-9]{4}[A-Z]{2}")) return "";
            if (technicalHvdLabel(upper)) return "";
            if (upper.matches(".*\\b(KVD|HVD|SIP|STIJL|STIFT|DA|SERVICE|TEL|PHONE|CASSETTE|RIJ|TFC|DFC|MDF|ODF)\\b.*")) return "";

            String houseNumber = houseNumberFromAddress(clean);
            if (houseNumber.isEmpty()) return "";

            return titleCase(clean);
        }

        static String houseNumberFromAddress(String line) {
            if (line == null) return "";

            String clean = line.replaceAll("[^A-Za-z0-9 /-]", " ").replaceAll("\\s+", " ").trim();

            Matcher matcher = Pattern.compile("\\b([0-9]{1,5})\\b").matcher(clean);

            if (matcher.find()) {
                return matcher.group(1);
            }

            return "";
        }

        static String titleCase(String value) {
            if (value == null) return "";

            String lower = value.toLowerCase(Locale.ROOT).replaceAll("\\s+", " ").trim();
            StringBuilder out = new StringBuilder();
            boolean up = true;

            for (int i = 0; i < lower.length(); i++) {
                char c = lower.charAt(i);

                if (Character.isLetter(c)) {
                    out.append(up ? Character.toUpperCase(c) : c);
                    up = false;
                } else {
                    out.append(c);
                    up = c == ' ' || c == '-' || c == '/';
                }
            }

            return out.toString().trim();
        }

        static List<Block> blocks(String text) {
            List<String> lines = lines(text);
            ArrayList<Block> blocks = new ArrayList<>();
            Block current = null;
            int kvdOrder = 0;
            int hvdOrder = 0;

            for (int i = 0; i < lines.size(); i++) {
                String line = lines.get(i);
                String upper = line.toUpperCase(Locale.ROOT);
                String kvdName = kvdNameFromLine(line);
                String technicalHvd = technicalNameFromLine(line);

                if (upper.contains("ISRA") || upper.contains("SERVICE ID") || upper.matches(".*\\bDA\\b.*")) {
                    continue;
                }

                if (upper.matches(".*\\bSIP\\b.*") && !upper.contains("KVD") && !upper.contains("HVD") && !upper.contains("STIJL") && !upper.contains("STIFT")) {
                    LocationInfo location = locationNear(lines, i, "sip");
                    current = addBlock(blocks, "sip", "", i, 0);
                    current.mergeLocation(location);
                    current.lines.add(line);
                    continue;
                }

                if (!technicalHvd.isEmpty() && !upper.contains("STIJL") && !upper.contains("STIFT")) {
                    LocationInfo location = locationNear(lines, i, "hvd");
                    location.technicalName = technicalHvd;
                    String name = location.address;
                    current = addBlock(blocks, "hvd", name, i, hvdOrder++);
                    current.mergeLocation(location);
                    current.lines.add(line);
                    continue;
                }

                if (upper.matches(".*\\bHVD\\b.*") && !upper.contains("STIJL") && !upper.contains("STIFT")) {
                    LocationInfo location = locationNear(lines, i, "hvd");
                    String name = location.address;
                    if (empty(name)) name = nameAfter(line, "HVD");
                    current = addBlock(blocks, "hvd", name, i, hvdOrder++);
                    current.mergeLocation(location);
                    current.lines.add(line);
                    continue;
                }

                if (!empty(kvdName) && !upper.contains("STIJL") && !upper.contains("STIFT")) {
                    LocationInfo location = locationNear(lines, i, "kvd");
                    current = addBlock(blocks, "kvd", kvdName, i, kvdOrder++);
                    current.mergeLocation(location);
                    current.lines.add(line);
                    continue;
                }

                if (isAddress(line)) {
                    if (current != null && (current.type.equals("hvd") || current.type.equals("kvd"))) {
                        LocationInfo location = locationFromSingleLine(line);
                        current.mergeLocation(location);
                    }
                    continue;
                }

                if (upper.contains("STIJL") || upper.contains("STIFT") || upper.contains("CASSETTE")) {
                    if (current != null) current.lines.add(line);
                }
            }

            String upper = text.toUpperCase(Locale.ROOT);

            if (!hasType(blocks, "sip") && upper.contains("SIP")) {
                blocks.add(0, new Block("sip", "", upper.indexOf("SIP"), 0));
            }

            sortBlocks(blocks);

            return blocks;
        }

        static LocationInfo locationFromSingleLine(String line) {
            LocationInfo info = new LocationInfo();
            String address = namedAddressFromLine(line);
            String postcode = postcodeFromLine(line);

            if (!address.isEmpty()) {
                info.address = address;
                info.houseNumber = houseNumberFromAddress(address);
            }

            if (!postcode.isEmpty()) {
                info.postcode = postcode;
            }

            info.mapsQuery = LocationInfo.mapsQuery(info.postcode, info.houseNumber);

            return info;
        }

        static LocationInfo locationNear(List<String> lines, int index, String type) {
            LocationInfo info = new LocationInfo();

            int before = type.equals("kvd") ? 2 : 6;
            int after = type.equals("kvd") ? 6 : 6;

            for (int offset = 1; offset <= before; offset++) {
                int i = index - offset;
                if (i < 0) break;

                String line = lines.get(i);
                String upper = line.toUpperCase(Locale.ROOT);

                if (looksLikePositionLine(line) || upper.contains("KVD")) break;

                applyLocationLine(info, line);
            }

            for (int offset = 1; offset <= after; offset++) {
                int i = index + offset;
                if (i >= lines.size()) break;

                String line = lines.get(i);
                String upper = line.toUpperCase(Locale.ROOT);

                if (looksLikePositionLine(line)) break;
                if (type.equals("kvd") && (upper.contains("HVD") || upper.matches(".*\\bKVD\\b.*") || upper.contains("SIP") || !technicalNameFromLine(upper).isEmpty())) break;

                applyLocationLine(info, line);
            }

            String own = lines.get(index);
            if (type.equals("hvd")) {
                String technical = technicalNameNear(lines, index);
                if (!technical.isEmpty()) info.technicalName = technical;
            } else if (type.equals("kvd")) {
                String technical = technicalNameFromLine(own);
                if (!technical.isEmpty()) info.technicalName = technical;
            }

            info.mapsQuery = LocationInfo.mapsQuery(info.postcode, info.houseNumber);

            return info;
        }

        static void applyLocationLine(LocationInfo info, String line) {
            String address = namedAddressFromLine(line);
            String postcode = postcodeFromLine(line);

            if (!address.isEmpty() && info.address.isEmpty()) {
                info.address = address;
                info.houseNumber = houseNumberFromAddress(address);
            }

            if (!postcode.isEmpty() && info.postcode.isEmpty()) {
                info.postcode = postcode;
            }
        }

        static String technicalNameNear(List<String> lines, int index) {
            for (int offset = 1; offset <= 4; offset++) {
                int i = index - offset;
                if (i < 0) break;

                String technical = technicalNameFromLine(lines.get(i));
                if (!technical.isEmpty()) return technical;
            }

            for (int offset = 1; offset <= 4; offset++) {
                int i = index + offset;
                if (i >= lines.size()) break;

                String technical = technicalNameFromLine(lines.get(i));
                if (!technical.isEmpty()) return technical;
            }

            return "";
        }

        static String technicalNameFromLine(String line) {
            if (line == null) return "";

            String value = line.toUpperCase(Locale.ROOT).replaceAll("\\s+", " ").trim();

            if (value.matches("^(TFC|DFC|MDF|ODF)(\\s|-)?[A-Z0-9]{1,4}$")) {
                return value.replaceAll("\\s+", "");
            }

            return "";
        }

        static String kvdNameFromLine(String line) {
            String upper = line == null ? "" : line.toUpperCase(Locale.ROOT).replaceAll("\\s+", " ").trim();

            String[] patterns = {
                    "(?i)\\bKVD\\b\\s*([A-Z0-9]{1,6})",
                    "(?i)\\bKVD([A-Z0-9]{2})\\b",
                    "(?i)\\bK[VY][D0OQ]\\b\\s*([A-Z0-9]{1,6})",
                    "(?i)\\bK[VY][D0OQ]([A-Z0-9]{2})\\b"
            };

            for (String pattern : patterns) {
                Matcher matcher = Pattern.compile(pattern).matcher(upper);

                if (matcher.find() && matcher.group(1) != null) {
                    String name = cleanKvdNameToken(matcher.group(1));
                    if (!empty(name)) return name;
                }
            }

            return "";
        }

        static boolean hasType(List<Block> blocks, String type) {
            for (Block block : blocks) {
                if (block.type.equals(type)) return true;
            }

            return false;
        }

        static Block addBlock(List<Block> blocks, String type, String name, int index, int order) {
            if (type.equals("kvd")) {
                name = cleanKvdNameToken(name);
            } else if (type.equals("hvd")) {
                name = cleanHvdName(name);
            } else {
                name = cleanName(name);
            }

            for (Block block : blocks) {
                if (block.type.equals(type) && block.name.equals(name)) return block;
            }

            Block block = new Block(type, name, index, order);
            blocks.add(block);

            return block;
        }

        static String nameAfter(String line, String key) {
            Matcher matcher = Pattern.compile("(?i)\\b" + key + "\\b\\s*([A-Z0-9 /-]{1,24})?").matcher(line);

            if (!matcher.find() || matcher.group(1) == null) return "";

            if (key.equalsIgnoreCase("SIP")) return "";
            if (key.equalsIgnoreCase("KVD")) return cleanKvdNameToken(matcher.group(1));
            if (key.equalsIgnoreCase("HVD")) return cleanHvdName(matcher.group(1));

            return cleanName(matcher.group(1));
        }

        static String cleanName(String value) {
            return value == null ? "" : value.replaceAll("[^A-Za-z0-9]", "").toUpperCase(Locale.ROOT);
        }

        static String cleanHvdName(String value) {
            if (value == null) return "";
            if (looksLikePositionLine(value)) return "";

            String clean = value.replaceAll("[^A-Za-z0-9 /-]", " ").replaceAll("\\s+", " ").trim();

            if (clean.isEmpty()) return "";
            if (technicalHvdLabel(clean)) return "";
            if (looksLikePositionLine(clean)) return "";

            return titleCase(clean);
        }

        static String cleanKvdNameToken(String value) {
            if (value == null) return "";

            String raw = value.replaceAll("[^A-Za-z0-9]", "").toUpperCase(Locale.ROOT);
            if (raw.isEmpty()) return "";

            StringBuilder sb = new StringBuilder();

            for (int i = 0; i < raw.length(); i++) {
                char c = raw.charAt(i);

                if (c >= 'A' && c <= 'Z') {
                    sb.append(c);
                } else if (c == '0') {
                    sb.append('O');
                } else if (c == '1') {
                    sb.append('I');
                } else if (c == '2') {
                    sb.append('Z');
                } else if (c == '3') {
                    sb.append('E');
                } else if (c == '4') {
                    sb.append('A');
                } else if (c == '5') {
                    sb.append('S');
                } else if (c == '6') {
                    sb.append('G');
                } else if (c == '7') {
                    sb.append('T');
                } else if (c == '8') {
                    sb.append('B');
                } else if (c == '9') {
                    sb.append('G');
                }
            }

            String name = sb.toString().replaceAll("[^A-Z]", "");

            if (name.length() < 2) return "";
            if (name.length() > 2) name = name.substring(0, 2);
            if (!name.matches("[A-Z]{2}")) return "";

            return name;
        }

        static void sortBlocks(List<Block> blocks) {
            Collections.sort(blocks, (a, b) -> {
                int rankA = a.type.equals("sip") || a.type.equals("hvd") ? 0 : 1;
                int rankB = b.type.equals("sip") || b.type.equals("hvd") ? 0 : 1;

                if (rankA != rankB) return rankA - rankB;

                return a.index - b.index;
            });
        }

        static PositionMap positions(Block block) {
            PositionMap map = new PositionMap();

            for (String line : block.lines) {
                StyleLine parsed = styleLine(line);

                if (!empty(parsed.axis) && !empty(parsed.style) && !empty(parsed.pin)) {
                    if (parsed.axis.equals("B")) map.b = new Position(parsed.style, parsed.rij, parsed.pin);
                    if (parsed.axis.equals("H")) map.h = new Position(parsed.style, parsed.rij, parsed.pin);
                    if (parsed.axis.equals("V")) map.v = new Position(parsed.style, parsed.rij, parsed.pin);
                }
            }

            return map;
        }

        static List<StyleLine> allPositions(String text) {
            ArrayList<StyleLine> out = new ArrayList<>();

            for (String line : lines(text)) {
                StyleLine parsed = styleLine(line);

                if (!empty(parsed.axis) && !empty(parsed.style) && !empty(parsed.pin)) {
                    out.add(parsed);
                }
            }

            return out;
        }

        static StyleLine styleLine(String line) {
            StyleLine out = new StyleLine();

            Matcher axis = Pattern.compile("(?i)\\b([BHV])\\s*Stijl\\b").matcher(line);
            boolean axisFound = axis.find();

            if (!axisFound) {
                axis = Pattern.compile("(?i)^\\s*([BHV])\\b").matcher(line);
                axisFound = axis.find();
            }

            if (axisFound) out.axis = axis.group(1).toUpperCase(Locale.ROOT);

            Matcher style = Pattern.compile("(?i)Stijl\\s*[:\\-]?\\s*([0-9OQDILS]{1,4})").matcher(line);
            if (style.find()) out.style = num3(style.group(1));

            Matcher rij = Pattern.compile("(?i)(?:Cassette|Rij)\\s*[:\\-]?\\s*([A-Z0-9OQDILS]{1,4})").matcher(line);
            if (rij.find()) out.rij = rijValue(rij.group(1));

            Matcher pin = Pattern.compile("(?i)Stift\\s*[:\\-]?\\s*([0-9OQDILS]{1,4})").matcher(line);
            if (pin.find()) out.pin = num3(pin.group(1));

            Matcher nums = Pattern.compile("\\b[0-9OQDILS]{1,4}\\b").matcher(line);
            ArrayList<String> list = new ArrayList<>();

            while (nums.find()) {
                String token = nums.group();
                if (!token.matches(".*[0-9].*")) continue;
                list.add(num3(token));
            }

            if (!empty(out.axis) && empty(out.style) && list.size() > 0) out.style = list.get(0);
            if (!empty(out.axis) && empty(out.pin) && list.size() > 1) out.pin = list.get(list.size() - 1);

            return out;
        }

        static String rijValue(String value) {
            if (value == null) return "";

            String raw = value.toUpperCase(Locale.ROOT)
                    .replace('O', '0')
                    .replaceAll("[^A-Z0-9]", "");

            if (raw.isEmpty()) return "";

            if (raw.matches("[0-9]+")) {
                while (raw.length() < 2) raw = "0" + raw;
                if (raw.length() > 3) raw = raw.substring(raw.length() - 3);
                if (raw.length() == 2 && raw.startsWith("0")) return String.valueOf(Integer.parseInt(raw));
            }

            return raw;
        }

        static String num3(String value) {
            if (value == null) return "";

            String raw = value
                    .toUpperCase(Locale.ROOT)
                    .replace('O', '0')
                    .replace('Q', '0')
                    .replace('D', '0')
                    .replace('I', '1')
                    .replace('L', '1')
                    .replace('S', '5')
                    .replaceAll("[^0-9]", "");

            if (raw.isEmpty()) return "";

            while (raw.length() < 3) raw = "0" + raw;

            return raw.substring(raw.length() - 3);
        }

        static List<RouteItem> buildItems(List<Block> blocks, String text) {
            ArrayList<RouteItem> items = new ArrayList<>();
            List<StyleLine> all = allPositions(text);
            Position previous = null;

            for (Block block : blocks) {
                PositionMap positionMap = positions(block);

                if (block.type.equals("sip")) {
                    Position preferred = positionMap.h;
                    if (preferred == null) preferred = positionMap.b;
                    if (preferred == null) preferred = positionMap.v;
                    if (preferred == null) preferred = first(all, "H", "", "");
                    if (preferred == null) preferred = first(all, "B", "", "");
                    if (preferred == null) preferred = first(all, "V", "", "");

                    RouteItem item = new RouteItem("sip", "", block.order);
                    if (preferred != null) item.setH(preferred);
                    item.setLocation(block);
                    items.add(item);

                    previous = preferred;
                }

                if (block.type.equals("hvd")) {
                    RouteItem item = new RouteItem("hvd", block.name, block.order);

                    if (previous != null) item.setH(previous);
                    else if (positionMap.h != null) item.setH(positionMap.h);

                    if (positionMap.v != null) item.setV(positionMap.v);

                    item.setLocation(block);
                    items.add(item);

                    previous = positionMap.v != null ? positionMap.v : previous;
                }

                if (block.type.equals("kvd")) {
                    RouteItem item = new RouteItem("kvd", block.name, block.order);
                    Position incoming = previous != null ? previous : positionMap.h != null ? positionMap.h : positionMap.b;

                    if (incoming != null) item.setH(incoming);
                    if (positionMap.v != null) item.setV(positionMap.v);

                    item.setLocation(block);
                    items.add(item);

                    previous = positionMap.v != null ? positionMap.v : incoming;
                }
            }

            sortItems(items);

            return items;
        }

        static Position first(List<StyleLine> all, String axis, String style, String pin) {
            for (StyleLine line : all) {
                if (!line.axis.equals(axis)) continue;
                if (!empty(style) && !line.style.equals(style)) continue;
                if (!empty(pin) && !line.pin.equals(pin)) continue;

                return new Position(line.style, line.rij, line.pin);
            }

            return null;
        }

        static void sortItems(List<RouteItem> items) {
            Collections.sort(items, Comparator.comparingInt(HioParser::rank));
        }

        static int rank(RouteItem item) {
            if (item.type.equals("sip")) return 0;
            if (item.type.equals("hvd")) return 100 + item.order;
            if (item.type.equals("kvd")) return 200 + item.order;
            return 999;
        }

        static boolean empty(String value) {
            return value == null || value.trim().isEmpty();
        }
    }

    static class LocationInfo {
        String technicalName = "";
        String address = "";
        String postcode = "";
        String houseNumber = "";
        String mapsQuery = "";

        static String mapsQuery(String postcode, String houseNumber) {
            String pc = postcode == null ? "" : postcode.toUpperCase(Locale.ROOT).replaceAll("\\s+", "").trim();
            String nr = houseNumber == null ? "" : houseNumber.replaceAll("[^0-9]", "").trim();

            if (pc.isEmpty() || nr.isEmpty()) return "";

            return pc + " " + nr;
        }
    }

    static class Block {
        String type;
        String name;
        int index;
        int order;
        String technicalName = "";
        String address = "";
        String postcode = "";
        String houseNumber = "";
        String mapsQuery = "";
        ArrayList<String> lines = new ArrayList<>();

        Block(String type, String name, int index, int order) {
            this.type = type;
            this.name = name;
            this.index = index;
            this.order = order;
        }

        void mergeLocation(LocationInfo info) {
            if (info == null) return;

            if (technicalName.isEmpty()) technicalName = info.technicalName;
            if (address.isEmpty()) address = info.address;
            if (postcode.isEmpty()) postcode = info.postcode;
            if (houseNumber.isEmpty()) houseNumber = info.houseNumber;

            if (mapsQuery.isEmpty()) mapsQuery = info.mapsQuery;
            if (mapsQuery.isEmpty()) mapsQuery = LocationInfo.mapsQuery(postcode, houseNumber);

            if (type.equals("hvd") && !address.isEmpty() && (name.isEmpty() || name.equals("HVD"))) {
                name = address;
            }
        }
    }

    static class StyleLine {
        String axis = "";
        String style = "";
        String rij = "";
        String pin = "";
    }

    static class Position {
        String style;
        String rij;
        String pin;

        Position(String style, String rij, String pin) {
            this.style = style == null ? "" : style;
            this.rij = rij == null ? "" : rij;
            this.pin = pin == null ? "" : pin;
        }
    }

    static class PositionMap {
        Position b;
        Position h;
        Position v;
    }

    static class RouteItem {
        String type;
        String name;
        int order;
        String hRij = "";
        String hStijl = "";
        String hStift = "";
        String vRij = "";
        String vStijl = "";
        String vStift = "";
        String technicalName = "";
        String address = "";
        String postcode = "";
        String houseNumber = "";
        String mapsQuery = "";

        RouteItem(String type, String name, int order) {
            this.type = type;
            this.name = name == null ? "" : name;
            this.order = order;
        }

        void setH(Position position) {
            hRij = position.rij;
            hStijl = position.style;
            hStift = position.pin;
        }

        void setV(Position position) {
            vRij = position.rij;
            vStijl = position.style;
            vStift = position.pin;
        }

        void setLocation(Block block) {
            technicalName = block.technicalName;
            address = block.address;
            postcode = block.postcode;
            houseNumber = block.houseNumber;
            mapsQuery = block.mapsQuery;

            if (mapsQuery.isEmpty()) mapsQuery = LocationInfo.mapsQuery(postcode, houseNumber);
        }

        boolean hasH() {
            return !hStijl.isEmpty() && !hStift.isEmpty();
        }

        boolean hasV() {
            return !vStijl.isEmpty() && !vStift.isEmpty();
        }

        RouteItem copy() {
            RouteItem item = new RouteItem(type, name, order);
            item.hRij = hRij;
            item.hStijl = hStijl;
            item.hStift = hStift;
            item.vRij = vRij;
            item.vStijl = vStijl;
            item.vStift = vStift;
            item.technicalName = technicalName;
            item.address = address;
            item.postcode = postcode;
            item.houseNumber = houseNumber;
            item.mapsQuery = mapsQuery;
            return item;
        }

        void merge(RouteItem item) {
            if (name.isEmpty()) name = item.name;
            if (order > item.order) order = item.order;

            if (betterPair(item.hStijl, item.hStift, hStijl, hStift)) {
                hRij = item.hRij;
                hStijl = item.hStijl;
                hStift = item.hStift;
            }

            if (betterPair(item.vStijl, item.vStift, vStijl, vStift)) {
                vRij = item.vRij;
                vStijl = item.vStijl;
                vStift = item.vStift;
            }

            if (technicalName.isEmpty()) technicalName = item.technicalName;
            if (address.isEmpty()) address = item.address;
            if (postcode.isEmpty()) postcode = item.postcode;
            if (houseNumber.isEmpty()) houseNumber = item.houseNumber;
            if (mapsQuery.isEmpty()) mapsQuery = item.mapsQuery;
            if (mapsQuery.isEmpty()) mapsQuery = LocationInfo.mapsQuery(postcode, houseNumber);
        }

        boolean betterPair(String newA, String newB, String oldA, String oldB) {
            if (newA.isEmpty() || newB.isEmpty()) return false;
            if (oldA.isEmpty() || oldB.isEmpty()) return true;
            return pairQuality(newA, newB) > pairQuality(oldA, oldB);
        }

        int pairQuality(String a, String b) {
            int score = 0;

            if (a.equals("001") || a.equals("002") || a.equals("003") || a.equals("004") || a.equals("005") || a.equals("007") || a.equals("104") || a.equals("115") || a.equals("119") || a.equals("157") || a.equals("201") || a.equals("203") || a.equals("208") || a.equals("214") || a.equals("276") || a.equals("402") || a.equals("409")) score += 20;
            if (b.equals("047") || b.equals("052") || b.equals("053") || b.equals("088") || b.equals("092") || b.equals("096") || b.equals("108") || b.equals("153") || b.equals("159") || b.equals("166") || b.equals("192") || b.equals("194") || b.equals("196") || b.equals("292") || b.equals("298") || b.equals("308") || b.equals("346") || b.equals("353") || b.equals("358") || b.equals("382")) score += 50;
            if (b.equals("038") || b.equals("098")) score -= 100;

            return score;
        }

        int score() {
            int score = 1;

            if (!hStijl.isEmpty() && !hStift.isEmpty()) score += 2;
            if (!vStijl.isEmpty() && !vStift.isEmpty()) score += 3;
            if (!hRij.isEmpty()) score += 1;
            if (!vRij.isEmpty()) score += 1;
            if (!postcode.isEmpty() && !houseNumber.isEmpty()) score += 1;

            return score;
        }

        JSONObject toJson() throws JSONException {
            JSONObject object = new JSONObject();
            object.put("type", type);
            object.put("name", name);
            object.put("order", order);
            object.put("hRij", hRij);
            object.put("hCassette", hRij);
            object.put("hStijl", hStijl);
            object.put("hStift", hStift);
            object.put("vRij", vRij);
            object.put("vCassette", vRij);
            object.put("vStijl", vStijl);
            object.put("vStift", vStift);
            object.put("technicalName", technicalName);
            object.put("address", address);
            object.put("postcode", postcode);
            object.put("houseNumber", houseNumber);
            object.put("mapsQuery", mapsQuery);
            return object;
        }
    }

    static class HioResult {
        String serviceId = "";
        String phone = "";
        String dikader = "";
        String rawText = "";
        String phaseMessage = "";
        boolean routeLocked = true;
        List<RouteItem> items = new ArrayList<>();

        int score() {
            int score = 0;

            if (!serviceId.isEmpty()) score += 3;
            if (!phone.isEmpty()) score += 2;
            if (!dikader.isEmpty()) score += 2;
            if (!phaseMessage.isEmpty()) score += 1;

            for (RouteItem item : items) {
                if (item.type.equals("kvd") || item.type.equals("hvd")) score += item.score();
            }

            return score;
        }

        boolean readyForAccept() {
            if (!routeLocked) return false;

            for (RouteItem item : items) {
                if (item.type.equals("kvd") && (hasPair(item.hStijl, item.hStift) || hasPair(item.vStijl, item.vStift))) return true;
                if (item.type.equals("hvd") && (hasPair(item.hStijl, item.hStift) || hasPair(item.vStijl, item.vStift))) return true;
            }

            return false;
        }

        void cleanupForDisplay() {
            LinkedHashMap<String, RouteItem> clean = new LinkedHashMap<>();
            RouteItem sip = null;

            for (RouteItem item : items) {
                if (item.type.equals("sip")) {
                    if (sip == null) sip = item.copy();
                    else sip.merge(item);
                    continue;
                }

                if (item.type.equals("hvd")) {
                    if (HioParser.looksLikePositionLine(item.name)) item.name = "HVD";
                    String key = "hvd";
                    RouteItem old = clean.get(key);

                    if (old == null) {
                        clean.put(key, item.copy());
                    } else {
                        old.merge(item);
                    }

                    continue;
                }

                if (item.type.equals("kvd")) {
                    if (!item.hasV() && !item.hasH()) continue;

                    String key = item.type + ":" + item.name;
                    RouteItem old = clean.get(key);

                    if (old == null) {
                        clean.put(key, item.copy());
                    } else {
                        old.merge(item);
                    }
                }
            }

            ArrayList<RouteItem> route = new ArrayList<>();

            for (RouteItem item : clean.values()) {
                if (item.type.equals("kvd") && item.hStijl.isEmpty() && sip != null) {
                    item.hRij = sip.hRij;
                    item.hStijl = sip.hStijl;
                    item.hStift = sip.hStift;
                }

                route.add(item);
            }

            HioParser.sortItems(route);
            items = route;
        }

        String displayText() {
            cleanupForDisplay();

            ArrayList<RouteItem> hvdItems = new ArrayList<>();
            ArrayList<RouteItem> kvdItems = new ArrayList<>();

            for (RouteItem item : items) {
                if (item.type.equals("hvd")) hvdItems.add(item);
                if (item.type.equals("kvd")) kvdItems.add(item);
            }

            ArrayList<String> routeNames = new ArrayList<>();

            for (RouteItem item : hvdItems) routeNames.add(("HVD " + item.name).trim());
            for (RouteItem item : kvdItems) routeNames.add(("KVD " + item.name).trim());
            routeNames.add("ISRA");

            int nameWidth = 7;
            for (String name : routeNames) if (name.length() > nameWidth) nameWidth = name.length();

            StringBuilder sb = new StringBuilder();

            if (!serviceId.isEmpty()) {
                sb.append(serviceId);
            }

            if (!routeLocked) {
                if (sb.length() > 0) sb.append("\n");
                sb.append(phaseMessage.isEmpty() ? "Route bepalen..." : phaseMessage);
                return sb.toString().trim();
            }

            for (RouteItem item : hvdItems) {
                String name = ("HVD " + item.name).trim();

                if (hasPair(item.hStijl, item.hStift)) {
                    appendRouteLine(sb, name, "H", valueHvd(item.hStijl, item.hRij, item.hStift), nameWidth);
                }

                if (hasPair(item.vStijl, item.vStift)) {
                    appendRouteLine(sb, "", "V", valueHvd(item.vStijl, item.vRij, item.vStift), nameWidth);
                }
            }

            for (int i = 0; i < kvdItems.size(); i++) {
                RouteItem item = kvdItems.get(i);
                String name = "KVD " + item.name;

                if (i == 0 && hvdItems.isEmpty() && hasPair(item.hStijl, item.hStift)) {
                    appendRouteLine(sb, name, "SIP", valueKvd(item.hStijl, item.hStift), nameWidth);

                    if (hasPair(item.vStijl, item.vStift)) {
                        appendRouteLine(sb, "", "V", valueKvd(item.vStijl, item.vStift), nameWidth);
                    }
                } else {
                    if (hasPair(item.vStijl, item.vStift)) {
                        appendRouteLine(sb, name, "V", valueKvd(item.vStijl, item.vStift), nameWidth);
                    }
                }
            }

            if (!dikader.isEmpty()) {
                appendRouteLine(sb, "ISRA", "", "Dik" + dikader, nameWidth);
            } else {
                appendRouteLine(sb, "ISRA", "", "", nameWidth);
            }

            return sb.toString().trim();
        }

        void appendRouteLine(StringBuilder sb, String name, String label, String value, int nameWidth) {
            if (sb.length() > 0) sb.append("\n");

            String left = String.format(Locale.ROOT, "%-" + nameWidth + "s", name == null ? "" : name);
            String tag = label == null || label.isEmpty() ? "   " : String.format(Locale.ROOT, "%-3s", label);
            String val = value == null ? "" : value.trim();

            sb.append(left).append(" ").append(tag).append(" |");

            if (!val.isEmpty()) sb.append(" ").append(val);
        }

        boolean hasPair(String a, String b) {
            return !a.isEmpty() && !b.isEmpty();
        }

        String valueHvd(String stijl, String rij, String stift) {
            if (rij == null || rij.isEmpty()) {
                return (stijl.isEmpty() ? "---" : stijl) + " " + (stift.isEmpty() ? "---" : stift);
            }

            return (stijl.isEmpty() ? "---" : stijl) + " " + rij + " " + (stift.isEmpty() ? "---" : stift);
        }

        String valueKvd(String stijl, String stift) {
            return (stijl.isEmpty() ? "---" : stijl) + " " + (stift.isEmpty() ? "---" : stift);
        }

        JSONObject toJson() {
            JSONObject object = new JSONObject();

            try {
                cleanupForDisplay();

                object.put("serviceId", serviceId);
                object.put("phone", phone);
                object.put("dikader", dikader);
                object.put("rawText", rawText);

                JSONArray array = new JSONArray();

                for (RouteItem item : items) {
                    array.put(item.toJson());
                }

                object.put("items", array);
            } catch (JSONException ignored) {}

            return object;
        }
    }
}