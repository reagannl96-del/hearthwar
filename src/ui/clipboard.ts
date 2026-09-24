// Copying text for the player: coordinates to paste into a message, a forum post
// or another tab. The Clipboard API needs a secure context (https or localhost);
// the game also runs from a plain file or a LAN address, so there is an old-style
// fallback through a hidden textarea.

export async function copyText(text: string): Promise<boolean> {
  try {
    if (typeof navigator !== 'undefined' && navigator.clipboard && (typeof window === 'undefined' || window.isSecureContext !== false)) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    /* refused (permissions, focus): try the old way */
  }
  return legacyCopy(text);
}

function legacyCopy(text: string): boolean {
  if (typeof document === 'undefined') return false;
  const active = document.activeElement as HTMLElement | null;
  const ta = document.createElement('textarea');
  ta.value = text;
  ta.setAttribute('readonly', '');
  // off-screen but still selectable; 16px keeps iOS from zooming in
  ta.style.cssText = 'position:fixed;top:0;left:-9999px;opacity:0;font-size:16px;';
  document.body.appendChild(ta);
  let ok = false;
  try {
    ta.select();
    ta.setSelectionRange(0, text.length);
    ok = document.execCommand('copy');
  } catch {
    ok = false;
  }
  ta.remove();
  active?.focus?.({ preventScroll: true });
  return ok;
}
