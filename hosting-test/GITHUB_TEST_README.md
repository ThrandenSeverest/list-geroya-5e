# HeroList — GitHub Pages test

`hosting-test` — отдельная статическая тестовая версия HeroList. Production backend, Telegram login и аккаунт не используются.

## GitHub Pages

В репозитории откройте **Settings → Pages** и в **Build and deployment → Source** выберите **GitHub Actions**.

Workflow `.github/workflows/hosting-test-pages.yml` автоматически собирает только `hosting-test` при изменениях в этой папке и публикует каталог `hosting-test/out`.

Ожидаемый адрес проекта без custom domain:

`https://thrandenserverest.github.io/list-geroya-5e/`

## Локальная проверка

```bash
cd hosting-test
npm ci
npm run dev
```

Для проверки именно статического экспорта:

```bash
npm run build
```

После успешной сборки готовая статика находится в `hosting-test/out/`.
