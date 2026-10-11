import Link from "next/link";
import { OPERATOR } from "@/lib/operator";

export const metadata = {
  title: "プライバシーポリシー | 滝原塾",
};

export default function PrivacyPolicyPage() {
  return (
    <main className="min-h-screen bg-navy-950 px-6 py-16">
      <div className="mx-auto max-w-2xl rounded-xl border border-border bg-card p-8 shadow-panel">
        <h1 className="text-h1 text-ivory-100">プライバシーポリシー</h1>
        <p className="mt-2 text-caption text-slate-500">最終改定日: {OPERATOR.policyRevisedAt}</p>

        <div className="mt-8 flex flex-col gap-7 text-body-sm leading-relaxed text-slate-300">
          <section>
            <p>
              {OPERATOR.tradeName}（運営者: {OPERATOR.name}。以下「当塾」といいます）は、当塾が提供する学習支援サービス
              「{OPERATOR.serviceName}」（iPhone・iPad向けアプリおよびウェブサイトを含み、以下「本サービス」といいます）における、
              利用者の個人情報の取り扱いについて、以下のとおりプライバシーポリシー（以下「本ポリシー」といいます）を定めます。
            </p>
          </section>

          <section>
            <h2 className="text-h3 text-ivory-100">1. 事業者情報</h2>
            <ul className="mt-2 flex flex-col gap-1">
              <li>屋号: {OPERATOR.tradeName}</li>
              <li>運営者: {OPERATOR.name}</li>
              <li>所在地: {OPERATOR.address}</li>
              <li>
                お問い合わせ先:{" "}
                <a href={`mailto:${OPERATOR.contactEmail}`} className="text-gold-400 underline-offset-2 hover:underline">
                  {OPERATOR.contactEmail}
                </a>
              </li>
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
                手書き回答の画像、音声入力を文字にしたテキスト、AIチューターへの質問内容など）
              </li>
              <li>講師が入力する、生徒の学力分析・面談記録などの指導関連情報</li>
              <li>ログイン状態を維持するためのCookie、生体認証（パスキー）でログインするための公開鍵情報</li>
            </ul>
            <p className="mt-2">
              本サービスは、広告の配信、利用者の行動追跡（トラッキング）、他社サービスとのデータの照合は行いません。
            </p>
          </section>

          <section>
            <h2 className="text-h3 text-ivory-100">3. 利用目的</h2>
            <ul className="mt-2 flex list-disc flex-col gap-1 pl-5">
              <li>本サービス（口頭試問ドリル、学習記録の管理、AIによる採点・フィードバック、講師による進捗確認）の提供</li>
              <li>生徒本人および保護者への学習状況の共有</li>
              <li>講師による指導方針の検討・教材の改善</li>
              <li>本サービスの不具合対応・品質改善、お問い合わせへの対応</li>
            </ul>
          </section>

          <section>
            <h2 className="text-h3 text-ivory-100">4. AIサービスへの送信（外国にある第三者への提供）</h2>
            <p className="mt-2">
              本サービスのAI口頭試問・AIチューターでは、回答の採点やフィードバック・学習アドバイスを作成するために、
              米国のAnthropic, PBCが提供するAI「Claude」のAPIへ、次の情報を送信します。送信は、利用者がアプリ内で
              内容を確認し、同意した場合にのみ行います。
            </p>
            <ul className="mt-2 flex list-disc flex-col gap-1 pl-5">
              <li>送信する情報: 問題文・模範解答、利用者の回答（文章、音声入力を文字にしたもの、手書き回答の画像）、AIチューターへの質問内容</li>
              <li>送信しない情報: メールアドレス、パスワードなどのアカウント情報</li>
              <li>提供先の国: アメリカ合衆国</li>
              <li>
                同国の個人情報保護制度: 日本の個人情報保護法に相当する包括的な連邦法はなく、州法（カリフォルニア州消費者
                プライバシー法など）や分野別の法律によって個人情報が保護されています。
              </li>
              <li>
                提供先が講じる措置: Anthropic社は商用API規約において、API経由で受け取ったデータをAIモデルの学習に利用しないこと、
                一定期間経過後に削除することなどを定めています。
              </li>
            </ul>
            <p className="mt-2">
              同意は、アプリの「設定」→「AI機能へのデータ送信」からいつでも取り消せます。取り消した場合、AI機能は利用できなくなりますが、
              それ以外の機能は引き続き利用できます。
            </p>
          </section>

          <section>
            <h2 className="text-h3 text-ivory-100">5. 上記以外の第三者提供・業務委託</h2>
            <p className="mt-2">
              前項の場合および法令に基づく場合を除き、本人の同意なく個人情報を第三者に提供することはありません。
            </p>
            <p className="mt-2">
              本サービスのデータは、クラウドサービス事業者（Render Services, Inc.、米国）が運営するサーバー（シンガポール所在）に
              保存しています。これはサーバーの運用を委託するものであり、同社が利用者のデータを独自の目的で利用することはありません。
            </p>
          </section>

          <section>
            <h2 className="text-h3 text-ivory-100">6. 端末の機能の利用（iPhone・iPadアプリ）</h2>
            <ul className="mt-2 flex list-disc flex-col gap-1 pl-5">
              <li>
                マイク・音声認識: 口頭試問で声で回答するときに限り利用します。音声はAppleの音声認識機能で文字に変換され、
                当塾には変換後の文字のみが送信されます。音声データそのものは保存しません。
              </li>
              <li>
                通知: 復習のリマインド通知を、利用者が許可した場合に端末内で予約して表示します。通知のために個人情報を
                外部へ送信することはありません。
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-h3 text-ivory-100">7. データの保管と安全管理</h2>
            <p className="mt-2">
              取得した情報は、通信を暗号化（HTTPS）したうえでサーバーに保存し、パスワードは復元できない形式に変換して保存しています。
              情報にアクセスできるのは、本サービスの運営に必要な当塾の講師に限られます。
            </p>
          </section>

          <section>
            <h2 className="text-h3 text-ivory-100">8. 未成年者の利用について</h2>
            <p className="mt-2">
              本サービスを未成年の生徒が利用する場合、当塾がアカウントを発行し、保護者の同意のもとで利用されることを前提としています。
            </p>
          </section>

          <section>
            <h2 className="text-h3 text-ivory-100">9. アカウントの削除、開示・訂正・削除のご請求</h2>
            <p className="mt-2">
              生徒・保護者のアカウントは、アプリの「設定」→「アカウントの削除」からご自身で削除できます。削除すると、ログイン情報と、
              口頭試問の回答・習熟度・AIチューターの履歴などの学習記録が削除されます。
            </p>
            <p className="mt-2">
              また、ご本人（未成年の場合は保護者）は、当塾に対して、保有する個人情報の開示・訂正・利用停止・削除を請求することができます。
              ご希望の場合は、上記のお問い合わせ先までご連絡ください。
            </p>
          </section>

          <section>
            <h2 className="text-h3 text-ivory-100">10. 本ポリシーの変更</h2>
            <p className="mt-2">
              本ポリシーの内容は、法令の変更やサービス内容の変更に応じて改定することがあります。重要な変更がある場合は、
              本サービス上でお知らせします。改定後のポリシーは、本ページに掲載した時点から効力を生じるものとします。
            </p>
          </section>
        </div>

        <div className="mt-10 flex gap-4 text-caption text-slate-500">
          <Link href="/support" className="hover:text-gold-400">
            お問い合わせ・サポート
          </Link>
          <Link href="/login" className="hover:text-gold-400">
            ログイン画面へ
          </Link>
        </div>
      </div>
    </main>
  );
}
