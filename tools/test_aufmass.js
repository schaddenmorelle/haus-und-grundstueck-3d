/* Test von src/aufmass.js und tools/aufmass.js (Plan Abschnitt 3.9 und 9, Phase 6), ohne Three.js.
   Aufruf: node tools/test_aufmass.js   (läuft auch über npm test)
   Sollwerte stammen aus dem gedruckten Plan (Speisekammer 1,26 m, Wohnen 7,76 m, Außenmaße) und aus dem Aufmaß des Nutzers, nicht aus
   einem gemessenen Istwert des Modells. Geprüft wird über die öffentliche Schnittstelle:
     Aufmass.auswerten(D, pruefmasse)        → { zeilen, gemessen, auffaellig, unbekannt }
     Aufmass.listeErzeugen / listeLesen      Export der Seite (Format "haus-aufmass")
     Aufmass.eintragen(text, neue)           Text von pruefmasse.json, nur die betroffenen Zeilen ändern
   und die Befehlszeile tools/aufmass.js (mit --datei auf einer Kopie von pruefmasse.json). */
const fs = require('fs'), os = require('os'), path = require('path'), { spawnSync } = require('child_process');
const A = require('../src/aendern.js');
const M = require('../src/aufmass.js');
const haus = require('../src/data/haus.json');
const PM_PFAD = path.join(__dirname, '../src/data/pruefmasse.json');
const PM_TEXT = fs.readFileSync(PM_PFAD, 'utf8'), PM = JSON.parse(PM_TEXT);
const D = A.ableiten(haus);

const fails = [];
function check(ok, msg) { if (!ok) fails.push(msg); }
function wirft(fn, muster, msg) {
  try { fn(); fails.push(msg + ' (kein Fehler geworfen)'); } catch (e) { if (!muster.test(e.message)) fails.push(msg + ' (falsche Meldung: ' + e.message + ')'); }
}
const klon = o => JSON.parse(JSON.stringify(o));
const nahe = (a, b, tol) => Math.abs(a - b) <= (tol == null ? 1e-6 : tol);
const mitMasse = (...eintraege) => Object.assign(klon(PM), { masse: eintraege });

/* ---------- Auswertung: ein Maß aus den Maßketten ---------- */
{
  // Speisekammer lichte Tiefe: gedruckter Plan 1,26 m (Kette rechts). Aufmaß 1,25 m → Modell − Aufmaß = +1 cm, im Putzbereich −1 … +4 cm.
  let z = M.auswerten(D, mitMasse({ mass: 'raum:speis.tiefe', cm: 125 })).zeilen[0];
  check(z.status === 'ok' && nahe(z.modell, 1260) && nahe(z.gemessen, 1250) && nahe(z.abweichung, 10), 'Speisekammer 125 cm: ' + JSON.stringify(z));
  check(z.geschoss === 'EG' && z.art === 'raum' && z.mass === 'raum:speis.tiefe', 'Zeile nennt Geschoss, Art und Maßname: ' + JSON.stringify(z));
  // 1,30 m gemessen: Modell wäre 4 cm zu klein (−4 cm), außerhalb von −1 … +4
  z = M.auswerten(D, mitMasse({ mass: 'raum:speis.tiefe', cm: 130 })).zeilen[0];
  check(z.status === 'auffaellig' && nahe(z.abweichung, -40), 'Speisekammer 130 cm ist auffällig: ' + JSON.stringify(z));
  // Grenzen des Putzbereichs gehören dazu: +4 cm (Aufmaß 1,22) ist ok, +4,1 cm nicht
  check(M.auswerten(D, mitMasse({ mass: 'raum:speis.tiefe', cm: 122 })).zeilen[0].status === 'ok', 'Obergrenze +4 cm gehört zum Putzbereich');
  check(M.auswerten(D, mitMasse({ mass: 'raum:speis.tiefe', cm: 121.9 })).zeilen[0].status === 'auffaellig', '+4,1 cm liegt außerhalb');
  check(M.auswerten(D, mitMasse({ mass: 'raum:speis.tiefe', cm: 127 })).zeilen[0].status === 'ok', 'Untergrenze −1 cm gehört zum Putzbereich');
  check(M.auswerten(D, mitMasse({ mass: 'raum:speis.tiefe', cm: 127.1 })).zeilen[0].status === 'auffaellig', '−1,1 cm liegt außerhalb');
  // Höhe ü. OKFF (Plan: Geschosshöhe 2971 mm): Maßname aus den Höhen
  z = M.auswerten(D, mitMasse({ mass: 'hoehe:dg.okff', cm: 297.1 })).zeilen[0];
  check(z.art === 'hoehe' && nahe(z.modell, 2971) && z.status === 'offen' && nahe(z.abweichung, 0), 'Höhe als Prüfmaß: ' + JSON.stringify(z));
  // Gesamtmaß Nordseite aus dem Plan: 12,95 m (gesperrt); ohne Erwartung → offen
  z = M.auswerten(D, mitMasse({ mass: 'aussen:breite', cm: 1296 })).zeilen[0];
  check(z.status === 'offen' && nahe(z.modell, 12950) && nahe(z.abweichung, -10), 'Außenmaß ohne Erwartung: ' + JSON.stringify(z));
  // Unbekannter Name
  z = M.auswerten(D, mitMasse({ mass: 'raum:gibtsnicht.tiefe', cm: 100 })).zeilen[0];
  check(z.status === 'unbekannt' && z.modell == null && z.abweichung == null, 'unbekanntes Maß: ' + JSON.stringify(z));
}

/* ---------- Auswertung: die vorhandenen Prüfmaße aus dem Aufmaß des EG ---------- */
{
  const r = M.auswerten(D, PM);
  check(r.zeilen.length === PM.masse.length && r.zeilen.length >= 18, 'jede Zeile von pruefmasse.json wird ausgewertet: ' + r.zeilen.length);
  check(r.unbekannt === 0 && r.auffaellig === 0, 'Aufmaß des EG: ' + r.unbekannt + ' unbekannt, ' + r.auffaellig + ' auffällig');
  const nach = (was) => r.zeilen.filter(z => z.was === was)[0];
  // Wohnen Tiefe: gedruckt 7,76 m, Aufmaß 776 cm; Speisekammer: gedruckt 1,26 m, Aufmaß 125 cm
  check(nahe(nach('Wohnen, Tiefe').modell, 7760) && nahe(nach('Wohnen, Tiefe').abweichung, 0), 'Wohnen, Tiefe: ' + JSON.stringify(nach('Wohnen, Tiefe')));
  check(nahe(nach('Speisekammer, Tiefe').modell, 1260) && nahe(nach('Speisekammer, Tiefe').abweichung, 10), 'Speisekammer, Tiefe: ' + JSON.stringify(nach('Speisekammer, Tiefe')));
  // Wandlänge (kante_bei): Toleranz ± kante_cm
  const k = nach('Eltern, Wand zum HAR');
  check(k.art === 'kante' && nahe(k.erwartet[0], -20) && nahe(k.erwartet[1], 20) && k.status === 'ok', 'Kante mit Toleranz ±2 cm: ' + JSON.stringify(k));
  // ein erfundener auffälliger Wert in der Liste wird gezählt
  const kaputt = klon(PM); kaputt.masse[0].cm += 50;
  check(M.auswerten(D, kaputt).auffaellig === 1, 'ein Prüfmaß um 50 cm falsch ergibt genau 1 auffälliges');
  // Raum ohne Eintrag in den Daten
  const ohne = klon(PM); ohne.masse[0].raum = 'gibtsnicht';
  check(M.auswerten(D, ohne).unbekannt === 1, 'Prüfmaß mit unbekanntem Raum zählt als unbekannt');
}

/* ---------- Auswertung folgt dem geänderten Haus (Probiermodus) ---------- */
{
  const res = A.aendern(haus, [{ mass: 'raum:speis.tiefe', wert: '1,30m' }]);
  check(res.ok, 'Voraussetzung: Änderung möglich ' + res.meldungen.join(' | '));
  const D2 = A.ableiten(res.haus);
  const z = M.auswerten(D2, mitMasse({ mass: 'raum:speis.tiefe', cm: 125 })).zeilen[0];
  check(nahe(z.modell, 1300) && nahe(z.abweichung, 50) && z.status === 'auffaellig', 'Nach der Änderung weicht das Modell vom Aufmaß ab: ' + JSON.stringify(z));
}

/* ---------- Beschreibung ---------- */
{
  check(M.beschreibung(D, 'raum:speis.tiefe') === 'Speisekammer, Tiefe', 'Beschreibung eines Raummaßes: ' + M.beschreibung(D, 'raum:speis.tiefe'));
  check(M.beschreibung(D, 'raum:kind1.breite') === 'Nähzimmer, Breite', 'Raumnamen aus den Daten: ' + M.beschreibung(D, 'raum:kind1.breite'));
  check(M.beschreibung(D, 'hoehe:dg.okff') === 'hoehe:dg.okff', 'andere Maße behalten ihren Namen');
}

/* ---------- Messliste (Export der Seite) ---------- */
{
  const e = [{ mass: 'raum:speis.tiefe', cm: 125.5, datum: '2026-10-12', notiz: 'Laser' }, { mass: 'raum:kind1.breite', cm: 339 }];
  const liste = M.listeErzeugen(D, e);
  check(liste.format === 'haus-aufmass' && liste.version === 1 && liste.eintraege.length === 2, 'Format der Messliste: ' + JSON.stringify(liste));
  const gelesen = M.listeLesen(JSON.stringify(liste), D);
  check(gelesen.length === 2 && gelesen[0].cm === 125.5 && gelesen[0].was === 'Speisekammer, Tiefe' && gelesen[1].was === 'Nähzimmer, Breite', 'Lesen ergänzt "was": ' + JSON.stringify(gelesen));
  wirft(() => M.listeErzeugen(D, []), /Keine Messung/, 'leere Liste');
  wirft(() => M.listeLesen('{kaputt', D), /JSON|lesbar/, 'kein JSON');
  wirft(() => M.listeLesen({ format: 'haus-aenderungen', version: 1, eintraege: e }, D), /Aufmaß|Format/, 'falsches Format (Änderungsliste)');
  wirft(() => M.listeLesen({ format: 'haus-aufmass', version: 2, eintraege: e }, D), /Version/, 'falsche Version');
  wirft(() => M.listeLesen({ format: 'haus-aufmass', version: 1, eintraege: e, extra: 1 }, D), /Unbekannte/, 'unbekanntes Feld der Liste');
  wirft(() => M.listeLesen({ format: 'haus-aufmass', version: 1, eintraege: [] }, D), /keine Messung/i, 'Liste ohne Messung');
  wirft(() => M.listeLesen({ format: 'haus-aufmass', version: 1, eintraege: [{ mass: 'raum:gibtsnicht.tiefe', cm: 100 }] }, D), /unbekannt/i, 'unbekanntes Maß');
  wirft(() => M.listeLesen({ format: 'haus-aufmass', version: 1, eintraege: [{ mass: 'raum:speis.tiefe', cm: -3 }] }, D), /cm/, 'negativer Wert');
  wirft(() => M.listeLesen({ format: 'haus-aufmass', version: 1, eintraege: [{ mass: 'raum:speis.tiefe', cm: '125' }] }, D), /cm/, 'Wert als Text');
  wirft(() => M.listeLesen({ format: 'haus-aufmass', version: 1, eintraege: [{ mass: 'raum:speis.tiefe', cm: 125, datum: '12.10.2026' }] }, D), /Datum/, 'Datum nicht im Format JJJJ-MM-TT');
  wirft(() => M.listeLesen({ format: 'haus-aufmass', version: 1, eintraege: [{ mass: 'raum:speis.tiefe', cm: 125, quatsch: 1 }] }, D), /Unbekannt.*quatsch/, 'unbekanntes Feld der Messung');
  wirft(() => M.listeLesen({ format: 'haus-aufmass', version: 1, eintraege: [{ cm: 125 }] }, D), /mass/, 'Maßname fehlt');
}

/* ---------- Werte mit Einheit (Seite und Befehlszeile) ---------- */
{
  check(M.cmParsen('125') === 125 && M.cmParsen('125,5') === 125.5, 'ohne Einheit sind es cm: ' + M.cmParsen('125,5'));
  check(M.cmParsen('1,255m') === 125.5 && M.cmParsen('1255mm') === 125.5 && M.cmParsen(' 125 cm ') === 125, 'Einheiten m, mm, cm');
  wirft(() => M.cmParsen('abc'), /lesbar/, 'kein Wert');
  wirft(() => M.cmParsen('0'), /größer/, 'null');
  wirft(() => M.cmParsen('-5'), /größer/, 'negativ');
  wirft(() => M.cmParsen('1,26'), /Einheit/, 'zweideutig: 1,26 ohne Einheit wäre 1,26 cm, gemeint ist wohl Meter');
}

/* ---------- Text von pruefmasse.json fortschreiben ---------- */
{
  const neu = [{ mass: 'raum:kind1.breite', cm: 339.5, was: 'Nähzimmer, Breite', datum: '2026-10-12' }];
  const r = M.eintragen(PM_TEXT, neu);
  const obj = JSON.parse(r.text);
  check(obj.masse.length === PM.masse.length + 1 && JSON.stringify(obj.masse[obj.masse.length - 1]) === JSON.stringify(neu[0]), 'angehängt als letzter Eintrag');
  check(JSON.stringify(obj.masse.slice(0, -1)) === JSON.stringify(PM.masse) && obj.hinweis === PM.hinweis && obj.putz_cm.join() === '-1,4', 'alles andere bleibt unberührt');
  const alt = PM_TEXT.split('\n'), nz = r.text.split('\n');
  const verschieden = nz.filter((l, i) => alt.indexOf(l) < 0);
  check(nz.length === alt.length + 1 && verschieden.length === 2, 'im Text ändern sich nur die letzte alte Zeile (Komma) und die neue Zeile: ' + verschieden.length + ' abweichende Zeilen');
  check(r.neu.length === 1 && r.ersetzt.length === 0, 'Bericht: neu / ersetzt');
  // zweiter Aufruf mit demselben Maß ersetzt den Eintrag an seiner Stelle
  const r2 = M.eintragen(r.text, [{ mass: 'raum:kind1.breite', cm: 338, was: 'Nähzimmer, Breite', datum: '2026-10-13' }]);
  const o2 = JSON.parse(r2.text);
  check(o2.masse.length === obj.masse.length && o2.masse[o2.masse.length - 1].cm === 338 && r2.ersetzt.length === 1 && r2.ersetzt[0].cm === 339.5, 'gleiches Maß ersetzt den früheren Eintrag');
  // mehrere auf einmal, eines davon ersetzt ein Altes in der Mitte
  const r3 = M.eintragen(PM_TEXT, [{ mass: 'raum:speis.tiefe', cm: 125 }, { mass: 'raum:kind1.tiefe', cm: 320 }]);
  check(JSON.parse(r3.text).masse.length === PM.masse.length + 2, 'zwei neue Messungen');
  // leere Liste, Eintrag ohne Maßnamen
  wirft(() => M.eintragen(PM_TEXT, []), /Keine Messung/, 'nichts einzutragen');
  wirft(() => M.eintragen('{"foo": 1}', [{ mass: 'raum:speis.tiefe', cm: 125 }]), /Prüfmaße|Format/, 'unerwartete Form der Datei');
}

/* ---------- Befehlszeile ---------- */
{
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'haus-aufmass-')), datei = path.join(dir, 'pruefmasse.json');
  fs.writeFileSync(datei, PM_TEXT);
  const cli = (...a) => spawnSync(process.execPath, [path.join(__dirname, 'aufmass.js'), '--datei', datei, ...a], { encoding: 'utf8' });
  let r = cli();
  check(r.status === 0 && /Speisekammer, Tiefe/.test(r.stdout) && /Wohnen, Tiefe/.test(r.stdout), 'Bericht ohne Argumente: ' + r.stdout + r.stderr);
  check(fs.readFileSync(datei, 'utf8') === PM_TEXT, 'Bericht ändert nichts');
  r = cli('raum:kind1.breite=339,5cm', '--datum', '2026-10-12', '--notiz', 'Laser');
  const neu = fs.readFileSync(datei, 'utf8'), o = JSON.parse(neu);
  const l = o.masse[o.masse.length - 1];
  check(r.status === 0 && l.mass === 'raum:kind1.breite' && l.cm === 339.5 && l.datum === '2026-10-12' && l.notiz === 'Laser' && l.was === 'Nähzimmer, Breite', 'CLI trägt eine Messung ein: ' + r.stdout + r.stderr + JSON.stringify(l));
  check(/Nähzimmer, Breite/.test(r.stdout) && /339/.test(r.stdout), 'CLI nennt die Abweichung: ' + r.stdout);
  fs.writeFileSync(datei, PM_TEXT);
  r = cli('--trockenlauf', 'raum:kind1.breite=339cm');
  check(r.status === 0 && fs.readFileSync(datei, 'utf8') === PM_TEXT && /Trockenlauf/.test(r.stdout), 'Trockenlauf schreibt nichts: ' + r.stdout + r.stderr);
  r = cli('raum:gibtsnicht.tiefe=100cm');
  check(r.status === 1 && /unbekannt/i.test(r.stdout + r.stderr) && fs.readFileSync(datei, 'utf8') === PM_TEXT, 'unbekanntes Maß wird abgelehnt: ' + r.stdout + r.stderr);
  r = cli('raum:kind1.breite=1,26');
  check(r.status === 1 && /Einheit/.test(r.stdout + r.stderr), 'zweideutiger Wert wird abgelehnt: ' + r.stdout + r.stderr);
  r = cli('raum:kind1.breite');
  check(r.status === 2, 'Aufruf ohne Wert: Ausgang 2, war ' + r.status);
  // Messliste aus der Seite einspielen
  const liste = path.join(dir, 'aufmass.json');
  fs.writeFileSync(liste, JSON.stringify(M.listeErzeugen(D, [{ mass: 'raum:speis.tiefe', cm: 125.5, datum: '2026-10-12' }, { mass: 'raum:kind1.tiefe', cm: 320 }])));
  r = cli('--liste', liste);
  const ol = JSON.parse(fs.readFileSync(datei, 'utf8'));
  check(r.status === 0 && ol.masse.length === PM.masse.length + 2 && ol.masse[ol.masse.length - 2].cm === 125.5, 'CLI spielt die Messliste ein: ' + r.stdout + r.stderr);
  fs.writeFileSync(datei, PM_TEXT);
  fs.writeFileSync(liste, '{"format":"haus-aenderungen","version":1}');
  r = cli('--liste', liste);
  check(r.status === 1 && /Aufmaß|Format/.test(r.stdout + r.stderr) && fs.readFileSync(datei, 'utf8') === PM_TEXT, 'falsche Liste wird abgelehnt: ' + r.stdout + r.stderr);
  r = cli('--liste', liste, 'raum:kind1.breite=339cm');
  check(r.status === 2, 'Liste und einzelne Messung zugleich: Ausgang 2, war ' + r.status);
}

if (fails.length) { console.log('FEHLER:\n  ' + fails.join('\n  ')); process.exit(1); }
console.log('Aufmaß: alle Prüfungen bestanden');
