import UIKit
import Capacitor

// アプリ本体に同梱するプラグイン（npmパッケージではないもの）をここで登録する。
class MainViewController: CAPBridgeViewController {
    override open func capacitorDidLoad() {
        bridge?.registerPluginInstance(NativeSpeechPlugin())
    }
}
