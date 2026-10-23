/**
 * Offline standalone file handling. Browser exports keep working unchanged.
 * Electron and Android use their native Save As dialogs for both JSON and ZIP.
 */
type NativeSaver = {
  saveFile: (name: string, mime: string, base64: string) => Promise<unknown> | void;
  printPdf?: (name: string) => Promise<unknown> | void;
};
declare global {
  interface Window {
    HeroListDesktop?: NativeSaver;
    HeroListNative?: NativeSaver;
  }
}
function binaryToBase64(bytes: Uint8Array): string {
  let out = "";
  const chunkSize = 16384;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    out += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return btoa(out);
}
export async function saveStandaloneFile(blob: Blob, filename: string): Promise<void> {
  const native = window.HeroListDesktop || window.HeroListNative;
  if (native) {
    const data = binaryToBase64(new Uint8Array(await blob.arrayBuffer()));
    await native.saveFile(filename, blob.type || "application/octet-stream", data);
    return;
  }
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  // Safari and slower browsers may still need the blob after anchor.click().
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
}
export function saveExport(blob: Blob, filename: string): void {
  void saveStandaloneFile(blob, filename).catch(error => {
    alert("Не удалось сохранить файл: " + (error instanceof Error ? error.message : String(error)));
  });
}
export function printStandalonePdf(filename: string): void {
  const native = window.HeroListDesktop || window.HeroListNative;
  if (native?.printPdf) {
    void Promise.resolve(native.printPdf(filename)).catch(error => {
      alert("Не удалось создать PDF: " + (error instanceof Error ? error.message : String(error)));
    });
    return;
  }
  window.print();
}
