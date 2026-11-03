# HeroList: reliable image upload

Two paths avoid repeatedly trying to force PNG bytes through the ChatGPT text connector.

## A. Generated PNGs on disk: upload as GitHub binary blobs

Install GitHub CLI once and run gh auth login (or provide GH_TOKEN with repository Contents write permission).
Run from a cloned repository with Python 3:

    python scripts/upload_art_assets.py ./generated --branch feat/paperdoll-icons --dest public/experimental/paperdoll

PowerShell:

    py scripts/upload_art_assets.py "C:\images\paperdoll" --branch feat/paperdoll-icons --dest public/experimental/paperdoll

The source can be one file or a directory. Its nested layout is preserved. PNG/JPEG/WebP are uploaded as original bytes.
Only changed files are sent, using Git blob SHA-1 comparison. One Git tree and one commit are created for the entire batch.
GitHub's returned blob hash and the final committed tree are checked. Uploads can be safely retried.
Use --dry-run to preview paths. The target branch must already exist.

## B. Public image URLs: GitHub Actions performs the download

Use the connected GitHub API to create a UTF-8 JSON file at asset-import/jobs/my-batch.json:

    {
      "version": 1,
      "assets": [
        {
          "url": "https://github.com/user-attachments/assets/ACTUAL-IMAGE-ID",
          "path": "public/experimental/paperdoll/large/body.png"
        }
      ]
    }

Adding that manifest to main or a feat/ or assets/ branch triggers Import HeroList images.
The workflow downloads all images with Pillow image validation, optionally validates sha256, and commits them together.
Supported public sources: GitHub attachment / release URLs, raw.githubusercontent.com,
user-images.githubusercontent.com, private-user-images.githubusercontent.com, and i.imgur.com.
Public HTTPS images only, max 18 MiB each. The importer preserves the original encoded file; no automatic cropping or recompression.

CRITICAL: ChatGPT sandbox paths are private local paths, not public links. GitHub Actions cannot download them.
If an image exists only in the assistant sandbox, use option A after receiving the file locally.
The GitHub connector supports create_blob with a base64 string, but cannot read a local image automatically;
pasting large base64 payloads into messages is not a reliable alternative.

For Paperdoll body/armor overlays, use consistent canvas, scale and anchor points. Do not trim transparent edges.
Group by large/medium/small and by body/armor. Test overlay alignment separately before merging into main.

Uploading and deployment are different: a feature branch will not update the live site.
