import type { KeyboardEvent } from "react";

// Keep Tab within the active native modal, including the wrap at either end.
// Native dialog still provides background inertness, Escape and focus restoration.
export function trapDialogFocus(event: KeyboardEvent<HTMLDialogElement>) {
  if (event.key !== "Tab") return;
  const dialog = event.currentTarget;
  const controls = [...dialog.querySelectorAll<HTMLElement>(
    'button:not(:disabled), a[href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"])',
  )].filter((element) => element.getClientRects().length > 0 && !element.hidden);
  const first = controls[0], last = controls[controls.length - 1];
  if (!first) { event.preventDefault(); dialog.focus(); return; }
  if (event.shiftKey && (document.activeElement === first || document.activeElement === dialog)) {
    event.preventDefault(); last.focus();
  } else if (!event.shiftKey && (document.activeElement === last || document.activeElement === dialog)) {
    event.preventDefault(); first.focus();
  }
}
