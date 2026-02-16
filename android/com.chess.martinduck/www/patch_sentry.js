// patch_sentry.js — Runs at document_start, BEFORE any chess.com scripts
// 1) Neutralizes Sentry SDK's instrumentFetch (silently — no errors thrown)
// 2) Blocks chess.com extension detection via fetch probing
(function () {
    'use strict';

    try {
        const nativeFetch = window.fetch.bind(window);
        const origDefineProperty = Object.defineProperty;

        // Proxy fetch that blocks chrome-extension:// probing
        const proxyFetch = function () {
            const url = arguments[0];
            const urlStr = (typeof url === 'string') ? url :
                (url && typeof url.url === 'string') ? url.url : '';
            if (urlStr.startsWith('chrome-extension://') || urlStr.startsWith('moz-extension://')) {
                return Promise.reject(new TypeError('Failed to fetch'));
            }
            return nativeFetch.apply(this, arguments);
        };
        origDefineProperty.call(Object, proxyFetch, 'name', { value: 'fetch', configurable: true });
        origDefineProperty.call(Object, proxyFetch, 'length', { value: 2, configurable: true });

        // Getter/setter to silently absorb Sentry's assignment to window.fetch
        let _currentFetch = proxyFetch;
        origDefineProperty.call(Object, window, 'fetch', {
            get: function () { return _currentFetch; },
            set: function (val) { },
            configurable: false,
            enumerable: true
        });

        // Block Object.defineProperty from redefining window.fetch
        Object.defineProperty = function (obj, prop, descriptor) {
            if (obj === window && prop === 'fetch') return obj;
            return origDefineProperty.call(Object, obj, prop, descriptor);
        };

        // Patch toString so fetch always looks native
        const origToString = Function.prototype.toString;
        Function.prototype.toString = function () {
            if (this === proxyFetch || this === nativeFetch || this === window.fetch) {
                return 'function fetch() { [native code] }';
            }
            return origToString.call(this);
        };

        // Hidden native fetch for our own scripts
        origDefineProperty.call(Object, window, '__mdNativeFetch__', {
            value: nativeFetch,
            writable: false,
            configurable: false,
            enumerable: false
        });

    } catch (e) { }
})();
