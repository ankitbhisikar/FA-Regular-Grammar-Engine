"""
build_apk.py  –  Auto-generate SIGNED Android APK via PWABuilder REST API
Run: python build_apk.py
Output: fa-grammar-signed.apk (installable on any Android device)
"""

import urllib.request
import urllib.parse
import urllib.error
import json
import sys
import os
import zipfile

PWA_URL      = "https://ankitbhisikar.github.io/FA-Regular-Grammar-Engine/"
PKG_NAME     = "com.ankitbhisikar.fagrammarengine"
APP_NAME     = "FA Grammar Engine"
VERSION      = "1.0.0"
VERSION_CODE = 1
OUT_ZIP      = "fa-grammar-signed.zip"
OUT_APK      = "fa-grammar-signed.apk"

PWABUILDER_API = "https://pwabuilder-cloudapk.azurewebsites.net/generateApkZip"

# Signing info – PWABuilder generates a keystore for us (signingMode = "new")
SIGNING = {
    "signingMode":    "new",
    "alias":          "fa-grammar-key",
    "fullName":       "Ankit Bhisikar",
    "organization":   "SBJIT",
    "organizationalUnit": "CS",
    "countryCode":    "IN",
    "keyPassword":    "FAGrammar2024!",
    "storePassword":  "FAGrammar2024!"
}

def post_json(url, data):
    body = json.dumps(data).encode("utf-8")
    req = urllib.request.Request(
        url,
        data=body,
        headers={"Content-Type": "application/json", "Accept": "application/octet-stream"},
        method="POST",
    )
    return urllib.request.urlopen(req, timeout=300)

def main():
    print(f"[1/4] Building SIGNED APK via PWABuilder ...")
    print(f"      URL  : {PWA_URL}")
    print(f"      PKG  : {PKG_NAME}")

    payload = {
        "packageId":                    PKG_NAME,
        "name":                         APP_NAME,
        "launcherName":                 "FA Grammar",
        "appVersion":                   VERSION,
        "appVersionCode":               VERSION_CODE,
        "display":                      "standalone",
        "orientation":                  "portrait",
        "themeColor":                   "#0B1220",
        "navigationColor":              "#0B1220",
        "backgroundColor":              "#0B1220",
        "startUrl":                     PWA_URL,
        "host":                         "ankitbhisikar.github.io",
        "iconUrl":                      PWA_URL + "icon-512.png",
        "maskableIconUrl":              PWA_URL + "icon-512.png",
        "monochromeIconUrl":            PWA_URL + "icon-192.png",
        "webManifestUrl":               PWA_URL + "manifest.json",
        "fallbackType":                 "customtabs",
        "splashScreenFadeOutDuration":  300,
        "enableNotifications":          False,
        "features": {
            "locationDelegation": {"enabled": False},
            "playBilling":        {"enabled": False}
        },
        "shortcuts":      [],
        "minSdkVersion":  21,
        "isChromeOSOnly": False,
        # Signing — nested object required by PWABuilder API
        "signing": {
            "alias":              SIGNING["alias"],
            "fullName":           SIGNING["fullName"],
            "organization":       SIGNING["organization"],
            "organizationalUnit": SIGNING["organizationalUnit"],
            "countryCode":        SIGNING["countryCode"],
            "keyPassword":        SIGNING["keyPassword"],
            "storePassword":      SIGNING["storePassword"],
        },
        "signingMode": SIGNING["signingMode"]
    }

    try:
        print("[2/4] Sending to PWABuilder cloud (30-90 sec)...")
        resp = post_json(PWABUILDER_API, payload)
        raw  = resp.read()
    except urllib.error.HTTPError as e:
        body = e.read().decode("utf-8", errors="replace")
        print(f"[ERROR] HTTP {e.code}: {body}")
        sys.exit(1)
    except Exception as ex:
        print(f"[ERROR] {ex}")
        sys.exit(1)

    # Save zip
    with open(OUT_ZIP, "wb") as f:
        f.write(raw)
    print(f"[3/4] ZIP received ({len(raw)//1024} KB) — extracting APK ...")

    # Extract signed APK from zip
    with zipfile.ZipFile(OUT_ZIP) as z:
        print(f"      Contents: {z.namelist()}")
        apk_names = [n for n in z.namelist() if n.endswith(".apk")]
        if not apk_names:
            print("[ERROR] No APK found inside the ZIP!")
            sys.exit(1)
        apk_name = apk_names[0]
        z.extract(apk_name, ".")
        if os.path.exists(OUT_APK):
            os.remove(OUT_APK)
        os.rename(apk_name, OUT_APK)

    size_mb = os.path.getsize(OUT_APK) / 1024 / 1024
    print(f"[4/4] SUCCESS!  Signed APK: '{OUT_APK}' ({size_mb:.1f} MB)")
    print(f"\n  Install on Android:")
    print(f"    Settings -> Security -> Install unknown apps -> Allow")
    print(f"    Then tap '{OUT_APK}' to install.")

if __name__ == "__main__":
    main()
