# HeroList Android (offline APK)

Android WebView loads packaged HTML/CSS/JS assets under the private origin `https://appassets.androidplatform.net/`. No sign-in, backend or Internet permission.

## Where saves are stored

The app package is `fun.superaistory.herolist`. HeroList character vault (`list-geroya-character-vault-v1`) and Homebrew (`herolist-homebrew-local-v2`) are stored using WebView `localStorage` in **private Android application data**, not in the APK, Downloads, or the system browser.

Android normally preserves these data during an APK update if the application ID and signing key remain unchanged. Uninstalling the app or clearing its storage typically deletes the saved characters. A separately installed browser session cannot share this WebView data automatically.

Back up characters through app JSON exports or ZIP folder exports **before** uninstalling or changing the device. Android's system document picker chooses where exported JSON and ZIP files go (including Downloads); PDF uses Android PrintManager (choose Save as PDF).

### Android release signing (required for updates)

The GitHub Actions workflow refuses to publish a new Android APK unless these **repository Actions secrets** are configured:

- `HEROLIST_ANDROID_KEYSTORE_BASE64`: base64 encoding of the complete persistent JKS keystore file
- `HEROLIST_ANDROID_KEYSTORE_PASSWORD`: password of that JKS keystore
- `HEROLIST_ANDROID_KEY_ALIAS`: alias of the signing key in that JKS keystore
- `HEROLIST_ANDROID_KEY_PASSWORD`: password for the individual signing key

Create one long-lived signing key **once**, keep a secure offline backup of its JKS file and passwords, then configure all four secrets under **Settings → Secrets and variables → Actions** in GitHub. To create a key on a developer machine with JDK installed:

```bash
keytool -genkeypair -v -keystore herolist-release.jks -alias herolist -keyalg RSA -keysize 3072 -validity 10000
```

Use the same keystore and alias **for every new release**. To encode the JKS file:

- Linux: `base64 -w 0 herolist-release.jks`
- macOS: `base64 < herolist-release.jks | tr -d '\\n'`
- PowerShell: `[Convert]::ToBase64String([IO.File]::ReadAllBytes((Resolve-Path .\\herolist-release.jks)))`

The release is assembled using `assembleRelease` and validated by `apksigner verify`. **Never commit the keystore or secrets to this public repository**. Changing the signing key again will break in-place updates.

#### Migrating from the old debug-signed APK

APK versions published on October 23, 2026 were signed by a fresh GitHub Actions runner debug key. They cannot be updated in place by the new release key. If one is already installed:

1. Open the old HeroList app and export each important character to JSON / export a ZIP backup.
2. Verify the exported files exist outside the app's private storage.
3. Uninstall the old APK, then install the new **release-signed** APK.
4. Import the exported characters.

**Uninstalling without an export deletes local WebView data.** This one-time migration is required to establish a stable signature for future updates.



### Temporary preview builds when release-signing secrets are absent

If none of the 4 signing secrets has been configured, GitHub Actions publishes **HeroList-Android-Preview.apk** instead of failing. This debug-signed preview uses Android package ID `fun.superaistory.herolist.preview`, and is visibly labeled **Лист Героя 5e (тест)**. It installs alongside the old `fun.superaistory.herolist` APK, preserving the old installation and its local character saves.

The preview has its **own empty local storage**. To continue playing an old character, export it as JSON / ZIP from the original HeroList and import it in the preview. The preview uses an ephemeral debug key and **is not an in-place updatable production APK**. Once a real persistent signing key is provided, the workflow switches automatically to a properly signed `HeroList-Android-Offline.apk` build.

If only some (but not all) signing secrets exist, the workflow fails intentionally rather than publishing with a mismatched signing identity.


### Installation smoke test

The Android workflow now boots an Android 14 (API 34) emulator, installs the exact APK that will be uploaded via `adb install` (without `-t`) and starts the main activity. The workflow fails rather than publishes if installation or first launch fails. The debug preview enables v1/v2/v3 signatures and targets API 34 for modern Android compatibility. This emulator check does not guarantee every manufacturer's installer will accept a sideloaded file, so the user's actual device still matters.
