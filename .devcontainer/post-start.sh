#!/usr/bin/env bash
# Wird bei JEDEM Containerstart ausgeführt (postStartCommand) — anders als post-create.sh, das nur
# beim Anlegen läuft. Hier steht ausschließlich, was pro Start prüfbar sein muss, ohne Netz auskommt
# und gefahrlos wiederholt werden kann.
set -euo pipefail

anmeldung="$HOME/.claude"
gh_anmeldung="$HOME/.config/gh"
codex_anmeldung="$HOME/.codex"

# Beide Rechte-Blöcke unten brauchen sudo. Fehlt es, wird gewarnt statt abgebrochen: Ein
# fehlgeschlagenes postStartCommand lässt die IDE den Start als fehlerhaft melden, und der
# eigentliche Schaden — Claude Code kann nicht schreiben — ist ohne die Meldung nicht zu erraten.
if sudo -n true 2>/dev/null; then
  darf_rechte_setzen=ja
else
  darf_rechte_setzen=nein
  echo "post-start: WARNUNG — kein passwortloses sudo, Rechteprüfung übersprungen."
fi

# Die Anmeldung von Claude Code liegt im benannten Volume unter ~/.claude, damit sie einen Rebuild
# überlebt. Ein Volume speichert die Eigentümer mit: gehört sein Wurzelverzeichnis root — frisch
# angelegt ist das der Normalfall —, darf vscode dort keine Datei ersetzen. Claude Code schreibt
# .credentials.json atomar (neue Datei anlegen, dann umbenennen) und braucht dafür Schreibrecht am
# Verzeichnis, nicht nur an der Datei. Fehlt es, scheitert das Erneuern des OAuth-Tokens still:
# /login läuft durch, das Ergebnis landet aber nie auf der Platte, und beim nächsten Aufruf kommt
# wieder „401 OAuth access token has expired".
# Dieselbe Falle gilt für ~/.config/gh (GitHub CLI) und ~/.codex (Codex CLI): ohne Schreibrecht am
# Volume überlebt `gh auth login` bzw. die Codex-Anmeldung den Rebuild nicht.
# Maßstab ist die UID des laufenden Benutzers, nicht die des Workspace: schreiben muss der Prozess,
# unter dem claude, gh bzw. codex startet. Weichen beide voneinander ab, meldet das post-create.sh.
if [[ "$darf_rechte_setzen" == ja ]]; then
  for verzeichnis in "$anmeldung" "$gh_anmeldung" "$codex_anmeldung"; do
    mkdir -p "$verzeichnis"
    if [[ ! -w "$verzeichnis" || "$(stat -c '%u:%g' "$verzeichnis")" != "$(id -u):$(id -g)" ]]; then
      echo "post-start: $verzeichnis gehört $(stat -c '%U:%G' "$verzeichnis") — wird auf $(id -u):$(id -g) gesetzt."
      sudo chown -R "$(id -u):$(id -g)" "$verzeichnis"
      sudo chmod 700 "$verzeichnis"
    fi
  done
fi

# Claude Code aktualisiert sich selbst über npm. Ein Devcontainer-Feature installiert die CLI aber
# als root, während das npm-Präfix unter nvm dem Benutzer gehört: Das Paketverzeichnis
# lib/node_modules/@anthropic-ai ist dann root-eigen und für die Gruppe nicht schreibbar. Der Fehler
# fällt erst Tage später auf — nämlich wenn die erste neue Version erscheint — und lautet dann
# „✘ Auto-update failed: no write permission to npm prefix". Betroffen ist alles, was ein Feature
# global nachinstalliert, deshalb wird hier der Bestand geprüft und nicht ein fester Pfad. Die
# Gruppe kommt vom Präfix selbst (unter nvm „nvm"), damit die setgid-Rechte des Verzeichnisses
# weiter passen.
if [[ "$darf_rechte_setzen" == ja ]] && npm_praefix=$(npm prefix -g 2>/dev/null) \
  && [[ -d "$npm_praefix/lib/node_modules" ]]; then
  mapfile -t fremd < <(find "$npm_praefix/lib/node_modules" "$npm_praefix/bin" \
    -maxdepth 1 -mindepth 1 ! -user "$(id -u)" -print 2>/dev/null)
  if (( ${#fremd[@]} > 0 )); then
    gruppe=$(stat -c %g "$npm_praefix/lib/node_modules")
    echo "post-start: ${#fremd[@]} Einträge im npm-Präfix gehören nicht $(id -un) — werden übertragen."
    sudo chown -R -h "$(id -u):${gruppe}" "${fremd[@]}"
    sudo chmod -R g+w "${fremd[@]}"
  fi
fi

# Claude Code sperrt das Erneuern des Tokens über ein Verzeichnis (mkdir ist atomar). Stirbt der
# Prozess dazwischen — Rebuild, geschlossenes Fenster —, bleibt die Sperre liegen und blockiert
# jeden weiteren Refresh. Beim Containerstart läuft noch kein claude, eine vorhandene Sperre ist
# hier also immer ein Überbleibsel.
sperre="$anmeldung/.oauth_refresh.lock"
if [[ -e "$sperre" ]] && ! pgrep -u "$(id -u)" -x claude >/dev/null 2>&1; then
  echo "post-start: liegengebliebene OAuth-Sperre entfernt."
  rm -rf "$sperre"
fi

# Projektspezifisch ist beim Start nichts zu prüfen.
