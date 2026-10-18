# Tools — Android en GitHub Pages

Eén broncode in `www/` voor Android (Capacitor) en de browser. De app bevat Kopermetingen, TV-codes, Value Fiber Route, Checklist PoP en de lokale AI-assistent.

## Lokaal starten

Vereist: Node.js 22 of nieuwer.

```sh
npm ci
npm test
npm start
```

Open http://localhost:4173. Open HTML niet rechtstreeks via `file://`: modules, camera en Excel-template hebben een webserver nodig.

## GitHub Pages

Bibliotheken worden bij de eerste test of build automatisch gedownload en met SHA-256 gecontroleerd. Ze blijven daarna lokaal beschikbaar.

Upload de inhoud van deze projectmap naar de hoofdmap van de repository, inclusief `.github/`, `www/`, `scripts/`, `tests/`, `android/` en `package-lock.json`. Laat `node_modules/`, `dist/`, `android/local.properties` en buildmappen buiten Git.

Kies in GitHub **Settings → Pages → Build and deployment → Source: GitHub Actions**. De workflow `Web en GitHub Pages` test en publiceert bij een push naar `main`. De workflow werkt ook met een projectpad zoals `/ToolsAPK/`; een eigen domein is niet nodig.

```sh
npm run build
node scripts/serve.cjs --dist
```

Dit test de publicatieversie lokaal. De serviceworker bewaart appbestanden voor offline gebruik nadat de eerste installatie volledig is afgerond. Op een volgende start wordt een nieuwe versie opgehaald; sluit andere geopende Tools-tabbladen om een wachtende update te activeren. De ontwikkelserver gebruikt geen offline cache.

## Android

Installeer Android Studio met JDK 21 en Android SDK 36. Laat Android Studio `android/local.properties` voor jouw computer aanmaken of stel `ANDROID_HOME` in.

```sh
npm ci
npm run sync:android
cd android
./gradlew assembleDebug
```

APK: `android/app/build/outputs/apk/debug/app-debug.apk`. Op Windows gebruik je `gradlew.bat`. De GitHub-workflow `Android APK` bouwt en test dit ook en bewaart de test-APK als downloadbaar artifact. Een debug-APK is bedoeld om te testen. Voor Play Store-distributie is een eigen releasehandtekening nodig.

## Verschillen per platform

| Functie | Browser / GitHub Pages | Android |
| --- | --- | --- |
| Formulieren, TV-codes, routes | Lokaal | Lokaal |
| Excel-import en Excel/ZIP-export | Lokaal gebundelde bibliotheken | Dezelfde code |
| Argus- en LCL-QR | Camera via HTTPS/localhost en toestemming | WebView-camera |
| HIO | Foto of schermafbeelding herkennen; tekst en route handmatig corrigeren | CameraX + ML Kit |
| Delen | Browser-deelmenu als ondersteund; download als terugvaloptie | Capacitor Share / Filesystem |
| AI | Lokaal WASM-model na eenmalige download | Native llama.cpp indien aanwezig, anders dezelfde WASM-runtime |

De meegeleverde Android-bron bevat geen `android/llama.cpp`. Daarom gebruikt deze APK de WASM-terugvaloptie voor AI. De optionele C++-integratie is bewaard maar niet meegebouwd of getest.

Het AI-model Qwen3-1.7B Q4_K_M wordt apart opgehaald van Hugging Face wanneer je **Model installeren** kiest (ongeveer 1,28 GB). Het vereist voldoende opslag en werkgeheugen. Dit bestand gaat niet naar GitHub. QR, Excel, OCR, wllama en WASM zijn lokaal gebundeld. HIO-fotoherkenning gebeurt op het apparaat; controleer altijd de herkende posities. De webparser herkent gelabelde H/V-velden en kan minder gegevens automatisch invullen dan de native Android-parser.

Formulieren, foto's en chat blijven in de lokale opslag van het betreffende apparaat en de betreffende website. Ze worden niet automatisch tussen APK en browser gesynchroniseerd. Wissen van browsergegevens kan deze gegevens verwijderen. Zoekopdrachten openen een externe zoekpagina en vereisen internet.

## Verificatie

`npm test` controleert JavaScript-syntaxis, lokale assets, toolpaden, de Excel-template en Excel-/ZIP-inhoud na export. Zie `VERIFICATIE.md` voor de uitgevoerde controles en resterende apparaattests.

## Meetrapporten

Metingen staan per Service ID bij elkaar en worden daarbinnen gegroepeerd op meetpositie en richting naar dezelfde verdeler. De oorspronkelijke metingnummers blijven behouden. LCL blijft gekoppeld aan de opgeslagen positie; dezelfde dikader mag voor meerdere Service IDs worden gekozen. Bestaande meetgegevens worden niet gewist.
