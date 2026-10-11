import { Capacitor, registerPlugin, type PluginListenerHandle } from "@capacitor/core";

// iOSアプリ同梱の音声認識プラグイン（ios/App/App/NativeSpeechPlugin.swift）。
// アプリ内のWKWebViewではWeb Speech APIの音声認識が使えないため、アプリで開いているときだけこちらを使う。
interface NativeSpeechPlugin {
  isAvailable(): Promise<{ available: boolean }>;
  requestAccess(): Promise<{ granted: boolean }>;
  start(): Promise<void>;
  stop(): Promise<void>;
  addListener(
    eventName: "partialResult",
    listener: (event: { text: string; isFinal: boolean }) => void,
  ): Promise<PluginListenerHandle>;
  addListener(eventName: "end", listener: () => void): Promise<PluginListenerHandle>;
}

const NativeSpeech = registerPlugin<NativeSpeechPlugin>("NativeSpeech");

export function isNativeApp(): boolean {
  return Capacitor.isNativePlatform();
}

export interface NativeSpeechHandlers {
  onPartial: (text: string) => void;
  onFinal: (text: string) => void;
  onEnd: () => void;
}

// 録音を開始し、止めるための関数を返す。権限がない・使えない場合は null。
// SFSpeechRecognizer は毎回「ここまでの全文」を返すので、確定（isFinal）時にその全文を onFinal に渡す。
// 確定前にエラーで終わった場合も、最後に聞き取れた分は onFinal で確定させる。
export async function startNativeSpeech(handlers: NativeSpeechHandlers): Promise<(() => void) | null> {
  const { granted } = await NativeSpeech.requestAccess();
  if (!granted) return null;
  const { available } = await NativeSpeech.isAvailable();
  if (!available) return null;

  let latest = "";
  let committed = false;
  const commit = () => {
    if (committed) return;
    committed = true;
    if (latest) handlers.onFinal(latest);
  };

  const partialHandle = await NativeSpeech.addListener("partialResult", (event) => {
    latest = event.text;
    if (event.isFinal) {
      commit();
    } else {
      handlers.onPartial(event.text);
    }
  });
  const endHandle = await NativeSpeech.addListener("end", () => {
    commit();
    void partialHandle.remove();
    void endHandle.remove();
    handlers.onEnd();
  });

  try {
    await NativeSpeech.start();
  } catch {
    void partialHandle.remove();
    void endHandle.remove();
    return null;
  }

  return () => {
    void NativeSpeech.stop();
  };
}
