# Конфиг nginx боевой машины

До 24 октября 2026 года эти файлы существовали в одном экземпляре — на самой
машине. Машина уже один раз сгорела вместе с датацентром (CLAUDE.md §2), и
восстанавливать маршрутизацию приходилось по памяти. Теперь копия лежит здесь,
в репозитории, и она же является источником истины.

| файл в репозитории            | путь на машине                      |
|-------------------------------|-------------------------------------|
| `iwent.ru.conf`               | `/etc/nginx/sites-enabled/iwent.ru` |
| `conf.d-00-hardening.conf`    | `/etc/nginx/conf.d/00-hardening.conf` |

## Как применить изменения

```bash
scp -i ~/.ssh/yandex-cloud docs/nginx/iwent.ru.conf root@91.197.99.213:/root/
ssh -i ~/.ssh/yandex-cloud root@91.197.99.213
  mkdir -p /root/nginx-backups
  cp -a /etc/nginx/sites-enabled/iwent.ru /root/nginx-backups/iwent.ru.$(date +%Y%m%d-%H%M%S)
  cp /root/iwent.ru.conf /etc/nginx/sites-enabled/iwent.ru
  nginx -t && systemctl reload nginx
```

`nginx -t` обязателен: reload с битым конфигом nginx не выполнит, но и об ошибке
узнаешь только из журнала.

**Бэкап нельзя класть рядом с конфигом.** `nginx.conf` включает
`sites-enabled/*` целиком, без фильтра по расширению — файл `iwent.ru.bak-...`
в той же папке подхватится как второй server-блок с тем же `server_name`.
Поэтому бэкапы уезжают в `/root/nginx-backups/`.

## Что важно знать про сам конфиг

- **Список префиксов API.** Всё, чего нет в регулярке с `auth|events|users|...`,
  уходит в Next.js. Новый контроллер с новым префиксом надо добавлять и сюда,
  иначе приложение получит HTML-страницу 404 вместо JSON. Подробно — CLAUDE.md
  §2.1.1, там же история про сломанную на несколько дней ленту воспоминаний.
- **Проверка нового конфига без подмены боевого.** Удобно, когда правка
  нетривиальная:
  ```bash
  cat > /root/test-nginx.conf <<'CONF'
  user www-data; worker_processes 1; pid /run/nginx-test.pid;
  events { worker_connections 768; }
  http {
      include /etc/nginx/mime.types;
      default_type application/octet-stream;
      include /etc/nginx/conf.d/00-hardening.conf;
      include /root/iwent.ru.conf;
  }
  CONF
  nginx -t -c /root/test-nginx.conf
  ```
- **`location ~ /\.(?!well-known)`.** Негативный lookahead здесь не для красоты:
  без него под раздачу попадут `/.well-known/apple-app-site-association`
  (универсальные ссылки iOS) и проверка домена certbot. После любой правки этого
  блока проверяй:
  ```bash
  curl -sI https://iwent.ru/.well-known/apple-app-site-association
  ```
  нужен `200` и `application/json`.
- **TLS-параметры не здесь.** `ssl_protocols`, шифры, `ssl_session_tickets off`
  приходят из `/etc/letsencrypt/options-ssl-nginx.conf`, который пишет certbot.
  Править его руками нельзя — обновления certbot перестанут приезжать.

## Что проверить после любого reload

```bash
for u in / /explore /api/events "/socket.io/?EIO=4&transport=polling" \
         /.well-known/apple-app-site-association; do
  curl -s -o /dev/null -w "%{http_code}  %{content_type}  $u\n" "https://iwent.ru$u"
done
```

Все пять должны отвечать `200`, причём `/api/events` — `application/json`
(если `text/html`, запрос ушёл в Next.js, см. §2.1.1).
