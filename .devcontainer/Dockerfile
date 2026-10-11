# Alles Schwere gehört ins Image, nicht in postCreateCommand: ein Rebuild trifft dann
# den Layer-Cache, statt jedesmal Pakete neu zu laden.
FROM mcr.microsoft.com/devcontainers/base:ubuntu-24.04

ENV DEBIAN_FRONTEND=noninteractive

RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        bubblewrap \
        ripgrep \
        fd-find \
    && ln -sf "$(command -v fdfind)" /usr/local/bin/fd \
    && apt-get autoremove -y && apt-get clean -y \
    && rm -rf /var/lib/apt/lists/*

# Projektspezifisch ist hier nichts Schweres nötig: Python und Node kommen als Features aus der
# devcontainer.json, Playwright (Chromium) richtet post-create.sh ein.

# UID/GID des Benutzers vscode. Standard ist 1000 wie im Basis-Image — dabei bleibt es unter
# Windows, wo updateRemoteUserUID den Abgleich übernimmt (die Spezifikation wendet das nur auf
# Linux-Hosts an, und unter WSL ist der lokale Host Linux).
# Auf dem Mac gibt es diesen Abgleich nicht: Podman reicht die Host-UID unverändert durch, der
# Workspace erscheint als 502:20 und wäre für vscode (1000) nur lesbar. Deshalb setzt
# .devcontainer/podman-wrapper.sh die Werte des Hosts als Build-Arg — hier zur Build-Zeit, wo
# usermod gefahrlos ist. Zur Laufzeit wäre er falsch: „I have no name!", siehe post-create.sh.
ARG USER_UID=1000
ARG USER_GID=1000
# Die Ziel-GID kann im Image schon belegt sein (auf dem Mac ist 20 = staff, in Ubuntu dialout).
# Dann wird vscode dieser Gruppe zugeordnet, statt seine eigene Gruppe umzunummerieren.
RUN set -eu; \
    if [ "$USER_GID" != "$(id -g vscode)" ]; then \
        if getent group "$USER_GID" >/dev/null; then \
            usermod --gid "$USER_GID" vscode; \
        else \
            groupmod --gid "$USER_GID" vscode; \
        fi; \
    fi; \
    if [ "$USER_UID" != "$(id -u vscode)" ]; then \
        usermod --uid "$USER_UID" vscode; \
    fi; \
    chown -R "$USER_UID:$USER_GID" /home/vscode
