# Verificatie — 18 oktober 2026

Deze herstelkopie is gebaseerd op de lokale ToolsAPK 2/3-broncode. Die versies waren inhoudelijk gelijk, afgezien van macOS-metadata. De oorspronkelijke projectmappen zijn niet aangepast.

## Uitgevoerd

- Android `assembleDebug` en `testDebugUnitTest`: succesvol.
- Vijf nieuwe Java-tests voor lokale startpagina's, alle toolpaden, onbekende/foutadressen, externe adressen en projectsubpaden: geslaagd. Deze testen de adresherkenning, niet het fysieke swipegebaar.
- Negen Node-tests voor HTML/JavaScript, lokale assets, toolpaden, Excel-template en Excel-/ZIP-exportinhoud: geslaagd.
- Alle webbronbestanden vergeleken met de gekopieerde Android-assets: gelijk.
- APK-inhoud gecontroleerd: TV-codes, Kopermetingen, Fiber Route, PoP en Assistent aanwezig; GOF/EOF afwezig.
- Browser: TV-codes opent, browser-terug keert terug naar de startpagina, tandwiel opent en gedeeld Light/Dark-thema werkt bij paginanavigatie.
- Browser: Fiber Route-link, ingebouwde assistent en openen van de volledige assistent getest.
- Browser: HIO-tekst met fictieve routegegevens omgezet naar controleerbare velden en bestaand overnamebevestigingsvenster.
- Browser: PoP-checklist ingevuld met fictieve gegevens; ZIP met Excel gemaakt. Excel-/ZIP-inhoud aanvullend automatisch gecontroleerd.
- Browser: Qwen3-1.7B-model gedownload en geladen; echte lokale antwoordtest leverde `test geslaagd` op.
- Publicatieversie getest onder `/ToolsAPK/`; Fiber Route herlaadt uit de offline cache nadat de testserver is gestopt.
- `npm audit --omit=dev`: geen gemelde kwetsbaarheden.
- Native `HioScanActivity.java` is byte-identiek aan ToolsAPK 2; meetparser, TV-codelijsten en Excel-routeparser zijn niet herschreven.

## Navigatiewijziging

`MainActivity.java` verwerkt Android-terug via AndroidX OnBackPressedDispatcher. Alleen het lokale startadres of `index.html` met dezelfde origin telt als startpagina. Iedere andere of onbekende pagina gaat naar het expliciete lokale `index.html`. Terwijl die terugnavigatie loopt, worden dubbele events genegeerd. WebView-historie wordt gewist na het daadwerkelijk laden van de startpagina, zonder vaste timer.

De oude JavaScript App-pluginlisteners, Cordova-backlisteners en kunstmatige history-items zijn verwijderd uit de drie hoofdtools en de startpagina. De browser gebruikt zijn gewone terugnavigatie. De App-plugin is niet nodig voor de native handler.

## Nog op Android controleren

Er was geen Android-apparaat aangesloten en geen emulator-image beschikbaar. Daarom zijn onderstaande apparaattests nog niet uitgevoerd:

1. Open elke tool en doe één terug-swipe: de startpagina moet verschijnen.
2. Swipe terug op de startpagina: de APK moet sluiten.
3. Start HIO en kies Annuleren of swipe terug: Kopermetingen moet blijven staan.
4. Controleer camera-toestemming, Argus/LCL-scans, native HIO-herkenning en de Android-deelmenu's.
5. Controleer hoorbaar Dark Side (één piep) en Light Side (twee piepjes), inclusief de audiofallback.

De web-HIO-foto-OCR is beschikbaar, maar is nog niet met echte HIO-foto's gevalideerd. De APK gebruikt bij ontbrekend native llama.cpp de WASM-AI-runtime; AI-geheugengebruik en snelheid zijn nog niet op een telefoon gemeten.

## GitHub

Workflows voor Pages en Android zijn opgenomen. Er is nog niets naar GitHub gepusht en er is geen live publicatie geactiveerd. De Pages- en Android-workflows zijn lokaal voorbereid; uitvoering op GitHub Actions is nog niet geverifieerd.
