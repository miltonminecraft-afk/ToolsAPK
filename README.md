# Tools — Android en GitHub Pages

Eén broncode in `www/` voor Android (Capacitor) en de browser. De app bevat Kopermetingen, TV-codes, Value Fiber Route, Checklist PoP en uitleg per onderdeel.

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

Dit test de publicatieversie lokaal. De serviceworker bewaart appbestanden voor offline gebruik nadat de eerste installatie volledig is afgerond. Op een volgende start wordt een nieuwe versie opgehaald; herlaad de pagina nadat de nieuwe versie is opgehaald. De ontwikkelserver gebruikt geen offline cache.

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
| Uitleg per onderdeel | Lokaal, ook beschikbaar in de offline cache | In de APK gebundeld |

QR, Excel en OCR zijn lokaal gebundeld. HIO-fotoherkenning gebeurt op het apparaat; controleer de herkende posities. De webparser herkent gelabelde H/V-velden en kan minder gegevens automatisch invullen dan de native Android-parser.

Formulieren en foto's blijven op het betreffende apparaat. Ze worden niet automatisch tussen APK en browser gesynchroniseerd. Maak een export voordat je browsergegevens wist.

## Verificatie

`npm test` controleert JavaScript-syntaxis, lokale assets, toolpaden, de Excel-template en Excel-/ZIP-inhoud na export. Zie `VERIFICATIE.md` voor de uitgevoerde controles en resterende apparaattests.

## Meetrapporten

Metingen staan per Service ID bij elkaar en worden daarbinnen gegroepeerd op meetpositie en richting naar dezelfde verdeler. De oorspronkelijke metingnummers blijven behouden. LCL blijft gekoppeld aan de opgeslagen positie; dezelfde dikader mag voor meerdere Service IDs worden gekozen. Bestaande meetgegevens worden niet gewist.

## Direct installeren

De actuele test-APK staat in de projectmap als `Tools.apk`. Dit is dezelfde versie als de meegeleverde webbron. Installeer deze op Android om de app te testen. Bouwmappen kunnen opnieuw worden aangemaakt met de bovenstaande opdrachten.

## Samenhangende testgegevens

Open `Testdocument QR en HIO.pdf` in deze projectmap. De actuele set bevat 21 paginas, vier HIO-routes, achttien Argus-codes en twaalf LCL-codes. Alle losse afbeeldingen, HIO-tekst, JSON en QR-payloads staan in `Testgegevens/`. De onafhankelijke decoder en de huidige app-parsers hebben alle testgegevens gecontroleerd; zie `Testgegevens/controle.json`. Kies voor elke scan zelf de velden die boven de code staan. Gebruik fictieve testgegevens in een afzonderlijke sessie.

## Info over onderdelen

Open **Info over onderdelen** op het startscherm voor de uitleg van Kopermetingen, TV codes, Value Fiber Route en Checklist PoP. In ieder onderdeel staat direct onder de kop een uitklapbare **Uitleg** met dezelfde gebruiksstappen. De uitleg werkt zonder modeldownload of online dienst.

De assistent, modelruntime, native AI-bridge en bronservercode zijn verwijderd. De oude assistentlink verwijst naar de informatiepagina. De bestaande meetgegevens zijn behouden.
