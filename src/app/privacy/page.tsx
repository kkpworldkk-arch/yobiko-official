export const metadata = {
  title: "プライバシーポリシー | 滝原塾",
};

export default function PrivacyPolicyPage() {
  return (
    <main className="min-h-screen bg-navy-950 px-6 py-16">
      <div className="mx-auto max-w-2xl rounded-xl border border-border bg-card p-8 shadow-panel">
        <h1 className="text-h1 text-ivory-100">プライバシーポリシー</h1>
        <p className="mt-2 text-caption text-slate-500">最終改定日: ［記入してください。例: 2026年10月8日］</p>

        <div className="mt-8 flex flex-col gap-7 text-body-sm leading-relaxed text-slate-300">
          <section>
            <p>
              ［運営者名を記入］（以下「当塾」といいます）は、当塾が提供する学習支援サービス「滝原塾アプリ」
              （以下「本サービス」といいます）における、利用者の個人情報の取り扱いについて、以下のとおり
              プライバシーポリシー（以下「本ポリシー」といいます）を定めます。
            </p>
          </section>

          <section>
            <h2 className="text-h3 text-ivory-100">1. 事業者情報</h2>
            <ul className="mt-2 flex flex-col gap-1">
              <li>名称: ［記入してください］</li>
              <li>所在地: ［記入してください］</li>
              <li>代表者: ［記入してください］</li>
              <li>お問い合わせ先: ［メールアドレスを記入してください］</li>
            </ul>
          </section>

          <section>
            <h2 className="text-h3 text-ivory-100">2. 収集する情報</h2>
            <p className="mt-2">本サービスでは、サービス提供のために以下の情報を取得します。</p>
            <ul className="mt-2 flex list-disc flex-col gap-1 pl-5">
              <li>アカウント情報（氏名、メールアドレス、パスワード（暗号化して保存）、役割（講師・保護者/生徒））</li>
              <li>生徒情報（氏名、学年、志望大学など、講師が登録する学籍情報）</li>
              <li>
                学習記録（口頭試問の回答内容、正誤、AIによる評価コメント、習熟度、回答にかかった時間、
                手書き回答の画像、音声入力の書き起こしテキストなど）
              </li>
              <li>講師が入力する、生徒の学力分析・面談記録などの指導関連情報</li>
              <li>ログイン状態を維持するためのセッションCookie</li>
            </ul>
          </section>

          <section>
            <h2 className="text-h3 text-ivory-100">3. 利用目的</h2>
            <ul className="mt-2 flex list-disc flex-col gap-1 pl-5">
              <li>本サービス（口頭試問ドリル、学習記録の管理、AIによる採点・フィードバック、講師による進捗確認）の提供</li>
              <li>生徒本人および保護者への学習状況の共有</li>
              <li>講師による指導方針の検討・教材の改善</li>
              <li>本サービスの不具合対応・品質改善</li>
            </ul>
          </section>

          <section>
            <h2 className="text-h3 text-ivory-100">4. 第三者への提供・外部送信</h2>
            <p className="mt-2">
              本サービスは、生徒の回答に対するAIによる採点・フィードバック・学習アドバイスの生成のために、
              Anthropic社が提供するAI API（Claude）に回答内容の一部（質問文・生徒の回答・模範解答）を送信します。
              送信される情報は採点処理の目的にのみ利用され、当塾が別途許可した場合を除き、広告目的や
              本サービスと無関係な目的での利用はありません。
            </p>
            <p className="mt-2">
              上記のほか、法令に基づく場合を除き、本人の同意なく個人情報を第三者に提供することはありません。
            </p>
          </section>

          <section>
            <h2 className="text-h3 text-ivory-100">5. データの保管</h2>
            <p className="mt-2">
              取得した情報は、当塾が管理するサーバー上に保存され、本サービスの運営に必要な範囲でのみ
              アクセスできるよう管理しています。
            </p>
          </section>

          <section>
            <h2 className="text-h3 text-ivory-100">6. 未成年者の利用について</h2>
            <p className="mt-2">
              本サービスを生徒本人が利用する場合、保護者または講師がアカウントを発行するものとし、
              保護者の同意のもとで利用されることを前提としています。
            </p>
          </section>

          <section>
            <h2 className="text-h3 text-ivory-100">7. 開示・訂正・削除のご請求</h2>
            <p className="mt-2">
              ご本人（未成年の場合は保護者）は、当塾に対して、保有する個人情報の開示・訂正・利用停止・
              削除を請求することができます。ご希望の場合は、上記のお問い合わせ先までご連絡ください。
            </p>
          </section>

          <section>
            <h2 className="text-h3 text-ivory-100">8. 本ポリシーの変更</h2>
            <p className="mt-2">
              本ポリシーの内容は、法令の変更やサービス内容の変更に応じて、予告なく改定することがあります。
              改定後のポリシーは、本ページに掲載した時点から効力を生じるものとします。
            </p>
          </section>
        </div>
      </div>
    </main>
  );
}
