self.addEventListener('install', () => {
  self.skipWaiting()
})
self.addEventListener('activate', () => {
  // dummy sw to prevent 404
})
