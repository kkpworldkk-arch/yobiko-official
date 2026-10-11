# App Store 掲載情報（下書き）

App Store Connect の各欄にそのまま貼り付けられる形にしています。［ ］は記入・確認が必要な箇所です。

---

## アプリ情報

| 項目 | 内容 |
|---|---|
| 名前（30文字以内） | 滝原塾 |
| サブタイトル（30文字以内） | 医学部受験のAI口頭試問・学習記録 |
| カテゴリ（プライマリ） | 教育 |
| カテゴリ（セカンダリ） | 仕事効率化 |
| 価格 | 無料 |
| プライバシーポリシーURL | https://takihara-app.onrender.com/privacy |
| サポートURL | https://takihara-app.onrender.com/support |
| マーケティングURL | （空欄でよい） |
| 著作権 | 2026 木暮啓人 |

## プロモーション用テキスト（170文字以内）

医学部進学予備校・滝原塾の塾生専用アプリ。参考書の問題をAIが音声で出題し、声・手書き・キーボードで答えると、その場でAIが採点。反応速度まで記録して「無意識に答えられる」レベルまで定着させます。

## 説明（4000文字以内）

医学部進学予備校「滝原塾」の塾生・保護者・講師のための学習アプリです。
アカウントは塾から発行されます（アプリ内での新規登録はできません）。

■ AI口頭試問
指定した参考書の問題を、アプリが音声で読み上げて出題します。
声・手書き・キーボードのいずれかで答えると、AIがその場で採点し、良かった点と改善点を具体的にフィードバックします。
・問題番号・ページ・章を「何番から何番まで」と範囲で指定して出題
・答えるまでの反応時間を記録し、「瞬答」できるまで繰り返し出題
・習熟度に合わせて、忘れかけたタイミングで復習問題を出題
・音声入力はiPhoneの音声認識で文字に変換

■ AIチューター
わからない問題をAIに質問でき、解き方の手順や復習のポイントを確認できます。

■ 復習リマインド
毎日決まった時刻に、口頭試問の復習を通知でお知らせします。

■ 講師との連携
回答の履歴は担当講師も確認でき、講師からのコメントを受け取れます。
問題の誤りや要望は、アプリから講師に直接送れます。

■ プライバシーへの配慮
AI採点のために回答内容を外部のAI（Anthropic社のClaude）に送信する際は、事前に内容をご説明し、同意をいただいてから利用します。
同意の取り消し、アカウントの削除はアプリの設定画面からいつでも行えます。

## キーワード（100文字以内、カンマ区切り）

医学部,受験,予備校,塾,口頭試問,一問一答,参考書,AI,採点,暗記,復習,音声,数学,化学,物理,生物,英語

## このバージョンの最新情報

初回リリース

---

## App Review に関する情報（審査メモ）

**サインイン情報**

| | |
|---|---|
| ユーザ名 | ［審査用の生徒アカウントのメール］ |
| パスワード | ［そのパスワード］ |

> パスワードはこのリポジトリに書かないこと（App Store Connect の入力欄にだけ入れる）。
> 講師アカウントは実在の生徒の情報が見えるため、審査には渡さない。

**メモ（英語で記入）**

```
This app is for students, parents and teachers of Takihara Juku, a private
preparatory school in Japan for medical school entrance exams. Accounts are
issued by the school; there is no in-app sign-up.

Demo account: the student account entered in the sign-in fields above.
(The teacher view contains real students' personal data, so it is not
provided for review; all reviewable features are on the student side.)

How to review the main features (student account):
1. Log in with the student account.
2. Open "AI口頭試問" (AI Oral Exam). A consent screen explains that answers are
   sent to Anthropic's Claude API for grading. Tap "同意してAI機能を使う".
3. Choose a book and tap "口頭試問を始める". The question is read aloud.
4. Answer by keyboard, voice ("音声入力" tab uses iOS Speech Recognition), or
   handwriting, then tap "回答する" to get AI feedback.
5. Settings ("設定") includes daily review reminders (local notifications),
   withdrawing AI consent, and account deletion ("アカウントの削除").

Native features: iOS speech recognition for voice answers, scheduled local
notifications for study reminders, and Face ID sign-in via passkeys.

Note: account deletion permanently deletes the demo student account. If it is
deleted during review, please contact us at the support URL and we will
re-issue it immediately.
```

---

## App のプライバシー（データ収集の申告）

「データを収集していますか？」→ **はい**

| データの種類 | 収集する | 利用目的 | ユーザに関連付け | トラッキング |
|---|---|---|---|---|
| 連絡先情報 › 名前 | はい | アプリの機能 | はい | いいえ |
| 連絡先情報 › メールアドレス | はい | アプリの機能 | はい | いいえ |
| ユーザコンテンツ › 写真またはビデオ（手書き回答の画像） | はい | アプリの機能 | はい | いいえ |
| ユーザコンテンツ › カスタマーサポート（講師への要望） | はい | アプリの機能 | はい | いいえ |
| ユーザコンテンツ › その他のユーザコンテンツ（回答・質問の文章） | はい | アプリの機能 | はい | いいえ |
| ID › ユーザID | はい | アプリの機能 | はい | いいえ |

- 音声データ: **収集しない**（端末の音声認識で文字にしたものだけを送るため）
- 位置情報・連絡先・閲覧履歴・購入履歴・診断データ・広告データ: **収集しない**
- トラッキング: **しない**

## 年齢制限指定

質問票には次のように回答してください（該当なし＝「なし」）。

- 暴力・性的表現・ギャンブル・医療情報（治療の助言）など: なし
- ユーザ生成コンテンツ・ユーザ間のメッセージ: なし（講師とのやりとりは塾内のみ）
- 制限のないWebアクセス: なし（自社サイトのみ表示）
- AIによるチャット・生成機能: あり（学習用途のAIチューター）

## スクリーンショット

必須: **iPhone 6.9インチ（1320×2868）を3〜10枚**。iPad にも対応しているので **iPad 13インチ（2064×2752）も3枚以上**必要です。
Mac の Xcode で「iPhone 17 Pro Max」「iPad Pro 13インチ」のシミュレータを起動し、ゲスト生徒でログインして ⌘S で撮れます。

おすすめの5枚:
1. AI口頭試問のトップ（参考書と範囲指定）
2. 出題中の画面（問題文と音声入力タブ）
3. AI採点の結果（良かった点・改善点）
4. AIチューターの画面
5. 設定画面（復習リマインド）
