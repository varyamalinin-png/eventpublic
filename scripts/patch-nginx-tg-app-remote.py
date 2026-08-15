#!/usr/bin/env python3
"""Вставить блок /tg-app/ в iventapp.ru сразу после закрывающей } блока /vk-app/."""
from pathlib import Path

path = Path("/etc/nginx/sites-enabled/iventapp.ru")
text = path.read_text(encoding="utf-8")
if "location ^~ /tg-app/" in text:
    print("already has tg-app")
    raise SystemExit(0)

lines = text.splitlines(keepends=True)
out: list[str] = []
i = 0
inserted = False
while i < len(lines):
    out.append(lines[i])
    if "/vk-app/index.html" in lines[i] and not inserted:
        j = i + 1
        while j < len(lines) and lines[j].strip() == "":
            out.append(lines[j])
            j += 1
        if j < len(lines) and lines[j].strip() == "}":
            out.append(lines[j])
            out.append("\n")
            out.append(
                "    # Telegram Mini App (scripts/deploy-tg-mini-app-to-vm.sh → /var/www/tg-app/)\n"
            )
            out.append("    location = /tg-app {\n")
            out.append("        return 301 https://$host/tg-app/;\n")
            out.append("    }\n")
            out.append("    location ^~ /tg-app/ {\n")
            out.append("        root /var/www;\n")
            out.append("        index index.html;\n")
            out.append("        try_files $uri $uri/ /tg-app/index.html;\n")
            out.append("    }\n")
            out.append("\n")
            i = j + 1
            inserted = True
            continue
    i += 1

if not inserted:
    raise SystemExit("could not find vk-app block end")

path.write_text("".join(out), encoding="utf-8")
print("patched")
