#!/usr/bin/env bash
# Продление SSL для iventapp.ru на прод-сервере.
# Запускать НА СЕРВЕРЕ (через SSH или серийную консоль Yandex Cloud).
#
# С этой машины: ssh -i ~/.ssh/yandex-cloud ubuntu@158.160.67.4
# Затем на сервере: sudo bash -c "$(curl -sSL https://raw.githubusercontent.com/...)" 
# Или скопировать скрипт на сервер и выполнить там.
set -e
echo "🔄 Продление SSL (certbot renew)..."
sudo certbot renew --nginx --non-interactive
echo "🔄 Перезагрузка nginx..."
sudo systemctl reload nginx
echo "✅ Готово. Проверьте: https://iventapp.ru/"
