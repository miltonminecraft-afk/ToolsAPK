# Android native AI

De webinterface gebruikt in de APK automatisch `window.ToolsNativeLlama`. `MainActivity` registreert daarvoor `LlamaBridge`. De lokale inference loopt via JNI naar llama.cpp.

## llama.cpp

Plaats llama.cpp in `android/llama.cpp`. Deze integratie is gecontroleerd tegen upstream commit `790b5713ca94e30f6c604daf79716f26111d20e8` van 25-08-2026.

Voorbeeld:

```bash
cd android
git clone https://github.com/ggml-org/llama.cpp.git
cd llama.cpp
git checkout 790b5713ca94e30f6c604daf79716f26111d20e8
```

Koppel daarna `app/src/main/cpp/CMakeLists.txt` aan `externalNativeBuild` in de bestaande Android/Capacitor Gradle-configuratie. Het standaardmodel wordt eenmalig naar de app-private map `files/ai/models/` gedownload en staat dus niet in de APK. Cache legen verwijdert het model niet; `AI-model verwijderen` wel.
