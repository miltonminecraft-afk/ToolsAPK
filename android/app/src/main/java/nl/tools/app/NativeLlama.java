package nl.tools.app;

public final class NativeLlama {
    private static final boolean AVAILABLE;
    static {
        boolean ok;
        try {
            System.loadLibrary("tools_llama");
            ok = true;
        } catch (Throwable ignored) {
            ok = false;
        }
        AVAILABLE = ok;
    }
    private NativeLlama() {}
    public static boolean isAvailable() { return AVAILABLE; }
    public static native String generate(String modelPath, String[] roles, String[] contents, int maxTokens, float temperature);
    public static native void unloadModel();
}
