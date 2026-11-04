/* Service worker for the installed web app. Plain JS, no build step.
 * Firestore keeps its own offline data; this only caches the app shell. */
var CACHE_NAME = "planner-v1";
var CACHE_PREFIX = "planner-";
var PRECACHE = ["/", "/manifest.json"];
var STATIC_PREFIXES = ["/_expo/static/", "/assets/", "/icons/"];

/** Decides how to answer a request: 'network-first' | 'cache-first' | 'bypass'. */
function strategyFor(url, request, origin) {
  if (request.method !== "GET") return "bypass";
  if (url.origin !== origin) return "bypass";
  var path = url.pathname;
  // Firebase Auth's handler must always reach the network untouched.
  if (path.indexOf("/__/") === 0) return "bypass";
  if (request.mode === "navigate") return "network-first";
  if (path === "/manifest.json") return "cache-first";
  for (var i = 0; i < STATIC_PREFIXES.length; i++) {
    if (path.indexOf(STATIC_PREFIXES[i]) === 0) return "cache-first";
  }
  return "bypass";
}

if (typeof self !== "undefined" && self.registration) {
  self.addEventListener("install", function (event) {
    event.waitUntil(
      caches
        .open(CACHE_NAME)
        .then(function (cache) {
          return cache.addAll(PRECACHE);
        })
        .then(function () {
          return self.skipWaiting();
        }),
    );
  });

  self.addEventListener("activate", function (event) {
    event.waitUntil(
      caches
        .keys()
        .then(function (keys) {
          return Promise.all(
            keys
              .filter(function (k) {
                return k.indexOf(CACHE_PREFIX) === 0 && k !== CACHE_NAME;
              })
              .map(function (k) {
                return caches.delete(k);
              }),
          );
        })
        .then(function () {
          return self.clients.claim();
        }),
    );
  });

  self.addEventListener("fetch", function (event) {
    var request = event.request;
    var url = new URL(request.url);
    var strategy = strategyFor(url, request, self.location.origin);
    if (strategy === "bypass") return;

    if (strategy === "network-first") {
      event.respondWith(
        fetch(request)
          .then(function (response) {
            if (response && response.ok) {
              var copy = response.clone();
              caches.open(CACHE_NAME).then(function (cache) {
                return cache.put("/", copy);
              });
            }
            return response;
          })
          .catch(function () {
            return caches.match("/");
          }),
      );
      return;
    }

    event.respondWith(
      caches.match(request).then(function (cached) {
        if (cached) return cached;
        return fetch(request).then(function (response) {
          if (response && response.ok) {
            var copy = response.clone();
            caches.open(CACHE_NAME).then(function (cache) {
              return cache.put(request, copy);
            });
          }
          return response;
        });
      }),
    );
  });
}
