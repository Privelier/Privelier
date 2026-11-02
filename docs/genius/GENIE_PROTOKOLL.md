# Genie-Protokoll für Privelier

Auftraggeber: Taha (Gründer). Gilt für jede Claude-Instanz, die diese Datei liest.

## Deine Rolle

Du bist hier kein Feature-Planer. Dein Ergebnis ist genau EINE Idee, nach
der Privelier sich grundlegend anders anfühlt als jede Barber-App auf dem
Markt. Das Konzept ist heilig und wird nie verändert: ein Kunde, sein Barber,
privat und premium bei ihm zu Hause. Anders werden muss, wie der Kunde zu
seinem Barber findet, was er dabei erlebt und warum er ihm vertraut. Ein Add-on als Geniestreich zu verkaufen ist
das schlimmste mögliche Ergebnis. Lieber lieferst du nichts.

## Der Add-on-Test (ein einziges JA = verworfen)

1. Könnte ein Wettbewerber (Booksy, Fresha, Treatwell, Planity) es in einem
   Sprint als Feature nachbauen, ohne sein Geschäftsmodell zu ändern?
2. Ist es im Kern ein besserer Button, Screen, Reminder oder Badge?
3. Ändert sich nichts daran, wie der Kunde seinen Barber findet und warum er ihm vertraut?
4. Sieht der Startscreen danach im Prinzip genauso aus?
5. Würde es in einer Salon-App genauso gut funktionieren wie bei einem
   Haus-Service?
6. Klingt der Ein-Satz-Pitch wie "Privelier, aber mit X"?

## Pflicht-Kriterien (jedes 0 bis 3 Punkte, Gewinner braucht überall mindestens 2)

| # | Kriterium |
|---|---|
| K1 | Ändert grundlegend, wie der Kunde seinen Barber findet oder ihm vertraut, ohne das Konzept zu verlassen |
| K2 | Der Startscreen erzählt eine neue Geschichte, erklärbar in einem Satz, den kein Wettbewerber sagen kann |
| K3 | Nutzt einen unfairen Vorteil, den nur Privelier hat (aus dem echten Code belegt) |
| K4 | Löst ein echtes Grundproblem: die Angst vor dem falschen Schnitt, fehlendes Vertrauen in Fremde, Kaltstart |
| K5 | Erzeugt eine Schleife: jeder neue Nutzer macht es für den nächsten besser oder holt ihn selbst |
| K6 | Ist zusätzlich baubar: hinter einem Schalter, bestehender Buchungsablauf unverändert, MVP in höchstens 5 Arbeitstagen |
| K7 | Übersteht den Pre-Mortem mit konkreten Gegenmaßnahmen |
| K8 | Hält die Gründerregeln ein (keine neuen Buchungsstatus, keine KI-Empfehlungen, keine Zahlungen) oder benennt jede Abweichung als Entscheidung für Taha |

## Pflicht-Methode (keinen Schritt überspringen)

1. **Fakten laden.** Lies AGENTS.md, CLAUDE.md, die Migrationen, `tools/geo/README.md`,
   die Screens beider Apps. Liste die unfairen Vorteile von Privelier mit
   Dateipfad als Beleg.
2. **Physik des Geschäfts.** Rechne mit offengelegten Annahmen: Minuten pro
   Schnitt, Fahrzeit, Puffer, Schnitte pro Abend, Einnahmen pro Stunde für
   einen Barber. Wo verschwindet die Zeit, wo das Geld, wo der Kunde?
3. **Annahmen umdrehen.** Schreibe mindestens 12 Annahmen der Kategorie auf
   ("der Kunde wählt den Barber", "die Einheit ist ein Termin", "der Kunde
   wählt die Uhrzeit", "Wachstum kommt über Werbung" ...). Drehe jede um und
   prüfe, was dann entsteht.
4. **Analogien aus 10 Branchen.** Zum Beispiel ÖPNV, Kickstarter, Pinduoduo,
   Uber Pool, Milchmann-Touren, Netflix, Strava, Too Good To Go,
   Paketzustellung, Foodtrucks. Was ist dort der Mechanismus, und was passiert,
   wenn man ihn auf Haare zu Hause überträgt?
5. **30 Ideen**, jede in einem Satz. Kein Filter in diesem Schritt.
6. **Bewerten.** Jede Idee durch den Add-on-Test, dann K1 bis K8. Behalte
   die besten 3.
7. **Angriff.** Fünf Kritiker greifen jede der 3 an: eine skeptische
   Investorin, ein Barber mit 4 Jahren Erfahrung, ein Kunde aus Nürnberg, ein
   Apple-Reviewer, Ali als Entwickler. Jeder nennt den stärksten Einwand.
8. **Entscheiden.** Genau eine Idee. Begründe, warum sie die anderen schlägt.
9. **Pre-Mortem.** "Es ist Herbst 2027, die Idee ist gescheitert. Warum?"
   Die 5 wahrscheinlichsten Gründe, jeder mit Gegenmaßnahme.
10. **Risikofreier Weg.** Wie wird sie gebaut, ohne den bestehenden Ablauf
    anzufassen: Schalter, neue Tabellen statt geänderter, Migrationen erst als
    Datei, Tests.

## Konzept-Test (ein einziges NEIN = verworfen)

Bleibt es ein Kunde und sein Barber? Bleibt es privat, premium, bei ihm zu
Hause? Würde Taha sagen: Das ist Privelier?

## Abbruchregel

Fällt die beste Idee durch den Add-on-Test oder liegt ein Kriterium unter 2:
Wiederhole Schritt 4 bis 8 mit 10 neuen Analogien. Höchstens zweimal. Ist es
danach immer noch kein Geniestreich, schreib genau das und warum.

## Ausgabe (Deutsch, Tabellen und Diagramme, keine Gedankenstriche)

1. Name und Ein-Satz-Pitch
2. Vorher/Nachher-Diagramm
3. So sieht die App danach aus: Startscreen Kunde, Startscreen Barber, der
   entscheidende Moment
4. Die Schleife, die Nutzer bringt
5. Rechnung mit offengelegten Annahmen
6. Warum nur Privelier das kann (mit Belegen aus dem Code)
7. Add-on-Test und K1 bis K8 als Tabelle mit Punkten
8. Pre-Mortem
9. Was sich im Code ändert: Tabellen, Funktionen, Screens, Schalter
10. MVP-Umfang und was bewusst später kommt
11. Entscheidungen für Taha, jeweils mit 2 bis 3 Optionen
12. Die zweitbeste Idee in 3 Sätzen, damit Taha vergleichen kann
