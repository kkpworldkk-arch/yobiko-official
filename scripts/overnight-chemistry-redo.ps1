# 化学頻出スタンダード問題230選の口頭試問データを、
#   1. 元のOCR抽出結果(data/ocr-candidates)からリセット(前回の言い換え結果を破棄)
#   2. スキップ条件を強化したルールで、もう一度AIによる言い換えを実行
#   3. 朝チェックできるよう、変換結果からランダム30件を抜き出したファイルを作成
# の順に自動で行う。実行中は何も入力・貼り付けしないでください。
#
# 使い方:
#   .\scripts\overnight-chemistry-redo.ps1
#
# ANTHROPIC_API_KEY は .env.local / .env に設定済みのものを自動で読み込みます
# (アプリの家庭教師機能で使っているものと同じキー)。

$ErrorActionPreference = "Stop"

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$repoRoot = Split-Path -Parent $scriptDir
$py = Join-Path $repoRoot ".venv\Scripts\python.exe"

if (-not (Test-Path $py)) {
    Write-Host "エラー: $py が見つかりません。.venv が作成済みか確認してください。" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "===== [1/3] 化学の口頭試問データを元のOCR結果からリセット中... =====" -ForegroundColor Cyan
& $py scripts/ocr-reference-oral-questions.py --replace --only "化学頻出スタンダード問題230選"
if ($LASTEXITCODE -ne 0) {
    Write-Host "リセットに失敗しました(exit=$LASTEXITCODE)。ここで停止します。" -ForegroundColor Red
    exit 1
}
Write-Host "----- [1/3] 完了 -----" -ForegroundColor Green

Write-Host ""
Write-Host "===== [2/3] 改善したルールで化学の問題を作り直し中... (時間がかかります) =====" -ForegroundColor Cyan
& $py scripts/rewrite-explain-questions.py --book "化学頻出スタンダード問題230選"
if ($LASTEXITCODE -ne 0) {
    Write-Host "----- [2/3] エラーが発生しました(exit=$LASTEXITCODE)。 -----" -ForegroundColor Red
} else {
    Write-Host "----- [2/3] 完了 -----" -ForegroundColor Green
}

Write-Host ""
Write-Host "===== [3/3] 朝チェック用のサンプルを作成中... =====" -ForegroundColor Cyan
& $py scripts/sample-converted-questions.py --book "化学頻出スタンダード問題230選" --n 30
Write-Host "----- [3/3] 完了 -----" -ForegroundColor Green

Write-Host ""
Write-Host "===== 全工程が終了しました。 =====" -ForegroundColor Cyan
Write-Host "確認するファイル:"
Write-Host "  data\rewrite-log.txt        (変換された全件のログ)"
Write-Host "  data\converted-sample.txt   (ランダム30件のチェック用サンプル)"
