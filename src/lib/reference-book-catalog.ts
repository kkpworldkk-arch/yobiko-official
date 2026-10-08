export interface ReferenceBookCatalogEntry {
  fileName: string;
  title: string;
  subject: string;
  pageCount: number;
  description: string;
}

/**
 * sankosho に置かれた参考書ファイルの台帳。
 * 問題本文の自動生成は、抽出結果の品質を確認してから行う。
 */
export const REFERENCE_BOOK_CATALOG: ReferenceBookCatalogEntry[] = [
  {
    fileName: "システム英単語 .pdf",
    title: "システム英単語",
    subject: "英語・単語",
    pageCount: 414,
    description: "sankosho/システム英単語 .pdf（414ページ）。文字層確認済み・問題化未実施。英単語を口頭で即答できる状態まで定着させる教材。",
  },
  {
    fileName: "システム英単語メディカル.pdf",
    title: "システム英単語 メディカル",
    subject: "英語・医療単語",
    pageCount: 214,
    description: "sankosho/システム英単語メディカル.pdf（214ページ）。文字層確認済み・問題化未実施。医療系英単語の口頭試問用教材。",
  },
  {
    fileName: "化学頻出スタンダード問題230選 .pdf",
    title: "化学頻出スタンダード問題230選",
    subject: "化学",
    pageCount: 346,
    description: "sankosho/化学頻出スタンダード問題230選 .pdf（346ページ）。文字層確認済み・問題化未実施。頻出問題を一問一答で確認する教材。",
  },
  {
    fileName: "標準セミナー生物基礎2021.pdf",
    title: "標準セミナー生物基礎 2021",
    subject: "生物基礎",
    pageCount: 146,
    description: "sankosho/標準セミナー生物基礎2021.pdf（146ページ）。画像PDF・OCR未実施。生物基礎の重要事項を口頭確認する教材。",
  },
  {
    fileName: "黄チャート式 解法と演習 数学1+A .pdf",
    title: "黄チャート式 解法と演習 数学1+A",
    subject: "数学・数学1+A",
    pageCount: 990,
    description: "sankosho/黄チャート式 解法と演習 数学1+A .pdf（990ページ）。文字層確認済み・問題化未実施。数学1+Aの解法を説明できる状態まで定着させる教材。",
  },
  {
    fileName: "黄チャート式 解法と演習 数学1+A  2.pdf",
    title: "黄チャート式 解法と演習 数学1+A（別スキャン）",
    subject: "数学・数学1+A",
    pageCount: 990,
    description: "sankosho/黄チャート式 解法と演習 数学1+A  2.pdf（990ページ）。数学1+AとSHA-256一致の重複ファイル。文字層確認済み・問題化未実施。",
  },
  {
    fileName: "黄チャート式 解法と演習 数学2+B .pdf",
    title: "黄チャート式 解法と演習 数学2+B",
    subject: "数学・数学2+B",
    pageCount: 1048,
    description: "sankosho/黄チャート式 解法と演習 数学2+B .pdf（1048ページ）。文字層確認済み・問題化未実施。数学2+Bの解法を口頭で説明する教材。",
  },
  {
    fileName: "黄チャート式 解法と演習 数学3+C.pdf",
    title: "黄チャート式 解法と演習 数学3+C",
    subject: "数学・数学3+C",
    pageCount: 1160,
    description: "sankosho/黄チャート式 解法と演習 数学3+C.pdf（1160ページ）。文字層確認済み・問題化未実施。数学3+Cの解法を口頭で説明する教材。",
  },
];
