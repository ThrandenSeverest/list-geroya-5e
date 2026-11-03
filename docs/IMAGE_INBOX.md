# HeroList Image Inbox

Permanent upload inbox: https://github.com/ThrandenSeverest/list-geroya-5e/issues/19

This solves the otherwise missing transfer between image generation in ChatGPT and the GitHub connector. It does NOT claim that ChatGPT image_gen files are directly readable by GitHub.

## Once

Merge the workflow in this branch into **main** once. GitHub only triggers issue_comment workflows that exist on the default branch. This workflow only accepts comments by the repository owner on issue #19.

## For each upload

1. In ChatGPT, copy the generated image.
2. Open issue #19, paste the image into a **comment** (Ctrl+V) and post it. Or download the PNG then drag it into the GitHub issue comment field.
3. GitHub hosts the image and its GitHub Actions runner imports the exact original bytes into branch `assets/issue-19`.

There is no Base64 text transfer through ChatGPT, no local Git clone, and no personal access token. Multiple images can be pasted in one issue comment (up to 30 per run).

Imported images are stored at `public/experimental/inbox/issue-19/<sha256-prefix>.png` (or JPG/WebP). The index file next to them records SHA-256, comment ID, byte size, and original alt text. Repeating the same image does not create multiple identical files. The script validates actual image types and dimensions, preserves transparency, and never resizes or recompresses the originals.

Uploads land on an **isolated branch**; the production site and mobile builds do not deploy automatically just because someone pasted an image. Move files into their final destination and check Paperdoll registration and alignment before merging.

## Limitations

This is not a zero-interaction pipeline. The user still has to place the image on GitHub once, because the current ChatGPT GitHub connector cannot read image_gen binary output. Clipboard paste can be browser-dependent; the fallback is to download the image and attach it in the GitHub comment editor. Never upload sensitive/private material to a public issue.

To check failures, look at the repository Actions tab for **HeroList Image Inbox** and its import job; verify image hashes against the staging branch.
