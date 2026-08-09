# Backup v0.8.0

Complete source backup of «Лист Героя 5e» immediately before the email/password account work.

- Sites source commit: `c111b08428076218ea3d154183bc2659c63f064f`
- Package version: `0.8.0`
- Excludes generated dependencies and build caches: `node_modules`, `dist`, `.sites-runtime`, `.vinext`, `.wrangler`, and `.git`.

## Restore

From this directory:

```bash
cat list-geroya-5e-v0.8.0-source.tar.gz.b64.part-* | base64 -d > list-geroya-5e-v0.8.0-source.tar.gz
mkdir list-geroya-5e-v0.8.0
tar -xzf list-geroya-5e-v0.8.0-source.tar.gz -C list-geroya-5e-v0.8.0
```

Verify the archive before extracting:

```bash
gzip -t list-geroya-5e-v0.8.0-source.tar.gz
```
