/**
 * Client-side WhatsApp opener.
 *
 * Why this exists:
 *   The server returns a canonical `https://wa.me/<phone>?text=...` URL.
 *   That URL works in regular mobile browsers (Chrome on Android, Safari
 *   on iOS) but fails in two important places:
 *
 *     1. Desktop browsers — `wa.me` redirects to the `whatsapp://` scheme
 *        which the desktop browser cannot resolve (`ERR_UNKNOWN_URL_SCHEME`).
 *     2. In-app webviews — including the Attendix Capacitor app, the
 *        Replit app, Facebook, Instagram, Telegram. The redirect to
 *        `whatsapp://` is blocked by the webview and the user lands on a
 *        "Download WhatsApp" page even though WhatsApp is installed.
 *
 * Fix — call WhatsApp through the platform's native launch path:
 *   - Android & iOS  → `whatsapp://send?phone=…&text=…` via
 *     `window.location.href`. Mobile browsers and the Capacitor bridge
 *     both delegate `whatsapp://` to the OS, which opens WhatsApp /
 *     WhatsApp Business (Android shows a chooser the first time if both
 *     are installed).
 *   - Desktop        → `https://web.whatsapp.com/send?…` in a new tab.
 */

function ua(): string {
  if (typeof navigator === "undefined") return "";
  return navigator.userAgent || "";
}

function isAndroid(): boolean {
  return /android/i.test(ua());
}

function isIOS(): boolean {
  return /iphone|ipad|ipod/i.test(ua());
}

/** Parse phone + text out of the canonical wa.me URL. */
function parseWaMe(waMeUrl: string): { phone: string; text: string } {
  try {
    const u = new URL(waMeUrl);
    let phone = u.pathname.replace(/^\/+/, "");
    if (phone === "send" || phone === "") {
      phone = u.searchParams.get("phone") ?? "";
    }
    const text = u.searchParams.get("text") ?? "";
    return { phone, text };
  } catch {
    return { phone: "", text: "" };
  }
}

/**
 * Open WhatsApp pre-filled with a message. `waMeUrl` is the canonical
 * `https://wa.me/<phone>?text=...` URL produced by the server.
 */
export function openWhatsApp(waMeUrl: string): void {
  if (typeof window === "undefined") return;

  const { phone, text } = parseWaMe(waMeUrl);
  const textEnc = encodeURIComponent(text);

  // Mobile (Android / iOS — works for both mobile browsers and the
  // Capacitor WebView). Trigger the WhatsApp custom scheme directly so
  // the OS hands the request to the installed WhatsApp app, bypassing
  // any wa.me redirect chain that in-app webviews block.
  if (isAndroid() || isIOS()) {
    window.location.href = `whatsapp://send?phone=${phone}&text=${textEnc}`;
    return;
  }

  // Desktop: open WhatsApp Web in a new tab.
  const webUrl = `https://web.whatsapp.com/send?phone=${phone}&text=${textEnc}`;
  window.open(webUrl, "_blank", "noopener,noreferrer");
}
