# Privelier Looks: Look-first statt Barber-first

Auftrag von Taha, 2026-10-28: Idee 4 ("echte Looks" plus "Wunsch")
als Zusatzfunktion, vorher kritisch und pessimistisch bewertet, bis die
beste umsetzbare Version steht. Das Konzept bleibt unangetastet: ein Kunde,
sein Barber, privat und premium bei ihm zu Hause. Alles liegt hinter einem
Feature-Schalter und ist für echte Nutzer unsichtbar, bis Taha ihn einschaltet.

## 1. Pitch

**Bei Privelier suchst du keinen Barber, du zeigst deinen Look.** Privelier
findet die Barber, die genau diesen Look nachweislich bei echten Kunden
geschnitten haben, und zwar zu deiner Wunschzeit bei dir zu Hause. Jeder Look
im Feed ist doppelt bestätigt: von einem abgeschlossenen Termin und vom
Kunden selbst. Und jeder Barber hat eine Quote, die es nirgends gibt: wie oft
er den gewünschten Look wirklich getroffen hat.

Die größte Angst bei jedem Haarschnitt lautet: "Macht er das, was ich will?"
Privelier beantwortet sie mit Beweisen statt mit Instagram-Fotos.

## 2. Wie die Idee durch die Kritik besser wurde

| Runde | Version | Pessimistischer Einwand | Konsequenz |
|---|---|---|---|
| 1 | Kunde postet Wunsch, Barber bieten mit Preisen | Bieten macht aus Premium einen Billigmarkt (MyHammer-Effekt) | **Gestrichen.** Preis ist immer der normale Service-Preis des Barbers |
| 1 | Warten auf Angebote ist der Hauptweg | Tote Wartezeit, Kunde springt ab, nachts antwortet keiner | **Umgedreht.** Erst sofortige Treffer aus Beweisen und freien Zeiten, der Wunsch ist nur der Rückfallweg |
| 1 | KI erkennt den Look auf dem Foto | Gründerregel (keine KI-Empfehlungen), Nähe zu Biometrie, Fehlerquote | **Gestrichen.** Feste Stil-Kategorien, die der Barber beim Ergebnis antippt |
| 2 | Barber lädt Ergebnisfotos selbst hoch | Er könnte fremde Arbeit hochladen | **Verschärft.** Nur zu einem abgeschlossenen Termin, und der Kunde muss bestätigen: "Das ist mein Schnitt" |
| 2 | Fotos mit Gesicht | Recht am eigenen Bild (KUG), DSGVO, viele sagen Nein | **Standard:** Hinterkopf und Seite, kein Gesicht. Gesicht nur nach Entscheidung L1 |
| 2 | Feed ist zum Start leer | Wenige Barber, wenige Termine | **Abgefangen.** Portfolio-Bilder dürfen erscheinen, klar markiert als "Portfolio, nicht bestätigt". Bestätigte Looks immer zuerst |
| 2 | Treffer-Quote nach einer einzigen Bewertung | Eine Stimme verzerrt alles, wirkt unseriös | **Mindestanzahl** (L6), vorher steht "noch zu wenige Termine" |
| 3 | Instagram-Screenshot des Kunden wird öffentlich | Urheberrecht, Privatsphäre | **Nie öffentlich.** Referenzfoto geht privat nur an den gebuchten Barber |
| 3 | Haarstruktur als Filter (Locken, Afro) | Wertvoll, aber rechtlich heikel (mögliche Rückschlüsse auf Herkunft) | **Nicht im MVP.** Entscheidung L5 nach rechtlicher Prüfung |
| 3 | Fotos öffentlich im Web | Unnötige Angriffsfläche | **Nur in der App**, privater Speicher, kurzlebige Links |

## 3. Die finale Version: 5 Bausteine

| # | Baustein | Was der Nutzer erlebt |
|---|---|---|
| B1 | **Beweis-Look** | Nach einem abgeschlossenen Termin macht der Barber bis zu 3 Fotos (Hinterkopf, Seite) und tippt die Stil-Kategorien an. Der Kunde bekommt eine Nachricht: "Ist das dein Schnitt?" und "Darf er gezeigt werden?". Erst nach beiden Ja wird daraus ein bestätigter Look. Jederzeit widerrufbar |
| B2 | **Look-Treffer** | Zusammen mit der Bewertung eine Frage mit einem Tipp: "Hat er deinen Look getroffen?" Genau / fast / nein. Daraus entsteht pro Barber und Stil die Quote "Skin Fade: 94 % getroffen, 31 Termine" |
| B3 | **Looks-Feed und "Diesen Look"** | Discover zeigt echte, bestätigte Looks aus deiner Stadt, filterbar nach Stil. Jeder Look trägt seine Beweiskette: Termin abgeschlossen, vom Kunden bestätigt, Bewertung, Ankunft per GPS (wenn vorhanden). "Diesen Look" startet die normale Buchung beim Barber mit dem passenden Service, der Look hängt als Referenz an |
| B4 | **Look-Suche** | Eigenes Foto oder ein Look aus dem Feed, dazu Stil und Zeitfenster ("Fr. 18 bis 20 Uhr"). Sofort erscheinen die Barber, die diesen Stil nachweislich geschnitten haben und in dem Fenster frei sind, sortiert nach Look-Treffer. Das Foto geht privat an den gebuchten Barber |
| B5 | **Look-Wunsch** (Rückfallweg) | Niemand passt oder ist frei: Der Wunsch geht an die Barber der Stadt mit Beweisen in diesem Stil. Sie schlagen eine Zeit vor, Preis ist ihr normaler Service-Preis, plus eine kurze Notiz. Der Kunde wählt, daraus wird eine ganz normale Buchung |
| Bonus | **Look-Pass** | Der Kunde sieht seine eigenen Looks privat: Referenz und Ergebnis nebeneinander. "Diesen Look wieder" bucht denselben Barber |

## 4. Die Schleife

```
Termin abgeschlossen ──► Barber hält Ergebnis fest ──► Kunde bestätigt
        ▲                                                  │
        │                                                  ▼
mehr Buchungen für ihn ◄── bessere Treffer in Suche ◄── Beweis und Quote wachsen
```

Für den Barber ist jeder bestätigte Look direkt Geld wert: Er wird in Feed
und Suche weiter oben gezeigt. Deshalb macht er die 20 Sekunden nach jedem
Termin freiwillig.

## 5. Warum es das so nicht gibt (per Webrecherche geprüft am 2026-10-28)

Quellen und Details in docs/genius/LOOKS_REVIEW.md Abschnitt 5. Drei
Aussagen der ersten Fassung waren zu stark und sind korrigiert.

| Gibt es schon | Gibt es nicht |
|---|---|
| Portfolios bei Booksy, Fresha, Treatwell; bei Fresha mit Service-Verknüpfung und "Jetzt buchen" direkt am Bild | Fotos, die der Barber zu einem abgeschlossenen Termin festhält **und** die der Kunde als "mein Schnitt" bestätigt, nach Stil erfasst |
| Kundenfotos in Bewertungen nach dem Termin (Booksy, laut Drittanbietern) | Diese Fotos als Beweis für Suche und Ranking pro Stil |
| Sternebewertungen, "verifizierte" Bewertungen (theCut, Treatwell) | Eine gemessene Quote, wie oft der gewünschte Look getroffen wurde (nirgends gefunden) |
| Suche nach Stil (theCut), Ranking nach getaggten Fotos (StyleSeat) | Suche nach Look, gefiltert auf nachgewiesenes Können **und** freie Zeit **und** Termin bei dir zu Hause |
| Vom Portfoliobild direkt buchen (Fresha) | Den Barber buchen, der genau diesen Stil nachweislich bei echten Kunden getroffen hat |

## 6. Was sich im Code ändert (alles zusätzlich, verbessert nach der Prüfung)

Die Begründung jeder Änderung gegenüber der ersten Fassung steht in
docs/genius/LOOKS_REVIEW.md (Kürzel X, R, P in Klammern).

| Bereich | Neu |
|---|---|
| Schalter | `private.feature_flags`, `private.feature_flag_users` (nicht per API erreichbar, P1), `public.my_feature_flags()`, `private.flag_enabled(key)`. Fehlt die Funktion oder der Schalter, bleibt alles aus. **Der Server prüft den Schalter in jeder Look-Funktion und Look-Policy selbst** (X1) |
| Einstellungen | `private.looks_settings` (eine Zeile): Mindestanzahl Look-Treffer (5, L6), Entwurf gültig (14 Tage, L10), Wunsch-Laufzeit (48 h), maximale Fensterlänge, Limits. Änderbar per SQL ohne Migration |
| Stil-Kategorien | Feste Liste `look_styles` (Skin Fade, Low Fade, Taper, Buzz, Crop, Mullet, Scissor Cut, Bart-Kontur, Bart voll) mit deutschem und englischem Namen, gepflegt per Migration, nicht von Nutzern änderbar |
| Looks | `looks` (Buchung, Barber, Kunde, Service, Stile, Status `draft` / `confirmed` / `published` / `declined` / `withdrawn` (P2), Zeitpunkte der Bestätigung und Einwilligung mit Version `looks-placeholder-1`, Bestätigung "kein Gesicht" durch den Barber (R3)), `look_photos` (bis 3, mit Lock, P6), privater Bucket `looks` (10 MB, nur Bilder, X4), kurzlebige signierte Links mit eigener Lese-Policy (X5) |
| Look-Treffer | `look_feedback` (eine pro abgeschlossener Buchung, nur vom Kunden dieser Buchung, genau / fast / nein). **Den Stil wählt der Kunde**, nicht der Barber (X6). Nur "genau" zählt als Treffer (L7) |
| Referenz | `look_references`, privater Bucket `look-references`: sichtbar nur für den Kunden und den Barber der Buchung, bei Wünschen für die passenden Barber, solange der Wunsch offen ist. Wird erst **nach** der erfolgreichen Buchung angehängt (R5) |
| Wünsche | `look_wishes` (Stil, Zeitfenster an einem Tag, Stadt aus dem Profil, **keine grobe Lage** (R1), Ablauf nach 48 h oder bei Fensterbeginn, beim Lesen berechnet (P9)), `look_wish_offers` (Barber, Zeitvorschlag im Fenster, Service, Notiz bis 280 Zeichen mit Sperrliste) |
| Funktionen | `create_look_draft`, `add_look_photo`, `submit_look`, `respond_to_look`, `withdraw_look`, `submit_look_feedback`, `barber_look_stats` (mit Mindestanzahl), `looks_feed`, `look_detail`, `attach_look_reference`, `match_look` (Barber, Beweis-Anzahl, Quote, erste freie Zeit, **keine Entfernung**, nie Lage, R1), `create_wish`, `offer_for_wish`, `accept_offer(offer, booking)` (verknüpft eine über `create_booking` erzeugte normale Buchung, P10), `my_looks` |
| Bestehendes erweitern | Meldungen (0056) um Look, Wunsch, Angebot; Sperrliste für Notizen; Limits (0055); Benachrichtigungstypen (für Wünsche wird `notifications.booking_id` nullable, X2); **Kontolöschung**: Zeilen per Kaskade, Dateien über die erweiterte Edge Function delete-account (X3, neu deployen); Blockieren gilt auch für Entwürfe, Feed, Suche und Wünsche |
| Fotos | Bestehendes EXIF-Entfernen (`normalizeImageForUpload`, P7), Größen- und Typ-Grenzen, Obergrenzen pro Look und pro Barber-Ordner, Systemfoto-Auswahl ohne Kamera-Berechtigung (P8) |
| Screens Barber | Ergebnis festhalten (im Termin-Detail nach "Abschließen"), Wünsche in der Stadt, Angebot senden, Stil-Statistik im Studio |
| Screens Kunde | Feed in Discover, Look-Detail mit Beweiskette, "Diesen Look", Look-Suche, Wunsch senden, Angebote vergleichen, Bestätigung "Ist das dein Schnitt?", Look-Treffer auf dem Bewertungs-Screen, Look-Pass |

Keine neuen Buchungsstatus, keine KI, keine Zahlungen, keine Gesichtserkennung,
keine neue native Abhängigkeit, kein Standort.

## 7. Restrisiken nach der Kritik

| Risiko | Wie wahrscheinlich | Gegenmittel |
|---|---|---|
| Barber halten Ergebnisse nicht fest | mittel | Nur 20 Sekunden, direkt nach "Abschließen", sichtbarer Vorteil im Ranking |
| Kunden sagen Nein zum Zeigen | mittel | Look zählt trotzdem für die Quote, nur ohne Foto |
| Moderationsaufwand | niedrig | Fotos nur aus echten Terminen mit Kundenbestätigung, Melden plus 24-h-Prozess (F18) |
| Eingriff in Kontolöschung | mittel | Eigene Migration mit Tests aus der bestehenden Lösch-Suite |
| Umfang für eine Nacht | hoch | Bau in Scheiben, jede für sich fertig und getestet |

## 8. Bau-Reihenfolge (jede Scheibe für sich fertig)

| Scheibe | Inhalt |
|---|---|
| S1 | Feature-Schalter |
| S2 | Beweis-Look und Look-Treffer (das Fundament, ohne Beweise ist der Rest wertlos) |
| S3 | Looks-Feed, Look-Detail, "Diesen Look" mit Referenz |
| S4 | Look-Suche mit sofortigen Treffern |
| S5 | Look-Wunsch und Angebote |
| S6 | Look-Pass |

## 9. Entscheidungen für Taha

| # | Frage | Optionen | Vorschlag |
|---|---|---|---|
| L1 | Fotos mit Gesicht | nie / mit ausdrücklicher Einwilligung | nie, für den Start |
| L2 | Wer sieht den Feed | alle angemeldeten Nutzer / nur Kunden | nur Kunden |
| L3 | Angebot angenommen | Buchung wartet auf einen Bestätigungs-Tipp des Barbers (passt zu den Regeln) / gilt sofort als angenommen (braucht Regel-Ausnahme) | Bestätigungs-Tipp |
| L4 | Reichweite eines Wunsches | gleiche Stadt / Umkreis in km | gleiche Stadt (passt zur heutigen Suche) |
| L5 | Haarstruktur als Filter | ja nach rechtlicher Prüfung / nein | erst prüfen |
| L6 | Look-Treffer sichtbar ab | 5 / 10 bewerteten Terminen | 5 |
