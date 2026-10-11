---
name: wissensrueckgabe
description: Wissensrückgabe an die private Wissensdatenbank, aus der dieses Projekt aufgesetzt wurde — trägt am Ende oder an Meilensteinen zusammen, was aus diesem Repository dauerhaft wissenswert ist, und schreibt es als eine Markdown-Datei nach .tmp/. Löst aus auf „gib das Gelernte an die Wissensdatenbank zurück", „Wissensrückgabe", „was haben wir hier gelernt".
---

# Wissensrückgabe an die Wissensdatenbank

**Sicherheitsprüfung zuerst:** Enthält der eigene Pfad dieses Skills `99-Dateien/Projekt Startpaket`, läuft diese Sitzung im Startpaket-Ordner eines Vaults, nicht in einem daraus aufgesetzten Projekt — dort abbrechen, ohne etwas zu schreiben, und das der Person sagen. Dieser Skill ist nur für ein Projekt gedacht, das aus dem Startpaket entstanden ist.

Dies ist ein Auftrag an einen KI-Agenten in diesem Repository. Ziel: zusammentragen, was aus diesem Projekt dauerhaft wissenswert ist, und als **eine** Markdown-Datei ablegen. Die Datei wird anschließend von Hand in eine private Wissensdatenbank übernommen und dort einsortiert.

Lies den Auftrag ganz, bevor du anfängst. Die Regeln unter „Nie aufnehmen" stammen aus dem Regelwerk der Zieldatenbank, das dir hier nicht vorliegt — sie stehen deshalb ausgeschrieben da und sind nicht verhandelbar.

## Was du tust und was ausdrücklich nicht

Du **extrahierst**: Du hast dieses Repository vor dir, seine Historie und seine Dokumentation. Das kann niemand sonst rekonstruieren — also holst du heraus, was hier gelernt wurde, und formulierst es in eigenen Worten.

Du **ordnest nicht ein**: Du kennst die Zieldatenbank nicht, weder ihre Ordner noch ihren Bestand. Deshalb keine Zielordner vorschlagen, keine Wikilinks (`[[…]]`) erfinden und nicht behaupten, etwas sei neu oder widerspreche etwas. Das entscheidet ein zweiter Durchgang dort, mit dem Bestand vor Augen.

Im Zweifel den Fund lieber roh und belegt hinschreiben, als ihn zurechtzubiegen.

## Kriterienkatalog — was ein Fund ist

Ein Fund ist etwas, das auch in einem Jahr und auch außerhalb dieses Projekts noch gilt:

| Fundart | Beispiel |
|---|---|
| Entscheidung mit Begründung | warum diese Bibliothek statt jener, warum diese Datenbank — samt der Abwägung dahinter |
| Stolperfalle | was Zeit gekostet hat und wie man es beim nächsten Mal vermeidet |
| Betriebswissen | wo das Ding läuft, wie es ausgeliefert wird, welcher Reverse Proxy, welche Anmeldung, welche Domain |
| Werkzeugbewertung nach echtem Einsatz | was sich bewährt hat, was man nicht wieder nehmen würde, und woran es lag |
| Übertragbares | was für das nächste Projekt genauso gilt, unabhängig von diesem hier |
| Offener Punkt mit Substanz | eine bewusst vertagte Entscheidung samt Stand der Überlegung |

Der Maßstab bei jedem Kandidaten: **Was ein Befehl jederzeit neu erzeugt, ist kein Fund — was eine Entscheidung war, ist einer.** Die Abhängigkeitsliste steht in der Paketdatei; die Begründung, warum eine davon drinsteht, steht nirgends.

## Nie aufnehmen

- **Zugangsdaten jeder Art:** Passwörter, Tokens, API-Schlüssel, PINs, TANs, private Schlüssel, Inhalte von `.env`-Dateien, Werte aus dem Secret-Store der CI. Auch nicht teilweise und auch nicht „zur Erinnerung"
- **Interne Adressen:** Hostnamen, IP-Adressen, Ports interner Systeme, Verbindungszeichenfolgen zu Datenbanken
- **Vollständige Nummern** jeder Art: Konto, Karte, Ausweis, Vertrag, Kundennummer
- **Bei beruflichen Projekten zusätzlich:** Kunden- und Projektnamen, Inhalte aus Ausschreibungen und Angeboten, Beurteilungen von Personen. Das Fachliche behalten, den Kunden weglassen — „eine Zollabwicklung für einen Großkunden" trägt dasselbe Wissen wie der Name
- **Den Code selbst:** Er steht in diesem Repository. Ein kurzer Ausschnitt als Beleg ist in Ordnung, die Abschrift ganzer Dateien nicht
- **Alles Generierte:** Abhängigkeitslisten, Verzeichnisbäume, Auszüge aus dem Commit-Log, Testausgaben

Trägt eine Aussage nur mit einer dieser Angaben, lass die ganze Aussage weg. Was übernommen wird, landet am Ende in einer Git-Historie und bleibt dort abrufbar — auch nachdem man es gelöscht hat.

## Wie du vorgehst

1. **Vorherigen Stand lesen.** Liegt `.claude/skills/wissensrueckgabe/stand.md` vor und enthält mindestens eine Zeile, ist das keine erste Rückgabe. Lies die letzte Zeile (Datum, Commit, Rückgabedatei) und beschränke dich auf das, was seit diesem Commit dazugekommen ist (`git log <commit>..HEAD`, geänderte und neue Dokumente). Will die Person ausdrücklich eine vollständige Rückgabe über die gesamte Historie, sag ihr trotzdem, was `stand.md` als letzten Lauf zeigt, und mach es dann komplett.
2. **Überblick verschaffen:** `README`, Architektur- und Entscheidungsdokumentation, `AGENTS.md` bzw. `CLAUDE.md`, auffällige Kommentare im Code — und vor allem die **Git-Historie** im relevanten Bereich. Commit-Nachrichten und Beschreibungen von Pull Requests sind die dichteste Quelle für Entscheidungen samt Begründung.
3. **Kandidaten sammeln** nach dem Katalog oben. Lieber einer zu viel als einer zu wenig: Aussortiert wird später, und das kostet dort wenig.
4. **Aussortieren,** was unter „Nie aufnehmen" fällt.
5. **Die Datei schreiben** nach dem Format unten.
6. **`stand.md` fortschreiben** (siehe unten) — erst nachdem die Rückgabedatei steht.
7. Liegt im Wurzelverzeichnis noch eine alte `WISSENSRUECKGABE.md` aus einer früheren Fassung des Startpakets, frag die Person, ob sie gelöscht werden soll — aber nur, wenn ihr Inhalt unverändert der alten Vorlage entspricht. Weicht sie ab, hat jemand sie bewusst angepasst; dann nicht anfassen und es nur melden.

## Format der Ausgabe

Genau **eine** Datei, nicht mehrere. Ablage: `.tmp/wissensrueckgabe-JJJJ-MM-TT.md` mit dem heutigen Datum; existiert unter diesem Namen an diesem Tag schon eine, hängt einen Uhrzeit-Zusatz an (`-HHMM`), statt sie zu überschreiben. Lege `.tmp/` an, falls es fehlt, und trage `.tmp/` in die `.gitignore` dieses Repositories ein, falls es dort noch nicht steht — **die Datei wird nicht committet.** Sie ist ein Transportstück, kein Projektinhalt.

Aufbau:

```markdown
---
titel: Wissensrückgabe <Projektname> <JJJJ-MM-TT>
typ: inbox
bereich: inbox
erstellt: JJJJ-MM-TT
aktualisiert: JJJJ-MM-TT
quelle: Repository <name>, Stand <kurzer Commit-Hash> vom JJJJ-MM-TT
---

# Wissensrückgabe <Projektname>

<Ein bis drei Sätze: was dieses Projekt ist, für jemanden, der es nicht kennt.>

## <Überschrift des ersten Funds>

<Der Fund in zwei bis fünf Sätzen, in eigenen Worten.>

**Beleg:** <Dateipfad, Commit-Hash oder Fundstelle, damit der Fund nachprüfbar bleibt.>

## <Überschrift des zweiten Funds>

…
```

Ein `##`-Abschnitt je Fund. Die Überschrift benennt die Sache, nicht die Fundart — also „Warum die Anmeldung über Authelia läuft" und nicht „Entscheidung 3". Bei einer wiederholten, auf neue Commits beschränkten Rückgabe stehen nur die neuen Funde in der Datei — keine Wiederholung des vorher schon Zurückgegebenen.

## `stand.md` — Protokoll der Läufe

Anders als die Rückgabedatei liegt `.claude/skills/wissensrueckgabe/stand.md` **nicht** in `.tmp/` und wird **mitcommittet**: Sie ist kein Transportstück, sondern das Gedächtnis dieses Skills, damit der nächste Lauf weiß, wo der letzte aufgehört hat. Nach jeder geschriebenen Rückgabedatei eine Zeile anhängen (Datei anlegen, falls sie fehlt):

```markdown
# Läufe des Skills wissensrueckgabe

| Datum | Ausgewertet bis Commit | Rückgabedatei |
|---|---|---|
| JJJJ-MM-TT | <kurzer Commit-Hash von HEAD zum Zeitpunkt des Laufs> | .tmp/wissensrueckgabe-JJJJ-MM-TT.md |
```

Der Skill behauptet nie, die Datei sei im Vault angekommen — das kann er von hier aus nicht wissen. Die Zeile hält nur fest, bis wohin *dieses Repository* schon ausgewertet wurde.

## Formregeln für den Text

Die Datei landet in einem Obsidian-Vault. Daraus folgen drei Dinge:

- **Deutsch,** auch wenn dieses Repository englisch dokumentiert ist. Fachbegriffe dürfen englisch bleiben.
- **Jeder Absatz ist eine einzige Zeile,** ohne harten Zeilenumbruch mitten im Satz: Obsidian macht aus jedem Zeilenumbruch einen sichtbaren Umbruch, ein umgebrochener Absatz zerfällt dort in kurze Stücke. Gilt auch für einzelne Aufzählungspunkte. Ausgenommen sind Code-Blöcke und Tabellen.
- **Keine Emojis** in Überschriften und in den Frontmatter-Werten.

## Zum Schluss

Sag in zwei, drei Sätzen, was du gefunden hast, was du bewusst weggelassen hast und warum, und wo du unsicher warst. Das liest ein Mensch, bevor die Datei übernommen wird. Weise darauf hin, dass die Datei aus `.tmp/` von Hand nach `01-Inbox/` der Wissensdatenbank wandert.
