# ToolsAPK

Tools project voor GitHub Pages en de Android APK.

## Webtools
- Kopermetingen
- TV codes
- Value Fiber Route
- Checklist PoP
- Assistent

De landing is gebaseerd op de aangeleverde ZIP; de toolbestanden komen uit de actuele, afzonderlijk aangeleverde/testversies.

## Assistent
Dezelfde HTML/JS-chat gebruikt een runtime-adapter:
- **Browser/GitHub Pages:** llama.cpp via **wllama 3.5.1** (WASM, WebGPU waar beschikbaar). Modelcache blijft lokaal in de browser.
- **Android APK:** native **llama.cpp** via Java/JNI. Het GGUF-model wordt eenmalig naar app-private opslag gedownload.

Standaardmodel: `ggml-org/Qwen3-1.7B-GGUF`, `Qwen3-1.7B-Q4_K_M.gguf` (ongeveer 1,28 GB).

GitHub Pages kan door browser-CORS externe KPN-pagina's niet betrouwbaar zelf uitlezen. Daarom opent de webversie gerichte actuele zoekopdrachten; Android kan later een native web-fetch/searchprovider krijgen zonder de chatruntime te wijzigen.
