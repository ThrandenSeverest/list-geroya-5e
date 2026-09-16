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

Updater сам скачивает `main` во временный каталог, выполняет тесты и сборку,
останавливает службы только после успешной сборки, создаёт проверенный SQLite-
backup, заменяет только код, применяет Alembic и проверяет API/frontend после
перезапуска. При ошибке после остановки служб предыдущие `dist` и backend-код
возвращаются автоматически.

Полный `node_modules` нужен только во временной папке на время сборки. На
production остаётся минимальный runtime: около 38 МБ зависимостей вместо
примерно 967 МБ, плюс `dist` около 15 МБ. При `LEAN_HOSTING=1` также удаляются
ненужные на сервере frontend-исходники, тесты и сборочные кэши. `.git`, архивы
версий и временная сборка на хостинге не сохраняются.

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

Старые build-каталоги нужно удалить до новой сборки, чтобы в production не
остались чанки и файлы предыдущих версий.

## Рекомендуемый безопасный порядок

Предположим, рабочий каталог приложения — `/srv/herolist`, а чистая копия
`main` находится в `/tmp/herolist-main`.

1. Остановите сервисы приложения.
2. Скопируйте базу, `.env`, `uploads/` и `saves/` в отдельную резервную
   директорию.
3. Синхронизируйте код, сохраняя пользовательские данные:

   ```bash
   rsync -a --delete \
     --exclude='.git/' \
     --exclude='.env' \
     --exclude='backend/.env' \
     --exclude='backend/data/' \
     --exclude='uploads/' \
     --exclude='saves/' \
     /tmp/herolist-main/ /srv/herolist/
   ```

   Не добавляйте `--delete-excluded`: этот параметр удалит сохраняемые
   каталоги.

4. Установите зависимости и соберите frontend:

   ```bash
   cd /srv/herolist
   npm ci
   npm run build
   python3 -m pip install -r backend/requirements.txt
   ```

5. Примените миграции к сохранённой базе:

   ```bash
   cd /srv/herolist/backend
   python3 -m alembic upgrade head
   ```

   Миграция `0003_compact_storage` не удаляет старые JSON-данные. Она
   добавляет компактное хранилище; старые записи мигрируют при следующем
   сохранении пользователя. Миграция `0004_external_identities` добавляет
   отдельные Telegram-identities и scope recovery-сессий, не меняя
   `users.id`, `character_vaults.user_id` или содержимое vault.

   На время перехода безопасная конфигурация такая:

   ```env
   REGISTRATION_ENABLED=false
   LOGIN_ENABLED=false
   LEGACY_EMAIL_RECOVERY_ENABLED=true
   ```

   Старый E-mail/пароль в этом режиме выдаёт только ограниченную recovery-
   сессию: она может скачать единый JSON-backup и привязать Telegram, но не
   может записывать vault. После привязки Telegram открывает исходный
   `users.id` со всеми прежними персонажами и хоумбрю.

6. Запустите API и frontend, затем проверьте:

   - `/healthz` возвращает `{"ok": true}`;
   - существующий пользователь может войти через Telegram;
   - его серверные персонажи и хоумбрю доступны;
   - браузер с уже сохранёнными локальными персонажами показывает те же
     персонажи после обновления и перезагрузки;
   - новый персонаж сохраняется и открывается после перезагрузки.
   - старый E-mail пользователь открывает recovery, скачивает backup и
     привязывает Telegram; после этого видит прежние slot ID.

## Если файлы загружаются вручную

Сначала сохраните перечисленные выше пользовательские данные. Затем удалите
только старый код и build-каталоги, загрузите содержимое `main` с заменой,
выполните `npm ci`, `npm run build` и `alembic upgrade head`. Никогда не
очищайте весь каталог приложения одной рекурсивной командой: база или `.env`
могут находиться внутри него.
