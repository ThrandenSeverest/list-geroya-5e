# Обновление HeroList на хостинге из `main`

## Короткий способ: одна команда

В `deployment/update-hosting.sh` находится готовый безопасный updater. После
однократной настройки обновление выполняется одной командой:

```bash
sudo bash /srv/herolist/deployment/update-hosting.sh
```

Один раз перед первым запуском:

```bash
sudo cp /srv/herolist/deployment/herolist-update.conf.example /etc/herolist-update.conf
sudo nano /etc/herolist-update.conf
sudo cp /srv/herolist/deployment/list-geroya-api.service.example /etc/systemd/system/list-geroya-api.service
sudo cp /srv/herolist/deployment/list-geroya-web.service.example /etc/systemd/system/list-geroya-web.service
sudo systemctl daemon-reload
sudo systemctl enable --now list-geroya-api list-geroya-web
```

Нужно указать фактический `APP_DIR`, файл окружения и названия systemd-служб.
Для frontend-службы дан пример `deployment/list-geroya-web.service.example`.

Updater сам скачивает `main` с уже скомпилированным `dist`, проверяет метаданные
сборки, останавливает службы, создаёт проверенный SQLite-
backup, заменяет только код, применяет Alembic и проверяет API/frontend после
перезапуска. При ошибке после остановки служб предыдущие `dist` и backend-код
возвращаются автоматически.

Компиляция и полный `node_modules` на production больше не нужны. На сервере
остаётся минимальный runtime: около 38 МБ зависимостей вместо примерно 967 МБ,
плюс `dist` около 15 МБ. При `LEAN_HOSTING=1` также удаляются
ненужные на сервере frontend-исходники, тесты и сборочные кэши. `.git`, архивы
версий и временная сборка на хостинге не сохраняются.

## Как выпускать новое обновление

Перед каждым обновлением `main` нужно собрать и закоммитить свежий `dist`:

```bash
bash scripts/build-committed-dist.sh
git add dist package.json package-lock.json
```

`dist/BUILD_INFO.json` создаётся автоматически. GitHub workflow по-прежнему
проверяет исходники, но на хостинг отправляется именно уже собранная версия из
`dist`.

`vinext`, `react` и `react-dom` находятся в production `dependencies`.
Frontend запускается напрямую через `deployment/start-frontend.mjs`, поэтому
на сервер не устанавливаются Vite, Next, TypeScript, каталоги типов и прочие
пакеты, нужные только при компиляции.

`main` — единственный актуальный источник production-версии. Старые каталоги
`hosting-*`, `hosting-update-*`, `export-*`, `site-export-*` и другие
снимки версий на сервере больше не нужны.

## Обязательно сохранить

Перед обновлением остановите frontend и API, затем сделайте резервную копию.
Следующие файлы и каталоги нельзя удалять или заменять содержимым репозитория:

- корневой `.env` и `backend/.env`;
- `backend/data/` целиком;
- все рабочие `*.db`, `*.sqlite`, `*.sqlite3`, а также их `-wal` и
  `-shm` файлы;
- внешний путь к SQLite, если `DATABASE_URL` указывает за пределы каталога
  проекта;
- `uploads/` и `saves/`;
- пользовательские резервные копии;
- серверные конфиги Nginx, systemd, SSL-сертификаты и секреты, если они
  находятся вне репозитория.

Путь фактической базы сначала проверьте в `DATABASE_URL`. Не предполагайте,
что база обязательно лежит в `backend/data/`.

## Важно для локальных персонажей в браузере

Локальные персонажи хранятся в `localStorage` браузера и не лежат в каталоге
проекта на сервере. Чтобы они пережили обновление, production должен остаться
на том же origin: тот же протокол (`https`), домен и порт. Замена файлов,
пересборка frontend и обновление `main` сами по себе `localStorage` не
очищают.

Перед гидрацией интерфейса `main` запускает storage guard. Он сохраняет
предыдущий `list-geroya-character-vault-v1` в независимый безопасный backup и
после старта проверяет, что новая сборка не заменила существующие ID слотов
новым пустым Vault. При аварийной замене старый snapshot восстанавливается до
следующей загрузки. Также сохраняется резервная копия legacy-ключа
`dark-codex-character`.

Нельзя добавлять в production-деплой команды или скрипты, которые вызывают
`localStorage.clear()`, удаляют эти ключи или меняют production origin без
отдельной миграции данных.

## Можно и нужно удалить или заменить

Внутри каталога приложения следует заменить версиями из `main`:

- `app/`, `public/`, `scripts/`, `deployment/`;
- `backend/app/`, `backend/alembic/`, `backend/scripts/`,
  `backend/requirements.txt`;
- `package.json`, `package-lock.json`, `next.config.ts`,
  `postcss.config.mjs`, `vite.config.ts`, `tsconfig.json`;
- старые `dist/`, `.next/`, `.vinext/`, `node_modules/` и прочие
  кэши сборки;
- старые каталоги-снимки `hosting-*`, `hosting-update-*`, `export-*`,
  `site-export-*`, `backup/` и `workflow-handoff/`.

Старые build-каталоги не нужно собирать или чистить вручную: updater сам
заменяет `dist` готовой версией из `main`.

## Обычное обновление production

После первоначальной настройки нужна ровно одна команда:

```bash
sudo bash /srv/herolist/deployment/update-hosting.sh
```

Не запускайте на хостинге `npm run build`, `vite build` или обычный `npm ci`.
Updater скачивает уже скомпилированный `dist` и устанавливает только runtime:

```bash
npm ci --omit=dev --ignore-scripts --legacy-peer-deps
```

Он самостоятельно создаёт backup базы, сохраняет `.env`, SQLite, `uploads/`
и `saves/`, применяет миграции, перезапускает службы и проверяет сайт.

Перед первым обновлением проверьте в `backend/.env`:

```env
REGISTRATION_ENABLED=false
LOGIN_ENABLED=false
LEGACY_EMAIL_RECOVERY_ENABLED=true
```

`DATABASE_URL` и `EXT_AUTH_BASE` должны остаться прежними. Миграция
`0004_external_identities` не меняет `users.id` или содержимое vault: старый
E-mail пользователь может открыть recovery, выгрузить backup и привязать
Telegram к своему прежнему аккаунту.

После завершения updater сам проверяет API и frontend. Дополнительно убедитесь,
что существующий пользователь входит через Telegram и видит свои персонажи.
