export const TOOL_GUIDE=`Gecontroleerde werking van deze app:
Kopermetingen HIO: open Kopermetingen, kies Scan vanaf HIO, scan het HIO-scherm (Android) of kies een foto/plak HIO-tekst (browser), controleer Service ID, HVD/KVD, stijlen, cassette en stiften, bevestig Overnemen. HIO neemt de route en posities over; het is geen elektrische meting. Er is geen HIO Export- of Sjabloon-knop. Vul afstanden apart in.
Argus: selecteer bij METING de juiste Service ID, dikader, Locatie en Richting. Kies Scan Argus QR-code en scan de code van het meetapparaat. Controleer lengte, isolatie AB/AG/BG, capaciteit, Delta C, DC en AC. De QR kiest niet automatisch de Service ID of positie.
LCL: selecteer bij LCL-METING dezelfde Service ID en de meetlocatie. Scan LCL QR-code of vul LCL in en kies Opslaan LCL. De app bewaart de gekozen positie en toont LCL bij de bijbehorende meting.
Nieuwe positie: alleen voor een gewijzigde aansluiting. Kies Service ID en Nieuwe positie, vul de gewijzigde stijl/cassette/stift in en kies Opslaan zonder scan of scan een nieuwe Argus-meting. Gebruik dit niet om alleen de meetlocatie te kiezen.
Tekstdocumenten: Hoofddocument, OG aansturing en Route hersteld. Metingen staan per Service ID en per richting bij elkaar. Omgekeerde richtingen blijven apart. Kopieer tekst of deel via het deelmenu. KPN-tekst gebruikt gewone tekens zoals ohm en Mohm. Dezelfde dikader mag op meerdere Service IDs voorkomen.
TV-codes: open Afstandsbediening codes, kies het juiste type afstandsbediening en TV-merk; gebruik de codes en instructies die de tool toont. Verzin geen TV-codes.
Fiber Route: open Value Fiber Route, importeer de Excel-koppelbon en controleer route, locaties en segmentlengtes. Gebruik de getoonde segmenten bij OTDR-keuzes.
PoP: vul Checklist PoP in, voeg foto's toe en maak de ZIP/Excel-export. Controleer voor delen de ingevulde gegevens.
Er zijn geen vastgelegde KPN-meetgrenzen in deze uitleg. Verzin geen grenswaarden of actuele storingen.`;
const overview=`Zo gebruik je Kopermetingen:
1. Scan de HIO-gegevens en controleer en bevestig de route en posities.
2. Kies bij METING de Service ID, dikader, locatie en richting. Scan daarna de Argus QR-code.
3. Kies bij LCL-METING dezelfde Service ID en de juiste locatie; scan of vul LCL in en sla op.
4. Gebruik NIEUWE POSITIE alleen bij een gewijzigde aansluiting.
5. Controleer het tekstdocument en kopieer of deel de tekst.
[OPEN_TOOL:kopermetingen]`;
export function guidedAnswer(text,previous=[],tool=''){
 const q=String(text).trim().toLowerCase();const prior=previous.filter(m=>m.role==='user').slice(-3).map(m=>m.content).join(' ').toLowerCase();
 if(/(grenswaarde|meetgrens|kpn.norm|kpn.grens|maximaal.toegestaan|minimaal.vereist)/.test(q))return 'Onzeker: deze app bevat geen geverifieerde KPN-meetgrenzen. Gebruik de actuele KPN-werkinstructie. Ik geef geen zelfbedachte grenswaarden.';
 if(/^(hoi|hallo|hey|goedemorgen|goedemiddag)[!. ]*$/.test(q))return 'Stel je technische vraag.';
 if(/\bhio\b/.test(q)||(/^(alles|ja|hoe|hoe meet ik|leg uit|stappen)[.!? ]*$/.test(q)&&(/hio|meting|koper/.test(prior)||tool==='kopermetingen'))){if(q==='alles'||q==='hoe meet ik')return overview;return `HIO overnemen doe je zo:
1. Open Kopermetingen en kies Scan vanaf HIO.
2. Android: richt de camera op het HIO-scherm. Browser: kies een foto of plak de HIO-tekst.
3. Controleer Service ID, HVD/KVD, stijl, cassette en stift. Kies daarna Overnemen.
4. Vul de routeafstanden apart in. Kies voor een elektrische meting de locatie en richting en scan vervolgens de Argus QR-code.
HIO leest de aansluitgegevens; het voert zelf geen elektrische meting uit.
[OPEN_TOOL:kopermetingen]`;}
 if(/^(hoe meet ik|hoe werkt kopermetingen|alles over kopermetingen)[?!. ]*$/.test(q))return overview;
 if(/\blcl\b/.test(q)&&!/grens|norm|hoeveel|waarde|beteken/.test(q))return 'LCL opslaan:\n1. Kies bij LCL-METING dezelfde Service ID als de koperverbinding.\n2. Kies de meetlocatie; controleer de getoonde richting.\n3. Scan LCL QR-code of vul de LCL-waarde in en kies Opslaan LCL.\n4. Controleer in het document of de LCL bij de juiste positie staat.\n[OPEN_TOOL:kopermetingen]';
 if(/argus/.test(q)&&!/grens|norm|beteken/.test(q))return 'Argus-meting toevoegen:\n1. Kies bij METING de juiste Service ID en dikader.\n2. Kies Locatie en Richting.\n3. Kies Scan Argus QR-code en scan de code van het meetapparaat.\n4. Controleer de overgenomen meetwaarden en het tekstdocument. De QR-code stelt de locatie niet automatisch in.\n[OPEN_TOOL:kopermetingen]';
 return '';
}
