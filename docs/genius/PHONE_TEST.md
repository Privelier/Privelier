# Handytest Looks

Schritt 7 aus `docs/genius/NEXT_SESSION.md`. Ein Test zählt erst als bestanden,
wenn er am echten Gerät mit den echten Testkonten gelaufen ist.

| Punkt | Stand |
|---|---|
| Gerät | iPhone, Expo Go für SDK 58 |
| App | `npx expo start --go --lan --port 8081 --no-dev --minify` |
| Barber | taha.metwally@outlook.de, Schalter an, Zeitzone `Africa/Cairo` |
| Kunde | titoacerlap@gmail.com, Schalter an, Zeitzone `Europe/Berlin` |
| Backend | Migrationen bis 0071, `delete-account` Version 9 |

Reihenfolge: Option A zuerst, weil es sonst keine abgeschlossene Buchung im
30-Tage-Fenster gibt und damit keinen Beweis-Look. "Zurückziehen" kommt zuletzt,
denn es nimmt dem Barber den Beweis, den Suche und Wünsche brauchen.

| # | Test | Konto | Erwartung | Ergebnis |
|---|---|---|---|---|
| 0 | App startet in Expo Go (React Native 0.88.1) | beide | App öffnet ohne Fehlermeldung, Anmeldung möglich | offen |
| A1 | Termin buchen: Montag 9.11., 09:00, Burst Fade | Kunde | Bestätigungsseite zeigt die Kartenvorschau, Anfrage wird gesendet | offen |
| A2 | Anfrage annehmen | Barber | Status "Angenommen" | offen |
| A3 | Sofort abschließen | Barber | "Als erledigt markieren" ist da und geht schon vor dem Termin | offen |
| A4 | Ergebnis festhalten | Barber | Details: "Ergebnis festhalten", Stil, Foto, "kein Gesicht", senden: "Wartet auf den Kunden" | offen |
| A5 | "Ist das dein Schnitt?" | Kunde | Eintrag in der Glocke, Fotos sichtbar, Ja, Zeigen: "Dein Look wird gezeigt" | offen |
| 6 | Look-Treffer | Kunde | Bewertung schreiben: Frage "Hat er deinen Look getroffen?" mit vorgewähltem Stil | offen |
| 7 | Echte Looks in Discover | Kunde | Leiste "Echte Looks", Stil filtern, Look öffnen: Beweiskette, "Diesen Look buchen" führt in die normale Buchung; der Barber sieht "Gebucht über deinen Look" | offen |
| 8 | Look suchen | Kunde | "Look suchen", Stil, Montag 9.11., Fenster, optional eigenes Foto: Barber mit Beweis und erster freier Zeit, nie eine Entfernung. "Um HH:MM buchen" springt zur Adresse | offen |
| 9 | Referenzfoto | Barber | Die Anfrage zeigt "Gebucht über die Look-Suche" und das Foto; nach Ablehnen ist es weg | offen |
| 10 | Look-Wunsch senden | Kunde | Suche ohne Treffer: "Als Wunsch senden" öffnet "Deine Look-Wünsche", Status "Offen für Angebote bis ..." | offen |
| 11 | Angebot machen | Barber | Eintrag "Look-Wunsch in deiner Stadt", Service, Beginn, Notiz, "Angebot senden"; ein belegter Beginn zeigt "Zu dieser Zeit bist du nicht frei" | offen |
| 12 | Angebot buchen | Kunde | Angebot mit Preis und Notiz, "Um HH:MM buchen" führt zur Adresse, danach normale Anfrage; der Wunsch steht auf "Gebucht" | offen |
| 13 | Look-Pass | Kunde | "Dein Look-Pass", Wunsch und Ergebnis nebeneinander, "Diesen Look wieder" führt zu Datum und Uhrzeit beim selben Barber | offen |
| 14 | Deine Looks | Barber | Studio zeigt die Karte "Deine Looks": bestätigte Looks pro Stil, "Quote folgt" bis genug Bewertungen da sind | offen |
| 15 | Nicht mehr zeigen, Zurückziehen | Kunde | Status wechselt, Fotos verschwinden | offen |

## Später, mit einem dritten Testkonto

| Test | Grund |
|---|---|
| Kontolöschung | Würde sonst das Testkonto des Kunden löschen. Gründerentscheidung von Taha am 2026-11-02. |
| Schalter aus | Geht nur mit einem Konto, für das der Schalter nicht an ist. |
