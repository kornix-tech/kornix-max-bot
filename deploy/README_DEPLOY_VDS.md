# Deploy KORNIX MAX Bot на VDS

Этот scaffold запускает read-only MAX bot как отдельный Docker service рядом с существующим KORNIX backend/frontend stack. Бот не подключается к базе данных, не меняет KORNIX API и не реализует write-команды полива.

## 1. Путь На VDS

Репозиторий должен лежать здесь:

```bash
/opt/kornix/kornix-max-bot
```

## 2. Клонирование

```bash
cd /opt/kornix
git clone https://github.com/kornix-tech/kornix-max-bot.git
```

## 3. Production Env

```bash
cd /opt/kornix/kornix-max-bot
cp .env.production.example .env.production
nano .env.production
```

Заполнить секреты:

- `KORNIX_SERVICE_TOKEN`
- `MAX_BOT_TOKEN`
- `MAX_WEBHOOK_SECRET`

Не коммитить `.env.production` и не публиковать секреты в логах, issue, PR или документации.

## 4. Docker Network

Бот должен быть в той же Docker network, что и Caddy reverse proxy из backend stack. Для текущего compose проекта ожидаемая сеть:

```bash
meteo_stack_meteo_net
```

Если на VDS сеть называется иначе, задать переменную перед запуском:

```bash
export KORNIX_DOCKER_NETWORK=<actual_network_name>
```

Проверить сети:

```bash
docker network ls | grep meteo
```

## 5. Проверка Docker Network

`reverse-proxy` из `meteo_stack` и контейнер `kornix-max-bot` должны быть подключены к одной Docker network. Тогда Caddy сможет обратиться к bot service по имени:

```text
kornix-max-bot:3000
```

Посмотреть доступные сети:

```bash
docker network ls
```

Посмотреть сети Caddy reverse proxy:

```bash
docker inspect meteo_stack-reverse-proxy-1 --format '{{json .NetworkSettings.Networks}}'
```

После запуска бота посмотреть его сети:

```bash
docker inspect kornix-max-bot --format '{{json .NetworkSettings.Networks}}'
```

Если имя сети у `reverse-proxy` отличается от `meteo_stack_meteo_net`, перед запуском бота указать его явно:

```bash
export KORNIX_DOCKER_NETWORK=<network_from_reverse_proxy_inspect>
docker compose -f docker-compose.bot.yml up -d --build
```

В `docker-compose.bot.yml` контейнер получает стабильное имя и network alias `kornix-max-bot`, чтобы Caddy мог резолвить `reverse_proxy kornix-max-bot:3000` даже при отдельном compose project.

## 6. Сборка И Запуск

```bash
cd /opt/kornix/kornix-max-bot/deploy
docker compose -f docker-compose.bot.yml up -d --build
```

Проверить контейнер:

```bash
docker compose -f docker-compose.bot.yml ps
docker compose -f docker-compose.bot.yml logs --tail=100 kornix-max-bot
```

## 7. Локальный Smoke

Если порт временно опубликован для debug через `127.0.0.1:3000:3000`, проверить:

```bash
BASE_URL=http://127.0.0.1:3000 ./smoke-test.sh
```

Если `MAX_WEBHOOK_SECRET` включён в контейнере или в MAX, передать его smoke-скрипту. Скрипт добавит header `X-Max-Bot-Api-Secret`:

```bash
MAX_WEBHOOK_SECRET=<secret> BASE_URL=http://127.0.0.1:3000 ./smoke-test.sh
```

Через публичный Caddy после подключения route:

```bash
MAX_WEBHOOK_SECRET=<secret> BASE_URL=https://poliv360.ru ./smoke-test.sh
```

## 8. Подключение Caddy

Открыть основной Caddyfile backend stack:

```bash
nano /opt/kornix/meteo/meteo_stack/deploy/Caddyfile
```

Вставить содержимое `deploy/Caddyfile.bot.snippet` рядом с `/api/*` и frontend route:

```caddy
handle /max/webhook {
	reverse_proxy kornix-max-bot:3000 {
		header_up Host {host}
		header_up X-Real-IP {remote_host}
		header_up X-Forwarded-For {remote_host}
		header_up X-Forwarded-Proto {scheme}
	}
}
```

Важно: использовать `handle`, не `handle_path`, чтобы путь дошёл до приложения как `/max/webhook`.
Backend приложения должен получить именно `POST /max/webhook`; Caddy не должен срезать prefix.

Перезапустить reverse proxy из backend stack:

```bash
cd /opt/kornix/meteo/meteo_stack
docker compose -f docker-compose.yml -f docker-compose.prod.yml restart reverse-proxy
```

Если backend stack запускается с явным project name, использовать тот же `-p`, что и в production runbook.

## 9. MAX Webhook URL

В MAX указать публичный webhook:

```text
https://poliv360.ru/max/webhook
```

Если `MAX_WEBHOOK_SECRET` задан, MAX должен отправлять header:

```text
X-Max-Bot-Api-Secret: <MAX_WEBHOOK_SECRET>
```

## 10. Откат

Остановить только bot service:

```bash
cd /opt/kornix/kornix-max-bot/deploy
docker compose -f docker-compose.bot.yml down
```

Затем удалить route `/max/webhook` из Caddyfile и перезапустить `reverse-proxy`.

## 11. Safety Checklist

- Не публиковать `.env.production`.
- Не коммитить секреты.
- Не включать write-команды.
- Сначала проверить read-only `/start` и `/status`.
- Не менять backend `meteo` и frontend `kornix_site` для запуска бота.
