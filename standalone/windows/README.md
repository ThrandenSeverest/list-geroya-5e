# HeroList Windows (portable EXE)

Self-contained Electron Windows executable. No Node.js, server, account or network connection is required on the user's PC.

## Where saves are stored

The EXE does **not** contain saves. Electron persists each app origin's `localStorage` in its `userData` profile, normally:

- Windows: `%APPDATA%\HeroList`
- Character vault: the Chromium `Local Storage/leveldb` directory within that profile; the key is `list-geroya-character-vault-v1`.
- Homebrew: same local storage profile, key `herolist-homebrew-local-v2`.

Open **HeroList → Открыть папку сохранений** in the desktop menu to reveal the actual `app.getPath('userData')` folder for that installation. Saved characters remain there when the portable EXE is moved/replaced. Removing the folder, clearing app storage, or changing the user profile may permanently erase local saves.

For migration or backup use the character JSON exports or ZIP folder exports in the application. Copying only the EXE does not copy characters. JSON and ZIP export open Windows Save As; PDF uses native printToPDF.

Windows SmartScreen may warn about the unsigned EXE.
