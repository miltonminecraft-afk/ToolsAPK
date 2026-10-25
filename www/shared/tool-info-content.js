export const PARTS = {
  "kopermetingen": {
    "title": "Kopermetingen TXT",
    "path": "../kopermetingen/index.html",
    "intro": "Vul aansluitgegevens handmatig in of neem ze over met een HIO-scan. Voeg meetgegevens toe en maak compacte tekstrapporten per Service ID.",
    "sections": [
      [
        "Route en posities: handmatig of scannen",
        [
          "Handmatig: vul de route, Service ID en aansluitposities in de bijbehorende velden in. Een HIO-scan is niet nodig.",
          "Scannen: kies Scan vanaf HIO. Scan het HIO-scherm op Android, of kies in de browser een foto of plak HIO-tekst. Controleer de herkenning en kies Overnemen.",
          "Controleer bij beide manieren Service ID, HVD/KVD, stijl, cassette en stift. Vul de routeafstanden in. HIO neemt aansluitgegevens over; het voert geen elektrische meting uit."
        ]
      ],
      [
        "Argus: meting toevoegen",
        [
          "Kies bij METING de juiste Service ID en dikader. Dezelfde dikader mag bij meerdere Service IDs voorkomen.",
          "Kies Locatie en Richting voordat je Scan Argus QR-code gebruikt. De code kiest deze velden niet voor je.",
          "Controleer de overgenomen lengte, isolatie AB/AG/BG, capaciteit, Delta C, DC en AC."
        ]
      ],
      [
        "LCL: koppelen aan de meetpositie",
        [
          "Kies bij LCL-METING de juiste Service ID en meetlocatie. Controleer de getoonde richting.",
          "Kies één van beide: scan de LCL QR-code of vul de LCL-waarde handmatig in. Kies daarna Opslaan LCL.",
          "Controleer in het document of de LCL bij de juiste positie en meting staat."
        ]
      ],
      [
        "Nieuwe positie en tekstrapport",
        [
          "Gebruik NIEUWE POSITIE alleen bij een gewijzigde aansluiting, niet om de meetlocatie te kiezen. Vul de gewijzigde stijl, cassette en stift in; sla op zonder scan of scan een nieuwe Argus-meting.",
          "Controleer Hoofddocument, OG aansturing of Route hersteld. Metingen staan per Service ID en daarbinnen per positie en richting bij elkaar. Omgekeerde richtingen blijven apart.",
          "Kopieer of deel de tekst. Eenheden worden als gewone tekens geschreven, bijvoorbeeld ohm en uF."
        ]
      ]
    ],
    "note": "Deze uitleg bevat geen KPN-meetgrenswaarden. Gebruik daarvoor de geldende werkinstructie."
  },
  "tv-codes": {
    "title": "TV codes",
    "path": "../tv-codes/index.html",
    "intro": "Zoek de programmeercodes voor een televisie en het gekozen type afstandsbediening.",
    "sections": [
      [
        "Code zoeken en gebruiken",
        [
          "Kies eerst Type afstandsbediening.",
          "Zoek het tv-merk met Snel zoeken of kies Merk televisie. Klik op Toon codes.",
          "Volg de stappen onder Programmeren voor het gekozen type afstandsbediening.",
          "Test de bediening. Werkt de code niet, kies Volgende en probeer de volgende getoonde code."
        ]
      ]
    ],
    "note": "Deze tool helpt met afstandsbedieningscodes. Voor het aansluiten van een tv-ontvanger gebruik je de handleiding van het exacte apparaatmodel."
  },
  "value-fiber-route": {
    "title": "Value Fiber Route",
    "path": "../fiber%20route/index.html",
    "intro": "Lees een Excel-koppelbon in en bekijk de route, locaties en gegevens voor het testen.",
    "sections": [
      [
        "Van koppelbon naar route",
        [
          "Kies op Import de knop Excel-koppelbon kiezen en selecteer het Excel-bestand.",
          "Controleer Importstatus. Los een gemelde importfout op voordat je de route gebruikt.",
          "Open Route voor de verbinding en segmenten. Open Locaties voor de aansluitlocaties.",
          "Open Testen en controleer de gekozen meetrichting en de segmentlengtes voor je OTDR-test."
        ]
      ]
    ],
    "note": "Controleer of de ingelezen koppelbon bij de juiste verbinding hoort. De app leest de bon; ze voert geen OTDR-meting uit."
  },
  "pop-checklist": {
    "title": "Checklist PoP",
    "path": "../pop-checklist/index.html",
    "intro": "Leg een PoP-controle vast met antwoorden, opmerkingen en foto’s en exporteer de resultaten.",
    "sections": [
      [
        "Controle invullen en delen",
        [
          "Vul Naam monteur, Datum controle, Naam PoP en Straat / plaats in.",
          "Kies per controlepunt Ja, Nee of NVT. Vul waar nodig Gemeld en Opmerking in.",
          "Voeg met + Foto de bijbehorende foto’s toe. Controleer de gekozen afbeeldingen.",
          "Kies ZIP maken voor het Excel-bestand met de losse foto’s. Controleer de export voordat je die deelt.",
          "Gebruik de deelfunctie als die beschikbaar is. Download anders de ZIP en voeg die zelf toe aan je bericht."
        ]
      ]
    ],
    "note": "Controleer voor het delen of alle gegevens en foto’s compleet zijn."
  }
};
