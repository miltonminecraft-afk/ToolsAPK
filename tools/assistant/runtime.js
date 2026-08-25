import { AndroidNativeRuntime } from './runtimes/android-native.js';
import { WebWllamaRuntime } from './runtimes/web-wllama.js';

export function createRuntime(){
  if (window.ToolsNativeLlama && typeof window.ToolsNativeLlama.getRuntimeInfo === 'function') {
    return new AndroidNativeRuntime(window.ToolsNativeLlama);
  }
  return new WebWllamaRuntime();
}
