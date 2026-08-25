package nl.tools.app;

public final class NativeLlama {
    static { System.loadLibrary("tools_llama"); }
    private NativeLlama() {}
    public static native String generate(String modelPath, String[] roles, String[] contents, int maxTokens, float temperature);
    public static native void unloadModel();
}
