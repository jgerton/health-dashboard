/**
 * Register the service worker for PWA offline support.
 * Call this once from a client component on mount.
 */
export function registerServiceWorker(): void {
  if (typeof window === "undefined") return;
  if (!("serviceWorker" in navigator)) return;

  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register("/sw.js")
      .catch((err) => {
        console.warn("Service worker registration failed:", err);
      });
  });
}
