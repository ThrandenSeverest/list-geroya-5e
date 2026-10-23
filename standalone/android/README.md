# HeroList Android (offline APK)

Android WebView loads only packaged HTML/CSS/JS assets using a private HTTPS app origin. No sign-in, backend or internet permission.

Builds from the same static site as the web app. Imports use Android's system file picker. JSON and ZIP exports use ACTION_CREATE_DOCUMENT, and PDF uses Android PrintManager (choose **Save as PDF**).

Unsigned release APKs are not directly installable on many devices. The Actions workflow creates a debug-signed APK for sideloading; production publication must use a privately managed signing key.

All local heroes and Homebrew live in app WebView storage, separate from the browser. Before uninstalling or clearing app data export your collection to ZIP.
