importScripts('https://storage.googleapis.com/workbox-cdn/releases/6.4.1/workbox-sw.js');

if (workbox) {
  console.log('Workbox is loaded 🎉');

  // Force activation and take control immediately
  workbox.core.skipWaiting();
  workbox.core.clientsClaim();

  // Cache name configuration
  const CACHE_NAMES = {
    assets: 'madrasah-assets-v1',
    images: 'madrasah-images-v1',
    pages: 'madrasah-pages-v1'
  };

  // 1. Cache JS, CSS, and manifest/icons files with Stale-While-Revalidate
  workbox.routing.registerRoute(
    ({ request }) => 
      request.destination === 'script' ||
      request.destination === 'style' ||
      request.destination === 'font' ||
      request.url.includes('/assets/') ||
      request.url.endsWith('.js') ||
      request.url.endsWith('.css'),
    new workbox.strategies.StaleWhileRevalidate({
      cacheName: CACHE_NAMES.assets,
      plugins: [
        new workbox.expiration.ExpirationPlugin({
          maxEntries: 100,
          maxAgeSeconds: 30 * 24 * 60 * 60, // 30 days
        }),
      ],
    })
  );

  // 2. Cache Images with Cache-First
  workbox.routing.registerRoute(
    ({ request }) => request.destination === 'image' || request.url.endsWith('.svg') || request.url.endsWith('.png'),
    new workbox.strategies.CacheFirst({
      cacheName: CACHE_NAMES.images,
      plugins: [
        new workbox.expiration.ExpirationPlugin({
          maxEntries: 50,
          maxAgeSeconds: 60 * 24 * 60 * 60, // 60 days
        }),
      ],
    })
  );

  // 3. Cache HTML pages or navigation requests with Network-First/Stale-While-Revalidate
  // This allows the app to load instantly offline while getting updates when online.
  workbox.routing.registerRoute(
    ({ request }) => request.mode === 'navigate',
    new workbox.strategies.NetworkFirst({
      cacheName: CACHE_NAMES.pages,
      plugins: [
        new workbox.expiration.ExpirationPlugin({
          maxEntries: 10,
          maxAgeSeconds: 7 * 24 * 60 * 60, // 7 days
        }),
      ],
      networkTimeoutSeconds: 3, // fallback to cache quickly if network is slow
    })
  );
} else {
  console.log('Workbox failed to load 😢');
}
