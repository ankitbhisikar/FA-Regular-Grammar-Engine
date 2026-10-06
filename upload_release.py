"""
upload_release.py  –  Create a GitHub Release and upload APK asset
"""
import subprocess, json, urllib.request, urllib.error, sys, os

OWNER    = "ankitbhisikar"
REPO     = "FA-Regular-Grammar-Engine"
TAG      = "v1.0.0"
NAME     = "FA Regular Grammar Engine v1.0.0"
APK_FILE = "fa-grammar-app.apk"
ZIP_FILE = "fa-grammar-app.zip"

BODY = """## FA Regular Grammar Engine – v1.0.0

### What's new
- High-tech animated **preloader** (7.5 s intro)
- **History Manager** – stores past DFA configurations and test results
- **SQLite backend** (`server.py`) for persistent history
- Interactive DFA diagram with grammar output
- Full PWA support (installable on Android)

### Install on Android
Download **fa-grammar-app.apk** below, enable *Install unknown apps* in Android settings, then tap the APK to install.

> **Note**: The APK is unsigned (debug build). For production use, sign it with a keystore via Android Studio.

### Web App
Live at: https://ankitbhisikar.github.io/FA-Regular-Grammar-Engine/
"""

def get_token():
    try:
        proc = subprocess.run(
            ["git", "credential", "fill"],
            input="protocol=https\nhost=github.com\n\n",
            capture_output=True, text=True, timeout=10
        )
        for line in proc.stdout.splitlines():
            if line.startswith("password="):
                return line.split("=", 1)[1].strip()
    except Exception:
        pass
    return None

def api(method, path, data=None, token=None, raw_body=None, content_type="application/json"):
    url = f"https://api.github.com{path}"
    if raw_body is not None:
        body = raw_body
    elif data is not None:
        body = json.dumps(data).encode()
    else:
        body = None
    headers = {
        "Accept":              "application/vnd.github+json",
        "X-GitHub-Api-Version":"2022-11-28",
        "User-Agent":          "fa-grammar-bot",
        "Content-Type":        content_type,
    }
    if token:
        headers["Authorization"] = f"Bearer {token}"
    req = urllib.request.Request(url, data=body, headers=headers, method=method)
    try:
        resp = urllib.request.urlopen(req, timeout=120)
        return resp.status, json.loads(resp.read())
    except urllib.error.HTTPError as e:
        return e.code, json.loads(e.read())

def upload_asset(upload_url, filepath, token):
    # upload_url looks like: https://uploads.github.com/repos/.../releases/123/assets{?name,label}
    base = upload_url.split("{")[0]
    fname = os.path.basename(filepath)
    url = f"{base}?name={urllib.parse.quote(fname)}"
    with open(filepath, "rb") as f:
        data = f.read()
    headers = {
        "Accept":              "application/vnd.github+json",
        "X-GitHub-Api-Version":"2022-11-28",
        "User-Agent":          "fa-grammar-bot",
        "Authorization":       f"Bearer {token}",
        "Content-Type":        "application/octet-stream",
    }
    req = urllib.request.Request(url, data=data, headers=headers, method="POST")
    try:
        resp = urllib.request.urlopen(req, timeout=300)
        return resp.status, json.loads(resp.read())
    except urllib.error.HTTPError as e:
        return e.code, json.loads(e.read())

import urllib.parse

def main():
    token = get_token()
    if not token:
        print("[ERROR] Could not get token from git credential manager.")
        sys.exit(1)

    # 1. Check if release already exists
    print(f"[1/4] Checking for existing release '{TAG}' ...")
    status, resp = api("GET", f"/repos/{OWNER}/{REPO}/releases/tags/{TAG}", token=token)
    if status == 200:
        release_id   = resp["id"]
        upload_url   = resp["upload_url"]
        print(f"      Release already exists (id={release_id}), reusing it.")
    elif status == 404:
        # Create it
        print(f"[2/4] Creating release '{TAG}' ...")
        status, resp = api("POST", f"/repos/{OWNER}/{REPO}/releases", token=token, data={
            "tag_name":   TAG,
            "name":       NAME,
            "body":       BODY,
            "draft":      False,
            "prerelease": False,
        })
        if status not in (200, 201):
            print(f"[ERROR] Could not create release: HTTP {status}: {resp}")
            sys.exit(1)
        release_id = resp["id"]
        upload_url = resp["upload_url"]
        print(f"      Release created (id={release_id})")
    else:
        print(f"[ERROR] HTTP {status}: {resp}")
        sys.exit(1)

    # 2. Upload APK
    for fpath in [APK_FILE, ZIP_FILE]:
        if not os.path.exists(fpath):
            print(f"      Skipping {fpath} (not found)")
            continue
        size_mb = os.path.getsize(fpath) / 1024 / 1024
        print(f"[3/4] Uploading {fpath} ({size_mb:.1f} MB) ...")
        s, r = upload_asset(upload_url, fpath, token)
        if s in (200, 201):
            print(f"      Uploaded: {r.get('browser_download_url', 'ok')}")
        elif s == 422:
            print(f"      Already uploaded (422 asset exists) – skipping.")
        else:
            print(f"      [WARN] HTTP {s}: {r}")

    print(f"\n[4/4] DONE!")
    print(f"      Release URL: https://github.com/{OWNER}/{REPO}/releases/tag/{TAG}")

if __name__ == "__main__":
    main()
