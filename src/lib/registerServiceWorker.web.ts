export function registerServiceWorker() {
  if (typeof document !== 'undefined') {
    ensurePwaHeadTags();
  }

  if (
    typeof window === 'undefined' ||
    typeof navigator === 'undefined' ||
    !('serviceWorker' in navigator)
  ) {
    return;
  }

  window.addEventListener('load', () => {
    void navigator.serviceWorker.register('/service-worker.js').catch((error) => {
      if (__DEV__) {
        console.warn('[pwa] service worker registration failed', error);
      }
    });
  });
}

function ensurePwaHeadTags() {
  ensureLink('manifest', '/manifest.json');
  ensureLink('apple-touch-icon', '/icons/icon-192.png');
  ensureMeta('theme-color', '#0b0b0b');
  ensureMeta('apple-mobile-web-app-capable', 'yes');
  ensureMeta('apple-mobile-web-app-title', 'Zenmo');
}

function ensureLink(rel: string, href: string) {
  if (document.head.querySelector(`link[rel="${rel}"]`)) {
    return;
  }

  const link = document.createElement('link');
  link.rel = rel;
  link.href = href;
  document.head.appendChild(link);
}

function ensureMeta(name: string, content: string) {
  const existing = document.head.querySelector(`meta[name="${name}"]`);

  if (existing) {
    existing.setAttribute('content', content);
    return;
  }

  const meta = document.createElement('meta');
  meta.name = name;
  meta.content = content;
  document.head.appendChild(meta);
}
