/* Service worker for the installed web app. Plain JS, no build step.
 * Firestore keeps its own offline data; this only caches the app shell. */
// scripts/stamp-sw.js replaces this name with planner-<hash of the built bundles> after export, so
// each build gets a new worker whose activate drops every older planner-* cache.
var CACHE_NAME = 'planner-dev';
var CACHE_PREFIX = 'planner-';
var PRECACHE = ['/', '/manifest.json'];
var STATIC_PREFIXES = ['/_expo/static/', '/assets/'];

var OFFLINE_MESSAGE =
  'You\u2019re offline and the app hasn\u2019t been saved yet. Open it once while online.';

function offlineResponse() {
  return new Response(OFFLINE_MESSAGE, {
    status: 503,
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
}

/**
 * Decides how to answer a request:
 * 'network-first' | 'cache-first' | 'stale-while-revalidate' | 'bypass'.
 */
function strategyFor(url, request, origin) {
  if (request.method !== 'GET') return 'bypass';
  if (url.origin !== origin) return 'bypass';
  var path = url.pathname;
  // Firebase Auth's handler must always reach the network untouched.
  if (path.indexOf('/__/') === 0) return 'bypass';
  if (request.mode === 'navigate') return 'network-first';
  // Not content-hashed, so edits must reach existing installs.
  if (path === '/manifest.json' || path.indexOf('/icons/') === 0) {
    return 'stale-while-revalidate';
  }
  // Content-hashed build output never changes under the same URL.
  for (var i = 0; i < STATIC_PREFIXES.length; i++) {
    if (path.indexOf(STATIC_PREFIXES[i]) === 0) return 'cache-first';
  }
  return 'bypass';
}

if (typeof self !== 'undefined' && self.registration) {
  self.addEventListener('install', function (event) {
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

  self.addEventListener('activate', function (event) {
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

  self.addEventListener('fetch', function (event) {
    var request = event.request;
    var url = new URL(request.url);
    var strategy = strategyFor(url, request, self.location.origin);
    if (strategy === 'bypass') return;

    if (strategy === 'network-first') {
      event.respondWith(
        fetch(request)
          .then(function (response) {
            if (response && response.ok) {
              var copy = response.clone();
              event.waitUntil(
                caches.open(CACHE_NAME).then(function (cache) {
                  return cache.put('/', copy);
                }),
              );
            }
            return response;
          })
          .catch(function () {
            return caches.match('/').then(function (cached) {
              return cached || offlineResponse();
            });
          }),
      );
      return;
    }

    if (strategy === 'stale-while-revalidate') {
      event.respondWith(
        caches.match(request).then(function (cached) {
          var refresh = fetch(request).then(function (response) {
            if (response && response.ok) {
              var copy = response.clone();
              return caches
                .open(CACHE_NAME)
                .then(function (cache) {
                  return cache.put(request, copy);
                })
                .then(function () {
                  return response;
                });
            }
            return response;
          });
          if (cached) {
            event.waitUntil(refresh.catch(function () {}));
            return cached;
          }
          return refresh;
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
            event.waitUntil(
              caches.open(CACHE_NAME).then(function (cache) {
                return cache.put(request, copy);
              }),
            );
          }
          return response;
        });
      }),
    );
  });
}
