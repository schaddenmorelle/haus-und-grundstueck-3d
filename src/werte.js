/* Werte: löst Achsen, Wandtypen und Maßausdrücke aus src/data/haus.json auf. Ohne Three.js, in Node testbar.
   Alle Maße in den Daten sind Millimeter. Ein Ausdruck ist
     - eine Zahl                          (Millimeter),
     - ein Achsenname                     ("x.Oi"),
     - { wert: 12950 }                    (Achse mit festem Wert),
     - { ref: "x.O", plus: .., minus: ..} (Achse plus/minus Zahl in mm oder Wandtyp; "TB-DG/2" = halbe Dicke).
   Halbe Wanddicken können halbe Millimeter ergeben (62,5 mm); sie sind im Binärsystem exakt. */
function werteAufloesen(haus) {
  var typen = haus.wandtypen || {}, achsen = {}, cache = {}, stack = [];
  [haus.aussenmasse || {}, haus.achsen || {}].forEach(function (gruppe) {
    Object.keys(gruppe).forEach(function (n) {
      if (n in achsen) throw new Error('Achse doppelt definiert: ' + n);
      achsen[n] = gruppe[n];
    });
  });

  function dicke(name) { // Wanddicke in mm, mit "/2" die halbe
    var halb = /\/2$/.test(name), n = name.replace(/\/2$/, '');
    if (!typen[n]) throw new Error('Wandtyp unbekannt: ' + name);
    return halb ? typen[n].dicke / 2 : typen[n].dicke;
  }
  function term(t) { return typeof t === 'number' ? t : dicke(t); }
  function achse(name) {
    if (name in cache) return cache[name];
    if (!(name in achsen)) throw new Error('Achse unbekannt: ' + name);
    if (stack.indexOf(name) >= 0) throw new Error('Zyklus in den Achsen: ' + stack.concat(name).join(' → '));
    stack.push(name);
    var v = ausdruck(achsen[name]);
    stack.pop();
    cache[name] = v;
    return v;
  }
  function ausdruck(e) {
    if (typeof e === 'number') return e;
    if (typeof e === 'string') return achse(e);
    if (e && e.wert != null) return e.wert;
    if (!e || e.ref == null) throw new Error('Ausdruck nicht lesbar: ' + JSON.stringify(e));
    var v = achse(e.ref);
    if (e.plus != null) v += term(e.plus);
    if (e.minus != null) v -= term(e.minus);
    return v;
  }
  return {
    mm: ausdruck,
    m: function (e) { return ausdruck(e) / 1000; },
    dicke: function (name) { return dicke(name); },
    achsen: function () { return Object.keys(achsen); }
  };
}
if (typeof module !== 'undefined') module.exports = { werteAufloesen: werteAufloesen };
