# ToolsAPK

Tools project voor GitHub Pages en de Android APK.

## Webtools
- Kopermetingen
- TV codes
- Value Fiber Route
- Checklist PoP
- Assistent

De landing is gebaseerd op de aangeleverde ZIP; de toolbestanden worden zonder inhoudelijke wijzigingen op hun definitieve paden geplaatst.

## Assistent
Dezelfde HTML/JS-chat gebruikt een runtime-adapter:
- **Browser/GitHub Pages:** llama.cpp via **wllama 3.5.1** (WASM, WebGPU waar beschikbaar). Modelcache blijft lokaal in de browser.
- **Android APK:** native **llama.cpp** via Java/JNI. Het GGUF-model wordt eenmalig naar app-private opslag gedownload.

Standaardmodel: `ggml-org/Qwen3-1.7B-GGUF`, `Qwen3-1.7B-Q4_K_M.gguf`.
