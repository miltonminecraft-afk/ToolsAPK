# Assistent op Android

De Assistent staat in `www/tools/assistant/`.

- Zonder native llama.cpp-bibliotheek gebruikt de APK automatisch dezelfde lokale wllama/WASM-runtime als de browser.
- Als `android/llama.cpp/` aanwezig is, schakelt `app/build.gradle` automatisch de native arm64-v8a CMake-build in. Daarna registreert `MainActivity` `ToolsNativeLlama` en gebruikt de Assistent native llama.cpp.
- Het GGUF-model wordt niet in de APK opgenomen; de gebruiker installeert het eenmalig via de Assistent.
- `Cache legen` wist de chat/cache maar behoudt het model. `AI-model verwijderen` verwijdert het model.

De JNI-bestanden staan onder `android/app/src/main/cpp/`.
