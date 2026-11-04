self.addEventListener("push", (event) => {
  const data = event.data ? event.data.json() : { title: "New Notification", body: "New update received!" };
  const options = {
    body: data.body,
    icon: "/icon.png",
    badge: "/icon.png",
    vibrate: [200, 100, 200]
  };
  event.waitUntil(self.registration.showNotification(data.title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(clients.openWindow("/"));
});