# 「=」誤判定バグの修正を反映して、影響のあった単語帳2冊だけ再抽出・取り込みし直す。
# 実行中は何も入力・貼り付けしないでください。
# 使い方(.venv の有効化は不要。このスクリプトが直接 .venv の python を使う):
#   .\scripts\fix-vocab-books.ps1

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$repoRoot = Split-Path -Parent $scriptDir
$py = Join-Path $repoRoot ".venv\Scripts\python.exe"

if (-not (Test-Path $py)) {
    Write-Host "エラー: $py が見つかりません。.venv が作成済みか確認してください。" -ForegroundColor Red
    exit 1
}

Write-Host "===== システム英単語 を再抽出中... =====" -ForegroundColor Cyan
& $py scripts/ocr-reference-oral-questions.py --book "システム英単語 .pdf" --export-dir data/ocr-candidates

Write-Host ""
Write-Host "===== システム英単語メディカル を再抽出中... =====" -ForegroundColor Cyan
& $py scripts/ocr-reference-oral-questions.py --book "システム英単語メディカル.pdf" --export-dir data/ocr-candidates

Write-Host ""
Write-Host "===== DBへ取り込み中(古いデータは置き換え)... =====" -ForegroundColor Cyan
& $py scripts/ocr-reference-oral-questions.py --replace

Write-Host ""
Write-Host "===== 完了しました =====" -ForegroundColor Green
