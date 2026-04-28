/**
 * Client-side WhatsApp opener.
 *
 * The server returns a canonical `https://wa.me/<phone>?text=...` URL,
 * but `wa.me` is unreliable inside in-app browsers / webviews (e.g. the
 * Replit mobile app, Facebook, Instagram, Telegram). Those browsers
 * block the `whatsapp://` redirect that wa.me does, and the user ends
 * up on a "Download WhatsApp" page even when WhatsApp is installed.
 *
 * To work everywhere we open WhatsApp directly using the platform's
 * native launch mechanism:
 *   - Android → `intent://` URL with `scheme=whatsapp` and an HTTPS
 *     `browser_fallback_url`. The OS opens the WhatsApp app (or shows
 *     a chooser if WhatsApp + WhatsApp Business are both installed).
 *   - iOS → `whatsapp://send?phone=X&text=Y` via `window.location`.
 *   - Desktop → `https://web.whatsapp.com/send?phone=X&text=Y` opened
 *     in a new tab so WhatsApp Web pre-fills the chat.
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

  // Android: use an Intent URL so the OS launches the WhatsApp app even
  // from inside an in-app webview. If WhatsApp is somehow not installed,
  // the browser falls back to the wa.me URL.
  if (isAndroid()) {
    const fallback = encodeURIComponent(waMeUrl);
    const intentUrl =
      `intent://send?phone=${phone}&text=${textEnc}` +
      `#Intent;scheme=whatsapp;action=android.intent.action.SEND;` +
      `S.browser_fallback_url=${fallback};end`;
    window.location.href = intentUrl;
    return;
  }

  // iOS: open the WhatsApp custom scheme directly. iOS will route to
  // WhatsApp / WhatsApp Business if installed.
  if (isIOS()) {
    window.location.href = `whatsapp://send?phone=${phone}&text=${textEnc}`;
    return;
  }

  // Desktop: open WhatsApp Web in a new tab.
  const webUrl = `https://web.whatsapp.com/send?phone=${phone}&text=${textEnc}`;
  window.open(webUrl, "_blank", "noopener,noreferrer");
}
