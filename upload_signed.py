"""
upload_signed.py  –  Upload signed APK to GitHub Release v1.0.0
"""
import urllib.request, urllib.parse, urllib.error
import subprocess, json, os, sys

OWNER = "ankitbhisikar"
REPO  = "FA-Regular-Grammar-Engine"
TAG   = "v1.0.0"

def get_token():
    proc = subprocess.run(
        ["git", "credential", "fill"],
        input="protocol=https\nhost=github.com\n\n",
        capture_output=True, text=True, timeout=10
    )
    for line in proc.stdout.splitlines():
        if line.startswith("password="):
            return line.split("=", 1)[1].strip()

def gh(method, path, data=None, token=None):
    url = "https://api.github.com" + path
    body = json.dumps(data).encode() if data else None
    headers = {
        "Accept": "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        "User-Agent": "fa-bot"
    }
    if token:
        headers["Authorization"] = "Bearer " + token
    req = urllib.request.Request(url, data=body, headers=headers, method=method)
    try:
        r = urllib.request.urlopen(req, timeout=30)
        body = r.read()
        return r.status, json.loads(body) if body else {}
    except urllib.error.HTTPError as e:
        body = e.read()
        return e.code, json.loads(body) if body else {}

def upload_asset(upload_url, fpath, token):
    base  = upload_url.split("{")[0]
    fname = os.path.basename(fpath)
    url   = base + "?name=" + urllib.parse.quote(fname)
    with open(fpath, "rb") as f:
        data = f.read()
    headers = {
        "Accept": "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        "User-Agent": "fa-bot",
        "Authorization": "Bearer " + token,
        "Content-Type": "application/octet-stream",
    }
    req = urllib.request.Request(url, data=data, headers=headers, method="POST")
    try:
        r = urllib.request.urlopen(req, timeout=300)
        return r.status, json.loads(r.read())
    except urllib.error.HTTPError as e:
        return e.code, json.loads(e.read())

def main():
    token = get_token()
    if not token:
        print("[ERROR] No token found.")
        sys.exit(1)

    # Get release
    print("[1/3] Fetching release " + TAG + " ...")
    s, r = gh("GET", "/repos/" + OWNER + "/" + REPO + "/releases/tags/" + TAG, token=token)
    if s != 200:
        print("[ERROR] Could not fetch release: HTTP " + str(s))
        sys.exit(1)

    release_id = r["id"]
    upload_url = r["upload_url"]
    existing   = {a["name"]: a["id"] for a in r.get("assets", [])}
    print("      Release id: " + str(release_id))

    # Delete old unsigned APK if present
    for name, aid in existing.items():
        if "unsigned" in name or name == "fa-grammar-app.apk":
            ds, _ = gh("DELETE", "/repos/" + OWNER + "/" + REPO + "/releases/assets/" + str(aid), token=token)
            print("[2/3] Deleted old unsigned asset: " + name + " (HTTP " + str(ds) + ")")

    # Upload new signed APK
    for fpath in ["fa-grammar-signed.apk", "signing-key-info.txt"]:
        if not os.path.exists(fpath):
            print("      Skipping (not found): " + fpath)
            continue
        fname  = os.path.basename(fpath)
        sz_mb  = os.path.getsize(fpath) / 1024 / 1024
        print("[3/3] Uploading " + fname + " (" + str(round(sz_mb, 1)) + " MB) ...")
        s2, r2 = upload_asset(upload_url, fpath, token)
        if s2 in (200, 201):
            print("      OK -> " + r2.get("browser_download_url", "uploaded"))
        elif s2 == 422:
            print("      Already exists — skipping.")
        else:
            print("      WARN HTTP " + str(s2) + ": " + str(r2))

    print("\nDONE! Release: https://github.com/" + OWNER + "/" + REPO + "/releases/tag/" + TAG)

if __name__ == "__main__":
    main()
