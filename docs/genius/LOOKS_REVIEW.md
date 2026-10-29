# LOOKS: pessimistische Prüfung gegen den echten Code

Stand: 2026-10-28, Nachtschicht. Geprüft wurde docs/genius/LOOKS.md gegen
origin/main 501f7f2 (Migrationen 0001 bis 0061, Edge Function
delete-account, Kunden- und Barber-Screens). Konzept, Gründerregeln und die
Entscheidungen L1 bis L6 bleiben unverändert; gebaut wird mit den
vorgeschlagenen Standardwerten, alle Grenzwerte sind in einer
Einstellungstabelle änderbar.

Einschränkung dieser Prüfung: Der Supabase-MCP-Server war heute Nacht nicht
erreichbar, und es gibt lokal kein Postgres. Alle Aussagen beruhen auf den
Migrationsdateien im Repo, nicht auf der Live-Datenbank. Die pgTAP-Tests sind
geschrieben, aber nicht ausgeführt (siehe Abschnitt 6).

## 1. Blocker (ohne Lösung wäre der Bau falsch oder unsicher)

| # | Befund | Beleg im Code | Lösung (so gebaut) |
|---|---|---|---|
| X1 | Ein reiner Client-Schalter versteckt nur, er schaltet nichts ab. Jeder mit dem Publishable Key könnte Look-Tabellen und RPCs direkt aufrufen | PostgREST stellt alles in `public` bereit, Rate-Limit nur pro Request (0055) | Jede Look-RPC und jede Look-RLS-Policy prüft serverseitig `private.flag_enabled('looks')`. Ist der Schalter aus, liefern Lesefunktionen nichts und Schreibfunktionen werfen 42501 |
| X2 | Benachrichtigungen brauchen immer eine Buchung: `notifications.booking_id` ist NOT NULL, `event_type` und `notifications_message_shape` sind feste CHECK-Listen | 0035, 0049 Abschnitt 3 | Look-Bestätigung hängt an der Buchung des Looks (passt). Wünsche und Angebote haben keine Buchung: S5 macht `booking_id` nullable und ergänzt `look_wish_id`, beide Apps müssen `booking_id = null` vertragen |
| X3 | SQL kann keine Storage-Dateien löschen. Kontolöschung räumt Dateien nur in der Edge Function auf, und nur in `verification-docs` und `portfolio` | supabase/functions/delete-account/index.ts, `BUCKETS` | Edge Function erweitert: Bucket `looks` und `look-references`, dazu die Look-Fotos, die den gelöschten Kunden zeigen, aber im Ordner des Barbers liegen (Pfade werden vor dem Löschen gelesen). **Muss neu deployed werden**, sonst bleiben Fotos liegen (unsichtbar, aber gespeichert) |
| X4 | Jeder Bucket muss Größenlimit und Bild-MIME-Liste haben, sonst schlägt der Hygiene-Test fehl | authorization_matrix.test.sql, Abschnitt storage | `looks` und `look-references`: privat, 10 MB, nur JPEG/PNG/WebP |
| X5 | Signierte Links brauchen eine SELECT-Policy auf `storage.objects` für den Aufrufer. Ohne sie bekommt der Kunde im Feed keine Bilder, mit einer zu weiten Policy sieht jeder alles | 0047 (gleiches Problem beim Portfolio) | Eigene Policy: Barber sieht den eigenen Ordner, der Kunde des Looks sieht seine Fotos, andere Kunden nur Fotos veröffentlichter Looks freigegebener Barber ohne Blockierung, nur mit Schalter |
| X6 | Die Treffer-Quote nach Stil, den der Barber selbst antippt, ist manipulierbar: Er tippt bei einem verfehlten Schnitt einfach einen anderen Stil an | B1/B2 in LOOKS.md | Der Stil der Quote kommt vom Kunden: `look_feedback.style` wählt der Kunde (vorbelegt aus Referenz oder Look), der Barber kann ihn nicht ändern |
| X7 | "Abschließen" hat keine Zeitprüfung: Ein Barber kann eine Buchung mit einem Zweitkonto sofort abschließen | 0011, Übergang accepted nach completed nur Akteur-Prüfung | Beweis braucht weiterhin die Bestätigung des Kundenkontos. Rest-Risiko Zweitkonto bleibt wie bei Bewertungen; zusätzlich Mindestanzahl (L6) und Melden. Neue Entscheidung L9 |

## 2. Konflikte mit Gründerregeln

| # | Regel | Konflikt | Lösung |
|---|---|---|---|
| R1 | Standort ist nie Pflicht (CLAUDE.md, 2026-09-21) | "Entfernungsstufe" in `match_look` und "grobe Lage" im Wunsch setzen einen Kundenstandort voraus | Gestrichen. Suche und Wunsch arbeiten nur mit der Stadt aus dem Profil (wie Discover, L4). Keine Koordinaten, keine Entfernung, nie exakte Lage |
| R2 | Discovery vergleicht die Stadt exakt, getrimmt, ohne Groß/Klein, ohne Aliase | Feed, Suche und Wunsch brauchen dieselbe Regel | Dieselbe Regel wie `barber_public_profile_approved_city_idx`: `lower(btrim(city))` |
| R3 | Keine biometrische Verarbeitung (AGENTS.md) | "Kein Gesicht" lässt sich ohne Gesichtserkennung nicht prüfen | Keine Erkennung. Der Barber bestätigt beim Festhalten "kein Gesicht erkennbar", der Kunde sieht die Fotos vor der Freigabe, Melden mit Grund. L1 bleibt "nie" |
| R4 | Schema nur über `supabase-schema-architect` (AGENTS.md) | Der Agent ist in Claude Code nicht aufrufbar | Rolle manuell angewendet, Migrationen nur als Dateien, nichts angewendet. Ehrlich vermerkt |
| R5 | Bestehende Buchungsstatus und den Solo-Buchungsweg nicht ändern | "Diesen Look" und angenommene Angebote müssen eine Buchung erzeugen | Beide gehen durch `create_booking` (0054). Die Referenz wird erst nach erfolgreicher Buchung angehängt, als eigene Zeile. Ohne Look-Parameter ist der Ablauf Byte für Byte der alte |
| R6 | Rechtstexte sind Platzhalter (`placeholder-1`) | Look-Fotos sind eine neue Verarbeitung personenbezogener Bilder | Einwilligung wird mit Version `looks-placeholder-1` gespeichert. **Vor dem Einschalten für echte Nutzer muss die Datenschutzerklärung die Look-Fotos nennen** |

## 3. Wo die Spezifikation nicht zum Code passt

| # | Spezifikation | Realität im Code | Lösung |
|---|---|---|---|
| P1 | Tabellen `feature_flags`, `feature_flag_users` | Jede Tabelle in `public` wäre per API erreichbar | Beide liegen im Schema `private` (nicht exponiert, wie `safety_staff` in 0061). Nur `public.my_feature_flags()` ist aufrufbar |
| P2 | `looks` mit Status Entwurf / bestätigt / veröffentlicht / zurückgezogen | "Kunde sagt Nein, Look zählt trotzdem" braucht zwei getrennte Antworten | Status `draft`, `confirmed` (mein Schnitt, ohne Zeigen), `published` (mein Schnitt und zeigen), `declined` (nicht mein Schnitt), `withdrawn`. Zeigen lässt sich einzeln zurücknehmen (published nach confirmed) |
| P3 | Look-Treffer "zusammen mit der Bewertung" | Bewertungen sind unveränderlich (0022) und eine eigene Tabelle | `look_feedback` als eigene Tabelle, eine pro abgeschlossener Buchung, nur vom Kunden dieser Buchung. Auf dem Bewertungs-Screen nur mit Schalter sichtbar |
| P4 | "Quote: 94 % getroffen" | Unklar, ob "fast" als Treffer zählt | Standard: nur "genau" zählt als Treffer, "fast" wird getrennt gezählt. Neue Entscheidung L7 |
| P5 | Beweiskette mit "Ankunft per GPS (wenn vorhanden)" | `booking_trips` ist nur für die zwei Beteiligten lesbar, Koordinaten werden beim Ende gelöscht, `arrived_at` bleibt | Feed-Funktion liefert nur `arrival_confirmed` (ja/nein), nie Koordinaten |
| P6 | Fotos "bis zu 3" | `portfolio` zählt Obergrenzen mit Advisory Lock (0055) | Gleiches Muster: Lock pro Look, Grenze 3, plus Storage-Obergrenze pro Barber-Ordner |
| P7 | EXIF entfernen | `normalizeImageForUpload` (src/shared/imageUpload.ts) kodiert neu und entfernt EXIF/GPS | Wiederverwendet für Look-Fotos und Referenzfotos |
| P8 | Barber fotografiert direkt | Kamera würde eine Berechtigung und einen neuen Build brauchen | Systemfoto-Auswahl wie beim Portfolio (keine Berechtigung, kein Build). Kamera ist spätere Entscheidung L8 |
| P9 | Wunsch läuft ab nach 48 h oder bei Fensterbeginn | Es gibt keinen Cron in der Datenbank | Ablauf wird beim Lesen berechnet (`expires_at`), kein Job nötig |
| P10 | `accept_offer` erzeugt die Buchung | `create_booking` braucht die volle Adresse, der Wunsch kennt nur die Stadt | Kunde wählt ein Angebot, gibt wie immer die Adresse ein, `create_booking` erzeugt die Buchung, danach verknüpft `accept_offer(offer, booking)` beides und prüft Barber, Service, Datum und Uhrzeit |
| P11 | Supabase-Typen | `src/database.types.ts` wird aus der Live-DB erzeugt und kennt die neuen Objekte nicht | Ein schmaler, dokumentierter untypisierter RPC-Zugang nur für Looks. Nach dem Anwenden `npm run db:types` und Zugang entfernen |
| P12 | Entwürfe mit Kundenfotos vor der Einwilligung | Speicherung personenbezogener Bilder ohne Antwort des Kunden | Entwurf nur für Barber und diesen Kunden sichtbar, ungültig nach 14 Tagen (einstellbar), danach weder bestätigbar noch sichtbar |

## 4. Sicherheit und Missbrauch (zusätzlich eingebaut)

| Thema | Maßnahme |
|---|---|
| Limits | `private.consume_rate` (0055) für Entwürfe, Fotos, Antworten, Look-Treffer, Wünsche, Angebote |
| Meldungen | `user_reports.target_type` um `look` erweitert (S2), `wish` und `offer` folgen in S5. Der Melder muss das Ziel sehen können. Founder-Alarm (0061) greift automatisch, weil er auf `user_reports` hängt |
| Sperrliste | Angebotsnotizen (280 Zeichen) laufen durch `private.assert_allowed_text` (0056) |
| Blockieren | Kein Entwurf zwischen blockierten Personen, Feed, Suche und Wünsche blenden blockierte Barber aus (`private.is_blocked_between`, 0058) |
| Kontolöschung | Zeilen: Kaskade (Look, Fotos, Referenzen, Wünsche verschwinden mit dem Konto). Look-Treffer bleibt ohne Kunden-ID für die Quote, wie die Sterne in 0057. Dateien: Edge Function, siehe X3 |
| Gast und anon | Keine Look-Funktion ist für `anon` ausführbar (Hygiene-Test) |

## 5. Webrecherche zu LOOKS.md Abschnitt 5 (abgerufen 2026-10-28)

| Behauptung in LOOKS.md | Ergebnis | Quelle |
|---|---|---|
| Portfolios gibt es bei Booksy, Fresha, Treatwell | Stimmt. Fresha verknüpft Portfoliobilder sogar mit einem Service und zeigt "Jetzt buchen" direkt am Bild | https://www.fresha.com/help-center/knowledge-base/online-profile/101688-create-your-service-portfolio, https://www.businesswire.com/news/home/20260529239883/en/ |
| Fotos, die an einen abgeschlossenen Termin gebunden sind, gibt es nicht | **Korrigiert.** Booksy lässt Kunden laut Drittanbietern nach einem abgeschlossenen Termin Fotos zur Bewertung hinzufügen (von Booksy selbst nicht bestätigt). Neu bleibt: vom Barber festgehalten, vom Kunden als "mein Schnitt" bestätigt, nach Stil erfasst und für Suche und Ranking genutzt | https://www.poper.ai/widgets/booksy-reviews/, https://justreview.co/blog/booksy-reviews-on-your-website/ |
| Suche nach Look gibt es nicht | **Korrigiert.** theCut bietet Suche nach Stil (Fade, Bart, Locs) und Portfolios "echter vergangener Schnitte" mit "verifizierten Bewertungen". StyleSeat rankt nach getaggten Fotos. Neu bleibt: gefiltert auf bewiesenes Können pro Stil **und** freie Zeit **und** Termin bei dir zu Hause | https://thecut.co/, https://apps.apple.com/us/app/thecut-find-book-barbers/id1101408626, https://www.styleseat.com/blog/styleseat-search-ranking-factors/ |
| Instagram-Look zeigen und direkt buchen gibt es nicht | **Teilweise korrigiert.** Vom Portfoliobild direkt buchen gibt es (Fresha). Neu bleibt: den Barber buchen, der genau diesen Stil nachweislich bei echten Kunden getroffen hat | Fresha-Quellen oben |
| Eine gemessene Quote, wie oft der gewünschte Look getroffen wurde, gibt es nicht | In der Recherche **nicht gefunden** (Booksy, Fresha, Treatwell, Planity, Squire, theCut, StyleSeat, Rock Pamper Scissors, Glammr geprüft). Bleibt die stärkste Neuheit | Suche nach Treffer-Bewertungen ohne Ergebnis; Squire: https://www.getapp.com/barbershop-software/a/squire, Planity: https://www.planity.com/coiffeur/coupe-homme/73000-chambery/page-2 |
| Treatwell, Planity: Fotos mit Terminbezug | Nichts gefunden. Treatwell kennzeichnet Bewertungen nach dem Besuch als verifiziert, ohne Fotos | https://www.treatwell.ie/place/beauty-27/reviews/page-62/ |

Fazit: Die Kombination bleibt neu, einzelne Bausteine nicht. LOOKS.md
Abschnitt 5 ist entsprechend korrigiert.

## 6. Was diese Prüfung nicht leisten konnte

| Punkt | Warum | Was zu tun ist |
|---|---|---|
| pgTAP-Tests ausführen | Kein lokales Postgres, `supa.py test --with` würde die Migrationen in einer zurückgerollten Transaktion auf der Live-DB ausführen (Nachtregel) | Taha: `python tools/db/supa.py test --with <Migrationen> -- <Testdatei>` nach Freigabe |
| Live-Schema abgleichen | Supabase-MCP nicht verbunden | Vor dem Anwenden `python tools/db/supa.py pending` |
| Rechtliche Prüfung KUG/DSGVO | Keine Rechtsberatung | Datenschutzerklärung ergänzen, Einwilligungstext freigeben |

## 7. Neue Entscheidungen aus der Prüfung

| # | Frage | Vorschlag (so gebaut) |
|---|---|---|
| L7 | Zählt "fast getroffen" für die Quote? | Nein, nur "genau". "Fast" wird daneben angezeigt |
| L8 | Kamera direkt in der App | Später, braucht Berechtigung und neuen Build |
| L9 | Schutz gegen Zweitkonten | Für den Start: Kundenbestätigung, Mindestanzahl, Melden. Später: Beweis zählt erst ab Termin, der mindestens zur geplanten Zeit abgeschlossen wurde |
| L10 | Wie lange bleibt ein unbestätigter Entwurf? | 14 Tage |
