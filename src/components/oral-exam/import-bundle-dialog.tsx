"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Upload } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

// 問題データと図をまとめた .tar.gz をブラウザから本番へ取り込む（Render の Shell を使わない）
export function ImportBundleDialog({ bookTitles }: { bookTitles: string[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [log, setLog] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  async function send(form: HTMLFormElement, dryRun: boolean) {
    setIsSubmitting(true);
    setLog(null);
    setFailed(false);
    const formData = new FormData(form);
    formData.set("dryRun", String(dryRun));
    try {
      const res = await fetch("/api/oral-exam/import-bundle", { method: "POST", body: formData });
      const data: { ok?: boolean; error?: string; figures?: number; log?: string } = await res.json();
      setFailed(!res.ok);
      setLog(data.error ?? `図 ${data.figures ?? 0} 枚を保存しました。\n${data.log ?? ""}`);
      if (res.ok && !dryRun) router.refresh();
    } catch {
      setFailed(true);
      setLog("送信に失敗しました。通信状態を確認してください。");
    } finally {
      setIsSubmitting(false);
    }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const submitter = (event.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null;
    void send(event.currentTarget, submitter?.value === "check");
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.04] px-3 text-body-sm font-medium text-ivory-200 transition-colors duration-300 hover:bg-white/[0.08]">
        <Upload className="size-4" strokeWidth={2} />
        図つきデータの取り込み
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>図つき問題データの取り込み</DialogTitle>
          <DialogDescription>
            問題データ（.txt）と図をまとめた .tar.gz を送ると、選んだ参考書の問題を入れ替えます。
            入れ替える前にデータベースのバックアップが自動で作られ、生徒の習熟度は同じ問題番号のものを引き継ぎます。
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="bundle-book">参考書</Label>
            <select
              id="bundle-book"
              name="book"
              required
              defaultValue={bookTitles.includes("化学頻出スタンダード問題230選") ? "化学頻出スタンダード問題230選" : undefined}
              className="h-9 rounded-lg border border-white/10 bg-navy-800 px-3 text-body-sm text-ivory-100"
            >
              {bookTitles.map((title) => (
                <option key={title} value={title}>{title}</option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="bundle-file">ファイル（.tar.gz）</Label>
            <Input id="bundle-file" name="file" type="file" accept=".gz,.tgz,application/gzip" required />
          </div>
          {log && (
            <pre
              className={`max-h-48 overflow-auto whitespace-pre-wrap rounded-md bg-navy-900 p-3 text-caption ${failed ? "text-crimson-500" : "text-slate-300"}`}
            >
              {log}
            </pre>
          )}

          <DialogFooter className="mt-1 gap-2">
            <Button type="submit" name="mode" value="check" variant="secondary" disabled={isSubmitting}>
              件数を確認する
            </Button>
            <Button
              type="submit"
              name="mode"
              value="import"
              disabled={isSubmitting}
              className="bg-gold-500 text-navy-950 hover:bg-gold-400"
            >
              {isSubmitting ? "処理しています…" : "取り込む"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
