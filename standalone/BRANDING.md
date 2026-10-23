# Standalone HeroList branding

The original character-sheet leaf, stat lines and writing quill are retained from `public/favicon.ico`.

Run `python standalone/scripts/generate_branding.py --source public/favicon.ico --out .` (requires Pillow) to build native PNG and ICO assets.

Android uses native mipmap and adaptive launcher icons, plus a loading image shown until the offline WebView has finished loading.

Windows uses an ICO embedded into the portable EXE and a splash BrowserWindow with animated loading dots before the main interface appears.

The web favicon, authentication, offline data and character exports are unchanged.
