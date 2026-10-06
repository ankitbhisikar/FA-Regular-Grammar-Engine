"""
enable_pages.py  –  Enable GitHub Pages via GitHub REST API
Uses Windows Credential Manager (same token git uses) to auth.
"""
import subprocess
import json
import urllib.request
import urllib.error
import sys

OWNER = "ankitbhisikar"
REPO  = "FA-Regular-Grammar-Engine"

def get_token():
    """Pull the stored GitHub PAT from Windows Credential Manager via git."""
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

def api(method, path, data=None, token=None):
    url = f"https://api.github.com{path}"
    body = json.dumps(data).encode() if data else None
    headers = {
        "Accept": "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        "User-Agent": "fa-grammar-bot"
    }
    if token:
        headers["Authorization"] = f"Bearer {token}"
    req = urllib.request.Request(url, data=body, headers=headers, method=method)
    try:
        resp = urllib.request.urlopen(req, timeout=20)
        return resp.status, json.loads(resp.read())
    except urllib.error.HTTPError as e:
        return e.code, json.loads(e.read())

def main():
    token = get_token()
    if not token:
        print("[WARN] Could not retrieve token from credential manager.")
        print("       Pages will need to be enabled manually on GitHub.")
        sys.exit(1)

    print(f"[1/2] Enabling GitHub Pages for {OWNER}/{REPO} ...")
    status, resp = api("POST", f"/repos/{OWNER}/{REPO}/pages",
        data={"source": {"branch": "main", "path": "/"}},
        token=token
    )
    if status in (201, 200):
        url = resp.get("html_url", f"https://{OWNER}.github.io/{REPO}/")
        print(f"[2/2] GitHub Pages ENABLED!")
        print(f"      Live URL: {url}")
    elif status == 409:
        print("[2/2] GitHub Pages already enabled (409 Conflict — that's fine).")
        print(f"      Live URL: https://{OWNER}.github.io/{REPO}/")
    else:
        print(f"[ERROR] HTTP {status}: {resp}")
        sys.exit(1)

if __name__ == "__main__":
    main()
