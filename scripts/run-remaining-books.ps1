# 残りの参考書を1冊ずつ順番に抽出するスクリプト。
# 実行中は何も入力・貼り付けしないでください(Pythonの実行中に別の入力が届くと
# KeyboardInterruptで処理が中断してしまいます)。
# 使い方(.venv の有効化は不要。このスクリプトが直接 .venv の python を使う):
#   .\scripts\run-remaining-books.ps1

$ErrorActionPreference = "Continue"

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$repoRoot = Split-Path -Parent $scriptDir
$py = Join-Path $repoRoot ".venv\Scripts\python.exe"

if (-not (Test-Path $py)) {
    Write-Host "エラー: $py が見つかりません。.venv が作成済みか確認してください。" -ForegroundColor Red
    exit 1
}

$books = @(
    "標準セミナー生物基礎2021.pdf",
    "化学頻出スタンダード問題230選 .pdf",
    "システム英単語 .pdf",
    "黄チャート式 解法と演習 数学1+A .pdf",
    "黄チャート式 解法と演習 数学2+B .pdf",
    "黄チャート式 解法と演習 数学3+C.pdf"
)

$total = $books.Count
$index = 0

foreach ($book in $books) {
    $index++
    Write-Host ""
    Write-Host "===== [$index/$total] $book を処理中... =====" -ForegroundColor Cyan
    & $py scripts/ocr-reference-oral-questions.py --book "$book" --export-dir data/ocr-candidates
    if ($LASTEXITCODE -ne 0) {
        Write-Host "----- [$index/$total] $book でエラーが発生しました(exit=$LASTEXITCODE)。次の本に進みます。 -----" -ForegroundColor Red
    } else {
        Write-Host "----- [$index/$total] $book 完了 -----" -ForegroundColor Green
    }
}

Write-Host ""
Write-Host "===== 全冊の抽出処理が終了しました。次はDBへの取り込みです: =====" -ForegroundColor Cyan
Write-Host ".venv\Scripts\python.exe scripts/ocr-reference-oral-questions.py --replace"
