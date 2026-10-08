# 化学頻出スタンダード問題230選・標準セミナー生物基礎2021 の口頭試問問題を、
# OCRを経由せず、AIがページ画像を直接読んで作り直す。
#
# 画像を直接見るので、OCRでは不可能だった「図表を見て判断する」「選択肢全体を見て
# 正誤を判断する」ことができ、これまでの問題(自己言及・プレースホルダー残り・
# OCR誤字)が大幅に減るはず。判断に迷う内容は出題しない方を優先するよう指示済み。
#
# 既存の問題は一旦すべて削除してから作り直す(--replace)。
# 対象は化学・生物の2冊だけ(黄チャートとシステム英単語系には触れない)。
# 500ページ近くを1ページずつAPIに送るため、全部終わるまで数十分〜1時間程度かかる。
# 置き忘れ・ネットワーク断などで途中で止まっても、再度このスクリプトを実行すれば
# 続きのページから再開する(data/vision-extract-progress.json に進捗を記録している)。
#
# 使い方:
#   .\scripts\overnight-vision-extract.ps1
#
# ANTHROPIC_API_KEY は .env.local / .env に設定済みのものを自動で読み込みます。

$ErrorActionPreference = "Continue"

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$repoRoot = Split-Path -Parent $scriptDir
$py = Join-Path $repoRoot ".venv\Scripts\python.exe"

if (-not (Test-Path $py)) {
    Write-Host "エラー: $py が見つかりません。.venv が作成済みか確認してください。" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "===== 化学・生物の問題をvision APIで作り直し中... (時間がかかります) =====" -ForegroundColor Cyan
& $py scripts/import-reference-questions.py --book "化学頻出スタンダード問題230選" --book "標準セミナー生物基礎" --replace
if ($LASTEXITCODE -ne 0) {
    Write-Host "----- エラーが発生しました(exit=$LASTEXITCODE)。再度このスクリプトを実行すると続きから再開します。 -----" -ForegroundColor Red
    exit 1
}
Write-Host "----- 完了 -----" -ForegroundColor Green

Write-Host ""
Write-Host "===== 朝チェック用のサンプルを作成中... =====" -ForegroundColor Cyan
& $py scripts/sample-converted-questions.py --book "化学頻出スタンダード問題230選" --n 30 --out data/converted-sample-chemistry.txt
& $py scripts/sample-converted-questions.py --book "標準セミナー生物基礎" --n 30 --out data/converted-sample-biology.txt
Write-Host "----- 完了 -----" -ForegroundColor Green

Write-Host ""
Write-Host "===== 全工程が終了しました。確認するファイル: =====" -ForegroundColor Cyan
Write-Host "  data\converted-sample-chemistry.txt"
Write-Host "  data\converted-sample-biology.txt"
