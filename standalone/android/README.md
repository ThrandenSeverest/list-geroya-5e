# HeroList Android (offline APK)

Android WebView loads packaged HTML/CSS/JS assets under the private origin `https://appassets.androidplatform.net/`. No sign-in, backend or Internet permission.

## Where saves are stored

The app package is `fun.superaistory.herolist`. HeroList character vault (`list-geroya-character-vault-v1`) and Homebrew (`herolist-homebrew-local-v2`) are stored using WebView `localStorage` in **private Android application data**, not in the APK, Downloads, or the system browser.

Android normally preserves these data during an APK update if the application ID and signing key remain unchanged. Uninstalling the app or clearing its storage typically deletes the saved characters. A separately installed browser session cannot share this WebView data automatically.

Back up characters through app JSON exports or ZIP folder exports **before** uninstalling or changing the device. Android's system document picker chooses where exported JSON and ZIP files go (including Downloads); PDF uses Android PrintManager (choose Save as PDF).

GitHub Actions produces a debug-signed sideloadable APK. Changing the signing key can prevent installing an update over the existing application.
