# Перенос текущей версии сайта

Эта ветка содержит сохранённую текущую версию **Лист Героя 5e**:

- обычные распакованные исходники в корне ветки;
- `package.json` и `package-lock.json`;
- заранее собранную серверную версию в `dist/`;
- Dockerfile для хостинга с поддержкой Docker.

## Обычный Node.js-хостинг

Команды сборки:

```bash
npm ci
npm run build
```

Команда запуска:

```bash
npm start
```

Хостинг должен поддерживать серверное Node.js-приложение. Это не чисто статический сайт: сборка содержит `dist/client` и `dist/server`, поэтому одного `index.html` здесь нет.

## Docker

```bash
docker build -t list-geroya-5e .
docker run --rm -p 3000:3000 list-geroya-5e
```

Для Render, Railway, Fly.io и похожих сервисов можно подключить эту ветку и использовать Dockerfile либо команды `npm ci && npm run build` / `npm start`.
