// Service Worker بسيط لتطبيق نِكسا — يسمح بتعريف التطبيق كـ PWA صالح للتثبيت
const CACHE_NAME = "nexa-cache-v1";

self.addEventListener("install", (event) => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

// استراتيجية تخزين مبسطة: محاولة الشبكة أولاً، ثم العودة للذاكرة المؤقتة عند فقدان الاتصال
self.addEventListener("fetch", (event) => {
  event.respondWith(
    fetch(event.request).catch(() => caches.match(event.request))
  );
});
