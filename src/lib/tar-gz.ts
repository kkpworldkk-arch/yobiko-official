import { gunzipSync } from "node:zlib";

export interface TarEntry {
  name: string;
  data: Buffer;
}

// .tar.gz の中の通常ファイルだけを取り出す。ディレクトリや pax ヘッダーなどは読み飛ばす。
export function readTarGz(archive: Buffer): TarEntry[] {
  const tar = gunzipSync(archive);
  const entries: TarEntry[] = [];
  let offset = 0;
  while (offset + 512 <= tar.length) {
    const header = tar.subarray(offset, offset + 512);
    if (header.every((byte) => byte === 0)) break;
    const field = (start: number, length: number) =>
      header.subarray(start, start + length).toString("utf8").split("\0")[0];
    const size = parseInt(field(124, 12).trim() || "0", 8);
    const type = field(156, 1);
    const prefix = field(345, 155);
    const name = (prefix ? `${prefix}/` : "") + field(0, 100);
    const dataStart = offset + 512;
    if (type === "0" || type === "") {
      entries.push({ name: name.replace(/^\.\//, ""), data: Buffer.from(tar.subarray(dataStart, dataStart + size)) });
    }
    offset = dataStart + Math.ceil(size / 512) * 512;
  }
  return entries;
}
