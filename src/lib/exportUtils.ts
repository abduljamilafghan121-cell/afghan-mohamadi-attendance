import { Capacitor } from "@capacitor/core";
import { Filesystem, Directory, Encoding } from "@capacitor/filesystem";
import { Share } from "@capacitor/share";

type CapacitorGlobal = {
  Plugins?: {
    Filesystem?: {
      writeFile: (opts: any) => Promise<any>;
      getUri: (opts: any) => Promise<{ uri: string }>;
    };
    Share?: {
      share: (opts: any) => Promise<any>;
    };
  };
};

function getCapacitorGlobal(): CapacitorGlobal | null {
  if (typeof window === "undefined") return null;
  return ((window as any).Capacitor as CapacitorGlobal | undefined) ?? null;
}

export function isNativeCapacitor(): boolean {
  // This is the most reliable check inside Capacitor v6.
  // It also ensures the Capacitor runtime is actually bundled.
  return Capacitor.getPlatform() !== "web";
}

async function shareFileFromTextNative(filename: string, data: string, mimeType: string): Promise<void> {
  let nativeError: unknown = null;
  try {
    await Filesystem.writeFile({
      path: filename,
      data,
      directory: Directory.Cache,
      encoding: Encoding.UTF8,
    });

    const fileUri = await Filesystem.getUri({
      path: filename,
      directory: Directory.Cache,
    });

    await Share.share({
      title: filename,
      url: fileUri.uri,
      dialogTitle: `Save ${filename}`,
      text: mimeType,
    });
    return;
  } catch (e) {
    nativeError = e;
  }

  const cap = getCapacitorGlobal();
  const fs = cap?.Plugins?.Filesystem;
  const sh = cap?.Plugins?.Share;
  if (!fs || !sh) {
    const nativeErrMsg =
      nativeError instanceof Error
        ? nativeError.message
        : nativeError
          ? String(nativeError)
          : "";
    const hasCap = Boolean(cap);
    throw new Error(
      "Export failed in APK. " +
        (nativeErrMsg ? `Native error: ${nativeErrMsg}. ` : "") +
        `Capacitor global present: ${hasCap}. ` +
        "Please ensure: npm install (root) + npx cap sync android (mobile) + rebuild APK."
    );
  }

  await fs.writeFile({
    path: filename,
    data,
    directory: "CACHE",
    encoding: "utf8",
  });

  const fileUri = await fs.getUri({
    path: filename,
    directory: "CACHE",
  });

  await sh.share({
    title: filename,
    url: fileUri.uri,
    dialogTitle: `Save ${filename}`,
    text: mimeType,
  });
}

export async function downloadTextFile(filename: string, content: string, mimeType: string): Promise<void> {
  if (isNativeCapacitor()) {
    await shareFileFromTextNative(filename, content, mimeType);
    return;
  }

  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export async function exportHtmlReport(filenameBase: string, htmlContent: string): Promise<void> {
  if (isNativeCapacitor()) {
    await shareFileFromTextNative(`${filenameBase}.html`, htmlContent, "text/html");
    return;
  }

  const win = window.open("", "_blank");
  if (!win) {
    alert("Please allow popups to export.");
    return;
  }
  win.document.write(htmlContent);
  win.document.close();
  win.focus();
  setTimeout(() => {
    try {
      win.print();
    } catch {
      // ignore
    }
  }, 500);
}
