# HeroList Offline: Android & Windows

Separate builds are published by GitHub Actions in **Build offline HeroList APK and Windows EXE**.

- **Android:** `standalone/android` source; downloadable **HeroList-Android-Offline-APK** artifact after successful workflow. The APK itself is inside this artifact.
- **Windows:** `standalone/windows` source; downloadable **HeroList-Windows-Standalone-EXE** artifact containing portable `.exe`.

GitHub Actions packages artifacts into ZIP downloads. Extract the ZIP to obtain the actual APK or EXE. A checked-in binary is intentionally not used because Electron executables may exceed GitHub's 100 MiB file limit.

Both builds include the static client and work offline without login. Local device storage is not synchronized with existing web accounts. Import previously exported JSON/ZIP files to move characters across devices.

PDF uses Electron native printToPDF on Windows and Android's system print service (choose Save as PDF). JSON and ZIP use OS Save As interfaces.
