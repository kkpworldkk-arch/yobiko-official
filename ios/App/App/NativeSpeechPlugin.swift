import Foundation
import AVFoundation
import Capacitor
import Speech

// 口頭試問の音声入力用。アプリ内の WKWebView ではブラウザの音声認識（Web Speech API）が使えないため、
// iOS の SFSpeechRecognizer で日本語を文字にしてウェブ側へ渡す。音声そのものは保存・送信しない。
// ウェブ側からは registerPlugin("NativeSpeech") で呼び出す（src/lib/native-speech.ts）。
@objc(NativeSpeechPlugin)
public class NativeSpeechPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "NativeSpeechPlugin"
    public let jsName = "NativeSpeech"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "isAvailable", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "requestAccess", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "start", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "stop", returnType: CAPPluginReturnPromise),
    ]

    private let recognizer = SFSpeechRecognizer(locale: Locale(identifier: "ja-JP"))
    private let audioEngine = AVAudioEngine()
    private var request: SFSpeechAudioBufferRecognitionRequest?
    private var task: SFSpeechRecognitionTask?

    @objc func isAvailable(_ call: CAPPluginCall) {
        call.resolve(["available": recognizer?.isAvailable ?? false])
    }

    @objc func requestAccess(_ call: CAPPluginCall) {
        SFSpeechRecognizer.requestAuthorization { status in
            guard status == .authorized else {
                call.resolve(["granted": false])
                return
            }
            AVAudioSession.sharedInstance().requestRecordPermission { granted in
                call.resolve(["granted": granted])
            }
        }
    }

    @objc func start(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            self.finishRecognition()
            guard let recognizer = self.recognizer, recognizer.isAvailable else {
                call.reject("音声認識を利用できません")
                return
            }
            do {
                let session = AVAudioSession.sharedInstance()
                try session.setCategory(.playAndRecord, mode: .measurement, options: [.duckOthers, .defaultToSpeaker])
                try session.setActive(true, options: .notifyOthersOnDeactivation)

                let request = SFSpeechAudioBufferRecognitionRequest()
                request.shouldReportPartialResults = true
                self.request = request

                let input = self.audioEngine.inputNode
                input.removeTap(onBus: 0)
                input.installTap(onBus: 0, bufferSize: 1024, format: input.outputFormat(forBus: 0)) { buffer, _ in
                    request.append(buffer)
                }
                self.audioEngine.prepare()
                try self.audioEngine.start()

                self.task = recognizer.recognitionTask(with: request) { [weak self] result, error in
                    guard let self = self else { return }
                    if let result = result {
                        self.notifyListeners("partialResult", data: [
                            "text": result.bestTranscription.formattedString,
                            "isFinal": result.isFinal,
                        ])
                    }
                    if error != nil || (result?.isFinal ?? false) {
                        DispatchQueue.main.async {
                            guard self.task != nil else { return }
                            self.finishRecognition()
                            self.notifyListeners("end", data: [:])
                        }
                    }
                }
                call.resolve()
            } catch {
                self.finishRecognition()
                call.reject("録音を開始できませんでした: \(error.localizedDescription)")
            }
        }
    }

    // 録音だけ止めて、確定した認識結果（isFinal）が届くのを待つ。届いたら finishRecognition される。
    @objc func stop(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            self.stopAudio()
            self.request?.endAudio()
            call.resolve()
        }
    }

    private func stopAudio() {
        if audioEngine.isRunning {
            audioEngine.stop()
        }
        audioEngine.inputNode.removeTap(onBus: 0)
    }

    private func finishRecognition() {
        stopAudio()
        let currentTask = task
        task = nil
        request = nil
        currentTask?.cancel()
        try? AVAudioSession.sharedInstance().setActive(false, options: .notifyOthersOnDeactivation)
    }
}
