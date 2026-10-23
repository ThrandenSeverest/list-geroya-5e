# HeroList Offline: Android & Windows

Standalone APK and portable EXE are published by GitHub Actions in **Build offline HeroList APK and Windows EXE**.

- Android package: `fun.superaistory.herolist`, private WebView localStorage, never shared with the browser.
- Windows package: Electron uses persistent `app.getPath('userData')`, normally `%APPDATA%\HeroList`, regardless of where the EXE lives. App menu **HeroList → Открыть папку сохранений** opens the exact location.
- In both apps, the character vault is saved under key `list-geroya-character-vault-v1`. Homebrew is stored under `herolist-homebrew-local-v2`.
- Both apps run offline with no login. Offline saves are independent from cloud/web saves and do not automatically synchronize.

**Backups:** Export important characters as HeroList JSON, or use folder ZIP exports, before clearing app data, uninstalling Android, or changing machines. Backups are written wherever you choose in the native save dialog. An EXE/APK by itself never contains your characters.

The downloadable GitHub Actions artifacts may be ZIP archives; the `standalone-latest` GitHub Release provides direct APK and EXE downloads. The Windows EXE is unsigned and may show a SmartScreen warning.
