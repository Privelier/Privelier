# Guten Morgen, Taha: Nachtschicht 2026-10-28

Alles liegt lokal auf dem Branch `night/2026-10-28`, nichts ist gepusht,
nichts ist auf der Datenbank angewendet. Die Looks sind für alle Nutzer
unsichtbar, bis du die Migrationen anwendest und dich in den Schalter einträgst.

## 1. Was die pessimistische Prüfung gefunden und verbessert hat

Der Feature-Schalter hätte nur versteckt und nichts abgeschaltet, deshalb prüft jetzt jede Look-Funktion und jede Look-Policy den Schalter selbst auf dem Server.
Die Treffer-Quote war manipulierbar, weil der Barber den Stil selbst antippt, deshalb wählt jetzt der Kunde den Stil, und nur "genau getroffen" zählt.
"Entfernungsstufe" und "grobe Lage" hätten einen Kundenstandort gebraucht und die Gründerregel "Standort nie Pflicht" verletzt, deshalb arbeiten Feed, Suche und Wunsch nur mit der Stadt aus dem Profil.
SQL kann keine Storage-Dateien löschen, deshalb räumt die Edge Function delete-account jetzt auch die Look-Fotos auf (Neu-Deploy nötig), und Benachrichtigungen ohne Buchung (Wünsche) brauchen eine Schemaänderung in S5.
Die Webrecherche hat drei Neuheits-Aussagen korrigiert (Fresha bucht direkt vom Portfoliobild, theCut sucht nach Stil, Booksy erlaubt Kundenfotos in Bewertungen); eine gemessene Treffer-Quote gibt es nirgends.

Details: docs/genius/LOOKS_REVIEW.md

## 2. Was heute Nacht gebaut wurde

| Schritt | Status | Commit |
|---|---|---|
| A Sicherung deiner lokalen Änderungen (Chat-Namen) | fertig, Branch `backup/taha-2026-10-28`, nicht gepusht | de8c0ed |
| A Nacht-Branch und Nacht-Dokumente | fertig | 3db6644 |
| A Prüf-Baseline (`npm run check`) | aufgezeichnet, siehe Abschnitt 8 | 8846577 |
| B Prüfung LOOKS_REVIEW.md, LOOKS.md verbessert | fertig | 8846577 |
| C S1 Feature-Schalter | fertig, Tests grün | f6797c7 |
| C S2 Beweis-Look und Look-Treffer | fertig, Tests grün | 7ee903c |
| C S3 Looks-Feed, Look-Detail, "Diesen Look" | fertig, Tests grün | f256166 |
| C S4 Look-Suche mit sofortigen Treffern | fertig, Tests grün | siehe `git log` ("Looks S4") |
| C S5 Look-Wunsch und Angebote | offen | offen |
| C S6 Look-Pass | offen | offen |

"Tests grün" heißt: Typecheck, Lint, knip, jscpd und madge ohne Fehler, Jest
ohne einen einzigen neuen Fehler gegenüber der Baseline. Die pgTAP-Tests sind
geschrieben, aber **nicht ausgeführt** (kein lokales Postgres, siehe Abschnitt 3b).
Die Maestro-Flows sind geschrieben, aber **nicht ausgeführt**.

## 3. Was du freigeben musst, in dieser Reihenfolge

### a) Pushes

| Befehl | Was es tut |
|---|---|
| `git push origin backup/taha-2026-10-28` | Sichert deine lokalen Chat-Namen-Änderungen von gestern (de8c0ed) |
| `git push origin night/2026-10-28:night/2026-10-28` | Lädt den Nacht-Branch hoch. Wichtig: genau so, der Branch folgt lokal origin/main, ein nacktes `git push` würde abgelehnt |

Danach Pull Request `night/2026-10-28` nach `main`, CI läuft dort mit englischer Locale.

### b) Migrationen (erst testen, dann anwenden)

| Datei | Was sie ändert | Risiko | Rollback |
|---|---|---|---|
| 0062_feature_flags | Neue Tabellen `private.feature_flags`, `private.feature_flag_users`, Funktionen `private.flag_enabled`, `public.my_feature_flags`. Schalter `looks` ist aus | niedrig, rein additiv, nicht per API erreichbar | supabase/rollbacks/0062_feature_flags.sql |
| 0063_looks_proof_and_match | Neue Tabellen `looks`, `look_photos`, `look_feedback`, `look_styles`, `private.looks_settings`; neuer **privater** Bucket `looks` (10 MB, nur Bilder) mit drei neuen Storage-Policies; 8 neue Funktionen | mittel: neue Storage-Policies und RLS. Ohne Schalter liest niemand etwas | supabase/rollbacks/0063_looks_proof_and_match.sql (löscht alle Looks; Bucket vorher im Dashboard leeren) |
| 0064_looks_reports_and_notifications | **Ändert bestehende Objekte**: CHECK-Constraints von `notifications` und `user_reports`, ersetzt `notification_push_copy` und `private.resolve_report_target` (bestehende Texte identisch, nur ergänzt), neuer Trigger auf `looks` | mittel: berührt die Benachrichtigungen aller Nutzer; die bestehenden Fälle sind unverändert übernommen | supabase/rollbacks/0064_looks_reports_and_notifications.sql (löscht look_confirm-Benachrichtigungen, behält Look-Meldungen als Nutzer-Meldungen) |
| 0065_looks_feed_and_reference | Neue Tabelle `look_references` (welcher Look zu welcher Buchung), Funktionen `looks_feed` und `attach_look_reference`, ersetzt `private.can_view_look_photo` (veröffentlichte Looks für Kunden sichtbar) | niedrig bis mittel: erweitert die Foto-Sicht auf veröffentlichte Looks, nur für Kunden mit Schalter, gleiche Stadt, nie über eine Blockierung | supabase/rollbacks/0065_looks_feed_and_reference.sql (löscht nur die Look-Verweise, Buchungen bleiben) |
| 0066_looks_search | Neue Spalte `look_references.photo_path`, zwei Einstellungen in `private.looks_settings`, neuer **privater** Bucket `look-references` (10 MB, nur Bilder) mit drei Storage-Policies, Funktion `match_look`, `attach_look_reference` bekommt das optionale Foto (alte Version wird ersetzt) | mittel: neue Storage-Policies; der gebuchte Barber sieht das Referenzfoto nur, solange die Anfrage offen oder angenommen ist | supabase/rollbacks/0066_looks_search.sql (vor 0065 zurückrollen; Bucket vorher im Dashboard leeren) |

Vorgehen (Befehle aus `tools/db/supa.py`, brauchen `SUPABASE_ACCESS_TOKEN`). `<alle>` steht für die fünf Dateien in dieser Reihenfolge:
`supabase/migrations/0062_feature_flags.sql supabase/migrations/0063_looks_proof_and_match.sql supabase/migrations/0064_looks_reports_and_notifications.sql supabase/migrations/0065_looks_feed_and_reference.sql supabase/migrations/0066_looks_search.sql`

1. Trockenlauf, alles in einer Transaktion, danach ROLLBACK:
   `python tools/db/supa.py dry-run <alle>`
2. pgTAP-Tests (ebenfalls zurückgerollt), jede Datei einzeln. Der genaue Befehl steht im Kopf jeder Testdatei (jede Scheibe ist gegen ihren eigenen Migrationsstand geschrieben):
   `supabase/tests/feature_flags.test.sql` (0062), `looks_proof_and_match.test.sql` (0062 bis 0064), `looks_feed_and_reference.test.sql` (0062 bis 0065), `looks_search.test.sql` (0062 bis 0066).
   Danach die bestehenden Suiten mit `--with <alle>`: `authorization_matrix.test.sql` und `abuse_limits_and_account_deletion.test.sql`. Die Looks-Tests von S2 und S3 wurden nie gegen den vollen Stand 0062 bis 0066 geprüft; einmal mit `--with <alle>` laufen lassen zeigt, ob eine spätere Scheibe eine frühere Annahme verändert
3. Erst wenn alles grün ist: anwenden, in dieser Reihenfolge, mit demselben Namen wie die Datei (AGENTS.md-Protokoll), danach `get_advisors` (security) und `npm run db:types`.
4. Edge Function `delete-account` neu deployen (sonst bleiben Look-Fotos und Referenzfotos gelöschter Konten im Speicher liegen, unsichtbar, aber gespeichert).

### c) Feature-Schalter einschalten

Nur für euch beide, im SQL-Editor (E-Mail von Ali ergänzen):

```sql
insert into private.feature_flag_users (flag_key, user_id)
select 'looks', id from auth.users
where email in ('taha.metwally@outlook.de', 'titoacerlap@gmail.com', '<Alis E-Mail>')
on conflict do nothing;
```

Wieder aus: `delete from private.feature_flag_users where flag_key = 'looks';`

**Vor echten Nutzern** (`enabled_for_all = true`): Datenschutzerklärung um
Look-Fotos ergänzen und den Einwilligungstext freigeben (Version
`looks-placeholder-1` in `private.looks_settings.consent_version`).

## 4. Entscheidungen

| # | Frage | Empfehlung (so gebaut) |
|---|---|---|
| L1 | Fotos mit Gesicht | nie (Barber bestätigt "kein Gesicht", Kunde kann ablehnen oder melden) |
| L2 | Wer sieht den Feed | nur Kunden (serverseitig erzwungen) |
| L3 | Angebot angenommen | Bestätigungs-Tipp des Barbers, also normale Anfrage (S5) |
| L4 | Reichweite eines Wunsches | gleiche Stadt |
| L5 | Haarstruktur als Filter | erst rechtlich prüfen, nicht gebaut |
| L6 | Look-Treffer sichtbar ab | 5 Bewertungen (einstellbar in `private.looks_settings`) |
| L7 neu | Zählt "fast" als Treffer? | nein, nur "genau" |
| L8 neu | Kamera direkt in der App | später, braucht Berechtigung und neuen Build |
| L9 neu | Schutz gegen Zweitkonten | für den Start: Kundenbestätigung, Mindestanzahl, Melden |
| L10 neu | Wie lange bleibt ein unbeantworteter Entwurf? | 14 Tage |
| L11 neu (S4) | Referenzfoto hochgeladen, aber nie gebucht | bleibt privat im eigenen Ordner des Kunden (höchstens 30 pro Kunde, gelöscht mit dem Konto). Empfehlung: später ein nächtlicher Aufräum-Job in `tools/automation` für Fotos ohne Buchung älter als 7 Tage |
| L12 neu (S4) | Wie viele Tage und welche Zeitfenster bietet die Suche an? | 7 Tage, 4 feste Fenster (9 bis 12, 12 bis 15, 15 bis 18, 18 bis 21). Der Server erlaubt bis 30 Tage und Fenster bis 12 Stunden (einstellbar in `private.looks_settings`) |
| neu | `tsconfig.json` soll `artifacts/` ausschließen wie Jest und ESLint | ja, dann ist `npm run check` lokal wieder aussagekräftig (heute Nacht nicht geändert: Regel "Baseline aufzeichnen, nicht reparieren") |

## 5. Was du am Handy testen sollst

Kein neuer nativer Build nötig: keine neue Abhängigkeit, die Fotoauswahl
nutzt das vorhandene `expo-image-picker` ohne Berechtigung. Dein aktueller
Development Build reicht, `npm start` lädt den neuen JavaScript-Stand.

| Test | Konto | Erwartung |
|---|---|---|
| Schalter aus (vor dem Eintragen) | beide | Nichts Neues sichtbar, Termin-Details und Bewertung wie bisher |
| Ergebnis festhalten | Barber | Abgeschlossener Termin, Details: "Ergebnis festhalten", Stil, Foto, "kein Gesicht", senden: "Wartet auf den Kunden" |
| "Ist das dein Schnitt?" | Kunde | Push und Eintrag in der Glocke, Fotos sichtbar, Ja, Zeigen: "Dein Look wird gezeigt" |
| Nicht mehr zeigen, Zurückziehen | Kunde | Status wechselt, Fotos verschwinden |
| Look-Treffer | Kunde | Bewertung schreiben: Frage "Hat er deinen Look getroffen?" mit vorgewähltem Stil |
| Echte Looks in Discover (S3) | zweiter Kunde, gleiche Stadt | Leiste "Echte Looks", Stil filtern, Look öffnen: Beweiskette, "Diesen Look buchen" führt in die normale Buchung; der Barber sieht in der Anfrage "Gebucht über deinen Look" |
| Look suchen (S4) | Kunde | In der Leiste "Look suchen", Stil, Tag, Fenster, optional eigenes Foto, "Freie Barber finden": Barber mit Beweis und erster freier Zeit, nie eine Entfernung. "Um HH:MM buchen" springt direkt zur Adresse |
| Referenzfoto (S4) | Barber | Die Anfrage aus der Suche zeigt "Gebucht über die Look-Suche" und das Foto des Kunden; nach Ablehnen ist das Foto weg |
| Kontolöschung | Testkunde | Look verschwindet (Dateien und Referenzfotos erst nach Neu-Deploy der Edge Function) |

## 6. Wichtig vor dem Start

Die App braucht in `.env` jetzt `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY` statt
des alten Anon-Keys (docs/hardening/FOUNDER_ACTIONS.md, F1), sonst startet sie nicht.

## 7. Wo es weitergeht

Siehe docs/genius/PROGRESS.md, Abschnitt "In progress".

## 8. Was du sonst wissen musst

| Punkt | Details |
|---|---|
| Supabase-MCP | Hat sich heute Nacht nicht verbunden. Keine Live-Abfrage möglich, alles beruht auf den Migrationsdateien |
| `npm run check` lokal | Bricht beim ersten Schritt ab: 6 Typfehler im nicht versionierten Ordner `artifacts/privelier-rebuild/`. Jest hat auf diesem Rechner 60 Baseline-Fehler, alle wegen deutscher Locale und Zeitzone (CI läuft en-US/UTC). Liste: docs/genius/jest-baseline-failures.txt, Prüfskript: docs/genius/night_check.py |
| Nicht gesichert | `.codex-eas-project-check/` (350-MB-APK und ein Screenshot) liegt weiter ungetrackt auf der Platte, zu groß für GitHub |
| Nicht erlaubt in dieser Sitzung | `git config`, `git ls-tree`, Schreiben außerhalb des Repos; nichts davon wurde umgangen |
| Untypisierter Zugriff | `src/shared/untypedRpc.ts` überbrückt, bis die Migrationen angewendet sind. Danach `npm run db:types` und die Aufrufe auf `supabase.rpc` umstellen |
