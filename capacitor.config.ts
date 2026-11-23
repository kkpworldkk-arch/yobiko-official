import type { CapacitorConfig } from "@capacitor/cli";

// iOSアプリはRender上の本番サイトをそのまま表示する。画面やロジックはウェブ側を更新すれば
// アプリにも反映されるので、App Storeの再審査が必要なのはネイティブ部分を変えたときだけ。
// mobile/www は通信できないときに表示するオフライン画面だけを持つ。
const config: CapacitorConfig = {
  appId: "jp.takiharajuku.app",
  appName: "滝原塾",
  webDir: "mobile/www",
  backgroundColor: "#ffffff",
  server: {
    url: "https://takihara-app.onrender.com",
    errorPath: "offline.html",
  },
  ios: {
    contentInset: "automatic",
    backgroundColor: "#ffffff",
  },
  plugins: {
    LocalNotifications: {
      iconColor: "#2060a0",
    },
  },
};

export default config;
