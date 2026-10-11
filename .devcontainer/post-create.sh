#!/usr/bin/env bash
# Wird einmal nach dem ersten Container-Build ausgeführt (postCreateCommand).
# Fast nur Sekunden-Arbeit: Pakete stehen im Dockerfile, damit ein Rebuild schnell bleibt.
set -euo pipefail

# Git-Einstellungen gelten pro Installation; der Container ist eine eigene Umgebung.
git config --global core.quotepath false
git config --global core.autocrlf false

# Die Erweiterung kopiert die Host-.gitconfig in den Container. Vom Mac kommt darin
# credential.helper=osxkeychain — den gibt es unter Linux nicht, jeder Zugriff auf ein
# Remote scheitert dann mit „is not a git command". Die IDE reicht ihren eigenen Helper
# beim Aufruf durch, hier bleibt das Feld deshalb leer.
git config --global --unset-all credential.helper || true

# Workspace als safe.directory, damit Git bei gemappten UIDs nicht blockiert.
git config --global --add safe.directory "${containerWorkspaceFolder:-$PWD}"

# Abhängigkeiten des Projekts (three@0.128.0 für npm test) und Playwright mit Chromium für die
# Screenshots (tools/shot_view.js). Schlägt eines fehl, ist nur ein Teil der Umgebung betroffen:
# deshalb warnen statt abbrechen.
if command -v npm >/dev/null 2>&1; then
  npm ci >/dev/null 2>&1 \
    || echo "post-create: WARNUNG — npm ci fehlgeschlagen."
  npm install -g playwright >/dev/null 2>&1 \
    && playwright install --with-deps chromium >/dev/null 2>&1 \
    || echo "post-create: WARNUNG — Playwright-Installation fehlgeschlagen."
fi

# Codex als zweiter Coding-Agent neben Claude Code. Ein offizielles Devcontainer-Feature gibt es
# nicht; das offizielle npm-Paket landet im gruppenschreibbaren nvm-Präfix des Node-Features.
# Ohne sudo installieren, damit Codex sich später selbst aktualisieren kann. Schlägt der Download
# fehl, bleibt der übrige Container benutzbar.
npm install --global @openai/codex \
  || echo "post-create: WARNUNG — Installation der Codex-CLI fehlgeschlagen."

echo "post-create: $(rg --version | head -1), node=$(node --version), gh=$(command -v gh), codex=$(command -v codex || echo nicht installiert)"

ziel_uid=$(stat -c %u .)
ziel_gid=$(stat -c %g .)

# Rechte in den Agenten-Volumes und in der GitHub-CLI-Anmeldung stehen in post-start.sh, weil sie
# bei jedem Start stimmen müssen und nicht nur beim Anlegen. Hier einmal mitausführen, damit
# ein frischer Container nicht erst neu gestartet werden muss.
bash "$(dirname "$0")/post-start.sh"

# Den UID-Abgleich erledigt der Image-Build, nicht dieses Skript: auf dem Mac über das Build-Arg
# USER_UID/USER_GID, das .devcontainer/podman-wrapper.sh mitgibt, unter Windows über
# updateRemoteUserUID aus der devcontainer.json.
# Bewusst kein usermod hier — der verschiebt nur den passwd-Eintrag; laufende Cursor-Prozesse und
# der Container-User bleiben bei 1000 → „I have no name!", Permission denied auf /home/vscode.
if [[ "$ziel_uid" != "$(id -u)" || "$ziel_gid" != "$(id -g)" ]]; then
  echo "post-create: WARNUNG — vscode ist $(id -u):$(id -g), Workspace ${ziel_uid}:${ziel_gid}."
  echo "post-create: Der Workspace ist damit nur lesbar. Kein usermod, sondern:"
  echo "post-create:   Mac (Podman) — dev.containers.dockerPath muss auf"
  echo "post-create:   .devcontainer/podman-wrapper.sh zeigen; nur dann kommt die Host-UID"
  echo "post-create:   als Build-Arg im Image an. Danach Rebuild Container, notfalls ohne Cache,"
  echo "post-create:   damit der Layer mit dem Build-Arg neu entsteht."
  echo "post-create:   Windows (Docker) — Container löschen und neu bauen, damit"
  echo "post-create:   updateRemoteUserUID beim Anlegen greift."
fi
