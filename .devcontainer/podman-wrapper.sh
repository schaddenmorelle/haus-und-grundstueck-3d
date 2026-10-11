#!/usr/bin/env bash
# Nur Mac + Podman. Dieser Wrapper behebt zwei Podman-Eigenheiten, die beide nicht in die
# gemeinsame `devcontainer.json` gehören, weil Docker Desktop unter Windows daran scheitern würde.
#
# 1. „Starting container“ hängt: Cursor/Dev-Containers wartet ausschließlich auf `podman events`.
#    Der Stream verliert Start-Events (Race) oder liefert unter macOS/libkrun zeitweise gar
#    nichts — dann hängt der Dialog, obwohl der Container schon läuft. Ersetzt durch einen
#    Polling-Fallback, der Start-Events aus `podman ps` synthetisiert.
# 2. Workspace nur lesbar: Podman reicht die Host-UID unverändert durch, der Workspace erscheint
#    im Container als 502:20, `vscode` ist aber 1000 — Schreiben scheitert (`FETCH_HEAD:
#    Permission denied`), ebenso Zugriffe über die durchgereichten Sockets (`EACCES`).
#    `updateRemoteUserUID` hilft hier nicht: Das gilt laut Spezifikation nur auf Linux-Hosts.
#    Deshalb gibt dieser Wrapper bei `build` die UID/GID des Mac-Benutzers als Build-Arg mit; das
#    `Dockerfile` setzt vscode damit zur Build-Zeit um. Zur Laufzeit wäre `usermod` falsch — das
#    endet in „I have no name!", siehe post-create.sh.
#    `--userns=keep-id` wäre der elegantere Weg, ist aber eine rootless-Option und wirkungslos,
#    solange die Podman-Machine rootful läuft (Messstand: 65-Werkstatt/Devcontainer.md).
#
# Windows-Weiche: Beides steht hier und nicht in der `devcontainer.json`, weil Docker Desktop
# damit nichts anfangen könnte. In Cursor (nur Mac): dev.containers.dockerPath → absoluter Pfad
# zu dieser Datei. Unter Windows bleibt der normale dockerPath auf Docker, der Wrapper läuft
# nicht, das Image bleibt bei UID 1000 und den Abgleich macht dort `updateRemoteUserUID`.
set -euo pipefail
PODMAN="${PODMAN_BIN:-/opt/podman/bin/podman}"

if [[ "${1:-}" == "events" ]]; then
  exec /usr/bin/env python3 - "$PODMAN" "$@" <<'PY'
import json
import subprocess
import sys
import time

podman = sys.argv[1]
seen: set[str] = set()

def inspect_labels(cid: str) -> tuple[str, dict]:
    raw = subprocess.check_output(
        [podman, "inspect", "--format", "{{json .}}", cid],
        text=True,
        stderr=subprocess.DEVNULL,
    )
    data = json.loads(raw)
    full_id = data.get("Id") or cid
    labels = (data.get("Config") or {}).get("Labels") or {}
    return full_id, labels

def emit_start(full_id: str, labels: dict) -> None:
    # Format, das @devcontainers/cli für isPodman erwartet (Status + Actor.Attributes).
    event = {
        "Status": "start",
        "ID": full_id,
        "id": full_id,
        "Attributes": labels,
        "Actor": {"Attributes": labels},
    }
    sys.stdout.write(json.dumps(event, separators=(",", ":")) + "\n")
    sys.stdout.flush()

# Bereits laufende Container mitnehmen — entschärft den Fall „Container läuft, Event war weg“.
try:
    existing = subprocess.check_output(
        [podman, "ps", "-q", "--filter", "status=running"],
        text=True,
        stderr=subprocess.DEVNULL,
    ).split()
except subprocess.CalledProcessError:
    existing = []

for cid in existing:
    try:
        full_id, labels = inspect_labels(cid)
        seen.add(full_id)
        seen.add(cid)
        if labels.get("devcontainer.local_folder"):
            emit_start(full_id, labels)
    except (subprocess.CalledProcessError, json.JSONDecodeError, KeyError):
        continue

# Danach neue Starts per Polling melden (robuster als der native Events-Stream).
while True:
    try:
        running = subprocess.check_output(
            [podman, "ps", "-q", "--filter", "status=running"],
            text=True,
            stderr=subprocess.DEVNULL,
        ).split()
    except subprocess.CalledProcessError:
        time.sleep(0.5)
        continue

    for cid in running:
        if cid in seen:
            continue
        try:
            full_id, labels = inspect_labels(cid)
        except (subprocess.CalledProcessError, json.JSONDecodeError, KeyError):
            continue
        seen.add(full_id)
        seen.add(cid)
        emit_start(full_id, labels)

    time.sleep(0.4)
PY
fi

# Position hinter dem Subcommand bestimmen. Angehängt werden darf die Option nicht: Beim Build
# steht am Ende das Kontextverzeichnis, das Argument gehört unmittelbar hinter `build`.
einfuegen_bei=0
case "${1:-}" in
  build) einfuegen_bei=1 ;;
  image | buildx)
    if [[ "${2:-}" == "build" ]]; then einfuegen_bei=2; fi
    ;;
esac

# Eine von außen mitgegebene UID hat Vorrang — dann hier nichts dazutun.
if [[ $einfuegen_bei -gt 0 ]]; then
  for arg in "$@"; do
    if [[ "$arg" == USER_UID=* ]]; then
      einfuegen_bei=0
      break
    fi
  done
fi

# Der zweite Build der Erweiterung (Features) kennt diese Args nicht und warnt nur darüber
# („one or more build args were not consumed") — das ist harmlos.
if [[ $einfuegen_bei -gt 0 ]]; then
  exec "$PODMAN" "${@:1:$einfuegen_bei}" \
    --build-arg "USER_UID=$(id -u)" --build-arg "USER_GID=$(id -g)" \
    "${@:$((einfuegen_bei + 1))}"
fi

exec "$PODMAN" "$@"
