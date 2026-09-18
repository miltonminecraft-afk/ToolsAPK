#!/usr/bin/env bash
set -euo pipefail

mkdir -p tools/kopermetingen tools/tv-codes tools/value-fiber-route tools/pop-checklist

cat .source/koper/part-*.bin > /tmp/kopermetingen.gz
gzip -t /tmp/kopermetingen.gz
gzip -dc /tmp/kopermetingen.gz > tools/kopermetingen/index.html
echo 'c0b827a3cf39287a072165606e7e7ad58b9b42ff9f0c49bc83ecb4a20ec16b64  tools/kopermetingen/index.html' | sha256sum -c -

cat .source/tv/part-*.bin > /tmp/tv-codes.gz
gzip -t /tmp/tv-codes.gz
gzip -dc /tmp/tv-codes.gz > tools/tv-codes/index.html
echo '181e9367aa4e71775bf601f5de6b40fb10d1ede2fcde8a0104eecbcaf2f34612  tools/tv-codes/index.html' | sha256sum -c -

cat .source/fiber/part-*.bin > /tmp/value-fiber-route.gz
gzip -t /tmp/value-fiber-route.gz
gzip -dc /tmp/value-fiber-route.gz > tools/value-fiber-route/index.html
echo 'bd3fd764eb532e883c8d26e54549260526f5aafbebb36c042fd40cda1839dcf5  tools/value-fiber-route/index.html' | sha256sum -c -

node <<'NODE'
const fs=require('fs'),z=require('zlib');
const text=fs.readFileSync('.source/HioScanActivity.java.gz.b64','utf8').replace(/\s+/g,'');
fs.writeFileSync('/tmp/HioScanActivity.java',z.gunzipSync(Buffer.from(text,'base64')));
NODE
echo 'dadfcee144e081ce712772151503e3bf1b60e2516a46d1fed1be0196cce5d005  /tmp/HioScanActivity.java' | sha256sum -c -

POP_REF='d06eeeb2668c057fc7a9c4a3b132147178e20d28'
curl -fsSL --retry 3 "https://raw.githubusercontent.com/miltonminecraft-afk/pop-checklist/$POP_REF/index.html" -o tools/pop-checklist/index.html
curl -fsSL --retry 3 "https://raw.githubusercontent.com/miltonminecraft-afk/pop-checklist/$POP_REF/template.xlsx" -o tools/pop-checklist/template.xlsx
echo '27fdee56db4fe739087adf1a13d6537437661e62dbba200e686492afb8210641  tools/pop-checklist/index.html' | sha256sum -c -
echo '1b456732ea5a95e1dd17bb0695cf8a720022582d34cb70aaa7575629092635eb  tools/pop-checklist/template.xlsx' | sha256sum -c -

for f in tools/kopermetingen/index.html tools/tv-codes/index.html tools/value-fiber-route/index.html tools/pop-checklist/index.html; do
  grep -q '../../shared/assistant-mini.js' "$f" || sed -i 's#</body>#<script src="../../shared/assistant-mini.js"></script></body>#' "$f"
done

# Save custom Android integration before regenerating the Capacitor shell.
mkdir -p /tmp/custom-android
cp android/app/src/main/java/nl/tools/app/MainActivity.java /tmp/custom-android/
cp android/app/src/main/java/nl/tools/app/LlamaBridge.java /tmp/custom-android/
cp android/app/src/main/java/nl/tools/app/NativeLlama.java /tmp/custom-android/
cp android/app/src/main/cpp/CMakeLists.txt /tmp/custom-android/
cp android/app/src/main/cpp/llama_jni.cpp /tmp/custom-android/

cat > package.json <<'JSON'
{
  "name":"toolsapk",
  "version":"1.0.0",
  "private":true,
  "scripts":{"sync":"npx cap sync android","android":"npx cap open android"},
  "dependencies":{
    "@capacitor/android":"^8.4.0",
    "@capacitor/cli":"^8.4.0",
    "@capacitor/core":"^8.4.0",
    "@capacitor/filesystem":"^8.1.2",
    "@capacitor/share":"^8.0.1"
  }
}
JSON
cat > capacitor.config.json <<'JSON'
{"appId":"nl.tools.app","appName":"Tools","webDir":"www"}
JSON

rm -rf www
mkdir -p www
cp index.html www/index.html
cp -R tools www/tools
cp -R shared www/shared

npm install --no-audit --no-fund

# Bundle the browser llama.cpp/WASM runtime in the repo instead of loading it from a CDN.
TMP_WLLAMA="$(mktemp -d)"
PKG="$(cd "$TMP_WLLAMA" && npm pack @wllama/wllama@3.5.1 --silent)"
tar -xzf "$TMP_WLLAMA/$PKG" -C "$TMP_WLLAMA"
mkdir -p tools/assistant/vendor/wllama
cp -R "$TMP_WLLAMA/package/esm/." tools/assistant/vendor/wllama/
rm -rf www/tools/assistant/vendor
mkdir -p www/tools/assistant/vendor
cp -R tools/assistant/vendor/wllama www/tools/assistant/vendor/
test -f tools/assistant/vendor/wllama/index.js
test -f tools/assistant/vendor/wllama/wasm/wllama.wasm

rm -rf android
npx cap add android
npx cap sync android

mkdir -p android/app/src/main/java/nl/tools/app android/app/src/main/cpp
cp /tmp/HioScanActivity.java android/app/src/main/java/nl/tools/app/HioScanActivity.java
cp /tmp/custom-android/MainActivity.java android/app/src/main/java/nl/tools/app/
cp /tmp/custom-android/LlamaBridge.java android/app/src/main/java/nl/tools/app/
cp /tmp/custom-android/NativeLlama.java android/app/src/main/java/nl/tools/app/
cp /tmp/custom-android/CMakeLists.txt android/app/src/main/cpp/
cp /tmp/custom-android/llama_jni.cpp android/app/src/main/cpp/

LLAMA_REF='790b5713ca94e30f6c604daf79716f26111d20e8'
git clone -q https://github.com/ggml-org/llama.cpp.git /tmp/llama.cpp
git -C /tmp/llama.cpp checkout -q "$LLAMA_REF"
rm -rf /tmp/llama.cpp/.git
mv /tmp/llama.cpp android/llama.cpp

python3 <<'PY'
from pathlib import Path
p=Path('android/app/build.gradle')
s=p.read_text()
s=s.replace('testInstrumentationRunner "androidx.test.runner.AndroidJUnitRunner"',
'''testInstrumentationRunner "androidx.test.runner.AndroidJUnitRunner"
        ndk { abiFilters "arm64-v8a" }
        externalNativeBuild { cmake { cppFlags "-std=c++17" } }''',1)
s=s.replace('    buildTypes {',
'''    externalNativeBuild {
        cmake {
            path file("src/main/cpp/CMakeLists.txt")
            version "3.22.1"
        }
    }
    buildTypes {''',1)
needle="    implementation project(':capacitor-cordova-android-plugins')"
addition=needle+"""
    def camerax_version = '1.4.2'
    implementation "androidx.camera:camera-camera2:$camerax_version"
    implementation "androidx.camera:camera-lifecycle:$camerax_version"
    implementation "androidx.camera:camera-view:$camerax_version"
    implementation 'com.google.mlkit:text-recognition:16.0.1'"""
s=s.replace(needle,addition,1)
p.write_text(s)

m=Path('android/app/src/main/AndroidManifest.xml')
x=m.read_text()
if 'android.permission.INTERNET' not in x:
    pos=x.find('>')
    x=x[:pos+1]+'\n    <uses-permission android:name="android.permission.INTERNET" />'+x[pos+1:]
m.write_text(x)
PY

npx cap sync android

cat > .gitignore <<'EOF'
node_modules/
.gradle/
**/build/
.idea/
.DS_Store
android/local.properties
*.iml
EOF

cat > README.md <<'EOF'
# ToolsAPK

Broncode voor de Tools-app en GitHub Pages.

- Webbron: index.html, tools/, shared/
- Capacitor/Android: android/
- Assistent: lokaal model; browser via gebundelde wllama/WASM en Android via native llama.cpp
- Het GGUF-model wordt eenmalig geïnstalleerd en kan daarna offline gebruikt worden
EOF

mkdir -p .github/workflows
cat > .github/workflows/pages.yml <<'YAML'
name: Deploy GitHub Pages
on:
  push:
    branches: [main]
  workflow_dispatch:
permissions:
  contents: read
  pages: write
  id-token: write
concurrency:
  group: pages
  cancel-in-progress: true
jobs:
  deploy:
    environment:
      name: github-pages
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/configure-pages@v5
      - uses: actions/upload-pages-artifact@v3
        with:
          path: .
      - name: Deploy
        id: deployment
        uses: actions/deploy-pages@v4
YAML

touch .nojekyll

test -f tools/kopermetingen/index.html
test -f tools/tv-codes/index.html
test -f tools/value-fiber-route/index.html
test -f tools/pop-checklist/index.html
test -f tools/pop-checklist/template.xlsx
test -f tools/assistant/index.html
test -f tools/assistant/vendor/wllama/wasm/wllama.wasm
test -f android/app/src/main/java/nl/tools/app/HioScanActivity.java
test -f android/app/src/main/java/nl/tools/app/LlamaBridge.java
test -f android/llama.cpp/CMakeLists.txt

rm -rf .source node_modules
rm -f .github/workflows/bootstrap.yml
rm -f .github/scripts/bootstrap.sh

git config user.name 'github-actions[bot]'
git config user.email '41898282+github-actions[bot]@users.noreply.github.com'
git add -A
git commit -m 'Restore complete ToolsAPK source'
git push origin HEAD:main
