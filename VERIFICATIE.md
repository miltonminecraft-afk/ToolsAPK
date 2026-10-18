# Verificatie — 18 oktober 2026

Herstelkopie van ToolsAPK 2/3. De oorspronkelijke projectmappen zijn niet aangepast.

## Geslaagd

- 21 Node-tests: scripts en lokale assets, startschermlinks, Excel/ZIP-exportinhoud, HIO A/B/AA/AD, telefoonnummer-overname, ongeldige identifiers, LCL per service en positie, hergebruik van dikaders en groepering per meetrichting.
- Android `:app:assembleDebug`, `:app:assembleDebugAndroidTest` en `:app:testDebugUnitTest` bouwen lokaal succesvol.
- Java-tests voor navigatieadressen en native HIO-identifiers slagen.
- Alle 33 webbestanden komen overeen met de Android-assets na `npm run sync:android`.
- Browser: HIO-overname A/B/AA/AD inclusief posities, bevestiging en bewaren na herladen gecontroleerd met fictieve gegevens.
- Browser: LCL op KVD B opgeslagen, correcte positie in rapport. Gegroepeerde rapporten gecontroleerd met een afzonderlijke testfixture met fictieve gegevens.
- Browser: TV-codes, Fiber Route, PoP Excel/ZIP-export, thema, browser-terug en assistent gecontroleerd.
- Assistent: Qwen3-1.7B-model daadwerkelijk gedownload, geladen en antwoord gegenereerd op de Mac.
- Offline publicatie onder `/ToolsAPK/` gecontroleerd door de testserver te stoppen en opnieuw te laden.
- GitHub Pages is gepubliceerd: https://miltonminecraft-afk.github.io/ToolsAPK/
- GitHub-workflows voor Pages en APK hebben succesvol gedraaid. De laatste codeversie `c788ed8` slaagt in beide workflows. Pages gebruikt uitsluitend GitHub Actions; de oude branchpublicatie is uitgeschakeld.
- GOF/EOF verwijderd uit bron, startscherm en APK-assets.
- `npm audit --omit=dev`: geen gemelde kwetsbaarheden.

## Gewijzigd gedrag

Rapporten groeperen eerst per Service ID, daarna per meetpositie en richting. Omgekeerde richtingen blijven apart. Oorspronkelijke meetnummers blijven behouden. LCL bewaart de gekozen routepositie en wordt bij een bijbehorende meting weergegeven. Reeds opgeslagen LCL-routegegevens blijven behouden; ontbrekende oude routegegevens worden afgeleid uit de route van de juiste service. Dikaders mogen bij meerdere Service IDs worden gebruikt.

Native HIO accepteert compacte KVD A/B en verwerpt te lange puntnamen in plaats van ze af te kappen. De web-overname accepteert A/B/AA/AD en voegt een al opgenomen telefoonnummer niet opnieuw toe. De bestaande meetparser en oorspronkelijke OG-routes zijn behouden.

Android-terug gebruikt OnBackPressedDispatcher: vanuit tools terug naar het expliciete lokale startadres; vanaf de geladen startpagina sluit de app. Tijdens terugnavigatie worden dubbele events genegeerd. Een tijdens emulatortests gevonden Android-afwijking in URI-resolve is hersteld door het startpad expliciet op te bouwen.

## Apparaattests en beperkingen

GitHub Actions voert tests uit op Android API 35 en 36: hardware-terug, teruggebaar, sluiten op startpagina, HIO openen/annuleren en HIO-overname met behoud van een andere serviceroute. Beide jobs slagen: zeven tests op API 35 en zeven tests op API 36 (run 39120186502). Het API 36 XML-rapport bevestigt nul fouten, nul mislukkingen en nul overgeslagen tests.

De lokale Mac-emulator crasht vóór het opstarten van Android; daarom worden Linux-emulators op GitHub gebruikt. Er is geen fysieke telefoon aangesloten.

Echte HIO-fotoherkenning, camera/QR-scans, Android-deelmenu's, pieptonen en AI-snelheid/geheugengebruik op een telefoon zijn nog niet fysiek gevalideerd. De APK gebruikt de WASM-runtime wanneer de optionele native llama.cpp ontbreekt. Het modelbestand wordt apart gedownload en staat niet in Git.

GitHub-controles: [apparaatcontroles](https://github.com/miltonminecraft-afk/ToolsAPK/actions/runs/39120186502), [APK-build](https://github.com/miltonminecraft-afk/ToolsAPK/actions/runs/39120186483), [Pages-publicatie](https://github.com/miltonminecraft-afk/ToolsAPK/actions/runs/39120186501). De live Kopermetingen-HTML is byte voor byte vergeleken met de lokaal geteste bron.

## Compacte tekstcorrectie

De meettrajectkoppen en decoratieve scheidingslijnen zijn verwijderd. Isolatie en capaciteit staan elk op één regel. Groepering, oorspronkelijke meetnummers, posities, meetwaarden en LCL-koppelingen blijven behouden. De 21 Node-tests slagen opnieuw.
