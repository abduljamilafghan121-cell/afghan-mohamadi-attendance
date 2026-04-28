/**
 * Client-side WhatsApp opener.
 *
 * The server returns a canonical `https://wa.me/<phone>?text=...` URL.
 * However, `wa.me` on a desktop browser will try to redirect to the
 * `whatsapp://` deep-link scheme, which most desktop browsers cannot
 * resolve — the user sees `ERR_UNKNOWN_URL_SCHEME`.
 *
 * To work everywhere we look at the platform first:
 *   - Mobile (Android / iOS) → open `wa.me` (OS opens the app).
 *   - Desktop → rewrite to `https://web.whatsapp.com/send?...` so the
 *     dispatcher gets WhatsApp Web in a new tab. They scan the QR once
 *     and from then on every dispatch opens straight into a chat.
 */

function isMobileUA(): boolean {
  if (typeof navigator === "undefined") return false;
  return /android|iphone|ipad|ipod|iemobile|opera mini/i.test(navigator.userAgent);
}

/** Convert a wa.me URL to a web.whatsapp.com URL. */
function toWebWhatsappUrl(waUrl: string): string {
  try {
    const u = new URL(waUrl);
    // wa.me path is "/<phone>" (sometimes "/send")
    let phone = u.pathname.replace(/^\/+/, "");
    if (phone === "send" || phone === "") {
      phone = u.searchParams.get("phone") ?? "";
    }
    const text = u.searchParams.get("text") ?? "";
    const params = new URLSearchParams();
    if (phone) params.set("phone", phone);
    if (text) params.set("text", text);
    return `https://web.whatsapp.com/send?${params.toString()}`;
  } catch {
    return waUrl;
  }
}

/**
 * Opens WhatsApp using the right URL for the device. Returns the URL
 * actually used so the caller can show it to the user as a fallback link.
 */
export function openWhatsApp(waMeUrl: string): string {
  const finalUrl = isMobileUA() ? waMeUrl : toWebWhatsappUrl(waMeUrl);
  if (typeof window !== "undefined") {
    window.open(finalUrl, "_blank", "noopener,noreferrer");
  }
  return finalUrl;
}
