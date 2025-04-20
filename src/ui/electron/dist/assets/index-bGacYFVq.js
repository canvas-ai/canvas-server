var vw = Object.defineProperty;
var yw = (e, t, n) => (t in e ? vw(e, t, { enumerable: !0, configurable: !0, writable: !0, value: n }) : (e[t] = n));
var Lt = (e, t, n) => yw(e, typeof t != 'symbol' ? t + '' : t, n);
function ww(e, t) {
    for (var n = 0; n < t.length; n++) {
        const r = t[n];
        if (typeof r != 'string' && !Array.isArray(r)) {
            for (const o in r)
                if (o !== 'default' && !(o in e)) {
                    const i = Object.getOwnPropertyDescriptor(r, o);
                    i && Object.defineProperty(e, o, i.get ? i : { enumerable: !0, get: () => r[o] });
                }
        }
    }
    return Object.freeze(Object.defineProperty(e, Symbol.toStringTag, { value: 'Module' }));
}
(function () {
    const t = document.createElement('link').relList;
    if (t && t.supports && t.supports('modulepreload')) return;
    for (const o of document.querySelectorAll('link[rel="modulepreload"]')) r(o);
    new MutationObserver((o) => {
        for (const i of o)
            if (i.type === 'childList') for (const s of i.addedNodes) s.tagName === 'LINK' && s.rel === 'modulepreload' && r(s);
    }).observe(document, { childList: !0, subtree: !0 });
    function n(o) {
        const i = {};
        return (
            o.integrity && (i.integrity = o.integrity),
            o.referrerPolicy && (i.referrerPolicy = o.referrerPolicy),
            o.crossOrigin === 'use-credentials'
                ? (i.credentials = 'include')
                : o.crossOrigin === 'anonymous'
                  ? (i.credentials = 'omit')
                  : (i.credentials = 'same-origin'),
            i
        );
    }
    function r(o) {
        if (o.ep) return;
        o.ep = !0;
        const i = n(o);
        fetch(o.href, i);
    }
})();
function Hc(e) {
    return e && e.__esModule && Object.prototype.hasOwnProperty.call(e, 'default') ? e.default : e;
}
var Uh = { exports: {} },
    Ws = {},
    Bh = { exports: {} },
    V = {};
/**
 * @license React
 * react.production.min.js
 *
 * Copyright (c) Facebook, Inc. and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */ var Jo = Symbol.for('react.element'),
    Sw = Symbol.for('react.portal'),
    Ew = Symbol.for('react.fragment'),
    xw = Symbol.for('react.strict_mode'),
    Cw = Symbol.for('react.profiler'),
    bw = Symbol.for('react.provider'),
    Tw = Symbol.for('react.context'),
    kw = Symbol.for('react.forward_ref'),
    Rw = Symbol.for('react.suspense'),
    _w = Symbol.for('react.memo'),
    Ow = Symbol.for('react.lazy'),
    Rf = Symbol.iterator;
function Pw(e) {
    return e === null || typeof e != 'object'
        ? null
        : ((e = (Rf && e[Rf]) || e['@@iterator']), typeof e == 'function' ? e : null);
}
var $h = {
        isMounted: function () {
            return !1;
        },
        enqueueForceUpdate: function () {},
        enqueueReplaceState: function () {},
        enqueueSetState: function () {},
    },
    Hh = Object.assign,
    Wh = {};
function Lr(e, t, n) {
    (this.props = e), (this.context = t), (this.refs = Wh), (this.updater = n || $h);
}
Lr.prototype.isReactComponent = {};
Lr.prototype.setState = function (e, t) {
    if (typeof e != 'object' && typeof e != 'function' && e != null)
        throw Error(
            'setState(...): takes an object of state variables to update or a function which returns an object of state variables.',
        );
    this.updater.enqueueSetState(this, e, t, 'setState');
};
Lr.prototype.forceUpdate = function (e) {
    this.updater.enqueueForceUpdate(this, e, 'forceUpdate');
};
function Vh() {}
Vh.prototype = Lr.prototype;
function Wc(e, t, n) {
    (this.props = e), (this.context = t), (this.refs = Wh), (this.updater = n || $h);
}
var Vc = (Wc.prototype = new Vh());
Vc.constructor = Wc;
Hh(Vc, Lr.prototype);
Vc.isPureReactComponent = !0;
var _f = Array.isArray,
    qh = Object.prototype.hasOwnProperty,
    qc = { current: null },
    Gh = { key: !0, ref: !0, __self: !0, __source: !0 };
function Kh(e, t, n) {
    var r,
        o = {},
        i = null,
        s = null;
    if (t != null)
        for (r in (t.ref !== void 0 && (s = t.ref), t.key !== void 0 && (i = '' + t.key), t))
            qh.call(t, r) && !Gh.hasOwnProperty(r) && (o[r] = t[r]);
    var l = arguments.length - 2;
    if (l === 1) o.children = n;
    else if (1 < l) {
        for (var a = Array(l), c = 0; c < l; c++) a[c] = arguments[c + 2];
        o.children = a;
    }
    if (e && e.defaultProps) for (r in ((l = e.defaultProps), l)) o[r] === void 0 && (o[r] = l[r]);
    return { $$typeof: Jo, type: e, key: i, ref: s, props: o, _owner: qc.current };
}
function Nw(e, t) {
    return { $$typeof: Jo, type: e.type, key: t, ref: e.ref, props: e.props, _owner: e._owner };
}
function Gc(e) {
    return typeof e == 'object' && e !== null && e.$$typeof === Jo;
}
function Dw(e) {
    var t = { '=': '=0', ':': '=2' };
    return (
        '$' +
        e.replace(/[=:]/g, function (n) {
            return t[n];
        })
    );
}
var Of = /\/+/g;
function _l(e, t) {
    return typeof e == 'object' && e !== null && e.key != null ? Dw('' + e.key) : t.toString(36);
}
function ji(e, t, n, r, o) {
    var i = typeof e;
    (i === 'undefined' || i === 'boolean') && (e = null);
    var s = !1;
    if (e === null) s = !0;
    else
        switch (i) {
            case 'string':
            case 'number':
                s = !0;
                break;
            case 'object':
                switch (e.$$typeof) {
                    case Jo:
                    case Sw:
                        s = !0;
                }
        }
    if (s)
        return (
            (s = e),
            (o = o(s)),
            (e = r === '' ? '.' + _l(s, 0) : r),
            _f(o)
                ? ((n = ''),
                  e != null && (n = e.replace(Of, '$&/') + '/'),
                  ji(o, t, n, '', function (c) {
                      return c;
                  }))
                : o != null &&
                  (Gc(o) &&
                      (o = Nw(o, n + (!o.key || (s && s.key === o.key) ? '' : ('' + o.key).replace(Of, '$&/') + '/') + e)),
                  t.push(o)),
            1
        );
    if (((s = 0), (r = r === '' ? '.' : r + ':'), _f(e)))
        for (var l = 0; l < e.length; l++) {
            i = e[l];
            var a = r + _l(i, l);
            s += ji(i, t, n, a, o);
        }
    else if (((a = Pw(e)), typeof a == 'function'))
        for (e = a.call(e), l = 0; !(i = e.next()).done; ) (i = i.value), (a = r + _l(i, l++)), (s += ji(i, t, n, a, o));
    else if (i === 'object')
        throw (
            ((t = String(e)),
            Error(
                'Objects are not valid as a React child (found: ' +
                    (t === '[object Object]' ? 'object with keys {' + Object.keys(e).join(', ') + '}' : t) +
                    '). If you meant to render a collection of children, use an array instead.',
            ))
        );
    return s;
}
function ui(e, t, n) {
    if (e == null) return e;
    var r = [],
        o = 0;
    return (
        ji(e, r, '', '', function (i) {
            return t.call(n, i, o++);
        }),
        r
    );
}
function Aw(e) {
    if (e._status === -1) {
        var t = e._result;
        (t = t()),
            t.then(
                function (n) {
                    (e._status === 0 || e._status === -1) && ((e._status = 1), (e._result = n));
                },
                function (n) {
                    (e._status === 0 || e._status === -1) && ((e._status = 2), (e._result = n));
                },
            ),
            e._status === -1 && ((e._status = 0), (e._result = t));
    }
    if (e._status === 1) return e._result.default;
    throw e._result;
}
var Ne = { current: null },
    zi = { transition: null },
    Iw = { ReactCurrentDispatcher: Ne, ReactCurrentBatchConfig: zi, ReactCurrentOwner: qc };
function Yh() {
    throw Error('act(...) is not supported in production builds of React.');
}
V.Children = {
    map: ui,
    forEach: function (e, t, n) {
        ui(
            e,
            function () {
                t.apply(this, arguments);
            },
            n,
        );
    },
    count: function (e) {
        var t = 0;
        return (
            ui(e, function () {
                t++;
            }),
            t
        );
    },
    toArray: function (e) {
        return (
            ui(e, function (t) {
                return t;
            }) || []
        );
    },
    only: function (e) {
        if (!Gc(e)) throw Error('React.Children.only expected to receive a single React element child.');
        return e;
    },
};
V.Component = Lr;
V.Fragment = Ew;
V.Profiler = Cw;
V.PureComponent = Wc;
V.StrictMode = xw;
V.Suspense = Rw;
V.__SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED = Iw;
V.act = Yh;
V.cloneElement = function (e, t, n) {
    if (e == null) throw Error('React.cloneElement(...): The argument must be a React element, but you passed ' + e + '.');
    var r = Hh({}, e.props),
        o = e.key,
        i = e.ref,
        s = e._owner;
    if (t != null) {
        if (
            (t.ref !== void 0 && ((i = t.ref), (s = qc.current)),
            t.key !== void 0 && (o = '' + t.key),
            e.type && e.type.defaultProps)
        )
            var l = e.type.defaultProps;
        for (a in t) qh.call(t, a) && !Gh.hasOwnProperty(a) && (r[a] = t[a] === void 0 && l !== void 0 ? l[a] : t[a]);
    }
    var a = arguments.length - 2;
    if (a === 1) r.children = n;
    else if (1 < a) {
        l = Array(a);
        for (var c = 0; c < a; c++) l[c] = arguments[c + 2];
        r.children = l;
    }
    return { $$typeof: Jo, type: e.type, key: o, ref: i, props: r, _owner: s };
};
V.createContext = function (e) {
    return (
        (e = {
            $$typeof: Tw,
            _currentValue: e,
            _currentValue2: e,
            _threadCount: 0,
            Provider: null,
            Consumer: null,
            _defaultValue: null,
            _globalName: null,
        }),
        (e.Provider = { $$typeof: bw, _context: e }),
        (e.Consumer = e)
    );
};
V.createElement = Kh;
V.createFactory = function (e) {
    var t = Kh.bind(null, e);
    return (t.type = e), t;
};
V.createRef = function () {
    return { current: null };
};
V.forwardRef = function (e) {
    return { $$typeof: kw, render: e };
};
V.isValidElement = Gc;
V.lazy = function (e) {
    return { $$typeof: Ow, _payload: { _status: -1, _result: e }, _init: Aw };
};
V.memo = function (e, t) {
    return { $$typeof: _w, type: e, compare: t === void 0 ? null : t };
};
V.startTransition = function (e) {
    var t = zi.transition;
    zi.transition = {};
    try {
        e();
    } finally {
        zi.transition = t;
    }
};
V.unstable_act = Yh;
V.useCallback = function (e, t) {
    return Ne.current.useCallback(e, t);
};
V.useContext = function (e) {
    return Ne.current.useContext(e);
};
V.useDebugValue = function () {};
V.useDeferredValue = function (e) {
    return Ne.current.useDeferredValue(e);
};
V.useEffect = function (e, t) {
    return Ne.current.useEffect(e, t);
};
V.useId = function () {
    return Ne.current.useId();
};
V.useImperativeHandle = function (e, t, n) {
    return Ne.current.useImperativeHandle(e, t, n);
};
V.useInsertionEffect = function (e, t) {
    return Ne.current.useInsertionEffect(e, t);
};
V.useLayoutEffect = function (e, t) {
    return Ne.current.useLayoutEffect(e, t);
};
V.useMemo = function (e, t) {
    return Ne.current.useMemo(e, t);
};
V.useReducer = function (e, t, n) {
    return Ne.current.useReducer(e, t, n);
};
V.useRef = function (e) {
    return Ne.current.useRef(e);
};
V.useState = function (e) {
    return Ne.current.useState(e);
};
V.useSyncExternalStore = function (e, t, n) {
    return Ne.current.useSyncExternalStore(e, t, n);
};
V.useTransition = function () {
    return Ne.current.useTransition();
};
V.version = '18.3.1';
Bh.exports = V;
var g = Bh.exports;
const jt = Hc(g),
    Mw = ww({ __proto__: null, default: jt }, [g]);
/**
 * @license React
 * react-jsx-runtime.production.min.js
 *
 * Copyright (c) Facebook, Inc. and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */ var Lw = g,
    Fw = Symbol.for('react.element'),
    jw = Symbol.for('react.fragment'),
    zw = Object.prototype.hasOwnProperty,
    Uw = Lw.__SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED.ReactCurrentOwner,
    Bw = { key: !0, ref: !0, __self: !0, __source: !0 };
function Xh(e, t, n) {
    var r,
        o = {},
        i = null,
        s = null;
    n !== void 0 && (i = '' + n), t.key !== void 0 && (i = '' + t.key), t.ref !== void 0 && (s = t.ref);
    for (r in t) zw.call(t, r) && !Bw.hasOwnProperty(r) && (o[r] = t[r]);
    if (e && e.defaultProps) for (r in ((t = e.defaultProps), t)) o[r] === void 0 && (o[r] = t[r]);
    return { $$typeof: Fw, type: e, key: i, ref: s, props: o, _owner: Uw.current };
}
Ws.Fragment = jw;
Ws.jsx = Xh;
Ws.jsxs = Xh;
Uh.exports = Ws;
var E = Uh.exports,
    Ca = {},
    Qh = { exports: {} },
    Xe = {},
    Jh = { exports: {} },
    Zh = {};
/**
 * @license React
 * scheduler.production.min.js
 *
 * Copyright (c) Facebook, Inc. and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */ (function (e) {
    function t(O, P) {
        var M = O.length;
        O.push(P);
        e: for (; 0 < M; ) {
            var F = (M - 1) >>> 1,
                Y = O[F];
            if (0 < o(Y, P)) (O[F] = P), (O[M] = Y), (M = F);
            else break e;
        }
    }
    function n(O) {
        return O.length === 0 ? null : O[0];
    }
    function r(O) {
        if (O.length === 0) return null;
        var P = O[0],
            M = O.pop();
        if (M !== P) {
            O[0] = M;
            e: for (var F = 0, Y = O.length, xt = Y >>> 1; F < xt; ) {
                var Be = 2 * (F + 1) - 1,
                    Jt = O[Be],
                    _e = Be + 1,
                    Ae = O[_e];
                if (0 > o(Jt, M))
                    _e < Y && 0 > o(Ae, Jt) ? ((O[F] = Ae), (O[_e] = M), (F = _e)) : ((O[F] = Jt), (O[Be] = M), (F = Be));
                else if (_e < Y && 0 > o(Ae, M)) (O[F] = Ae), (O[_e] = M), (F = _e);
                else break e;
            }
        }
        return P;
    }
    function o(O, P) {
        var M = O.sortIndex - P.sortIndex;
        return M !== 0 ? M : O.id - P.id;
    }
    if (typeof performance == 'object' && typeof performance.now == 'function') {
        var i = performance;
        e.unstable_now = function () {
            return i.now();
        };
    } else {
        var s = Date,
            l = s.now();
        e.unstable_now = function () {
            return s.now() - l;
        };
    }
    var a = [],
        c = [],
        u = 1,
        f = null,
        d = 3,
        y = !1,
        m = !1,
        v = !1,
        S = typeof setTimeout == 'function' ? setTimeout : null,
        h = typeof clearTimeout == 'function' ? clearTimeout : null,
        p = typeof setImmediate < 'u' ? setImmediate : null;
    typeof navigator < 'u' &&
        navigator.scheduling !== void 0 &&
        navigator.scheduling.isInputPending !== void 0 &&
        navigator.scheduling.isInputPending.bind(navigator.scheduling);
    function w(O) {
        for (var P = n(c); P !== null; ) {
            if (P.callback === null) r(c);
            else if (P.startTime <= O) r(c), (P.sortIndex = P.expirationTime), t(a, P);
            else break;
            P = n(c);
        }
    }
    function C(O) {
        if (((v = !1), w(O), !m))
            if (n(a) !== null) (m = !0), W(T);
            else {
                var P = n(c);
                P !== null && Q(C, P.startTime - O);
            }
    }
    function T(O, P) {
        (m = !1), v && ((v = !1), h(x), (x = -1)), (y = !0);
        var M = d;
        try {
            for (w(P), f = n(a); f !== null && (!(f.expirationTime > P) || (O && !L())); ) {
                var F = f.callback;
                if (typeof F == 'function') {
                    (f.callback = null), (d = f.priorityLevel);
                    var Y = F(f.expirationTime <= P);
                    (P = e.unstable_now()), typeof Y == 'function' ? (f.callback = Y) : f === n(a) && r(a), w(P);
                } else r(a);
                f = n(a);
            }
            if (f !== null) var xt = !0;
            else {
                var Be = n(c);
                Be !== null && Q(C, Be.startTime - P), (xt = !1);
            }
            return xt;
        } finally {
            (f = null), (d = M), (y = !1);
        }
    }
    var _ = !1,
        b = null,
        x = -1,
        R = 5,
        N = -1;
    function L() {
        return !(e.unstable_now() - N < R);
    }
    function I() {
        if (b !== null) {
            var O = e.unstable_now();
            N = O;
            var P = !0;
            try {
                P = b(!0, O);
            } finally {
                P ? z() : ((_ = !1), (b = null));
            }
        } else _ = !1;
    }
    var z;
    if (typeof p == 'function')
        z = function () {
            p(I);
        };
    else if (typeof MessageChannel < 'u') {
        var j = new MessageChannel(),
            le = j.port2;
        (j.port1.onmessage = I),
            (z = function () {
                le.postMessage(null);
            });
    } else
        z = function () {
            S(I, 0);
        };
    function W(O) {
        (b = O), _ || ((_ = !0), z());
    }
    function Q(O, P) {
        x = S(function () {
            O(e.unstable_now());
        }, P);
    }
    (e.unstable_IdlePriority = 5),
        (e.unstable_ImmediatePriority = 1),
        (e.unstable_LowPriority = 4),
        (e.unstable_NormalPriority = 3),
        (e.unstable_Profiling = null),
        (e.unstable_UserBlockingPriority = 2),
        (e.unstable_cancelCallback = function (O) {
            O.callback = null;
        }),
        (e.unstable_continueExecution = function () {
            m || y || ((m = !0), W(T));
        }),
        (e.unstable_forceFrameRate = function (O) {
            0 > O || 125 < O
                ? console.error(
                      'forceFrameRate takes a positive int between 0 and 125, forcing frame rates higher than 125 fps is not supported',
                  )
                : (R = 0 < O ? Math.floor(1e3 / O) : 5);
        }),
        (e.unstable_getCurrentPriorityLevel = function () {
            return d;
        }),
        (e.unstable_getFirstCallbackNode = function () {
            return n(a);
        }),
        (e.unstable_next = function (O) {
            switch (d) {
                case 1:
                case 2:
                case 3:
                    var P = 3;
                    break;
                default:
                    P = d;
            }
            var M = d;
            d = P;
            try {
                return O();
            } finally {
                d = M;
            }
        }),
        (e.unstable_pauseExecution = function () {}),
        (e.unstable_requestPaint = function () {}),
        (e.unstable_runWithPriority = function (O, P) {
            switch (O) {
                case 1:
                case 2:
                case 3:
                case 4:
                case 5:
                    break;
                default:
                    O = 3;
            }
            var M = d;
            d = O;
            try {
                return P();
            } finally {
                d = M;
            }
        }),
        (e.unstable_scheduleCallback = function (O, P, M) {
            var F = e.unstable_now();
            switch (
                (typeof M == 'object' && M !== null
                    ? ((M = M.delay), (M = typeof M == 'number' && 0 < M ? F + M : F))
                    : (M = F),
                O)
            ) {
                case 1:
                    var Y = -1;
                    break;
                case 2:
                    Y = 250;
                    break;
                case 5:
                    Y = 1073741823;
                    break;
                case 4:
                    Y = 1e4;
                    break;
                default:
                    Y = 5e3;
            }
            return (
                (Y = M + Y),
                (O = { id: u++, callback: P, priorityLevel: O, startTime: M, expirationTime: Y, sortIndex: -1 }),
                M > F
                    ? ((O.sortIndex = M),
                      t(c, O),
                      n(a) === null && O === n(c) && (v ? (h(x), (x = -1)) : (v = !0), Q(C, M - F)))
                    : ((O.sortIndex = Y), t(a, O), m || y || ((m = !0), W(T))),
                O
            );
        }),
        (e.unstable_shouldYield = L),
        (e.unstable_wrapCallback = function (O) {
            var P = d;
            return function () {
                var M = d;
                d = P;
                try {
                    return O.apply(this, arguments);
                } finally {
                    d = M;
                }
            };
        });
})(Zh);
Jh.exports = Zh;
var $w = Jh.exports;
/**
 * @license React
 * react-dom.production.min.js
 *
 * Copyright (c) Facebook, Inc. and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */ var Hw = g,
    Ke = $w;
function D(e) {
    for (var t = 'https://reactjs.org/docs/error-decoder.html?invariant=' + e, n = 1; n < arguments.length; n++)
        t += '&args[]=' + encodeURIComponent(arguments[n]);
    return (
        'Minified React error #' +
        e +
        '; visit ' +
        t +
        ' for the full message or use the non-minified dev environment for full errors and additional helpful warnings.'
    );
}
var ep = new Set(),
    _o = {};
function Xn(e, t) {
    Rr(e, t), Rr(e + 'Capture', t);
}
function Rr(e, t) {
    for (_o[e] = t, e = 0; e < t.length; e++) ep.add(t[e]);
}
var Wt = !(typeof window > 'u' || typeof window.document > 'u' || typeof window.document.createElement > 'u'),
    ba = Object.prototype.hasOwnProperty,
    Ww =
        /^[:A-Z_a-z\u00C0-\u00D6\u00D8-\u00F6\u00F8-\u02FF\u0370-\u037D\u037F-\u1FFF\u200C-\u200D\u2070-\u218F\u2C00-\u2FEF\u3001-\uD7FF\uF900-\uFDCF\uFDF0-\uFFFD][:A-Z_a-z\u00C0-\u00D6\u00D8-\u00F6\u00F8-\u02FF\u0370-\u037D\u037F-\u1FFF\u200C-\u200D\u2070-\u218F\u2C00-\u2FEF\u3001-\uD7FF\uF900-\uFDCF\uFDF0-\uFFFD\-.0-9\u00B7\u0300-\u036F\u203F-\u2040]*$/,
    Pf = {},
    Nf = {};
function Vw(e) {
    return ba.call(Nf, e) ? !0 : ba.call(Pf, e) ? !1 : Ww.test(e) ? (Nf[e] = !0) : ((Pf[e] = !0), !1);
}
function qw(e, t, n, r) {
    if (n !== null && n.type === 0) return !1;
    switch (typeof t) {
        case 'function':
        case 'symbol':
            return !0;
        case 'boolean':
            return r
                ? !1
                : n !== null
                  ? !n.acceptsBooleans
                  : ((e = e.toLowerCase().slice(0, 5)), e !== 'data-' && e !== 'aria-');
        default:
            return !1;
    }
}
function Gw(e, t, n, r) {
    if (t === null || typeof t > 'u' || qw(e, t, n, r)) return !0;
    if (r) return !1;
    if (n !== null)
        switch (n.type) {
            case 3:
                return !t;
            case 4:
                return t === !1;
            case 5:
                return isNaN(t);
            case 6:
                return isNaN(t) || 1 > t;
        }
    return !1;
}
function De(e, t, n, r, o, i, s) {
    (this.acceptsBooleans = t === 2 || t === 3 || t === 4),
        (this.attributeName = r),
        (this.attributeNamespace = o),
        (this.mustUseProperty = n),
        (this.propertyName = e),
        (this.type = t),
        (this.sanitizeURL = i),
        (this.removeEmptyString = s);
}
var Ee = {};
'children dangerouslySetInnerHTML defaultValue defaultChecked innerHTML suppressContentEditableWarning suppressHydrationWarning style'
    .split(' ')
    .forEach(function (e) {
        Ee[e] = new De(e, 0, !1, e, null, !1, !1);
    });
[
    ['acceptCharset', 'accept-charset'],
    ['className', 'class'],
    ['htmlFor', 'for'],
    ['httpEquiv', 'http-equiv'],
].forEach(function (e) {
    var t = e[0];
    Ee[t] = new De(t, 1, !1, e[1], null, !1, !1);
});
['contentEditable', 'draggable', 'spellCheck', 'value'].forEach(function (e) {
    Ee[e] = new De(e, 2, !1, e.toLowerCase(), null, !1, !1);
});
['autoReverse', 'externalResourcesRequired', 'focusable', 'preserveAlpha'].forEach(function (e) {
    Ee[e] = new De(e, 2, !1, e, null, !1, !1);
});
'allowFullScreen async autoFocus autoPlay controls default defer disabled disablePictureInPicture disableRemotePlayback formNoValidate hidden loop noModule noValidate open playsInline readOnly required reversed scoped seamless itemScope'
    .split(' ')
    .forEach(function (e) {
        Ee[e] = new De(e, 3, !1, e.toLowerCase(), null, !1, !1);
    });
['checked', 'multiple', 'muted', 'selected'].forEach(function (e) {
    Ee[e] = new De(e, 3, !0, e, null, !1, !1);
});
['capture', 'download'].forEach(function (e) {
    Ee[e] = new De(e, 4, !1, e, null, !1, !1);
});
['cols', 'rows', 'size', 'span'].forEach(function (e) {
    Ee[e] = new De(e, 6, !1, e, null, !1, !1);
});
['rowSpan', 'start'].forEach(function (e) {
    Ee[e] = new De(e, 5, !1, e.toLowerCase(), null, !1, !1);
});
var Kc = /[\-:]([a-z])/g;
function Yc(e) {
    return e[1].toUpperCase();
}
'accent-height alignment-baseline arabic-form baseline-shift cap-height clip-path clip-rule color-interpolation color-interpolation-filters color-profile color-rendering dominant-baseline enable-background fill-opacity fill-rule flood-color flood-opacity font-family font-size font-size-adjust font-stretch font-style font-variant font-weight glyph-name glyph-orientation-horizontal glyph-orientation-vertical horiz-adv-x horiz-origin-x image-rendering letter-spacing lighting-color marker-end marker-mid marker-start overline-position overline-thickness paint-order panose-1 pointer-events rendering-intent shape-rendering stop-color stop-opacity strikethrough-position strikethrough-thickness stroke-dasharray stroke-dashoffset stroke-linecap stroke-linejoin stroke-miterlimit stroke-opacity stroke-width text-anchor text-decoration text-rendering underline-position underline-thickness unicode-bidi unicode-range units-per-em v-alphabetic v-hanging v-ideographic v-mathematical vector-effect vert-adv-y vert-origin-x vert-origin-y word-spacing writing-mode xmlns:xlink x-height'
    .split(' ')
    .forEach(function (e) {
        var t = e.replace(Kc, Yc);
        Ee[t] = new De(t, 1, !1, e, null, !1, !1);
    });
'xlink:actuate xlink:arcrole xlink:role xlink:show xlink:title xlink:type'.split(' ').forEach(function (e) {
    var t = e.replace(Kc, Yc);
    Ee[t] = new De(t, 1, !1, e, 'http://www.w3.org/1999/xlink', !1, !1);
});
['xml:base', 'xml:lang', 'xml:space'].forEach(function (e) {
    var t = e.replace(Kc, Yc);
    Ee[t] = new De(t, 1, !1, e, 'http://www.w3.org/XML/1998/namespace', !1, !1);
});
['tabIndex', 'crossOrigin'].forEach(function (e) {
    Ee[e] = new De(e, 1, !1, e.toLowerCase(), null, !1, !1);
});
Ee.xlinkHref = new De('xlinkHref', 1, !1, 'xlink:href', 'http://www.w3.org/1999/xlink', !0, !1);
['src', 'href', 'action', 'formAction'].forEach(function (e) {
    Ee[e] = new De(e, 1, !1, e.toLowerCase(), null, !0, !0);
});
function Xc(e, t, n, r) {
    var o = Ee.hasOwnProperty(t) ? Ee[t] : null;
    (o !== null ? o.type !== 0 : r || !(2 < t.length) || (t[0] !== 'o' && t[0] !== 'O') || (t[1] !== 'n' && t[1] !== 'N')) &&
        (Gw(t, n, o, r) && (n = null),
        r || o === null
            ? Vw(t) && (n === null ? e.removeAttribute(t) : e.setAttribute(t, '' + n))
            : o.mustUseProperty
              ? (e[o.propertyName] = n === null ? (o.type === 3 ? !1 : '') : n)
              : ((t = o.attributeName),
                (r = o.attributeNamespace),
                n === null
                    ? e.removeAttribute(t)
                    : ((o = o.type),
                      (n = o === 3 || (o === 4 && n === !0) ? '' : '' + n),
                      r ? e.setAttributeNS(r, t, n) : e.setAttribute(t, n))));
}
var Xt = Hw.__SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED,
    fi = Symbol.for('react.element'),
    ir = Symbol.for('react.portal'),
    sr = Symbol.for('react.fragment'),
    Qc = Symbol.for('react.strict_mode'),
    Ta = Symbol.for('react.profiler'),
    tp = Symbol.for('react.provider'),
    np = Symbol.for('react.context'),
    Jc = Symbol.for('react.forward_ref'),
    ka = Symbol.for('react.suspense'),
    Ra = Symbol.for('react.suspense_list'),
    Zc = Symbol.for('react.memo'),
    on = Symbol.for('react.lazy'),
    rp = Symbol.for('react.offscreen'),
    Df = Symbol.iterator;
function Qr(e) {
    return e === null || typeof e != 'object'
        ? null
        : ((e = (Df && e[Df]) || e['@@iterator']), typeof e == 'function' ? e : null);
}
var ie = Object.assign,
    Ol;
function co(e) {
    if (Ol === void 0)
        try {
            throw Error();
        } catch (n) {
            var t = n.stack.trim().match(/\n( *(at )?)/);
            Ol = (t && t[1]) || '';
        }
    return (
        `
` +
        Ol +
        e
    );
}
var Pl = !1;
function Nl(e, t) {
    if (!e || Pl) return '';
    Pl = !0;
    var n = Error.prepareStackTrace;
    Error.prepareStackTrace = void 0;
    try {
        if (t)
            if (
                ((t = function () {
                    throw Error();
                }),
                Object.defineProperty(t.prototype, 'props', {
                    set: function () {
                        throw Error();
                    },
                }),
                typeof Reflect == 'object' && Reflect.construct)
            ) {
                try {
                    Reflect.construct(t, []);
                } catch (c) {
                    var r = c;
                }
                Reflect.construct(e, [], t);
            } else {
                try {
                    t.call();
                } catch (c) {
                    r = c;
                }
                e.call(t.prototype);
            }
        else {
            try {
                throw Error();
            } catch (c) {
                r = c;
            }
            e();
        }
    } catch (c) {
        if (c && r && typeof c.stack == 'string') {
            for (
                var o = c.stack.split(`
`),
                    i = r.stack.split(`
`),
                    s = o.length - 1,
                    l = i.length - 1;
                1 <= s && 0 <= l && o[s] !== i[l];

            )
                l--;
            for (; 1 <= s && 0 <= l; s--, l--)
                if (o[s] !== i[l]) {
                    if (s !== 1 || l !== 1)
                        do
                            if ((s--, l--, 0 > l || o[s] !== i[l])) {
                                var a =
                                    `
` + o[s].replace(' at new ', ' at ');
                                return (
                                    e.displayName && a.includes('<anonymous>') && (a = a.replace('<anonymous>', e.displayName)),
                                    a
                                );
                            }
                        while (1 <= s && 0 <= l);
                    break;
                }
        }
    } finally {
        (Pl = !1), (Error.prepareStackTrace = n);
    }
    return (e = e ? e.displayName || e.name : '') ? co(e) : '';
}
function Kw(e) {
    switch (e.tag) {
        case 5:
            return co(e.type);
        case 16:
            return co('Lazy');
        case 13:
            return co('Suspense');
        case 19:
            return co('SuspenseList');
        case 0:
        case 2:
        case 15:
            return (e = Nl(e.type, !1)), e;
        case 11:
            return (e = Nl(e.type.render, !1)), e;
        case 1:
            return (e = Nl(e.type, !0)), e;
        default:
            return '';
    }
}
function _a(e) {
    if (e == null) return null;
    if (typeof e == 'function') return e.displayName || e.name || null;
    if (typeof e == 'string') return e;
    switch (e) {
        case sr:
            return 'Fragment';
        case ir:
            return 'Portal';
        case Ta:
            return 'Profiler';
        case Qc:
            return 'StrictMode';
        case ka:
            return 'Suspense';
        case Ra:
            return 'SuspenseList';
    }
    if (typeof e == 'object')
        switch (e.$$typeof) {
            case np:
                return (e.displayName || 'Context') + '.Consumer';
            case tp:
                return (e._context.displayName || 'Context') + '.Provider';
            case Jc:
                var t = e.render;
                return (
                    (e = e.displayName),
                    e || ((e = t.displayName || t.name || ''), (e = e !== '' ? 'ForwardRef(' + e + ')' : 'ForwardRef')),
                    e
                );
            case Zc:
                return (t = e.displayName || null), t !== null ? t : _a(e.type) || 'Memo';
            case on:
                (t = e._payload), (e = e._init);
                try {
                    return _a(e(t));
                } catch {}
        }
    return null;
}
function Yw(e) {
    var t = e.type;
    switch (e.tag) {
        case 24:
            return 'Cache';
        case 9:
            return (t.displayName || 'Context') + '.Consumer';
        case 10:
            return (t._context.displayName || 'Context') + '.Provider';
        case 18:
            return 'DehydratedFragment';
        case 11:
            return (
                (e = t.render),
                (e = e.displayName || e.name || ''),
                t.displayName || (e !== '' ? 'ForwardRef(' + e + ')' : 'ForwardRef')
            );
        case 7:
            return 'Fragment';
        case 5:
            return t;
        case 4:
            return 'Portal';
        case 3:
            return 'Root';
        case 6:
            return 'Text';
        case 16:
            return _a(t);
        case 8:
            return t === Qc ? 'StrictMode' : 'Mode';
        case 22:
            return 'Offscreen';
        case 12:
            return 'Profiler';
        case 21:
            return 'Scope';
        case 13:
            return 'Suspense';
        case 19:
            return 'SuspenseList';
        case 25:
            return 'TracingMarker';
        case 1:
        case 0:
        case 17:
        case 2:
        case 14:
        case 15:
            if (typeof t == 'function') return t.displayName || t.name || null;
            if (typeof t == 'string') return t;
    }
    return null;
}
function Sn(e) {
    switch (typeof e) {
        case 'boolean':
        case 'number':
        case 'string':
        case 'undefined':
            return e;
        case 'object':
            return e;
        default:
            return '';
    }
}
function op(e) {
    var t = e.type;
    return (e = e.nodeName) && e.toLowerCase() === 'input' && (t === 'checkbox' || t === 'radio');
}
function Xw(e) {
    var t = op(e) ? 'checked' : 'value',
        n = Object.getOwnPropertyDescriptor(e.constructor.prototype, t),
        r = '' + e[t];
    if (!e.hasOwnProperty(t) && typeof n < 'u' && typeof n.get == 'function' && typeof n.set == 'function') {
        var o = n.get,
            i = n.set;
        return (
            Object.defineProperty(e, t, {
                configurable: !0,
                get: function () {
                    return o.call(this);
                },
                set: function (s) {
                    (r = '' + s), i.call(this, s);
                },
            }),
            Object.defineProperty(e, t, { enumerable: n.enumerable }),
            {
                getValue: function () {
                    return r;
                },
                setValue: function (s) {
                    r = '' + s;
                },
                stopTracking: function () {
                    (e._valueTracker = null), delete e[t];
                },
            }
        );
    }
}
function di(e) {
    e._valueTracker || (e._valueTracker = Xw(e));
}
function ip(e) {
    if (!e) return !1;
    var t = e._valueTracker;
    if (!t) return !0;
    var n = t.getValue(),
        r = '';
    return e && (r = op(e) ? (e.checked ? 'true' : 'false') : e.value), (e = r), e !== n ? (t.setValue(e), !0) : !1;
}
function cs(e) {
    if (((e = e || (typeof document < 'u' ? document : void 0)), typeof e > 'u')) return null;
    try {
        return e.activeElement || e.body;
    } catch {
        return e.body;
    }
}
function Oa(e, t) {
    var n = t.checked;
    return ie({}, t, {
        defaultChecked: void 0,
        defaultValue: void 0,
        value: void 0,
        checked: n ?? e._wrapperState.initialChecked,
    });
}
function Af(e, t) {
    var n = t.defaultValue == null ? '' : t.defaultValue,
        r = t.checked != null ? t.checked : t.defaultChecked;
    (n = Sn(t.value != null ? t.value : n)),
        (e._wrapperState = {
            initialChecked: r,
            initialValue: n,
            controlled: t.type === 'checkbox' || t.type === 'radio' ? t.checked != null : t.value != null,
        });
}
function sp(e, t) {
    (t = t.checked), t != null && Xc(e, 'checked', t, !1);
}
function Pa(e, t) {
    sp(e, t);
    var n = Sn(t.value),
        r = t.type;
    if (n != null)
        r === 'number'
            ? ((n === 0 && e.value === '') || e.value != n) && (e.value = '' + n)
            : e.value !== '' + n && (e.value = '' + n);
    else if (r === 'submit' || r === 'reset') {
        e.removeAttribute('value');
        return;
    }
    t.hasOwnProperty('value') ? Na(e, t.type, n) : t.hasOwnProperty('defaultValue') && Na(e, t.type, Sn(t.defaultValue)),
        t.checked == null && t.defaultChecked != null && (e.defaultChecked = !!t.defaultChecked);
}
function If(e, t, n) {
    if (t.hasOwnProperty('value') || t.hasOwnProperty('defaultValue')) {
        var r = t.type;
        if (!((r !== 'submit' && r !== 'reset') || (t.value !== void 0 && t.value !== null))) return;
        (t = '' + e._wrapperState.initialValue), n || t === e.value || (e.value = t), (e.defaultValue = t);
    }
    (n = e.name), n !== '' && (e.name = ''), (e.defaultChecked = !!e._wrapperState.initialChecked), n !== '' && (e.name = n);
}
function Na(e, t, n) {
    (t !== 'number' || cs(e.ownerDocument) !== e) &&
        (n == null
            ? (e.defaultValue = '' + e._wrapperState.initialValue)
            : e.defaultValue !== '' + n && (e.defaultValue = '' + n));
}
var uo = Array.isArray;
function vr(e, t, n, r) {
    if (((e = e.options), t)) {
        t = {};
        for (var o = 0; o < n.length; o++) t['$' + n[o]] = !0;
        for (n = 0; n < e.length; n++)
            (o = t.hasOwnProperty('$' + e[n].value)),
                e[n].selected !== o && (e[n].selected = o),
                o && r && (e[n].defaultSelected = !0);
    } else {
        for (n = '' + Sn(n), t = null, o = 0; o < e.length; o++) {
            if (e[o].value === n) {
                (e[o].selected = !0), r && (e[o].defaultSelected = !0);
                return;
            }
            t !== null || e[o].disabled || (t = e[o]);
        }
        t !== null && (t.selected = !0);
    }
}
function Da(e, t) {
    if (t.dangerouslySetInnerHTML != null) throw Error(D(91));
    return ie({}, t, { value: void 0, defaultValue: void 0, children: '' + e._wrapperState.initialValue });
}
function Mf(e, t) {
    var n = t.value;
    if (n == null) {
        if (((n = t.children), (t = t.defaultValue), n != null)) {
            if (t != null) throw Error(D(92));
            if (uo(n)) {
                if (1 < n.length) throw Error(D(93));
                n = n[0];
            }
            t = n;
        }
        t == null && (t = ''), (n = t);
    }
    e._wrapperState = { initialValue: Sn(n) };
}
function lp(e, t) {
    var n = Sn(t.value),
        r = Sn(t.defaultValue);
    n != null &&
        ((n = '' + n), n !== e.value && (e.value = n), t.defaultValue == null && e.defaultValue !== n && (e.defaultValue = n)),
        r != null && (e.defaultValue = '' + r);
}
function Lf(e) {
    var t = e.textContent;
    t === e._wrapperState.initialValue && t !== '' && t !== null && (e.value = t);
}
function ap(e) {
    switch (e) {
        case 'svg':
            return 'http://www.w3.org/2000/svg';
        case 'math':
            return 'http://www.w3.org/1998/Math/MathML';
        default:
            return 'http://www.w3.org/1999/xhtml';
    }
}
function Aa(e, t) {
    return e == null || e === 'http://www.w3.org/1999/xhtml'
        ? ap(t)
        : e === 'http://www.w3.org/2000/svg' && t === 'foreignObject'
          ? 'http://www.w3.org/1999/xhtml'
          : e;
}
var hi,
    cp = (function (e) {
        return typeof MSApp < 'u' && MSApp.execUnsafeLocalFunction
            ? function (t, n, r, o) {
                  MSApp.execUnsafeLocalFunction(function () {
                      return e(t, n, r, o);
                  });
              }
            : e;
    })(function (e, t) {
        if (e.namespaceURI !== 'http://www.w3.org/2000/svg' || 'innerHTML' in e) e.innerHTML = t;
        else {
            for (
                hi = hi || document.createElement('div'),
                    hi.innerHTML = '<svg>' + t.valueOf().toString() + '</svg>',
                    t = hi.firstChild;
                e.firstChild;

            )
                e.removeChild(e.firstChild);
            for (; t.firstChild; ) e.appendChild(t.firstChild);
        }
    });
function Oo(e, t) {
    if (t) {
        var n = e.firstChild;
        if (n && n === e.lastChild && n.nodeType === 3) {
            n.nodeValue = t;
            return;
        }
    }
    e.textContent = t;
}
var yo = {
        animationIterationCount: !0,
        aspectRatio: !0,
        borderImageOutset: !0,
        borderImageSlice: !0,
        borderImageWidth: !0,
        boxFlex: !0,
        boxFlexGroup: !0,
        boxOrdinalGroup: !0,
        columnCount: !0,
        columns: !0,
        flex: !0,
        flexGrow: !0,
        flexPositive: !0,
        flexShrink: !0,
        flexNegative: !0,
        flexOrder: !0,
        gridArea: !0,
        gridRow: !0,
        gridRowEnd: !0,
        gridRowSpan: !0,
        gridRowStart: !0,
        gridColumn: !0,
        gridColumnEnd: !0,
        gridColumnSpan: !0,
        gridColumnStart: !0,
        fontWeight: !0,
        lineClamp: !0,
        lineHeight: !0,
        opacity: !0,
        order: !0,
        orphans: !0,
        tabSize: !0,
        widows: !0,
        zIndex: !0,
        zoom: !0,
        fillOpacity: !0,
        floodOpacity: !0,
        stopOpacity: !0,
        strokeDasharray: !0,
        strokeDashoffset: !0,
        strokeMiterlimit: !0,
        strokeOpacity: !0,
        strokeWidth: !0,
    },
    Qw = ['Webkit', 'ms', 'Moz', 'O'];
Object.keys(yo).forEach(function (e) {
    Qw.forEach(function (t) {
        (t = t + e.charAt(0).toUpperCase() + e.substring(1)), (yo[t] = yo[e]);
    });
});
function up(e, t, n) {
    return t == null || typeof t == 'boolean' || t === ''
        ? ''
        : n || typeof t != 'number' || t === 0 || (yo.hasOwnProperty(e) && yo[e])
          ? ('' + t).trim()
          : t + 'px';
}
function fp(e, t) {
    e = e.style;
    for (var n in t)
        if (t.hasOwnProperty(n)) {
            var r = n.indexOf('--') === 0,
                o = up(n, t[n], r);
            n === 'float' && (n = 'cssFloat'), r ? e.setProperty(n, o) : (e[n] = o);
        }
}
var Jw = ie(
    { menuitem: !0 },
    {
        area: !0,
        base: !0,
        br: !0,
        col: !0,
        embed: !0,
        hr: !0,
        img: !0,
        input: !0,
        keygen: !0,
        link: !0,
        meta: !0,
        param: !0,
        source: !0,
        track: !0,
        wbr: !0,
    },
);
function Ia(e, t) {
    if (t) {
        if (Jw[e] && (t.children != null || t.dangerouslySetInnerHTML != null)) throw Error(D(137, e));
        if (t.dangerouslySetInnerHTML != null) {
            if (t.children != null) throw Error(D(60));
            if (typeof t.dangerouslySetInnerHTML != 'object' || !('__html' in t.dangerouslySetInnerHTML)) throw Error(D(61));
        }
        if (t.style != null && typeof t.style != 'object') throw Error(D(62));
    }
}
function Ma(e, t) {
    if (e.indexOf('-') === -1) return typeof t.is == 'string';
    switch (e) {
        case 'annotation-xml':
        case 'color-profile':
        case 'font-face':
        case 'font-face-src':
        case 'font-face-uri':
        case 'font-face-format':
        case 'font-face-name':
        case 'missing-glyph':
            return !1;
        default:
            return !0;
    }
}
var La = null;
function eu(e) {
    return (
        (e = e.target || e.srcElement || window),
        e.correspondingUseElement && (e = e.correspondingUseElement),
        e.nodeType === 3 ? e.parentNode : e
    );
}
var Fa = null,
    yr = null,
    wr = null;
function Ff(e) {
    if ((e = ti(e))) {
        if (typeof Fa != 'function') throw Error(D(280));
        var t = e.stateNode;
        t && ((t = Ys(t)), Fa(e.stateNode, e.type, t));
    }
}
function dp(e) {
    yr ? (wr ? wr.push(e) : (wr = [e])) : (yr = e);
}
function hp() {
    if (yr) {
        var e = yr,
            t = wr;
        if (((wr = yr = null), Ff(e), t)) for (e = 0; e < t.length; e++) Ff(t[e]);
    }
}
function pp(e, t) {
    return e(t);
}
function gp() {}
var Dl = !1;
function mp(e, t, n) {
    if (Dl) return e(t, n);
    Dl = !0;
    try {
        return pp(e, t, n);
    } finally {
        (Dl = !1), (yr !== null || wr !== null) && (gp(), hp());
    }
}
function Po(e, t) {
    var n = e.stateNode;
    if (n === null) return null;
    var r = Ys(n);
    if (r === null) return null;
    n = r[t];
    e: switch (t) {
        case 'onClick':
        case 'onClickCapture':
        case 'onDoubleClick':
        case 'onDoubleClickCapture':
        case 'onMouseDown':
        case 'onMouseDownCapture':
        case 'onMouseMove':
        case 'onMouseMoveCapture':
        case 'onMouseUp':
        case 'onMouseUpCapture':
        case 'onMouseEnter':
            (r = !r.disabled) || ((e = e.type), (r = !(e === 'button' || e === 'input' || e === 'select' || e === 'textarea'))),
                (e = !r);
            break e;
        default:
            e = !1;
    }
    if (e) return null;
    if (n && typeof n != 'function') throw Error(D(231, t, typeof n));
    return n;
}
var ja = !1;
if (Wt)
    try {
        var Jr = {};
        Object.defineProperty(Jr, 'passive', {
            get: function () {
                ja = !0;
            },
        }),
            window.addEventListener('test', Jr, Jr),
            window.removeEventListener('test', Jr, Jr);
    } catch {
        ja = !1;
    }
function Zw(e, t, n, r, o, i, s, l, a) {
    var c = Array.prototype.slice.call(arguments, 3);
    try {
        t.apply(n, c);
    } catch (u) {
        this.onError(u);
    }
}
var wo = !1,
    us = null,
    fs = !1,
    za = null,
    eS = {
        onError: function (e) {
            (wo = !0), (us = e);
        },
    };
function tS(e, t, n, r, o, i, s, l, a) {
    (wo = !1), (us = null), Zw.apply(eS, arguments);
}
function nS(e, t, n, r, o, i, s, l, a) {
    if ((tS.apply(this, arguments), wo)) {
        if (wo) {
            var c = us;
            (wo = !1), (us = null);
        } else throw Error(D(198));
        fs || ((fs = !0), (za = c));
    }
}
function Qn(e) {
    var t = e,
        n = e;
    if (e.alternate) for (; t.return; ) t = t.return;
    else {
        e = t;
        do (t = e), t.flags & 4098 && (n = t.return), (e = t.return);
        while (e);
    }
    return t.tag === 3 ? n : null;
}
function vp(e) {
    if (e.tag === 13) {
        var t = e.memoizedState;
        if ((t === null && ((e = e.alternate), e !== null && (t = e.memoizedState)), t !== null)) return t.dehydrated;
    }
    return null;
}
function jf(e) {
    if (Qn(e) !== e) throw Error(D(188));
}
function rS(e) {
    var t = e.alternate;
    if (!t) {
        if (((t = Qn(e)), t === null)) throw Error(D(188));
        return t !== e ? null : e;
    }
    for (var n = e, r = t; ; ) {
        var o = n.return;
        if (o === null) break;
        var i = o.alternate;
        if (i === null) {
            if (((r = o.return), r !== null)) {
                n = r;
                continue;
            }
            break;
        }
        if (o.child === i.child) {
            for (i = o.child; i; ) {
                if (i === n) return jf(o), e;
                if (i === r) return jf(o), t;
                i = i.sibling;
            }
            throw Error(D(188));
        }
        if (n.return !== r.return) (n = o), (r = i);
        else {
            for (var s = !1, l = o.child; l; ) {
                if (l === n) {
                    (s = !0), (n = o), (r = i);
                    break;
                }
                if (l === r) {
                    (s = !0), (r = o), (n = i);
                    break;
                }
                l = l.sibling;
            }
            if (!s) {
                for (l = i.child; l; ) {
                    if (l === n) {
                        (s = !0), (n = i), (r = o);
                        break;
                    }
                    if (l === r) {
                        (s = !0), (r = i), (n = o);
                        break;
                    }
                    l = l.sibling;
                }
                if (!s) throw Error(D(189));
            }
        }
        if (n.alternate !== r) throw Error(D(190));
    }
    if (n.tag !== 3) throw Error(D(188));
    return n.stateNode.current === n ? e : t;
}
function yp(e) {
    return (e = rS(e)), e !== null ? wp(e) : null;
}
function wp(e) {
    if (e.tag === 5 || e.tag === 6) return e;
    for (e = e.child; e !== null; ) {
        var t = wp(e);
        if (t !== null) return t;
        e = e.sibling;
    }
    return null;
}
var Sp = Ke.unstable_scheduleCallback,
    zf = Ke.unstable_cancelCallback,
    oS = Ke.unstable_shouldYield,
    iS = Ke.unstable_requestPaint,
    ae = Ke.unstable_now,
    sS = Ke.unstable_getCurrentPriorityLevel,
    tu = Ke.unstable_ImmediatePriority,
    Ep = Ke.unstable_UserBlockingPriority,
    ds = Ke.unstable_NormalPriority,
    lS = Ke.unstable_LowPriority,
    xp = Ke.unstable_IdlePriority,
    Vs = null,
    _t = null;
function aS(e) {
    if (_t && typeof _t.onCommitFiberRoot == 'function')
        try {
            _t.onCommitFiberRoot(Vs, e, void 0, (e.current.flags & 128) === 128);
        } catch {}
}
var mt = Math.clz32 ? Math.clz32 : fS,
    cS = Math.log,
    uS = Math.LN2;
function fS(e) {
    return (e >>>= 0), e === 0 ? 32 : (31 - ((cS(e) / uS) | 0)) | 0;
}
var pi = 64,
    gi = 4194304;
function fo(e) {
    switch (e & -e) {
        case 1:
            return 1;
        case 2:
            return 2;
        case 4:
            return 4;
        case 8:
            return 8;
        case 16:
            return 16;
        case 32:
            return 32;
        case 64:
        case 128:
        case 256:
        case 512:
        case 1024:
        case 2048:
        case 4096:
        case 8192:
        case 16384:
        case 32768:
        case 65536:
        case 131072:
        case 262144:
        case 524288:
        case 1048576:
        case 2097152:
            return e & 4194240;
        case 4194304:
        case 8388608:
        case 16777216:
        case 33554432:
        case 67108864:
            return e & 130023424;
        case 134217728:
            return 134217728;
        case 268435456:
            return 268435456;
        case 536870912:
            return 536870912;
        case 1073741824:
            return 1073741824;
        default:
            return e;
    }
}
function hs(e, t) {
    var n = e.pendingLanes;
    if (n === 0) return 0;
    var r = 0,
        o = e.suspendedLanes,
        i = e.pingedLanes,
        s = n & 268435455;
    if (s !== 0) {
        var l = s & ~o;
        l !== 0 ? (r = fo(l)) : ((i &= s), i !== 0 && (r = fo(i)));
    } else (s = n & ~o), s !== 0 ? (r = fo(s)) : i !== 0 && (r = fo(i));
    if (r === 0) return 0;
    if (t !== 0 && t !== r && !(t & o) && ((o = r & -r), (i = t & -t), o >= i || (o === 16 && (i & 4194240) !== 0))) return t;
    if ((r & 4 && (r |= n & 16), (t = e.entangledLanes), t !== 0))
        for (e = e.entanglements, t &= r; 0 < t; ) (n = 31 - mt(t)), (o = 1 << n), (r |= e[n]), (t &= ~o);
    return r;
}
function dS(e, t) {
    switch (e) {
        case 1:
        case 2:
        case 4:
            return t + 250;
        case 8:
        case 16:
        case 32:
        case 64:
        case 128:
        case 256:
        case 512:
        case 1024:
        case 2048:
        case 4096:
        case 8192:
        case 16384:
        case 32768:
        case 65536:
        case 131072:
        case 262144:
        case 524288:
        case 1048576:
        case 2097152:
            return t + 5e3;
        case 4194304:
        case 8388608:
        case 16777216:
        case 33554432:
        case 67108864:
            return -1;
        case 134217728:
        case 268435456:
        case 536870912:
        case 1073741824:
            return -1;
        default:
            return -1;
    }
}
function hS(e, t) {
    for (var n = e.suspendedLanes, r = e.pingedLanes, o = e.expirationTimes, i = e.pendingLanes; 0 < i; ) {
        var s = 31 - mt(i),
            l = 1 << s,
            a = o[s];
        a === -1 ? (!(l & n) || l & r) && (o[s] = dS(l, t)) : a <= t && (e.expiredLanes |= l), (i &= ~l);
    }
}
function Ua(e) {
    return (e = e.pendingLanes & -1073741825), e !== 0 ? e : e & 1073741824 ? 1073741824 : 0;
}
function Cp() {
    var e = pi;
    return (pi <<= 1), !(pi & 4194240) && (pi = 64), e;
}
function Al(e) {
    for (var t = [], n = 0; 31 > n; n++) t.push(e);
    return t;
}
function Zo(e, t, n) {
    (e.pendingLanes |= t),
        t !== 536870912 && ((e.suspendedLanes = 0), (e.pingedLanes = 0)),
        (e = e.eventTimes),
        (t = 31 - mt(t)),
        (e[t] = n);
}
function pS(e, t) {
    var n = e.pendingLanes & ~t;
    (e.pendingLanes = t),
        (e.suspendedLanes = 0),
        (e.pingedLanes = 0),
        (e.expiredLanes &= t),
        (e.mutableReadLanes &= t),
        (e.entangledLanes &= t),
        (t = e.entanglements);
    var r = e.eventTimes;
    for (e = e.expirationTimes; 0 < n; ) {
        var o = 31 - mt(n),
            i = 1 << o;
        (t[o] = 0), (r[o] = -1), (e[o] = -1), (n &= ~i);
    }
}
function nu(e, t) {
    var n = (e.entangledLanes |= t);
    for (e = e.entanglements; n; ) {
        var r = 31 - mt(n),
            o = 1 << r;
        (o & t) | (e[r] & t) && (e[r] |= t), (n &= ~o);
    }
}
var X = 0;
function bp(e) {
    return (e &= -e), 1 < e ? (4 < e ? (e & 268435455 ? 16 : 536870912) : 4) : 1;
}
var Tp,
    ru,
    kp,
    Rp,
    _p,
    Ba = !1,
    mi = [],
    fn = null,
    dn = null,
    hn = null,
    No = new Map(),
    Do = new Map(),
    ln = [],
    gS =
        'mousedown mouseup touchcancel touchend touchstart auxclick dblclick pointercancel pointerdown pointerup dragend dragstart drop compositionend compositionstart keydown keypress keyup input textInput copy cut paste click change contextmenu reset submit'.split(
            ' ',
        );
function Uf(e, t) {
    switch (e) {
        case 'focusin':
        case 'focusout':
            fn = null;
            break;
        case 'dragenter':
        case 'dragleave':
            dn = null;
            break;
        case 'mouseover':
        case 'mouseout':
            hn = null;
            break;
        case 'pointerover':
        case 'pointerout':
            No.delete(t.pointerId);
            break;
        case 'gotpointercapture':
        case 'lostpointercapture':
            Do.delete(t.pointerId);
    }
}
function Zr(e, t, n, r, o, i) {
    return e === null || e.nativeEvent !== i
        ? ((e = { blockedOn: t, domEventName: n, eventSystemFlags: r, nativeEvent: i, targetContainers: [o] }),
          t !== null && ((t = ti(t)), t !== null && ru(t)),
          e)
        : ((e.eventSystemFlags |= r), (t = e.targetContainers), o !== null && t.indexOf(o) === -1 && t.push(o), e);
}
function mS(e, t, n, r, o) {
    switch (t) {
        case 'focusin':
            return (fn = Zr(fn, e, t, n, r, o)), !0;
        case 'dragenter':
            return (dn = Zr(dn, e, t, n, r, o)), !0;
        case 'mouseover':
            return (hn = Zr(hn, e, t, n, r, o)), !0;
        case 'pointerover':
            var i = o.pointerId;
            return No.set(i, Zr(No.get(i) || null, e, t, n, r, o)), !0;
        case 'gotpointercapture':
            return (i = o.pointerId), Do.set(i, Zr(Do.get(i) || null, e, t, n, r, o)), !0;
    }
    return !1;
}
function Op(e) {
    var t = In(e.target);
    if (t !== null) {
        var n = Qn(t);
        if (n !== null) {
            if (((t = n.tag), t === 13)) {
                if (((t = vp(n)), t !== null)) {
                    (e.blockedOn = t),
                        _p(e.priority, function () {
                            kp(n);
                        });
                    return;
                }
            } else if (t === 3 && n.stateNode.current.memoizedState.isDehydrated) {
                e.blockedOn = n.tag === 3 ? n.stateNode.containerInfo : null;
                return;
            }
        }
    }
    e.blockedOn = null;
}
function Ui(e) {
    if (e.blockedOn !== null) return !1;
    for (var t = e.targetContainers; 0 < t.length; ) {
        var n = $a(e.domEventName, e.eventSystemFlags, t[0], e.nativeEvent);
        if (n === null) {
            n = e.nativeEvent;
            var r = new n.constructor(n.type, n);
            (La = r), n.target.dispatchEvent(r), (La = null);
        } else return (t = ti(n)), t !== null && ru(t), (e.blockedOn = n), !1;
        t.shift();
    }
    return !0;
}
function Bf(e, t, n) {
    Ui(e) && n.delete(t);
}
function vS() {
    (Ba = !1),
        fn !== null && Ui(fn) && (fn = null),
        dn !== null && Ui(dn) && (dn = null),
        hn !== null && Ui(hn) && (hn = null),
        No.forEach(Bf),
        Do.forEach(Bf);
}
function eo(e, t) {
    e.blockedOn === t &&
        ((e.blockedOn = null), Ba || ((Ba = !0), Ke.unstable_scheduleCallback(Ke.unstable_NormalPriority, vS)));
}
function Ao(e) {
    function t(o) {
        return eo(o, e);
    }
    if (0 < mi.length) {
        eo(mi[0], e);
        for (var n = 1; n < mi.length; n++) {
            var r = mi[n];
            r.blockedOn === e && (r.blockedOn = null);
        }
    }
    for (
        fn !== null && eo(fn, e), dn !== null && eo(dn, e), hn !== null && eo(hn, e), No.forEach(t), Do.forEach(t), n = 0;
        n < ln.length;
        n++
    )
        (r = ln[n]), r.blockedOn === e && (r.blockedOn = null);
    for (; 0 < ln.length && ((n = ln[0]), n.blockedOn === null); ) Op(n), n.blockedOn === null && ln.shift();
}
var Sr = Xt.ReactCurrentBatchConfig,
    ps = !0;
function yS(e, t, n, r) {
    var o = X,
        i = Sr.transition;
    Sr.transition = null;
    try {
        (X = 1), ou(e, t, n, r);
    } finally {
        (X = o), (Sr.transition = i);
    }
}
function wS(e, t, n, r) {
    var o = X,
        i = Sr.transition;
    Sr.transition = null;
    try {
        (X = 4), ou(e, t, n, r);
    } finally {
        (X = o), (Sr.transition = i);
    }
}
function ou(e, t, n, r) {
    if (ps) {
        var o = $a(e, t, n, r);
        if (o === null) Hl(e, t, r, gs, n), Uf(e, r);
        else if (mS(o, e, t, n, r)) r.stopPropagation();
        else if ((Uf(e, r), t & 4 && -1 < gS.indexOf(e))) {
            for (; o !== null; ) {
                var i = ti(o);
                if ((i !== null && Tp(i), (i = $a(e, t, n, r)), i === null && Hl(e, t, r, gs, n), i === o)) break;
                o = i;
            }
            o !== null && r.stopPropagation();
        } else Hl(e, t, r, null, n);
    }
}
var gs = null;
function $a(e, t, n, r) {
    if (((gs = null), (e = eu(r)), (e = In(e)), e !== null))
        if (((t = Qn(e)), t === null)) e = null;
        else if (((n = t.tag), n === 13)) {
            if (((e = vp(t)), e !== null)) return e;
            e = null;
        } else if (n === 3) {
            if (t.stateNode.current.memoizedState.isDehydrated) return t.tag === 3 ? t.stateNode.containerInfo : null;
            e = null;
        } else t !== e && (e = null);
    return (gs = e), null;
}
function Pp(e) {
    switch (e) {
        case 'cancel':
        case 'click':
        case 'close':
        case 'contextmenu':
        case 'copy':
        case 'cut':
        case 'auxclick':
        case 'dblclick':
        case 'dragend':
        case 'dragstart':
        case 'drop':
        case 'focusin':
        case 'focusout':
        case 'input':
        case 'invalid':
        case 'keydown':
        case 'keypress':
        case 'keyup':
        case 'mousedown':
        case 'mouseup':
        case 'paste':
        case 'pause':
        case 'play':
        case 'pointercancel':
        case 'pointerdown':
        case 'pointerup':
        case 'ratechange':
        case 'reset':
        case 'resize':
        case 'seeked':
        case 'submit':
        case 'touchcancel':
        case 'touchend':
        case 'touchstart':
        case 'volumechange':
        case 'change':
        case 'selectionchange':
        case 'textInput':
        case 'compositionstart':
        case 'compositionend':
        case 'compositionupdate':
        case 'beforeblur':
        case 'afterblur':
        case 'beforeinput':
        case 'blur':
        case 'fullscreenchange':
        case 'focus':
        case 'hashchange':
        case 'popstate':
        case 'select':
        case 'selectstart':
            return 1;
        case 'drag':
        case 'dragenter':
        case 'dragexit':
        case 'dragleave':
        case 'dragover':
        case 'mousemove':
        case 'mouseout':
        case 'mouseover':
        case 'pointermove':
        case 'pointerout':
        case 'pointerover':
        case 'scroll':
        case 'toggle':
        case 'touchmove':
        case 'wheel':
        case 'mouseenter':
        case 'mouseleave':
        case 'pointerenter':
        case 'pointerleave':
            return 4;
        case 'message':
            switch (sS()) {
                case tu:
                    return 1;
                case Ep:
                    return 4;
                case ds:
                case lS:
                    return 16;
                case xp:
                    return 536870912;
                default:
                    return 16;
            }
        default:
            return 16;
    }
}
var cn = null,
    iu = null,
    Bi = null;
function Np() {
    if (Bi) return Bi;
    var e,
        t = iu,
        n = t.length,
        r,
        o = 'value' in cn ? cn.value : cn.textContent,
        i = o.length;
    for (e = 0; e < n && t[e] === o[e]; e++);
    var s = n - e;
    for (r = 1; r <= s && t[n - r] === o[i - r]; r++);
    return (Bi = o.slice(e, 1 < r ? 1 - r : void 0));
}
function $i(e) {
    var t = e.keyCode;
    return (
        'charCode' in e ? ((e = e.charCode), e === 0 && t === 13 && (e = 13)) : (e = t),
        e === 10 && (e = 13),
        32 <= e || e === 13 ? e : 0
    );
}
function vi() {
    return !0;
}
function $f() {
    return !1;
}
function Qe(e) {
    function t(n, r, o, i, s) {
        (this._reactName = n),
            (this._targetInst = o),
            (this.type = r),
            (this.nativeEvent = i),
            (this.target = s),
            (this.currentTarget = null);
        for (var l in e) e.hasOwnProperty(l) && ((n = e[l]), (this[l] = n ? n(i) : i[l]));
        return (
            (this.isDefaultPrevented = (i.defaultPrevented != null ? i.defaultPrevented : i.returnValue === !1) ? vi : $f),
            (this.isPropagationStopped = $f),
            this
        );
    }
    return (
        ie(t.prototype, {
            preventDefault: function () {
                this.defaultPrevented = !0;
                var n = this.nativeEvent;
                n &&
                    (n.preventDefault ? n.preventDefault() : typeof n.returnValue != 'unknown' && (n.returnValue = !1),
                    (this.isDefaultPrevented = vi));
            },
            stopPropagation: function () {
                var n = this.nativeEvent;
                n &&
                    (n.stopPropagation ? n.stopPropagation() : typeof n.cancelBubble != 'unknown' && (n.cancelBubble = !0),
                    (this.isPropagationStopped = vi));
            },
            persist: function () {},
            isPersistent: vi,
        }),
        t
    );
}
var Fr = {
        eventPhase: 0,
        bubbles: 0,
        cancelable: 0,
        timeStamp: function (e) {
            return e.timeStamp || Date.now();
        },
        defaultPrevented: 0,
        isTrusted: 0,
    },
    su = Qe(Fr),
    ei = ie({}, Fr, { view: 0, detail: 0 }),
    SS = Qe(ei),
    Il,
    Ml,
    to,
    qs = ie({}, ei, {
        screenX: 0,
        screenY: 0,
        clientX: 0,
        clientY: 0,
        pageX: 0,
        pageY: 0,
        ctrlKey: 0,
        shiftKey: 0,
        altKey: 0,
        metaKey: 0,
        getModifierState: lu,
        button: 0,
        buttons: 0,
        relatedTarget: function (e) {
            return e.relatedTarget === void 0
                ? e.fromElement === e.srcElement
                    ? e.toElement
                    : e.fromElement
                : e.relatedTarget;
        },
        movementX: function (e) {
            return 'movementX' in e
                ? e.movementX
                : (e !== to &&
                      (to && e.type === 'mousemove'
                          ? ((Il = e.screenX - to.screenX), (Ml = e.screenY - to.screenY))
                          : (Ml = Il = 0),
                      (to = e)),
                  Il);
        },
        movementY: function (e) {
            return 'movementY' in e ? e.movementY : Ml;
        },
    }),
    Hf = Qe(qs),
    ES = ie({}, qs, { dataTransfer: 0 }),
    xS = Qe(ES),
    CS = ie({}, ei, { relatedTarget: 0 }),
    Ll = Qe(CS),
    bS = ie({}, Fr, { animationName: 0, elapsedTime: 0, pseudoElement: 0 }),
    TS = Qe(bS),
    kS = ie({}, Fr, {
        clipboardData: function (e) {
            return 'clipboardData' in e ? e.clipboardData : window.clipboardData;
        },
    }),
    RS = Qe(kS),
    _S = ie({}, Fr, { data: 0 }),
    Wf = Qe(_S),
    OS = {
        Esc: 'Escape',
        Spacebar: ' ',
        Left: 'ArrowLeft',
        Up: 'ArrowUp',
        Right: 'ArrowRight',
        Down: 'ArrowDown',
        Del: 'Delete',
        Win: 'OS',
        Menu: 'ContextMenu',
        Apps: 'ContextMenu',
        Scroll: 'ScrollLock',
        MozPrintableKey: 'Unidentified',
    },
    PS = {
        8: 'Backspace',
        9: 'Tab',
        12: 'Clear',
        13: 'Enter',
        16: 'Shift',
        17: 'Control',
        18: 'Alt',
        19: 'Pause',
        20: 'CapsLock',
        27: 'Escape',
        32: ' ',
        33: 'PageUp',
        34: 'PageDown',
        35: 'End',
        36: 'Home',
        37: 'ArrowLeft',
        38: 'ArrowUp',
        39: 'ArrowRight',
        40: 'ArrowDown',
        45: 'Insert',
        46: 'Delete',
        112: 'F1',
        113: 'F2',
        114: 'F3',
        115: 'F4',
        116: 'F5',
        117: 'F6',
        118: 'F7',
        119: 'F8',
        120: 'F9',
        121: 'F10',
        122: 'F11',
        123: 'F12',
        144: 'NumLock',
        145: 'ScrollLock',
        224: 'Meta',
    },
    NS = { Alt: 'altKey', Control: 'ctrlKey', Meta: 'metaKey', Shift: 'shiftKey' };
function DS(e) {
    var t = this.nativeEvent;
    return t.getModifierState ? t.getModifierState(e) : (e = NS[e]) ? !!t[e] : !1;
}
function lu() {
    return DS;
}
var AS = ie({}, ei, {
        key: function (e) {
            if (e.key) {
                var t = OS[e.key] || e.key;
                if (t !== 'Unidentified') return t;
            }
            return e.type === 'keypress'
                ? ((e = $i(e)), e === 13 ? 'Enter' : String.fromCharCode(e))
                : e.type === 'keydown' || e.type === 'keyup'
                  ? PS[e.keyCode] || 'Unidentified'
                  : '';
        },
        code: 0,
        location: 0,
        ctrlKey: 0,
        shiftKey: 0,
        altKey: 0,
        metaKey: 0,
        repeat: 0,
        locale: 0,
        getModifierState: lu,
        charCode: function (e) {
            return e.type === 'keypress' ? $i(e) : 0;
        },
        keyCode: function (e) {
            return e.type === 'keydown' || e.type === 'keyup' ? e.keyCode : 0;
        },
        which: function (e) {
            return e.type === 'keypress' ? $i(e) : e.type === 'keydown' || e.type === 'keyup' ? e.keyCode : 0;
        },
    }),
    IS = Qe(AS),
    MS = ie({}, qs, {
        pointerId: 0,
        width: 0,
        height: 0,
        pressure: 0,
        tangentialPressure: 0,
        tiltX: 0,
        tiltY: 0,
        twist: 0,
        pointerType: 0,
        isPrimary: 0,
    }),
    Vf = Qe(MS),
    LS = ie({}, ei, {
        touches: 0,
        targetTouches: 0,
        changedTouches: 0,
        altKey: 0,
        metaKey: 0,
        ctrlKey: 0,
        shiftKey: 0,
        getModifierState: lu,
    }),
    FS = Qe(LS),
    jS = ie({}, Fr, { propertyName: 0, elapsedTime: 0, pseudoElement: 0 }),
    zS = Qe(jS),
    US = ie({}, qs, {
        deltaX: function (e) {
            return 'deltaX' in e ? e.deltaX : 'wheelDeltaX' in e ? -e.wheelDeltaX : 0;
        },
        deltaY: function (e) {
            return 'deltaY' in e ? e.deltaY : 'wheelDeltaY' in e ? -e.wheelDeltaY : 'wheelDelta' in e ? -e.wheelDelta : 0;
        },
        deltaZ: 0,
        deltaMode: 0,
    }),
    BS = Qe(US),
    $S = [9, 13, 27, 32],
    au = Wt && 'CompositionEvent' in window,
    So = null;
Wt && 'documentMode' in document && (So = document.documentMode);
var HS = Wt && 'TextEvent' in window && !So,
    Dp = Wt && (!au || (So && 8 < So && 11 >= So)),
    qf = ' ',
    Gf = !1;
function Ap(e, t) {
    switch (e) {
        case 'keyup':
            return $S.indexOf(t.keyCode) !== -1;
        case 'keydown':
            return t.keyCode !== 229;
        case 'keypress':
        case 'mousedown':
        case 'focusout':
            return !0;
        default:
            return !1;
    }
}
function Ip(e) {
    return (e = e.detail), typeof e == 'object' && 'data' in e ? e.data : null;
}
var lr = !1;
function WS(e, t) {
    switch (e) {
        case 'compositionend':
            return Ip(t);
        case 'keypress':
            return t.which !== 32 ? null : ((Gf = !0), qf);
        case 'textInput':
            return (e = t.data), e === qf && Gf ? null : e;
        default:
            return null;
    }
}
function VS(e, t) {
    if (lr) return e === 'compositionend' || (!au && Ap(e, t)) ? ((e = Np()), (Bi = iu = cn = null), (lr = !1), e) : null;
    switch (e) {
        case 'paste':
            return null;
        case 'keypress':
            if (!(t.ctrlKey || t.altKey || t.metaKey) || (t.ctrlKey && t.altKey)) {
                if (t.char && 1 < t.char.length) return t.char;
                if (t.which) return String.fromCharCode(t.which);
            }
            return null;
        case 'compositionend':
            return Dp && t.locale !== 'ko' ? null : t.data;
        default:
            return null;
    }
}
var qS = {
    color: !0,
    date: !0,
    datetime: !0,
    'datetime-local': !0,
    email: !0,
    month: !0,
    number: !0,
    password: !0,
    range: !0,
    search: !0,
    tel: !0,
    text: !0,
    time: !0,
    url: !0,
    week: !0,
};
function Kf(e) {
    var t = e && e.nodeName && e.nodeName.toLowerCase();
    return t === 'input' ? !!qS[e.type] : t === 'textarea';
}
function Mp(e, t, n, r) {
    dp(r),
        (t = ms(t, 'onChange')),
        0 < t.length && ((n = new su('onChange', 'change', null, n, r)), e.push({ event: n, listeners: t }));
}
var Eo = null,
    Io = null;
function GS(e) {
    qp(e, 0);
}
function Gs(e) {
    var t = ur(e);
    if (ip(t)) return e;
}
function KS(e, t) {
    if (e === 'change') return t;
}
var Lp = !1;
if (Wt) {
    var Fl;
    if (Wt) {
        var jl = 'oninput' in document;
        if (!jl) {
            var Yf = document.createElement('div');
            Yf.setAttribute('oninput', 'return;'), (jl = typeof Yf.oninput == 'function');
        }
        Fl = jl;
    } else Fl = !1;
    Lp = Fl && (!document.documentMode || 9 < document.documentMode);
}
function Xf() {
    Eo && (Eo.detachEvent('onpropertychange', Fp), (Io = Eo = null));
}
function Fp(e) {
    if (e.propertyName === 'value' && Gs(Io)) {
        var t = [];
        Mp(t, Io, e, eu(e)), mp(GS, t);
    }
}
function YS(e, t, n) {
    e === 'focusin' ? (Xf(), (Eo = t), (Io = n), Eo.attachEvent('onpropertychange', Fp)) : e === 'focusout' && Xf();
}
function XS(e) {
    if (e === 'selectionchange' || e === 'keyup' || e === 'keydown') return Gs(Io);
}
function QS(e, t) {
    if (e === 'click') return Gs(t);
}
function JS(e, t) {
    if (e === 'input' || e === 'change') return Gs(t);
}
function ZS(e, t) {
    return (e === t && (e !== 0 || 1 / e === 1 / t)) || (e !== e && t !== t);
}
var yt = typeof Object.is == 'function' ? Object.is : ZS;
function Mo(e, t) {
    if (yt(e, t)) return !0;
    if (typeof e != 'object' || e === null || typeof t != 'object' || t === null) return !1;
    var n = Object.keys(e),
        r = Object.keys(t);
    if (n.length !== r.length) return !1;
    for (r = 0; r < n.length; r++) {
        var o = n[r];
        if (!ba.call(t, o) || !yt(e[o], t[o])) return !1;
    }
    return !0;
}
function Qf(e) {
    for (; e && e.firstChild; ) e = e.firstChild;
    return e;
}
function Jf(e, t) {
    var n = Qf(e);
    e = 0;
    for (var r; n; ) {
        if (n.nodeType === 3) {
            if (((r = e + n.textContent.length), e <= t && r >= t)) return { node: n, offset: t - e };
            e = r;
        }
        e: {
            for (; n; ) {
                if (n.nextSibling) {
                    n = n.nextSibling;
                    break e;
                }
                n = n.parentNode;
            }
            n = void 0;
        }
        n = Qf(n);
    }
}
function jp(e, t) {
    return e && t
        ? e === t
            ? !0
            : e && e.nodeType === 3
              ? !1
              : t && t.nodeType === 3
                ? jp(e, t.parentNode)
                : 'contains' in e
                  ? e.contains(t)
                  : e.compareDocumentPosition
                    ? !!(e.compareDocumentPosition(t) & 16)
                    : !1
        : !1;
}
function zp() {
    for (var e = window, t = cs(); t instanceof e.HTMLIFrameElement; ) {
        try {
            var n = typeof t.contentWindow.location.href == 'string';
        } catch {
            n = !1;
        }
        if (n) e = t.contentWindow;
        else break;
        t = cs(e.document);
    }
    return t;
}
function cu(e) {
    var t = e && e.nodeName && e.nodeName.toLowerCase();
    return (
        t &&
        ((t === 'input' &&
            (e.type === 'text' || e.type === 'search' || e.type === 'tel' || e.type === 'url' || e.type === 'password')) ||
            t === 'textarea' ||
            e.contentEditable === 'true')
    );
}
function e0(e) {
    var t = zp(),
        n = e.focusedElem,
        r = e.selectionRange;
    if (t !== n && n && n.ownerDocument && jp(n.ownerDocument.documentElement, n)) {
        if (r !== null && cu(n)) {
            if (((t = r.start), (e = r.end), e === void 0 && (e = t), 'selectionStart' in n))
                (n.selectionStart = t), (n.selectionEnd = Math.min(e, n.value.length));
            else if (((e = ((t = n.ownerDocument || document) && t.defaultView) || window), e.getSelection)) {
                e = e.getSelection();
                var o = n.textContent.length,
                    i = Math.min(r.start, o);
                (r = r.end === void 0 ? i : Math.min(r.end, o)),
                    !e.extend && i > r && ((o = r), (r = i), (i = o)),
                    (o = Jf(n, i));
                var s = Jf(n, r);
                o &&
                    s &&
                    (e.rangeCount !== 1 ||
                        e.anchorNode !== o.node ||
                        e.anchorOffset !== o.offset ||
                        e.focusNode !== s.node ||
                        e.focusOffset !== s.offset) &&
                    ((t = t.createRange()),
                    t.setStart(o.node, o.offset),
                    e.removeAllRanges(),
                    i > r ? (e.addRange(t), e.extend(s.node, s.offset)) : (t.setEnd(s.node, s.offset), e.addRange(t)));
            }
        }
        for (t = [], e = n; (e = e.parentNode); )
            e.nodeType === 1 && t.push({ element: e, left: e.scrollLeft, top: e.scrollTop });
        for (typeof n.focus == 'function' && n.focus(), n = 0; n < t.length; n++)
            (e = t[n]), (e.element.scrollLeft = e.left), (e.element.scrollTop = e.top);
    }
}
var t0 = Wt && 'documentMode' in document && 11 >= document.documentMode,
    ar = null,
    Ha = null,
    xo = null,
    Wa = !1;
function Zf(e, t, n) {
    var r = n.window === n ? n.document : n.nodeType === 9 ? n : n.ownerDocument;
    Wa ||
        ar == null ||
        ar !== cs(r) ||
        ((r = ar),
        'selectionStart' in r && cu(r)
            ? (r = { start: r.selectionStart, end: r.selectionEnd })
            : ((r = ((r.ownerDocument && r.ownerDocument.defaultView) || window).getSelection()),
              (r = {
                  anchorNode: r.anchorNode,
                  anchorOffset: r.anchorOffset,
                  focusNode: r.focusNode,
                  focusOffset: r.focusOffset,
              })),
        (xo && Mo(xo, r)) ||
            ((xo = r),
            (r = ms(Ha, 'onSelect')),
            0 < r.length &&
                ((t = new su('onSelect', 'select', null, t, n)), e.push({ event: t, listeners: r }), (t.target = ar))));
}
function yi(e, t) {
    var n = {};
    return (n[e.toLowerCase()] = t.toLowerCase()), (n['Webkit' + e] = 'webkit' + t), (n['Moz' + e] = 'moz' + t), n;
}
var cr = {
        animationend: yi('Animation', 'AnimationEnd'),
        animationiteration: yi('Animation', 'AnimationIteration'),
        animationstart: yi('Animation', 'AnimationStart'),
        transitionend: yi('Transition', 'TransitionEnd'),
    },
    zl = {},
    Up = {};
Wt &&
    ((Up = document.createElement('div').style),
    'AnimationEvent' in window ||
        (delete cr.animationend.animation, delete cr.animationiteration.animation, delete cr.animationstart.animation),
    'TransitionEvent' in window || delete cr.transitionend.transition);
function Ks(e) {
    if (zl[e]) return zl[e];
    if (!cr[e]) return e;
    var t = cr[e],
        n;
    for (n in t) if (t.hasOwnProperty(n) && n in Up) return (zl[e] = t[n]);
    return e;
}
var Bp = Ks('animationend'),
    $p = Ks('animationiteration'),
    Hp = Ks('animationstart'),
    Wp = Ks('transitionend'),
    Vp = new Map(),
    ed =
        'abort auxClick cancel canPlay canPlayThrough click close contextMenu copy cut drag dragEnd dragEnter dragExit dragLeave dragOver dragStart drop durationChange emptied encrypted ended error gotPointerCapture input invalid keyDown keyPress keyUp load loadedData loadedMetadata loadStart lostPointerCapture mouseDown mouseMove mouseOut mouseOver mouseUp paste pause play playing pointerCancel pointerDown pointerMove pointerOut pointerOver pointerUp progress rateChange reset resize seeked seeking stalled submit suspend timeUpdate touchCancel touchEnd touchStart volumeChange scroll toggle touchMove waiting wheel'.split(
            ' ',
        );
function Rn(e, t) {
    Vp.set(e, t), Xn(t, [e]);
}
for (var Ul = 0; Ul < ed.length; Ul++) {
    var Bl = ed[Ul],
        n0 = Bl.toLowerCase(),
        r0 = Bl[0].toUpperCase() + Bl.slice(1);
    Rn(n0, 'on' + r0);
}
Rn(Bp, 'onAnimationEnd');
Rn($p, 'onAnimationIteration');
Rn(Hp, 'onAnimationStart');
Rn('dblclick', 'onDoubleClick');
Rn('focusin', 'onFocus');
Rn('focusout', 'onBlur');
Rn(Wp, 'onTransitionEnd');
Rr('onMouseEnter', ['mouseout', 'mouseover']);
Rr('onMouseLeave', ['mouseout', 'mouseover']);
Rr('onPointerEnter', ['pointerout', 'pointerover']);
Rr('onPointerLeave', ['pointerout', 'pointerover']);
Xn('onChange', 'change click focusin focusout input keydown keyup selectionchange'.split(' '));
Xn('onSelect', 'focusout contextmenu dragend focusin keydown keyup mousedown mouseup selectionchange'.split(' '));
Xn('onBeforeInput', ['compositionend', 'keypress', 'textInput', 'paste']);
Xn('onCompositionEnd', 'compositionend focusout keydown keypress keyup mousedown'.split(' '));
Xn('onCompositionStart', 'compositionstart focusout keydown keypress keyup mousedown'.split(' '));
Xn('onCompositionUpdate', 'compositionupdate focusout keydown keypress keyup mousedown'.split(' '));
var ho =
        'abort canplay canplaythrough durationchange emptied encrypted ended error loadeddata loadedmetadata loadstart pause play playing progress ratechange resize seeked seeking stalled suspend timeupdate volumechange waiting'.split(
            ' ',
        ),
    o0 = new Set('cancel close invalid load scroll toggle'.split(' ').concat(ho));
function td(e, t, n) {
    var r = e.type || 'unknown-event';
    (e.currentTarget = n), nS(r, t, void 0, e), (e.currentTarget = null);
}
function qp(e, t) {
    t = (t & 4) !== 0;
    for (var n = 0; n < e.length; n++) {
        var r = e[n],
            o = r.event;
        r = r.listeners;
        e: {
            var i = void 0;
            if (t)
                for (var s = r.length - 1; 0 <= s; s--) {
                    var l = r[s],
                        a = l.instance,
                        c = l.currentTarget;
                    if (((l = l.listener), a !== i && o.isPropagationStopped())) break e;
                    td(o, l, c), (i = a);
                }
            else
                for (s = 0; s < r.length; s++) {
                    if (
                        ((l = r[s]),
                        (a = l.instance),
                        (c = l.currentTarget),
                        (l = l.listener),
                        a !== i && o.isPropagationStopped())
                    )
                        break e;
                    td(o, l, c), (i = a);
                }
        }
    }
    if (fs) throw ((e = za), (fs = !1), (za = null), e);
}
function ee(e, t) {
    var n = t[Ya];
    n === void 0 && (n = t[Ya] = new Set());
    var r = e + '__bubble';
    n.has(r) || (Gp(t, e, 2, !1), n.add(r));
}
function $l(e, t, n) {
    var r = 0;
    t && (r |= 4), Gp(n, e, r, t);
}
var wi = '_reactListening' + Math.random().toString(36).slice(2);
function Lo(e) {
    if (!e[wi]) {
        (e[wi] = !0),
            ep.forEach(function (n) {
                n !== 'selectionchange' && (o0.has(n) || $l(n, !1, e), $l(n, !0, e));
            });
        var t = e.nodeType === 9 ? e : e.ownerDocument;
        t === null || t[wi] || ((t[wi] = !0), $l('selectionchange', !1, t));
    }
}
function Gp(e, t, n, r) {
    switch (Pp(t)) {
        case 1:
            var o = yS;
            break;
        case 4:
            o = wS;
            break;
        default:
            o = ou;
    }
    (n = o.bind(null, t, n, e)),
        (o = void 0),
        !ja || (t !== 'touchstart' && t !== 'touchmove' && t !== 'wheel') || (o = !0),
        r
            ? o !== void 0
                ? e.addEventListener(t, n, { capture: !0, passive: o })
                : e.addEventListener(t, n, !0)
            : o !== void 0
              ? e.addEventListener(t, n, { passive: o })
              : e.addEventListener(t, n, !1);
}
function Hl(e, t, n, r, o) {
    var i = r;
    if (!(t & 1) && !(t & 2) && r !== null)
        e: for (;;) {
            if (r === null) return;
            var s = r.tag;
            if (s === 3 || s === 4) {
                var l = r.stateNode.containerInfo;
                if (l === o || (l.nodeType === 8 && l.parentNode === o)) break;
                if (s === 4)
                    for (s = r.return; s !== null; ) {
                        var a = s.tag;
                        if (
                            (a === 3 || a === 4) &&
                            ((a = s.stateNode.containerInfo), a === o || (a.nodeType === 8 && a.parentNode === o))
                        )
                            return;
                        s = s.return;
                    }
                for (; l !== null; ) {
                    if (((s = In(l)), s === null)) return;
                    if (((a = s.tag), a === 5 || a === 6)) {
                        r = i = s;
                        continue e;
                    }
                    l = l.parentNode;
                }
            }
            r = r.return;
        }
    mp(function () {
        var c = i,
            u = eu(n),
            f = [];
        e: {
            var d = Vp.get(e);
            if (d !== void 0) {
                var y = su,
                    m = e;
                switch (e) {
                    case 'keypress':
                        if ($i(n) === 0) break e;
                    case 'keydown':
                    case 'keyup':
                        y = IS;
                        break;
                    case 'focusin':
                        (m = 'focus'), (y = Ll);
                        break;
                    case 'focusout':
                        (m = 'blur'), (y = Ll);
                        break;
                    case 'beforeblur':
                    case 'afterblur':
                        y = Ll;
                        break;
                    case 'click':
                        if (n.button === 2) break e;
                    case 'auxclick':
                    case 'dblclick':
                    case 'mousedown':
                    case 'mousemove':
                    case 'mouseup':
                    case 'mouseout':
                    case 'mouseover':
                    case 'contextmenu':
                        y = Hf;
                        break;
                    case 'drag':
                    case 'dragend':
                    case 'dragenter':
                    case 'dragexit':
                    case 'dragleave':
                    case 'dragover':
                    case 'dragstart':
                    case 'drop':
                        y = xS;
                        break;
                    case 'touchcancel':
                    case 'touchend':
                    case 'touchmove':
                    case 'touchstart':
                        y = FS;
                        break;
                    case Bp:
                    case $p:
                    case Hp:
                        y = TS;
                        break;
                    case Wp:
                        y = zS;
                        break;
                    case 'scroll':
                        y = SS;
                        break;
                    case 'wheel':
                        y = BS;
                        break;
                    case 'copy':
                    case 'cut':
                    case 'paste':
                        y = RS;
                        break;
                    case 'gotpointercapture':
                    case 'lostpointercapture':
                    case 'pointercancel':
                    case 'pointerdown':
                    case 'pointermove':
                    case 'pointerout':
                    case 'pointerover':
                    case 'pointerup':
                        y = Vf;
                }
                var v = (t & 4) !== 0,
                    S = !v && e === 'scroll',
                    h = v ? (d !== null ? d + 'Capture' : null) : d;
                v = [];
                for (var p = c, w; p !== null; ) {
                    w = p;
                    var C = w.stateNode;
                    if (
                        (w.tag === 5 &&
                            C !== null &&
                            ((w = C), h !== null && ((C = Po(p, h)), C != null && v.push(Fo(p, C, w)))),
                        S)
                    )
                        break;
                    p = p.return;
                }
                0 < v.length && ((d = new y(d, m, null, n, u)), f.push({ event: d, listeners: v }));
            }
        }
        if (!(t & 7)) {
            e: {
                if (
                    ((d = e === 'mouseover' || e === 'pointerover'),
                    (y = e === 'mouseout' || e === 'pointerout'),
                    d && n !== La && (m = n.relatedTarget || n.fromElement) && (In(m) || m[Vt]))
                )
                    break e;
                if (
                    (y || d) &&
                    ((d = u.window === u ? u : (d = u.ownerDocument) ? d.defaultView || d.parentWindow : window),
                    y
                        ? ((m = n.relatedTarget || n.toElement),
                          (y = c),
                          (m = m ? In(m) : null),
                          m !== null && ((S = Qn(m)), m !== S || (m.tag !== 5 && m.tag !== 6)) && (m = null))
                        : ((y = null), (m = c)),
                    y !== m)
                ) {
                    if (
                        ((v = Hf),
                        (C = 'onMouseLeave'),
                        (h = 'onMouseEnter'),
                        (p = 'mouse'),
                        (e === 'pointerout' || e === 'pointerover') &&
                            ((v = Vf), (C = 'onPointerLeave'), (h = 'onPointerEnter'), (p = 'pointer')),
                        (S = y == null ? d : ur(y)),
                        (w = m == null ? d : ur(m)),
                        (d = new v(C, p + 'leave', y, n, u)),
                        (d.target = S),
                        (d.relatedTarget = w),
                        (C = null),
                        In(u) === c && ((v = new v(h, p + 'enter', m, n, u)), (v.target = w), (v.relatedTarget = S), (C = v)),
                        (S = C),
                        y && m)
                    )
                        t: {
                            for (v = y, h = m, p = 0, w = v; w; w = Zn(w)) p++;
                            for (w = 0, C = h; C; C = Zn(C)) w++;
                            for (; 0 < p - w; ) (v = Zn(v)), p--;
                            for (; 0 < w - p; ) (h = Zn(h)), w--;
                            for (; p--; ) {
                                if (v === h || (h !== null && v === h.alternate)) break t;
                                (v = Zn(v)), (h = Zn(h));
                            }
                            v = null;
                        }
                    else v = null;
                    y !== null && nd(f, d, y, v, !1), m !== null && S !== null && nd(f, S, m, v, !0);
                }
            }
            e: {
                if (
                    ((d = c ? ur(c) : window),
                    (y = d.nodeName && d.nodeName.toLowerCase()),
                    y === 'select' || (y === 'input' && d.type === 'file'))
                )
                    var T = KS;
                else if (Kf(d))
                    if (Lp) T = JS;
                    else {
                        T = XS;
                        var _ = YS;
                    }
                else
                    (y = d.nodeName) &&
                        y.toLowerCase() === 'input' &&
                        (d.type === 'checkbox' || d.type === 'radio') &&
                        (T = QS);
                if (T && (T = T(e, c))) {
                    Mp(f, T, n, u);
                    break e;
                }
                _ && _(e, d, c),
                    e === 'focusout' &&
                        (_ = d._wrapperState) &&
                        _.controlled &&
                        d.type === 'number' &&
                        Na(d, 'number', d.value);
            }
            switch (((_ = c ? ur(c) : window), e)) {
                case 'focusin':
                    (Kf(_) || _.contentEditable === 'true') && ((ar = _), (Ha = c), (xo = null));
                    break;
                case 'focusout':
                    xo = Ha = ar = null;
                    break;
                case 'mousedown':
                    Wa = !0;
                    break;
                case 'contextmenu':
                case 'mouseup':
                case 'dragend':
                    (Wa = !1), Zf(f, n, u);
                    break;
                case 'selectionchange':
                    if (t0) break;
                case 'keydown':
                case 'keyup':
                    Zf(f, n, u);
            }
            var b;
            if (au)
                e: {
                    switch (e) {
                        case 'compositionstart':
                            var x = 'onCompositionStart';
                            break e;
                        case 'compositionend':
                            x = 'onCompositionEnd';
                            break e;
                        case 'compositionupdate':
                            x = 'onCompositionUpdate';
                            break e;
                    }
                    x = void 0;
                }
            else lr ? Ap(e, n) && (x = 'onCompositionEnd') : e === 'keydown' && n.keyCode === 229 && (x = 'onCompositionStart');
            x &&
                (Dp &&
                    n.locale !== 'ko' &&
                    (lr || x !== 'onCompositionStart'
                        ? x === 'onCompositionEnd' && lr && (b = Np())
                        : ((cn = u), (iu = 'value' in cn ? cn.value : cn.textContent), (lr = !0))),
                (_ = ms(c, x)),
                0 < _.length &&
                    ((x = new Wf(x, e, null, n, u)),
                    f.push({ event: x, listeners: _ }),
                    b ? (x.data = b) : ((b = Ip(n)), b !== null && (x.data = b)))),
                (b = HS ? WS(e, n) : VS(e, n)) &&
                    ((c = ms(c, 'onBeforeInput')),
                    0 < c.length &&
                        ((u = new Wf('onBeforeInput', 'beforeinput', null, n, u)),
                        f.push({ event: u, listeners: c }),
                        (u.data = b)));
        }
        qp(f, t);
    });
}
function Fo(e, t, n) {
    return { instance: e, listener: t, currentTarget: n };
}
function ms(e, t) {
    for (var n = t + 'Capture', r = []; e !== null; ) {
        var o = e,
            i = o.stateNode;
        o.tag === 5 &&
            i !== null &&
            ((o = i), (i = Po(e, n)), i != null && r.unshift(Fo(e, i, o)), (i = Po(e, t)), i != null && r.push(Fo(e, i, o))),
            (e = e.return);
    }
    return r;
}
function Zn(e) {
    if (e === null) return null;
    do e = e.return;
    while (e && e.tag !== 5);
    return e || null;
}
function nd(e, t, n, r, o) {
    for (var i = t._reactName, s = []; n !== null && n !== r; ) {
        var l = n,
            a = l.alternate,
            c = l.stateNode;
        if (a !== null && a === r) break;
        l.tag === 5 &&
            c !== null &&
            ((l = c),
            o
                ? ((a = Po(n, i)), a != null && s.unshift(Fo(n, a, l)))
                : o || ((a = Po(n, i)), a != null && s.push(Fo(n, a, l)))),
            (n = n.return);
    }
    s.length !== 0 && e.push({ event: t, listeners: s });
}
var i0 = /\r\n?/g,
    s0 = /\u0000|\uFFFD/g;
function rd(e) {
    return (typeof e == 'string' ? e : '' + e)
        .replace(
            i0,
            `
`,
        )
        .replace(s0, '');
}
function Si(e, t, n) {
    if (((t = rd(t)), rd(e) !== t && n)) throw Error(D(425));
}
function vs() {}
var Va = null,
    qa = null;
function Ga(e, t) {
    return (
        e === 'textarea' ||
        e === 'noscript' ||
        typeof t.children == 'string' ||
        typeof t.children == 'number' ||
        (typeof t.dangerouslySetInnerHTML == 'object' &&
            t.dangerouslySetInnerHTML !== null &&
            t.dangerouslySetInnerHTML.__html != null)
    );
}
var Ka = typeof setTimeout == 'function' ? setTimeout : void 0,
    l0 = typeof clearTimeout == 'function' ? clearTimeout : void 0,
    od = typeof Promise == 'function' ? Promise : void 0,
    a0 =
        typeof queueMicrotask == 'function'
            ? queueMicrotask
            : typeof od < 'u'
              ? function (e) {
                    return od.resolve(null).then(e).catch(c0);
                }
              : Ka;
function c0(e) {
    setTimeout(function () {
        throw e;
    });
}
function Wl(e, t) {
    var n = t,
        r = 0;
    do {
        var o = n.nextSibling;
        if ((e.removeChild(n), o && o.nodeType === 8))
            if (((n = o.data), n === '/$')) {
                if (r === 0) {
                    e.removeChild(o), Ao(t);
                    return;
                }
                r--;
            } else (n !== '$' && n !== '$?' && n !== '$!') || r++;
        n = o;
    } while (n);
    Ao(t);
}
function pn(e) {
    for (; e != null; e = e.nextSibling) {
        var t = e.nodeType;
        if (t === 1 || t === 3) break;
        if (t === 8) {
            if (((t = e.data), t === '$' || t === '$!' || t === '$?')) break;
            if (t === '/$') return null;
        }
    }
    return e;
}
function id(e) {
    e = e.previousSibling;
    for (var t = 0; e; ) {
        if (e.nodeType === 8) {
            var n = e.data;
            if (n === '$' || n === '$!' || n === '$?') {
                if (t === 0) return e;
                t--;
            } else n === '/$' && t++;
        }
        e = e.previousSibling;
    }
    return null;
}
var jr = Math.random().toString(36).slice(2),
    kt = '__reactFiber$' + jr,
    jo = '__reactProps$' + jr,
    Vt = '__reactContainer$' + jr,
    Ya = '__reactEvents$' + jr,
    u0 = '__reactListeners$' + jr,
    f0 = '__reactHandles$' + jr;
function In(e) {
    var t = e[kt];
    if (t) return t;
    for (var n = e.parentNode; n; ) {
        if ((t = n[Vt] || n[kt])) {
            if (((n = t.alternate), t.child !== null || (n !== null && n.child !== null)))
                for (e = id(e); e !== null; ) {
                    if ((n = e[kt])) return n;
                    e = id(e);
                }
            return t;
        }
        (e = n), (n = e.parentNode);
    }
    return null;
}
function ti(e) {
    return (e = e[kt] || e[Vt]), !e || (e.tag !== 5 && e.tag !== 6 && e.tag !== 13 && e.tag !== 3) ? null : e;
}
function ur(e) {
    if (e.tag === 5 || e.tag === 6) return e.stateNode;
    throw Error(D(33));
}
function Ys(e) {
    return e[jo] || null;
}
var Xa = [],
    fr = -1;
function _n(e) {
    return { current: e };
}
function te(e) {
    0 > fr || ((e.current = Xa[fr]), (Xa[fr] = null), fr--);
}
function J(e, t) {
    fr++, (Xa[fr] = e.current), (e.current = t);
}
var En = {},
    ke = _n(En),
    Fe = _n(!1),
    $n = En;
function _r(e, t) {
    var n = e.type.contextTypes;
    if (!n) return En;
    var r = e.stateNode;
    if (r && r.__reactInternalMemoizedUnmaskedChildContext === t) return r.__reactInternalMemoizedMaskedChildContext;
    var o = {},
        i;
    for (i in n) o[i] = t[i];
    return (
        r &&
            ((e = e.stateNode),
            (e.__reactInternalMemoizedUnmaskedChildContext = t),
            (e.__reactInternalMemoizedMaskedChildContext = o)),
        o
    );
}
function je(e) {
    return (e = e.childContextTypes), e != null;
}
function ys() {
    te(Fe), te(ke);
}
function sd(e, t, n) {
    if (ke.current !== En) throw Error(D(168));
    J(ke, t), J(Fe, n);
}
function Kp(e, t, n) {
    var r = e.stateNode;
    if (((t = t.childContextTypes), typeof r.getChildContext != 'function')) return n;
    r = r.getChildContext();
    for (var o in r) if (!(o in t)) throw Error(D(108, Yw(e) || 'Unknown', o));
    return ie({}, n, r);
}
function ws(e) {
    return (
        (e = ((e = e.stateNode) && e.__reactInternalMemoizedMergedChildContext) || En),
        ($n = ke.current),
        J(ke, e),
        J(Fe, Fe.current),
        !0
    );
}
function ld(e, t, n) {
    var r = e.stateNode;
    if (!r) throw Error(D(169));
    n ? ((e = Kp(e, t, $n)), (r.__reactInternalMemoizedMergedChildContext = e), te(Fe), te(ke), J(ke, e)) : te(Fe), J(Fe, n);
}
var Ut = null,
    Xs = !1,
    Vl = !1;
function Yp(e) {
    Ut === null ? (Ut = [e]) : Ut.push(e);
}
function d0(e) {
    (Xs = !0), Yp(e);
}
function On() {
    if (!Vl && Ut !== null) {
        Vl = !0;
        var e = 0,
            t = X;
        try {
            var n = Ut;
            for (X = 1; e < n.length; e++) {
                var r = n[e];
                do r = r(!0);
                while (r !== null);
            }
            (Ut = null), (Xs = !1);
        } catch (o) {
            throw (Ut !== null && (Ut = Ut.slice(e + 1)), Sp(tu, On), o);
        } finally {
            (X = t), (Vl = !1);
        }
    }
    return null;
}
var dr = [],
    hr = 0,
    Ss = null,
    Es = 0,
    et = [],
    tt = 0,
    Hn = null,
    Bt = 1,
    $t = '';
function Dn(e, t) {
    (dr[hr++] = Es), (dr[hr++] = Ss), (Ss = e), (Es = t);
}
function Xp(e, t, n) {
    (et[tt++] = Bt), (et[tt++] = $t), (et[tt++] = Hn), (Hn = e);
    var r = Bt;
    e = $t;
    var o = 32 - mt(r) - 1;
    (r &= ~(1 << o)), (n += 1);
    var i = 32 - mt(t) + o;
    if (30 < i) {
        var s = o - (o % 5);
        (i = (r & ((1 << s) - 1)).toString(32)),
            (r >>= s),
            (o -= s),
            (Bt = (1 << (32 - mt(t) + o)) | (n << o) | r),
            ($t = i + e);
    } else (Bt = (1 << i) | (n << o) | r), ($t = e);
}
function uu(e) {
    e.return !== null && (Dn(e, 1), Xp(e, 1, 0));
}
function fu(e) {
    for (; e === Ss; ) (Ss = dr[--hr]), (dr[hr] = null), (Es = dr[--hr]), (dr[hr] = null);
    for (; e === Hn; ) (Hn = et[--tt]), (et[tt] = null), ($t = et[--tt]), (et[tt] = null), (Bt = et[--tt]), (et[tt] = null);
}
var Ve = null,
    We = null,
    ne = !1,
    gt = null;
function Qp(e, t) {
    var n = ot(5, null, null, 0);
    (n.elementType = 'DELETED'),
        (n.stateNode = t),
        (n.return = e),
        (t = e.deletions),
        t === null ? ((e.deletions = [n]), (e.flags |= 16)) : t.push(n);
}
function ad(e, t) {
    switch (e.tag) {
        case 5:
            var n = e.type;
            return (
                (t = t.nodeType !== 1 || n.toLowerCase() !== t.nodeName.toLowerCase() ? null : t),
                t !== null ? ((e.stateNode = t), (Ve = e), (We = pn(t.firstChild)), !0) : !1
            );
        case 6:
            return (
                (t = e.pendingProps === '' || t.nodeType !== 3 ? null : t),
                t !== null ? ((e.stateNode = t), (Ve = e), (We = null), !0) : !1
            );
        case 13:
            return (
                (t = t.nodeType !== 8 ? null : t),
                t !== null
                    ? ((n = Hn !== null ? { id: Bt, overflow: $t } : null),
                      (e.memoizedState = { dehydrated: t, treeContext: n, retryLane: 1073741824 }),
                      (n = ot(18, null, null, 0)),
                      (n.stateNode = t),
                      (n.return = e),
                      (e.child = n),
                      (Ve = e),
                      (We = null),
                      !0)
                    : !1
            );
        default:
            return !1;
    }
}
function Qa(e) {
    return (e.mode & 1) !== 0 && (e.flags & 128) === 0;
}
function Ja(e) {
    if (ne) {
        var t = We;
        if (t) {
            var n = t;
            if (!ad(e, t)) {
                if (Qa(e)) throw Error(D(418));
                t = pn(n.nextSibling);
                var r = Ve;
                t && ad(e, t) ? Qp(r, n) : ((e.flags = (e.flags & -4097) | 2), (ne = !1), (Ve = e));
            }
        } else {
            if (Qa(e)) throw Error(D(418));
            (e.flags = (e.flags & -4097) | 2), (ne = !1), (Ve = e);
        }
    }
}
function cd(e) {
    for (e = e.return; e !== null && e.tag !== 5 && e.tag !== 3 && e.tag !== 13; ) e = e.return;
    Ve = e;
}
function Ei(e) {
    if (e !== Ve) return !1;
    if (!ne) return cd(e), (ne = !0), !1;
    var t;
    if (
        ((t = e.tag !== 3) &&
            !(t = e.tag !== 5) &&
            ((t = e.type), (t = t !== 'head' && t !== 'body' && !Ga(e.type, e.memoizedProps))),
        t && (t = We))
    ) {
        if (Qa(e)) throw (Jp(), Error(D(418)));
        for (; t; ) Qp(e, t), (t = pn(t.nextSibling));
    }
    if ((cd(e), e.tag === 13)) {
        if (((e = e.memoizedState), (e = e !== null ? e.dehydrated : null), !e)) throw Error(D(317));
        e: {
            for (e = e.nextSibling, t = 0; e; ) {
                if (e.nodeType === 8) {
                    var n = e.data;
                    if (n === '/$') {
                        if (t === 0) {
                            We = pn(e.nextSibling);
                            break e;
                        }
                        t--;
                    } else (n !== '$' && n !== '$!' && n !== '$?') || t++;
                }
                e = e.nextSibling;
            }
            We = null;
        }
    } else We = Ve ? pn(e.stateNode.nextSibling) : null;
    return !0;
}
function Jp() {
    for (var e = We; e; ) e = pn(e.nextSibling);
}
function Or() {
    (We = Ve = null), (ne = !1);
}
function du(e) {
    gt === null ? (gt = [e]) : gt.push(e);
}
var h0 = Xt.ReactCurrentBatchConfig;
function no(e, t, n) {
    if (((e = n.ref), e !== null && typeof e != 'function' && typeof e != 'object')) {
        if (n._owner) {
            if (((n = n._owner), n)) {
                if (n.tag !== 1) throw Error(D(309));
                var r = n.stateNode;
            }
            if (!r) throw Error(D(147, e));
            var o = r,
                i = '' + e;
            return t !== null && t.ref !== null && typeof t.ref == 'function' && t.ref._stringRef === i
                ? t.ref
                : ((t = function (s) {
                      var l = o.refs;
                      s === null ? delete l[i] : (l[i] = s);
                  }),
                  (t._stringRef = i),
                  t);
        }
        if (typeof e != 'string') throw Error(D(284));
        if (!n._owner) throw Error(D(290, e));
    }
    return e;
}
function xi(e, t) {
    throw (
        ((e = Object.prototype.toString.call(t)),
        Error(D(31, e === '[object Object]' ? 'object with keys {' + Object.keys(t).join(', ') + '}' : e)))
    );
}
function ud(e) {
    var t = e._init;
    return t(e._payload);
}
function Zp(e) {
    function t(h, p) {
        if (e) {
            var w = h.deletions;
            w === null ? ((h.deletions = [p]), (h.flags |= 16)) : w.push(p);
        }
    }
    function n(h, p) {
        if (!e) return null;
        for (; p !== null; ) t(h, p), (p = p.sibling);
        return null;
    }
    function r(h, p) {
        for (h = new Map(); p !== null; ) p.key !== null ? h.set(p.key, p) : h.set(p.index, p), (p = p.sibling);
        return h;
    }
    function o(h, p) {
        return (h = yn(h, p)), (h.index = 0), (h.sibling = null), h;
    }
    function i(h, p, w) {
        return (
            (h.index = w),
            e
                ? ((w = h.alternate), w !== null ? ((w = w.index), w < p ? ((h.flags |= 2), p) : w) : ((h.flags |= 2), p))
                : ((h.flags |= 1048576), p)
        );
    }
    function s(h) {
        return e && h.alternate === null && (h.flags |= 2), h;
    }
    function l(h, p, w, C) {
        return p === null || p.tag !== 6 ? ((p = Jl(w, h.mode, C)), (p.return = h), p) : ((p = o(p, w)), (p.return = h), p);
    }
    function a(h, p, w, C) {
        var T = w.type;
        return T === sr
            ? u(h, p, w.props.children, C, w.key)
            : p !== null &&
                (p.elementType === T || (typeof T == 'object' && T !== null && T.$$typeof === on && ud(T) === p.type))
              ? ((C = o(p, w.props)), (C.ref = no(h, p, w)), (C.return = h), C)
              : ((C = Yi(w.type, w.key, w.props, null, h.mode, C)), (C.ref = no(h, p, w)), (C.return = h), C);
    }
    function c(h, p, w, C) {
        return p === null ||
            p.tag !== 4 ||
            p.stateNode.containerInfo !== w.containerInfo ||
            p.stateNode.implementation !== w.implementation
            ? ((p = Zl(w, h.mode, C)), (p.return = h), p)
            : ((p = o(p, w.children || [])), (p.return = h), p);
    }
    function u(h, p, w, C, T) {
        return p === null || p.tag !== 7 ? ((p = zn(w, h.mode, C, T)), (p.return = h), p) : ((p = o(p, w)), (p.return = h), p);
    }
    function f(h, p, w) {
        if ((typeof p == 'string' && p !== '') || typeof p == 'number') return (p = Jl('' + p, h.mode, w)), (p.return = h), p;
        if (typeof p == 'object' && p !== null) {
            switch (p.$$typeof) {
                case fi:
                    return (w = Yi(p.type, p.key, p.props, null, h.mode, w)), (w.ref = no(h, null, p)), (w.return = h), w;
                case ir:
                    return (p = Zl(p, h.mode, w)), (p.return = h), p;
                case on:
                    var C = p._init;
                    return f(h, C(p._payload), w);
            }
            if (uo(p) || Qr(p)) return (p = zn(p, h.mode, w, null)), (p.return = h), p;
            xi(h, p);
        }
        return null;
    }
    function d(h, p, w, C) {
        var T = p !== null ? p.key : null;
        if ((typeof w == 'string' && w !== '') || typeof w == 'number') return T !== null ? null : l(h, p, '' + w, C);
        if (typeof w == 'object' && w !== null) {
            switch (w.$$typeof) {
                case fi:
                    return w.key === T ? a(h, p, w, C) : null;
                case ir:
                    return w.key === T ? c(h, p, w, C) : null;
                case on:
                    return (T = w._init), d(h, p, T(w._payload), C);
            }
            if (uo(w) || Qr(w)) return T !== null ? null : u(h, p, w, C, null);
            xi(h, w);
        }
        return null;
    }
    function y(h, p, w, C, T) {
        if ((typeof C == 'string' && C !== '') || typeof C == 'number') return (h = h.get(w) || null), l(p, h, '' + C, T);
        if (typeof C == 'object' && C !== null) {
            switch (C.$$typeof) {
                case fi:
                    return (h = h.get(C.key === null ? w : C.key) || null), a(p, h, C, T);
                case ir:
                    return (h = h.get(C.key === null ? w : C.key) || null), c(p, h, C, T);
                case on:
                    var _ = C._init;
                    return y(h, p, w, _(C._payload), T);
            }
            if (uo(C) || Qr(C)) return (h = h.get(w) || null), u(p, h, C, T, null);
            xi(p, C);
        }
        return null;
    }
    function m(h, p, w, C) {
        for (var T = null, _ = null, b = p, x = (p = 0), R = null; b !== null && x < w.length; x++) {
            b.index > x ? ((R = b), (b = null)) : (R = b.sibling);
            var N = d(h, b, w[x], C);
            if (N === null) {
                b === null && (b = R);
                break;
            }
            e && b && N.alternate === null && t(h, b),
                (p = i(N, p, x)),
                _ === null ? (T = N) : (_.sibling = N),
                (_ = N),
                (b = R);
        }
        if (x === w.length) return n(h, b), ne && Dn(h, x), T;
        if (b === null) {
            for (; x < w.length; x++)
                (b = f(h, w[x], C)), b !== null && ((p = i(b, p, x)), _ === null ? (T = b) : (_.sibling = b), (_ = b));
            return ne && Dn(h, x), T;
        }
        for (b = r(h, b); x < w.length; x++)
            (R = y(b, h, x, w[x], C)),
                R !== null &&
                    (e && R.alternate !== null && b.delete(R.key === null ? x : R.key),
                    (p = i(R, p, x)),
                    _ === null ? (T = R) : (_.sibling = R),
                    (_ = R));
        return (
            e &&
                b.forEach(function (L) {
                    return t(h, L);
                }),
            ne && Dn(h, x),
            T
        );
    }
    function v(h, p, w, C) {
        var T = Qr(w);
        if (typeof T != 'function') throw Error(D(150));
        if (((w = T.call(w)), w == null)) throw Error(D(151));
        for (var _ = (T = null), b = p, x = (p = 0), R = null, N = w.next(); b !== null && !N.done; x++, N = w.next()) {
            b.index > x ? ((R = b), (b = null)) : (R = b.sibling);
            var L = d(h, b, N.value, C);
            if (L === null) {
                b === null && (b = R);
                break;
            }
            e && b && L.alternate === null && t(h, b),
                (p = i(L, p, x)),
                _ === null ? (T = L) : (_.sibling = L),
                (_ = L),
                (b = R);
        }
        if (N.done) return n(h, b), ne && Dn(h, x), T;
        if (b === null) {
            for (; !N.done; x++, N = w.next())
                (N = f(h, N.value, C)), N !== null && ((p = i(N, p, x)), _ === null ? (T = N) : (_.sibling = N), (_ = N));
            return ne && Dn(h, x), T;
        }
        for (b = r(h, b); !N.done; x++, N = w.next())
            (N = y(b, h, x, N.value, C)),
                N !== null &&
                    (e && N.alternate !== null && b.delete(N.key === null ? x : N.key),
                    (p = i(N, p, x)),
                    _ === null ? (T = N) : (_.sibling = N),
                    (_ = N));
        return (
            e &&
                b.forEach(function (I) {
                    return t(h, I);
                }),
            ne && Dn(h, x),
            T
        );
    }
    function S(h, p, w, C) {
        if (
            (typeof w == 'object' && w !== null && w.type === sr && w.key === null && (w = w.props.children),
            typeof w == 'object' && w !== null)
        ) {
            switch (w.$$typeof) {
                case fi:
                    e: {
                        for (var T = w.key, _ = p; _ !== null; ) {
                            if (_.key === T) {
                                if (((T = w.type), T === sr)) {
                                    if (_.tag === 7) {
                                        n(h, _.sibling), (p = o(_, w.props.children)), (p.return = h), (h = p);
                                        break e;
                                    }
                                } else if (
                                    _.elementType === T ||
                                    (typeof T == 'object' && T !== null && T.$$typeof === on && ud(T) === _.type)
                                ) {
                                    n(h, _.sibling), (p = o(_, w.props)), (p.ref = no(h, _, w)), (p.return = h), (h = p);
                                    break e;
                                }
                                n(h, _);
                                break;
                            } else t(h, _);
                            _ = _.sibling;
                        }
                        w.type === sr
                            ? ((p = zn(w.props.children, h.mode, C, w.key)), (p.return = h), (h = p))
                            : ((C = Yi(w.type, w.key, w.props, null, h.mode, C)),
                              (C.ref = no(h, p, w)),
                              (C.return = h),
                              (h = C));
                    }
                    return s(h);
                case ir:
                    e: {
                        for (_ = w.key; p !== null; ) {
                            if (p.key === _)
                                if (
                                    p.tag === 4 &&
                                    p.stateNode.containerInfo === w.containerInfo &&
                                    p.stateNode.implementation === w.implementation
                                ) {
                                    n(h, p.sibling), (p = o(p, w.children || [])), (p.return = h), (h = p);
                                    break e;
                                } else {
                                    n(h, p);
                                    break;
                                }
                            else t(h, p);
                            p = p.sibling;
                        }
                        (p = Zl(w, h.mode, C)), (p.return = h), (h = p);
                    }
                    return s(h);
                case on:
                    return (_ = w._init), S(h, p, _(w._payload), C);
            }
            if (uo(w)) return m(h, p, w, C);
            if (Qr(w)) return v(h, p, w, C);
            xi(h, w);
        }
        return (typeof w == 'string' && w !== '') || typeof w == 'number'
            ? ((w = '' + w),
              p !== null && p.tag === 6
                  ? (n(h, p.sibling), (p = o(p, w)), (p.return = h), (h = p))
                  : (n(h, p), (p = Jl(w, h.mode, C)), (p.return = h), (h = p)),
              s(h))
            : n(h, p);
    }
    return S;
}
var Pr = Zp(!0),
    eg = Zp(!1),
    xs = _n(null),
    Cs = null,
    pr = null,
    hu = null;
function pu() {
    hu = pr = Cs = null;
}
function gu(e) {
    var t = xs.current;
    te(xs), (e._currentValue = t);
}
function Za(e, t, n) {
    for (; e !== null; ) {
        var r = e.alternate;
        if (
            ((e.childLanes & t) !== t
                ? ((e.childLanes |= t), r !== null && (r.childLanes |= t))
                : r !== null && (r.childLanes & t) !== t && (r.childLanes |= t),
            e === n)
        )
            break;
        e = e.return;
    }
}
function Er(e, t) {
    (Cs = e),
        (hu = pr = null),
        (e = e.dependencies),
        e !== null && e.firstContext !== null && (e.lanes & t && (Le = !0), (e.firstContext = null));
}
function lt(e) {
    var t = e._currentValue;
    if (hu !== e)
        if (((e = { context: e, memoizedValue: t, next: null }), pr === null)) {
            if (Cs === null) throw Error(D(308));
            (pr = e), (Cs.dependencies = { lanes: 0, firstContext: e });
        } else pr = pr.next = e;
    return t;
}
var Mn = null;
function mu(e) {
    Mn === null ? (Mn = [e]) : Mn.push(e);
}
function tg(e, t, n, r) {
    var o = t.interleaved;
    return o === null ? ((n.next = n), mu(t)) : ((n.next = o.next), (o.next = n)), (t.interleaved = n), qt(e, r);
}
function qt(e, t) {
    e.lanes |= t;
    var n = e.alternate;
    for (n !== null && (n.lanes |= t), n = e, e = e.return; e !== null; )
        (e.childLanes |= t), (n = e.alternate), n !== null && (n.childLanes |= t), (n = e), (e = e.return);
    return n.tag === 3 ? n.stateNode : null;
}
var sn = !1;
function vu(e) {
    e.updateQueue = {
        baseState: e.memoizedState,
        firstBaseUpdate: null,
        lastBaseUpdate: null,
        shared: { pending: null, interleaved: null, lanes: 0 },
        effects: null,
    };
}
function ng(e, t) {
    (e = e.updateQueue),
        t.updateQueue === e &&
            (t.updateQueue = {
                baseState: e.baseState,
                firstBaseUpdate: e.firstBaseUpdate,
                lastBaseUpdate: e.lastBaseUpdate,
                shared: e.shared,
                effects: e.effects,
            });
}
function Ht(e, t) {
    return { eventTime: e, lane: t, tag: 0, payload: null, callback: null, next: null };
}
function gn(e, t, n) {
    var r = e.updateQueue;
    if (r === null) return null;
    if (((r = r.shared), G & 2)) {
        var o = r.pending;
        return o === null ? (t.next = t) : ((t.next = o.next), (o.next = t)), (r.pending = t), qt(e, n);
    }
    return (
        (o = r.interleaved),
        o === null ? ((t.next = t), mu(r)) : ((t.next = o.next), (o.next = t)),
        (r.interleaved = t),
        qt(e, n)
    );
}
function Hi(e, t, n) {
    if (((t = t.updateQueue), t !== null && ((t = t.shared), (n & 4194240) !== 0))) {
        var r = t.lanes;
        (r &= e.pendingLanes), (n |= r), (t.lanes = n), nu(e, n);
    }
}
function fd(e, t) {
    var n = e.updateQueue,
        r = e.alternate;
    if (r !== null && ((r = r.updateQueue), n === r)) {
        var o = null,
            i = null;
        if (((n = n.firstBaseUpdate), n !== null)) {
            do {
                var s = {
                    eventTime: n.eventTime,
                    lane: n.lane,
                    tag: n.tag,
                    payload: n.payload,
                    callback: n.callback,
                    next: null,
                };
                i === null ? (o = i = s) : (i = i.next = s), (n = n.next);
            } while (n !== null);
            i === null ? (o = i = t) : (i = i.next = t);
        } else o = i = t;
        (n = { baseState: r.baseState, firstBaseUpdate: o, lastBaseUpdate: i, shared: r.shared, effects: r.effects }),
            (e.updateQueue = n);
        return;
    }
    (e = n.lastBaseUpdate), e === null ? (n.firstBaseUpdate = t) : (e.next = t), (n.lastBaseUpdate = t);
}
function bs(e, t, n, r) {
    var o = e.updateQueue;
    sn = !1;
    var i = o.firstBaseUpdate,
        s = o.lastBaseUpdate,
        l = o.shared.pending;
    if (l !== null) {
        o.shared.pending = null;
        var a = l,
            c = a.next;
        (a.next = null), s === null ? (i = c) : (s.next = c), (s = a);
        var u = e.alternate;
        u !== null &&
            ((u = u.updateQueue),
            (l = u.lastBaseUpdate),
            l !== s && (l === null ? (u.firstBaseUpdate = c) : (l.next = c), (u.lastBaseUpdate = a)));
    }
    if (i !== null) {
        var f = o.baseState;
        (s = 0), (u = c = a = null), (l = i);
        do {
            var d = l.lane,
                y = l.eventTime;
            if ((r & d) === d) {
                u !== null &&
                    (u = u.next = { eventTime: y, lane: 0, tag: l.tag, payload: l.payload, callback: l.callback, next: null });
                e: {
                    var m = e,
                        v = l;
                    switch (((d = t), (y = n), v.tag)) {
                        case 1:
                            if (((m = v.payload), typeof m == 'function')) {
                                f = m.call(y, f, d);
                                break e;
                            }
                            f = m;
                            break e;
                        case 3:
                            m.flags = (m.flags & -65537) | 128;
                        case 0:
                            if (((m = v.payload), (d = typeof m == 'function' ? m.call(y, f, d) : m), d == null)) break e;
                            f = ie({}, f, d);
                            break e;
                        case 2:
                            sn = !0;
                    }
                }
                l.callback !== null &&
                    l.lane !== 0 &&
                    ((e.flags |= 64), (d = o.effects), d === null ? (o.effects = [l]) : d.push(l));
            } else
                (y = { eventTime: y, lane: d, tag: l.tag, payload: l.payload, callback: l.callback, next: null }),
                    u === null ? ((c = u = y), (a = f)) : (u = u.next = y),
                    (s |= d);
            if (((l = l.next), l === null)) {
                if (((l = o.shared.pending), l === null)) break;
                (d = l), (l = d.next), (d.next = null), (o.lastBaseUpdate = d), (o.shared.pending = null);
            }
        } while (!0);
        if (
            (u === null && (a = f),
            (o.baseState = a),
            (o.firstBaseUpdate = c),
            (o.lastBaseUpdate = u),
            (t = o.shared.interleaved),
            t !== null)
        ) {
            o = t;
            do (s |= o.lane), (o = o.next);
            while (o !== t);
        } else i === null && (o.shared.lanes = 0);
        (Vn |= s), (e.lanes = s), (e.memoizedState = f);
    }
}
function dd(e, t, n) {
    if (((e = t.effects), (t.effects = null), e !== null))
        for (t = 0; t < e.length; t++) {
            var r = e[t],
                o = r.callback;
            if (o !== null) {
                if (((r.callback = null), (r = n), typeof o != 'function')) throw Error(D(191, o));
                o.call(r);
            }
        }
}
var ni = {},
    Ot = _n(ni),
    zo = _n(ni),
    Uo = _n(ni);
function Ln(e) {
    if (e === ni) throw Error(D(174));
    return e;
}
function yu(e, t) {
    switch ((J(Uo, t), J(zo, e), J(Ot, ni), (e = t.nodeType), e)) {
        case 9:
        case 11:
            t = (t = t.documentElement) ? t.namespaceURI : Aa(null, '');
            break;
        default:
            (e = e === 8 ? t.parentNode : t), (t = e.namespaceURI || null), (e = e.tagName), (t = Aa(t, e));
    }
    te(Ot), J(Ot, t);
}
function Nr() {
    te(Ot), te(zo), te(Uo);
}
function rg(e) {
    Ln(Uo.current);
    var t = Ln(Ot.current),
        n = Aa(t, e.type);
    t !== n && (J(zo, e), J(Ot, n));
}
function wu(e) {
    zo.current === e && (te(Ot), te(zo));
}
var re = _n(0);
function Ts(e) {
    for (var t = e; t !== null; ) {
        if (t.tag === 13) {
            var n = t.memoizedState;
            if (n !== null && ((n = n.dehydrated), n === null || n.data === '$?' || n.data === '$!')) return t;
        } else if (t.tag === 19 && t.memoizedProps.revealOrder !== void 0) {
            if (t.flags & 128) return t;
        } else if (t.child !== null) {
            (t.child.return = t), (t = t.child);
            continue;
        }
        if (t === e) break;
        for (; t.sibling === null; ) {
            if (t.return === null || t.return === e) return null;
            t = t.return;
        }
        (t.sibling.return = t.return), (t = t.sibling);
    }
    return null;
}
var ql = [];
function Su() {
    for (var e = 0; e < ql.length; e++) ql[e]._workInProgressVersionPrimary = null;
    ql.length = 0;
}
var Wi = Xt.ReactCurrentDispatcher,
    Gl = Xt.ReactCurrentBatchConfig,
    Wn = 0,
    oe = null,
    pe = null,
    me = null,
    ks = !1,
    Co = !1,
    Bo = 0,
    p0 = 0;
function xe() {
    throw Error(D(321));
}
function Eu(e, t) {
    if (t === null) return !1;
    for (var n = 0; n < t.length && n < e.length; n++) if (!yt(e[n], t[n])) return !1;
    return !0;
}
function xu(e, t, n, r, o, i) {
    if (
        ((Wn = i),
        (oe = t),
        (t.memoizedState = null),
        (t.updateQueue = null),
        (t.lanes = 0),
        (Wi.current = e === null || e.memoizedState === null ? y0 : w0),
        (e = n(r, o)),
        Co)
    ) {
        i = 0;
        do {
            if (((Co = !1), (Bo = 0), 25 <= i)) throw Error(D(301));
            (i += 1), (me = pe = null), (t.updateQueue = null), (Wi.current = S0), (e = n(r, o));
        } while (Co);
    }
    if (((Wi.current = Rs), (t = pe !== null && pe.next !== null), (Wn = 0), (me = pe = oe = null), (ks = !1), t))
        throw Error(D(300));
    return e;
}
function Cu() {
    var e = Bo !== 0;
    return (Bo = 0), e;
}
function Tt() {
    var e = { memoizedState: null, baseState: null, baseQueue: null, queue: null, next: null };
    return me === null ? (oe.memoizedState = me = e) : (me = me.next = e), me;
}
function at() {
    if (pe === null) {
        var e = oe.alternate;
        e = e !== null ? e.memoizedState : null;
    } else e = pe.next;
    var t = me === null ? oe.memoizedState : me.next;
    if (t !== null) (me = t), (pe = e);
    else {
        if (e === null) throw Error(D(310));
        (pe = e),
            (e = {
                memoizedState: pe.memoizedState,
                baseState: pe.baseState,
                baseQueue: pe.baseQueue,
                queue: pe.queue,
                next: null,
            }),
            me === null ? (oe.memoizedState = me = e) : (me = me.next = e);
    }
    return me;
}
function $o(e, t) {
    return typeof t == 'function' ? t(e) : t;
}
function Kl(e) {
    var t = at(),
        n = t.queue;
    if (n === null) throw Error(D(311));
    n.lastRenderedReducer = e;
    var r = pe,
        o = r.baseQueue,
        i = n.pending;
    if (i !== null) {
        if (o !== null) {
            var s = o.next;
            (o.next = i.next), (i.next = s);
        }
        (r.baseQueue = o = i), (n.pending = null);
    }
    if (o !== null) {
        (i = o.next), (r = r.baseState);
        var l = (s = null),
            a = null,
            c = i;
        do {
            var u = c.lane;
            if ((Wn & u) === u)
                a !== null &&
                    (a = a.next =
                        { lane: 0, action: c.action, hasEagerState: c.hasEagerState, eagerState: c.eagerState, next: null }),
                    (r = c.hasEagerState ? c.eagerState : e(r, c.action));
            else {
                var f = { lane: u, action: c.action, hasEagerState: c.hasEagerState, eagerState: c.eagerState, next: null };
                a === null ? ((l = a = f), (s = r)) : (a = a.next = f), (oe.lanes |= u), (Vn |= u);
            }
            c = c.next;
        } while (c !== null && c !== i);
        a === null ? (s = r) : (a.next = l),
            yt(r, t.memoizedState) || (Le = !0),
            (t.memoizedState = r),
            (t.baseState = s),
            (t.baseQueue = a),
            (n.lastRenderedState = r);
    }
    if (((e = n.interleaved), e !== null)) {
        o = e;
        do (i = o.lane), (oe.lanes |= i), (Vn |= i), (o = o.next);
        while (o !== e);
    } else o === null && (n.lanes = 0);
    return [t.memoizedState, n.dispatch];
}
function Yl(e) {
    var t = at(),
        n = t.queue;
    if (n === null) throw Error(D(311));
    n.lastRenderedReducer = e;
    var r = n.dispatch,
        o = n.pending,
        i = t.memoizedState;
    if (o !== null) {
        n.pending = null;
        var s = (o = o.next);
        do (i = e(i, s.action)), (s = s.next);
        while (s !== o);
        yt(i, t.memoizedState) || (Le = !0),
            (t.memoizedState = i),
            t.baseQueue === null && (t.baseState = i),
            (n.lastRenderedState = i);
    }
    return [i, r];
}
function og() {}
function ig(e, t) {
    var n = oe,
        r = at(),
        o = t(),
        i = !yt(r.memoizedState, o);
    if (
        (i && ((r.memoizedState = o), (Le = !0)),
        (r = r.queue),
        bu(ag.bind(null, n, r, e), [e]),
        r.getSnapshot !== t || i || (me !== null && me.memoizedState.tag & 1))
    ) {
        if (((n.flags |= 2048), Ho(9, lg.bind(null, n, r, o, t), void 0, null), ve === null)) throw Error(D(349));
        Wn & 30 || sg(n, t, o);
    }
    return o;
}
function sg(e, t, n) {
    (e.flags |= 16384),
        (e = { getSnapshot: t, value: n }),
        (t = oe.updateQueue),
        t === null
            ? ((t = { lastEffect: null, stores: null }), (oe.updateQueue = t), (t.stores = [e]))
            : ((n = t.stores), n === null ? (t.stores = [e]) : n.push(e));
}
function lg(e, t, n, r) {
    (t.value = n), (t.getSnapshot = r), cg(t) && ug(e);
}
function ag(e, t, n) {
    return n(function () {
        cg(t) && ug(e);
    });
}
function cg(e) {
    var t = e.getSnapshot;
    e = e.value;
    try {
        var n = t();
        return !yt(e, n);
    } catch {
        return !0;
    }
}
function ug(e) {
    var t = qt(e, 1);
    t !== null && vt(t, e, 1, -1);
}
function hd(e) {
    var t = Tt();
    return (
        typeof e == 'function' && (e = e()),
        (t.memoizedState = t.baseState = e),
        (e = { pending: null, interleaved: null, lanes: 0, dispatch: null, lastRenderedReducer: $o, lastRenderedState: e }),
        (t.queue = e),
        (e = e.dispatch = v0.bind(null, oe, e)),
        [t.memoizedState, e]
    );
}
function Ho(e, t, n, r) {
    return (
        (e = { tag: e, create: t, destroy: n, deps: r, next: null }),
        (t = oe.updateQueue),
        t === null
            ? ((t = { lastEffect: null, stores: null }), (oe.updateQueue = t), (t.lastEffect = e.next = e))
            : ((n = t.lastEffect),
              n === null ? (t.lastEffect = e.next = e) : ((r = n.next), (n.next = e), (e.next = r), (t.lastEffect = e))),
        e
    );
}
function fg() {
    return at().memoizedState;
}
function Vi(e, t, n, r) {
    var o = Tt();
    (oe.flags |= e), (o.memoizedState = Ho(1 | t, n, void 0, r === void 0 ? null : r));
}
function Qs(e, t, n, r) {
    var o = at();
    r = r === void 0 ? null : r;
    var i = void 0;
    if (pe !== null) {
        var s = pe.memoizedState;
        if (((i = s.destroy), r !== null && Eu(r, s.deps))) {
            o.memoizedState = Ho(t, n, i, r);
            return;
        }
    }
    (oe.flags |= e), (o.memoizedState = Ho(1 | t, n, i, r));
}
function pd(e, t) {
    return Vi(8390656, 8, e, t);
}
function bu(e, t) {
    return Qs(2048, 8, e, t);
}
function dg(e, t) {
    return Qs(4, 2, e, t);
}
function hg(e, t) {
    return Qs(4, 4, e, t);
}
function pg(e, t) {
    if (typeof t == 'function')
        return (
            (e = e()),
            t(e),
            function () {
                t(null);
            }
        );
    if (t != null)
        return (
            (e = e()),
            (t.current = e),
            function () {
                t.current = null;
            }
        );
}
function gg(e, t, n) {
    return (n = n != null ? n.concat([e]) : null), Qs(4, 4, pg.bind(null, t, e), n);
}
function Tu() {}
function mg(e, t) {
    var n = at();
    t = t === void 0 ? null : t;
    var r = n.memoizedState;
    return r !== null && t !== null && Eu(t, r[1]) ? r[0] : ((n.memoizedState = [e, t]), e);
}
function vg(e, t) {
    var n = at();
    t = t === void 0 ? null : t;
    var r = n.memoizedState;
    return r !== null && t !== null && Eu(t, r[1]) ? r[0] : ((e = e()), (n.memoizedState = [e, t]), e);
}
function yg(e, t, n) {
    return Wn & 21
        ? (yt(n, t) || ((n = Cp()), (oe.lanes |= n), (Vn |= n), (e.baseState = !0)), t)
        : (e.baseState && ((e.baseState = !1), (Le = !0)), (e.memoizedState = n));
}
function g0(e, t) {
    var n = X;
    (X = n !== 0 && 4 > n ? n : 4), e(!0);
    var r = Gl.transition;
    Gl.transition = {};
    try {
        e(!1), t();
    } finally {
        (X = n), (Gl.transition = r);
    }
}
function wg() {
    return at().memoizedState;
}
function m0(e, t, n) {
    var r = vn(e);
    if (((n = { lane: r, action: n, hasEagerState: !1, eagerState: null, next: null }), Sg(e))) Eg(t, n);
    else if (((n = tg(e, t, n, r)), n !== null)) {
        var o = Pe();
        vt(n, e, r, o), xg(n, t, r);
    }
}
function v0(e, t, n) {
    var r = vn(e),
        o = { lane: r, action: n, hasEagerState: !1, eagerState: null, next: null };
    if (Sg(e)) Eg(t, o);
    else {
        var i = e.alternate;
        if (e.lanes === 0 && (i === null || i.lanes === 0) && ((i = t.lastRenderedReducer), i !== null))
            try {
                var s = t.lastRenderedState,
                    l = i(s, n);
                if (((o.hasEagerState = !0), (o.eagerState = l), yt(l, s))) {
                    var a = t.interleaved;
                    a === null ? ((o.next = o), mu(t)) : ((o.next = a.next), (a.next = o)), (t.interleaved = o);
                    return;
                }
            } catch {
            } finally {
            }
        (n = tg(e, t, o, r)), n !== null && ((o = Pe()), vt(n, e, r, o), xg(n, t, r));
    }
}
function Sg(e) {
    var t = e.alternate;
    return e === oe || (t !== null && t === oe);
}
function Eg(e, t) {
    Co = ks = !0;
    var n = e.pending;
    n === null ? (t.next = t) : ((t.next = n.next), (n.next = t)), (e.pending = t);
}
function xg(e, t, n) {
    if (n & 4194240) {
        var r = t.lanes;
        (r &= e.pendingLanes), (n |= r), (t.lanes = n), nu(e, n);
    }
}
var Rs = {
        readContext: lt,
        useCallback: xe,
        useContext: xe,
        useEffect: xe,
        useImperativeHandle: xe,
        useInsertionEffect: xe,
        useLayoutEffect: xe,
        useMemo: xe,
        useReducer: xe,
        useRef: xe,
        useState: xe,
        useDebugValue: xe,
        useDeferredValue: xe,
        useTransition: xe,
        useMutableSource: xe,
        useSyncExternalStore: xe,
        useId: xe,
        unstable_isNewReconciler: !1,
    },
    y0 = {
        readContext: lt,
        useCallback: function (e, t) {
            return (Tt().memoizedState = [e, t === void 0 ? null : t]), e;
        },
        useContext: lt,
        useEffect: pd,
        useImperativeHandle: function (e, t, n) {
            return (n = n != null ? n.concat([e]) : null), Vi(4194308, 4, pg.bind(null, t, e), n);
        },
        useLayoutEffect: function (e, t) {
            return Vi(4194308, 4, e, t);
        },
        useInsertionEffect: function (e, t) {
            return Vi(4, 2, e, t);
        },
        useMemo: function (e, t) {
            var n = Tt();
            return (t = t === void 0 ? null : t), (e = e()), (n.memoizedState = [e, t]), e;
        },
        useReducer: function (e, t, n) {
            var r = Tt();
            return (
                (t = n !== void 0 ? n(t) : t),
                (r.memoizedState = r.baseState = t),
                (e = {
                    pending: null,
                    interleaved: null,
                    lanes: 0,
                    dispatch: null,
                    lastRenderedReducer: e,
                    lastRenderedState: t,
                }),
                (r.queue = e),
                (e = e.dispatch = m0.bind(null, oe, e)),
                [r.memoizedState, e]
            );
        },
        useRef: function (e) {
            var t = Tt();
            return (e = { current: e }), (t.memoizedState = e);
        },
        useState: hd,
        useDebugValue: Tu,
        useDeferredValue: function (e) {
            return (Tt().memoizedState = e);
        },
        useTransition: function () {
            var e = hd(!1),
                t = e[0];
            return (e = g0.bind(null, e[1])), (Tt().memoizedState = e), [t, e];
        },
        useMutableSource: function () {},
        useSyncExternalStore: function (e, t, n) {
            var r = oe,
                o = Tt();
            if (ne) {
                if (n === void 0) throw Error(D(407));
                n = n();
            } else {
                if (((n = t()), ve === null)) throw Error(D(349));
                Wn & 30 || sg(r, t, n);
            }
            o.memoizedState = n;
            var i = { value: n, getSnapshot: t };
            return (
                (o.queue = i),
                pd(ag.bind(null, r, i, e), [e]),
                (r.flags |= 2048),
                Ho(9, lg.bind(null, r, i, n, t), void 0, null),
                n
            );
        },
        useId: function () {
            var e = Tt(),
                t = ve.identifierPrefix;
            if (ne) {
                var n = $t,
                    r = Bt;
                (n = (r & ~(1 << (32 - mt(r) - 1))).toString(32) + n),
                    (t = ':' + t + 'R' + n),
                    (n = Bo++),
                    0 < n && (t += 'H' + n.toString(32)),
                    (t += ':');
            } else (n = p0++), (t = ':' + t + 'r' + n.toString(32) + ':');
            return (e.memoizedState = t);
        },
        unstable_isNewReconciler: !1,
    },
    w0 = {
        readContext: lt,
        useCallback: mg,
        useContext: lt,
        useEffect: bu,
        useImperativeHandle: gg,
        useInsertionEffect: dg,
        useLayoutEffect: hg,
        useMemo: vg,
        useReducer: Kl,
        useRef: fg,
        useState: function () {
            return Kl($o);
        },
        useDebugValue: Tu,
        useDeferredValue: function (e) {
            var t = at();
            return yg(t, pe.memoizedState, e);
        },
        useTransition: function () {
            var e = Kl($o)[0],
                t = at().memoizedState;
            return [e, t];
        },
        useMutableSource: og,
        useSyncExternalStore: ig,
        useId: wg,
        unstable_isNewReconciler: !1,
    },
    S0 = {
        readContext: lt,
        useCallback: mg,
        useContext: lt,
        useEffect: bu,
        useImperativeHandle: gg,
        useInsertionEffect: dg,
        useLayoutEffect: hg,
        useMemo: vg,
        useReducer: Yl,
        useRef: fg,
        useState: function () {
            return Yl($o);
        },
        useDebugValue: Tu,
        useDeferredValue: function (e) {
            var t = at();
            return pe === null ? (t.memoizedState = e) : yg(t, pe.memoizedState, e);
        },
        useTransition: function () {
            var e = Yl($o)[0],
                t = at().memoizedState;
            return [e, t];
        },
        useMutableSource: og,
        useSyncExternalStore: ig,
        useId: wg,
        unstable_isNewReconciler: !1,
    };
function dt(e, t) {
    if (e && e.defaultProps) {
        (t = ie({}, t)), (e = e.defaultProps);
        for (var n in e) t[n] === void 0 && (t[n] = e[n]);
        return t;
    }
    return t;
}
function ec(e, t, n, r) {
    (t = e.memoizedState),
        (n = n(r, t)),
        (n = n == null ? t : ie({}, t, n)),
        (e.memoizedState = n),
        e.lanes === 0 && (e.updateQueue.baseState = n);
}
var Js = {
    isMounted: function (e) {
        return (e = e._reactInternals) ? Qn(e) === e : !1;
    },
    enqueueSetState: function (e, t, n) {
        e = e._reactInternals;
        var r = Pe(),
            o = vn(e),
            i = Ht(r, o);
        (i.payload = t), n != null && (i.callback = n), (t = gn(e, i, o)), t !== null && (vt(t, e, o, r), Hi(t, e, o));
    },
    enqueueReplaceState: function (e, t, n) {
        e = e._reactInternals;
        var r = Pe(),
            o = vn(e),
            i = Ht(r, o);
        (i.tag = 1),
            (i.payload = t),
            n != null && (i.callback = n),
            (t = gn(e, i, o)),
            t !== null && (vt(t, e, o, r), Hi(t, e, o));
    },
    enqueueForceUpdate: function (e, t) {
        e = e._reactInternals;
        var n = Pe(),
            r = vn(e),
            o = Ht(n, r);
        (o.tag = 2), t != null && (o.callback = t), (t = gn(e, o, r)), t !== null && (vt(t, e, r, n), Hi(t, e, r));
    },
};
function gd(e, t, n, r, o, i, s) {
    return (
        (e = e.stateNode),
        typeof e.shouldComponentUpdate == 'function'
            ? e.shouldComponentUpdate(r, i, s)
            : t.prototype && t.prototype.isPureReactComponent
              ? !Mo(n, r) || !Mo(o, i)
              : !0
    );
}
function Cg(e, t, n) {
    var r = !1,
        o = En,
        i = t.contextType;
    return (
        typeof i == 'object' && i !== null
            ? (i = lt(i))
            : ((o = je(t) ? $n : ke.current), (r = t.contextTypes), (i = (r = r != null) ? _r(e, o) : En)),
        (t = new t(n, i)),
        (e.memoizedState = t.state !== null && t.state !== void 0 ? t.state : null),
        (t.updater = Js),
        (e.stateNode = t),
        (t._reactInternals = e),
        r &&
            ((e = e.stateNode),
            (e.__reactInternalMemoizedUnmaskedChildContext = o),
            (e.__reactInternalMemoizedMaskedChildContext = i)),
        t
    );
}
function md(e, t, n, r) {
    (e = t.state),
        typeof t.componentWillReceiveProps == 'function' && t.componentWillReceiveProps(n, r),
        typeof t.UNSAFE_componentWillReceiveProps == 'function' && t.UNSAFE_componentWillReceiveProps(n, r),
        t.state !== e && Js.enqueueReplaceState(t, t.state, null);
}
function tc(e, t, n, r) {
    var o = e.stateNode;
    (o.props = n), (o.state = e.memoizedState), (o.refs = {}), vu(e);
    var i = t.contextType;
    typeof i == 'object' && i !== null ? (o.context = lt(i)) : ((i = je(t) ? $n : ke.current), (o.context = _r(e, i))),
        (o.state = e.memoizedState),
        (i = t.getDerivedStateFromProps),
        typeof i == 'function' && (ec(e, t, i, n), (o.state = e.memoizedState)),
        typeof t.getDerivedStateFromProps == 'function' ||
            typeof o.getSnapshotBeforeUpdate == 'function' ||
            (typeof o.UNSAFE_componentWillMount != 'function' && typeof o.componentWillMount != 'function') ||
            ((t = o.state),
            typeof o.componentWillMount == 'function' && o.componentWillMount(),
            typeof o.UNSAFE_componentWillMount == 'function' && o.UNSAFE_componentWillMount(),
            t !== o.state && Js.enqueueReplaceState(o, o.state, null),
            bs(e, n, o, r),
            (o.state = e.memoizedState)),
        typeof o.componentDidMount == 'function' && (e.flags |= 4194308);
}
function Dr(e, t) {
    try {
        var n = '',
            r = t;
        do (n += Kw(r)), (r = r.return);
        while (r);
        var o = n;
    } catch (i) {
        o =
            `
Error generating stack: ` +
            i.message +
            `
` +
            i.stack;
    }
    return { value: e, source: t, stack: o, digest: null };
}
function Xl(e, t, n) {
    return { value: e, source: null, stack: n ?? null, digest: t ?? null };
}
function nc(e, t) {
    try {
        console.error(t.value);
    } catch (n) {
        setTimeout(function () {
            throw n;
        });
    }
}
var E0 = typeof WeakMap == 'function' ? WeakMap : Map;
function bg(e, t, n) {
    (n = Ht(-1, n)), (n.tag = 3), (n.payload = { element: null });
    var r = t.value;
    return (
        (n.callback = function () {
            Os || ((Os = !0), (dc = r)), nc(e, t);
        }),
        n
    );
}
function Tg(e, t, n) {
    (n = Ht(-1, n)), (n.tag = 3);
    var r = e.type.getDerivedStateFromError;
    if (typeof r == 'function') {
        var o = t.value;
        (n.payload = function () {
            return r(o);
        }),
            (n.callback = function () {
                nc(e, t);
            });
    }
    var i = e.stateNode;
    return (
        i !== null &&
            typeof i.componentDidCatch == 'function' &&
            (n.callback = function () {
                nc(e, t), typeof r != 'function' && (mn === null ? (mn = new Set([this])) : mn.add(this));
                var s = t.stack;
                this.componentDidCatch(t.value, { componentStack: s !== null ? s : '' });
            }),
        n
    );
}
function vd(e, t, n) {
    var r = e.pingCache;
    if (r === null) {
        r = e.pingCache = new E0();
        var o = new Set();
        r.set(t, o);
    } else (o = r.get(t)), o === void 0 && ((o = new Set()), r.set(t, o));
    o.has(n) || (o.add(n), (e = M0.bind(null, e, t, n)), t.then(e, e));
}
function yd(e) {
    do {
        var t;
        if (((t = e.tag === 13) && ((t = e.memoizedState), (t = t !== null ? t.dehydrated !== null : !0)), t)) return e;
        e = e.return;
    } while (e !== null);
    return null;
}
function wd(e, t, n, r, o) {
    return e.mode & 1
        ? ((e.flags |= 65536), (e.lanes = o), e)
        : (e === t
              ? (e.flags |= 65536)
              : ((e.flags |= 128),
                (n.flags |= 131072),
                (n.flags &= -52805),
                n.tag === 1 && (n.alternate === null ? (n.tag = 17) : ((t = Ht(-1, 1)), (t.tag = 2), gn(n, t, 1))),
                (n.lanes |= 1)),
          e);
}
var x0 = Xt.ReactCurrentOwner,
    Le = !1;
function Oe(e, t, n, r) {
    t.child = e === null ? eg(t, null, n, r) : Pr(t, e.child, n, r);
}
function Sd(e, t, n, r, o) {
    n = n.render;
    var i = t.ref;
    return (
        Er(t, o),
        (r = xu(e, t, n, r, i, o)),
        (n = Cu()),
        e !== null && !Le
            ? ((t.updateQueue = e.updateQueue), (t.flags &= -2053), (e.lanes &= ~o), Gt(e, t, o))
            : (ne && n && uu(t), (t.flags |= 1), Oe(e, t, r, o), t.child)
    );
}
function Ed(e, t, n, r, o) {
    if (e === null) {
        var i = n.type;
        return typeof i == 'function' && !Au(i) && i.defaultProps === void 0 && n.compare === null && n.defaultProps === void 0
            ? ((t.tag = 15), (t.type = i), kg(e, t, i, r, o))
            : ((e = Yi(n.type, null, r, t, t.mode, o)), (e.ref = t.ref), (e.return = t), (t.child = e));
    }
    if (((i = e.child), !(e.lanes & o))) {
        var s = i.memoizedProps;
        if (((n = n.compare), (n = n !== null ? n : Mo), n(s, r) && e.ref === t.ref)) return Gt(e, t, o);
    }
    return (t.flags |= 1), (e = yn(i, r)), (e.ref = t.ref), (e.return = t), (t.child = e);
}
function kg(e, t, n, r, o) {
    if (e !== null) {
        var i = e.memoizedProps;
        if (Mo(i, r) && e.ref === t.ref)
            if (((Le = !1), (t.pendingProps = r = i), (e.lanes & o) !== 0)) e.flags & 131072 && (Le = !0);
            else return (t.lanes = e.lanes), Gt(e, t, o);
    }
    return rc(e, t, n, r, o);
}
function Rg(e, t, n) {
    var r = t.pendingProps,
        o = r.children,
        i = e !== null ? e.memoizedState : null;
    if (r.mode === 'hidden')
        if (!(t.mode & 1)) (t.memoizedState = { baseLanes: 0, cachePool: null, transitions: null }), J(mr, $e), ($e |= n);
        else {
            if (!(n & 1073741824))
                return (
                    (e = i !== null ? i.baseLanes | n : n),
                    (t.lanes = t.childLanes = 1073741824),
                    (t.memoizedState = { baseLanes: e, cachePool: null, transitions: null }),
                    (t.updateQueue = null),
                    J(mr, $e),
                    ($e |= e),
                    null
                );
            (t.memoizedState = { baseLanes: 0, cachePool: null, transitions: null }),
                (r = i !== null ? i.baseLanes : n),
                J(mr, $e),
                ($e |= r);
        }
    else i !== null ? ((r = i.baseLanes | n), (t.memoizedState = null)) : (r = n), J(mr, $e), ($e |= r);
    return Oe(e, t, o, n), t.child;
}
function _g(e, t) {
    var n = t.ref;
    ((e === null && n !== null) || (e !== null && e.ref !== n)) && ((t.flags |= 512), (t.flags |= 2097152));
}
function rc(e, t, n, r, o) {
    var i = je(n) ? $n : ke.current;
    return (
        (i = _r(t, i)),
        Er(t, o),
        (n = xu(e, t, n, r, i, o)),
        (r = Cu()),
        e !== null && !Le
            ? ((t.updateQueue = e.updateQueue), (t.flags &= -2053), (e.lanes &= ~o), Gt(e, t, o))
            : (ne && r && uu(t), (t.flags |= 1), Oe(e, t, n, o), t.child)
    );
}
function xd(e, t, n, r, o) {
    if (je(n)) {
        var i = !0;
        ws(t);
    } else i = !1;
    if ((Er(t, o), t.stateNode === null)) qi(e, t), Cg(t, n, r), tc(t, n, r, o), (r = !0);
    else if (e === null) {
        var s = t.stateNode,
            l = t.memoizedProps;
        s.props = l;
        var a = s.context,
            c = n.contextType;
        typeof c == 'object' && c !== null ? (c = lt(c)) : ((c = je(n) ? $n : ke.current), (c = _r(t, c)));
        var u = n.getDerivedStateFromProps,
            f = typeof u == 'function' || typeof s.getSnapshotBeforeUpdate == 'function';
        f ||
            (typeof s.UNSAFE_componentWillReceiveProps != 'function' && typeof s.componentWillReceiveProps != 'function') ||
            ((l !== r || a !== c) && md(t, s, r, c)),
            (sn = !1);
        var d = t.memoizedState;
        (s.state = d),
            bs(t, r, s, o),
            (a = t.memoizedState),
            l !== r || d !== a || Fe.current || sn
                ? (typeof u == 'function' && (ec(t, n, u, r), (a = t.memoizedState)),
                  (l = sn || gd(t, n, l, r, d, a, c))
                      ? (f ||
                            (typeof s.UNSAFE_componentWillMount != 'function' && typeof s.componentWillMount != 'function') ||
                            (typeof s.componentWillMount == 'function' && s.componentWillMount(),
                            typeof s.UNSAFE_componentWillMount == 'function' && s.UNSAFE_componentWillMount()),
                        typeof s.componentDidMount == 'function' && (t.flags |= 4194308))
                      : (typeof s.componentDidMount == 'function' && (t.flags |= 4194308),
                        (t.memoizedProps = r),
                        (t.memoizedState = a)),
                  (s.props = r),
                  (s.state = a),
                  (s.context = c),
                  (r = l))
                : (typeof s.componentDidMount == 'function' && (t.flags |= 4194308), (r = !1));
    } else {
        (s = t.stateNode),
            ng(e, t),
            (l = t.memoizedProps),
            (c = t.type === t.elementType ? l : dt(t.type, l)),
            (s.props = c),
            (f = t.pendingProps),
            (d = s.context),
            (a = n.contextType),
            typeof a == 'object' && a !== null ? (a = lt(a)) : ((a = je(n) ? $n : ke.current), (a = _r(t, a)));
        var y = n.getDerivedStateFromProps;
        (u = typeof y == 'function' || typeof s.getSnapshotBeforeUpdate == 'function') ||
            (typeof s.UNSAFE_componentWillReceiveProps != 'function' && typeof s.componentWillReceiveProps != 'function') ||
            ((l !== f || d !== a) && md(t, s, r, a)),
            (sn = !1),
            (d = t.memoizedState),
            (s.state = d),
            bs(t, r, s, o);
        var m = t.memoizedState;
        l !== f || d !== m || Fe.current || sn
            ? (typeof y == 'function' && (ec(t, n, y, r), (m = t.memoizedState)),
              (c = sn || gd(t, n, c, r, d, m, a) || !1)
                  ? (u ||
                        (typeof s.UNSAFE_componentWillUpdate != 'function' && typeof s.componentWillUpdate != 'function') ||
                        (typeof s.componentWillUpdate == 'function' && s.componentWillUpdate(r, m, a),
                        typeof s.UNSAFE_componentWillUpdate == 'function' && s.UNSAFE_componentWillUpdate(r, m, a)),
                    typeof s.componentDidUpdate == 'function' && (t.flags |= 4),
                    typeof s.getSnapshotBeforeUpdate == 'function' && (t.flags |= 1024))
                  : (typeof s.componentDidUpdate != 'function' ||
                        (l === e.memoizedProps && d === e.memoizedState) ||
                        (t.flags |= 4),
                    typeof s.getSnapshotBeforeUpdate != 'function' ||
                        (l === e.memoizedProps && d === e.memoizedState) ||
                        (t.flags |= 1024),
                    (t.memoizedProps = r),
                    (t.memoizedState = m)),
              (s.props = r),
              (s.state = m),
              (s.context = a),
              (r = c))
            : (typeof s.componentDidUpdate != 'function' || (l === e.memoizedProps && d === e.memoizedState) || (t.flags |= 4),
              typeof s.getSnapshotBeforeUpdate != 'function' ||
                  (l === e.memoizedProps && d === e.memoizedState) ||
                  (t.flags |= 1024),
              (r = !1));
    }
    return oc(e, t, n, r, i, o);
}
function oc(e, t, n, r, o, i) {
    _g(e, t);
    var s = (t.flags & 128) !== 0;
    if (!r && !s) return o && ld(t, n, !1), Gt(e, t, i);
    (r = t.stateNode), (x0.current = t);
    var l = s && typeof n.getDerivedStateFromError != 'function' ? null : r.render();
    return (
        (t.flags |= 1),
        e !== null && s ? ((t.child = Pr(t, e.child, null, i)), (t.child = Pr(t, null, l, i))) : Oe(e, t, l, i),
        (t.memoizedState = r.state),
        o && ld(t, n, !0),
        t.child
    );
}
function Og(e) {
    var t = e.stateNode;
    t.pendingContext ? sd(e, t.pendingContext, t.pendingContext !== t.context) : t.context && sd(e, t.context, !1),
        yu(e, t.containerInfo);
}
function Cd(e, t, n, r, o) {
    return Or(), du(o), (t.flags |= 256), Oe(e, t, n, r), t.child;
}
var ic = { dehydrated: null, treeContext: null, retryLane: 0 };
function sc(e) {
    return { baseLanes: e, cachePool: null, transitions: null };
}
function Pg(e, t, n) {
    var r = t.pendingProps,
        o = re.current,
        i = !1,
        s = (t.flags & 128) !== 0,
        l;
    if (
        ((l = s) || (l = e !== null && e.memoizedState === null ? !1 : (o & 2) !== 0),
        l ? ((i = !0), (t.flags &= -129)) : (e === null || e.memoizedState !== null) && (o |= 1),
        J(re, o & 1),
        e === null)
    )
        return (
            Ja(t),
            (e = t.memoizedState),
            e !== null && ((e = e.dehydrated), e !== null)
                ? (t.mode & 1 ? (e.data === '$!' ? (t.lanes = 8) : (t.lanes = 1073741824)) : (t.lanes = 1), null)
                : ((s = r.children),
                  (e = r.fallback),
                  i
                      ? ((r = t.mode),
                        (i = t.child),
                        (s = { mode: 'hidden', children: s }),
                        !(r & 1) && i !== null ? ((i.childLanes = 0), (i.pendingProps = s)) : (i = tl(s, r, 0, null)),
                        (e = zn(e, r, n, null)),
                        (i.return = t),
                        (e.return = t),
                        (i.sibling = e),
                        (t.child = i),
                        (t.child.memoizedState = sc(n)),
                        (t.memoizedState = ic),
                        e)
                      : ku(t, s))
        );
    if (((o = e.memoizedState), o !== null && ((l = o.dehydrated), l !== null))) return C0(e, t, s, r, l, o, n);
    if (i) {
        (i = r.fallback), (s = t.mode), (o = e.child), (l = o.sibling);
        var a = { mode: 'hidden', children: r.children };
        return (
            !(s & 1) && t.child !== o
                ? ((r = t.child), (r.childLanes = 0), (r.pendingProps = a), (t.deletions = null))
                : ((r = yn(o, a)), (r.subtreeFlags = o.subtreeFlags & 14680064)),
            l !== null ? (i = yn(l, i)) : ((i = zn(i, s, n, null)), (i.flags |= 2)),
            (i.return = t),
            (r.return = t),
            (r.sibling = i),
            (t.child = r),
            (r = i),
            (i = t.child),
            (s = e.child.memoizedState),
            (s = s === null ? sc(n) : { baseLanes: s.baseLanes | n, cachePool: null, transitions: s.transitions }),
            (i.memoizedState = s),
            (i.childLanes = e.childLanes & ~n),
            (t.memoizedState = ic),
            r
        );
    }
    return (
        (i = e.child),
        (e = i.sibling),
        (r = yn(i, { mode: 'visible', children: r.children })),
        !(t.mode & 1) && (r.lanes = n),
        (r.return = t),
        (r.sibling = null),
        e !== null && ((n = t.deletions), n === null ? ((t.deletions = [e]), (t.flags |= 16)) : n.push(e)),
        (t.child = r),
        (t.memoizedState = null),
        r
    );
}
function ku(e, t) {
    return (t = tl({ mode: 'visible', children: t }, e.mode, 0, null)), (t.return = e), (e.child = t);
}
function Ci(e, t, n, r) {
    return (
        r !== null && du(r),
        Pr(t, e.child, null, n),
        (e = ku(t, t.pendingProps.children)),
        (e.flags |= 2),
        (t.memoizedState = null),
        e
    );
}
function C0(e, t, n, r, o, i, s) {
    if (n)
        return t.flags & 256
            ? ((t.flags &= -257), (r = Xl(Error(D(422)))), Ci(e, t, s, r))
            : t.memoizedState !== null
              ? ((t.child = e.child), (t.flags |= 128), null)
              : ((i = r.fallback),
                (o = t.mode),
                (r = tl({ mode: 'visible', children: r.children }, o, 0, null)),
                (i = zn(i, o, s, null)),
                (i.flags |= 2),
                (r.return = t),
                (i.return = t),
                (r.sibling = i),
                (t.child = r),
                t.mode & 1 && Pr(t, e.child, null, s),
                (t.child.memoizedState = sc(s)),
                (t.memoizedState = ic),
                i);
    if (!(t.mode & 1)) return Ci(e, t, s, null);
    if (o.data === '$!') {
        if (((r = o.nextSibling && o.nextSibling.dataset), r)) var l = r.dgst;
        return (r = l), (i = Error(D(419))), (r = Xl(i, r, void 0)), Ci(e, t, s, r);
    }
    if (((l = (s & e.childLanes) !== 0), Le || l)) {
        if (((r = ve), r !== null)) {
            switch (s & -s) {
                case 4:
                    o = 2;
                    break;
                case 16:
                    o = 8;
                    break;
                case 64:
                case 128:
                case 256:
                case 512:
                case 1024:
                case 2048:
                case 4096:
                case 8192:
                case 16384:
                case 32768:
                case 65536:
                case 131072:
                case 262144:
                case 524288:
                case 1048576:
                case 2097152:
                case 4194304:
                case 8388608:
                case 16777216:
                case 33554432:
                case 67108864:
                    o = 32;
                    break;
                case 536870912:
                    o = 268435456;
                    break;
                default:
                    o = 0;
            }
            (o = o & (r.suspendedLanes | s) ? 0 : o),
                o !== 0 && o !== i.retryLane && ((i.retryLane = o), qt(e, o), vt(r, e, o, -1));
        }
        return Du(), (r = Xl(Error(D(421)))), Ci(e, t, s, r);
    }
    return o.data === '$?'
        ? ((t.flags |= 128), (t.child = e.child), (t = L0.bind(null, e)), (o._reactRetry = t), null)
        : ((e = i.treeContext),
          (We = pn(o.nextSibling)),
          (Ve = t),
          (ne = !0),
          (gt = null),
          e !== null && ((et[tt++] = Bt), (et[tt++] = $t), (et[tt++] = Hn), (Bt = e.id), ($t = e.overflow), (Hn = t)),
          (t = ku(t, r.children)),
          (t.flags |= 4096),
          t);
}
function bd(e, t, n) {
    e.lanes |= t;
    var r = e.alternate;
    r !== null && (r.lanes |= t), Za(e.return, t, n);
}
function Ql(e, t, n, r, o) {
    var i = e.memoizedState;
    i === null
        ? (e.memoizedState = { isBackwards: t, rendering: null, renderingStartTime: 0, last: r, tail: n, tailMode: o })
        : ((i.isBackwards = t), (i.rendering = null), (i.renderingStartTime = 0), (i.last = r), (i.tail = n), (i.tailMode = o));
}
function Ng(e, t, n) {
    var r = t.pendingProps,
        o = r.revealOrder,
        i = r.tail;
    if ((Oe(e, t, r.children, n), (r = re.current), r & 2)) (r = (r & 1) | 2), (t.flags |= 128);
    else {
        if (e !== null && e.flags & 128)
            e: for (e = t.child; e !== null; ) {
                if (e.tag === 13) e.memoizedState !== null && bd(e, n, t);
                else if (e.tag === 19) bd(e, n, t);
                else if (e.child !== null) {
                    (e.child.return = e), (e = e.child);
                    continue;
                }
                if (e === t) break e;
                for (; e.sibling === null; ) {
                    if (e.return === null || e.return === t) break e;
                    e = e.return;
                }
                (e.sibling.return = e.return), (e = e.sibling);
            }
        r &= 1;
    }
    if ((J(re, r), !(t.mode & 1))) t.memoizedState = null;
    else
        switch (o) {
            case 'forwards':
                for (n = t.child, o = null; n !== null; )
                    (e = n.alternate), e !== null && Ts(e) === null && (o = n), (n = n.sibling);
                (n = o),
                    n === null ? ((o = t.child), (t.child = null)) : ((o = n.sibling), (n.sibling = null)),
                    Ql(t, !1, o, n, i);
                break;
            case 'backwards':
                for (n = null, o = t.child, t.child = null; o !== null; ) {
                    if (((e = o.alternate), e !== null && Ts(e) === null)) {
                        t.child = o;
                        break;
                    }
                    (e = o.sibling), (o.sibling = n), (n = o), (o = e);
                }
                Ql(t, !0, n, null, i);
                break;
            case 'together':
                Ql(t, !1, null, null, void 0);
                break;
            default:
                t.memoizedState = null;
        }
    return t.child;
}
function qi(e, t) {
    !(t.mode & 1) && e !== null && ((e.alternate = null), (t.alternate = null), (t.flags |= 2));
}
function Gt(e, t, n) {
    if ((e !== null && (t.dependencies = e.dependencies), (Vn |= t.lanes), !(n & t.childLanes))) return null;
    if (e !== null && t.child !== e.child) throw Error(D(153));
    if (t.child !== null) {
        for (e = t.child, n = yn(e, e.pendingProps), t.child = n, n.return = t; e.sibling !== null; )
            (e = e.sibling), (n = n.sibling = yn(e, e.pendingProps)), (n.return = t);
        n.sibling = null;
    }
    return t.child;
}
function b0(e, t, n) {
    switch (t.tag) {
        case 3:
            Og(t), Or();
            break;
        case 5:
            rg(t);
            break;
        case 1:
            je(t.type) && ws(t);
            break;
        case 4:
            yu(t, t.stateNode.containerInfo);
            break;
        case 10:
            var r = t.type._context,
                o = t.memoizedProps.value;
            J(xs, r._currentValue), (r._currentValue = o);
            break;
        case 13:
            if (((r = t.memoizedState), r !== null))
                return r.dehydrated !== null
                    ? (J(re, re.current & 1), (t.flags |= 128), null)
                    : n & t.child.childLanes
                      ? Pg(e, t, n)
                      : (J(re, re.current & 1), (e = Gt(e, t, n)), e !== null ? e.sibling : null);
            J(re, re.current & 1);
            break;
        case 19:
            if (((r = (n & t.childLanes) !== 0), e.flags & 128)) {
                if (r) return Ng(e, t, n);
                t.flags |= 128;
            }
            if (
                ((o = t.memoizedState),
                o !== null && ((o.rendering = null), (o.tail = null), (o.lastEffect = null)),
                J(re, re.current),
                r)
            )
                break;
            return null;
        case 22:
        case 23:
            return (t.lanes = 0), Rg(e, t, n);
    }
    return Gt(e, t, n);
}
var Dg, lc, Ag, Ig;
Dg = function (e, t) {
    for (var n = t.child; n !== null; ) {
        if (n.tag === 5 || n.tag === 6) e.appendChild(n.stateNode);
        else if (n.tag !== 4 && n.child !== null) {
            (n.child.return = n), (n = n.child);
            continue;
        }
        if (n === t) break;
        for (; n.sibling === null; ) {
            if (n.return === null || n.return === t) return;
            n = n.return;
        }
        (n.sibling.return = n.return), (n = n.sibling);
    }
};
lc = function () {};
Ag = function (e, t, n, r) {
    var o = e.memoizedProps;
    if (o !== r) {
        (e = t.stateNode), Ln(Ot.current);
        var i = null;
        switch (n) {
            case 'input':
                (o = Oa(e, o)), (r = Oa(e, r)), (i = []);
                break;
            case 'select':
                (o = ie({}, o, { value: void 0 })), (r = ie({}, r, { value: void 0 })), (i = []);
                break;
            case 'textarea':
                (o = Da(e, o)), (r = Da(e, r)), (i = []);
                break;
            default:
                typeof o.onClick != 'function' && typeof r.onClick == 'function' && (e.onclick = vs);
        }
        Ia(n, r);
        var s;
        n = null;
        for (c in o)
            if (!r.hasOwnProperty(c) && o.hasOwnProperty(c) && o[c] != null)
                if (c === 'style') {
                    var l = o[c];
                    for (s in l) l.hasOwnProperty(s) && (n || (n = {}), (n[s] = ''));
                } else
                    c !== 'dangerouslySetInnerHTML' &&
                        c !== 'children' &&
                        c !== 'suppressContentEditableWarning' &&
                        c !== 'suppressHydrationWarning' &&
                        c !== 'autoFocus' &&
                        (_o.hasOwnProperty(c) ? i || (i = []) : (i = i || []).push(c, null));
        for (c in r) {
            var a = r[c];
            if (((l = o != null ? o[c] : void 0), r.hasOwnProperty(c) && a !== l && (a != null || l != null)))
                if (c === 'style')
                    if (l) {
                        for (s in l) !l.hasOwnProperty(s) || (a && a.hasOwnProperty(s)) || (n || (n = {}), (n[s] = ''));
                        for (s in a) a.hasOwnProperty(s) && l[s] !== a[s] && (n || (n = {}), (n[s] = a[s]));
                    } else n || (i || (i = []), i.push(c, n)), (n = a);
                else
                    c === 'dangerouslySetInnerHTML'
                        ? ((a = a ? a.__html : void 0),
                          (l = l ? l.__html : void 0),
                          a != null && l !== a && (i = i || []).push(c, a))
                        : c === 'children'
                          ? (typeof a != 'string' && typeof a != 'number') || (i = i || []).push(c, '' + a)
                          : c !== 'suppressContentEditableWarning' &&
                            c !== 'suppressHydrationWarning' &&
                            (_o.hasOwnProperty(c)
                                ? (a != null && c === 'onScroll' && ee('scroll', e), i || l === a || (i = []))
                                : (i = i || []).push(c, a));
        }
        n && (i = i || []).push('style', n);
        var c = i;
        (t.updateQueue = c) && (t.flags |= 4);
    }
};
Ig = function (e, t, n, r) {
    n !== r && (t.flags |= 4);
};
function ro(e, t) {
    if (!ne)
        switch (e.tailMode) {
            case 'hidden':
                t = e.tail;
                for (var n = null; t !== null; ) t.alternate !== null && (n = t), (t = t.sibling);
                n === null ? (e.tail = null) : (n.sibling = null);
                break;
            case 'collapsed':
                n = e.tail;
                for (var r = null; n !== null; ) n.alternate !== null && (r = n), (n = n.sibling);
                r === null ? (t || e.tail === null ? (e.tail = null) : (e.tail.sibling = null)) : (r.sibling = null);
        }
}
function Ce(e) {
    var t = e.alternate !== null && e.alternate.child === e.child,
        n = 0,
        r = 0;
    if (t)
        for (var o = e.child; o !== null; )
            (n |= o.lanes | o.childLanes),
                (r |= o.subtreeFlags & 14680064),
                (r |= o.flags & 14680064),
                (o.return = e),
                (o = o.sibling);
    else
        for (o = e.child; o !== null; )
            (n |= o.lanes | o.childLanes), (r |= o.subtreeFlags), (r |= o.flags), (o.return = e), (o = o.sibling);
    return (e.subtreeFlags |= r), (e.childLanes = n), t;
}
function T0(e, t, n) {
    var r = t.pendingProps;
    switch ((fu(t), t.tag)) {
        case 2:
        case 16:
        case 15:
        case 0:
        case 11:
        case 7:
        case 8:
        case 12:
        case 9:
        case 14:
            return Ce(t), null;
        case 1:
            return je(t.type) && ys(), Ce(t), null;
        case 3:
            return (
                (r = t.stateNode),
                Nr(),
                te(Fe),
                te(ke),
                Su(),
                r.pendingContext && ((r.context = r.pendingContext), (r.pendingContext = null)),
                (e === null || e.child === null) &&
                    (Ei(t)
                        ? (t.flags |= 4)
                        : e === null ||
                          (e.memoizedState.isDehydrated && !(t.flags & 256)) ||
                          ((t.flags |= 1024), gt !== null && (gc(gt), (gt = null)))),
                lc(e, t),
                Ce(t),
                null
            );
        case 5:
            wu(t);
            var o = Ln(Uo.current);
            if (((n = t.type), e !== null && t.stateNode != null))
                Ag(e, t, n, r, o), e.ref !== t.ref && ((t.flags |= 512), (t.flags |= 2097152));
            else {
                if (!r) {
                    if (t.stateNode === null) throw Error(D(166));
                    return Ce(t), null;
                }
                if (((e = Ln(Ot.current)), Ei(t))) {
                    (r = t.stateNode), (n = t.type);
                    var i = t.memoizedProps;
                    switch (((r[kt] = t), (r[jo] = i), (e = (t.mode & 1) !== 0), n)) {
                        case 'dialog':
                            ee('cancel', r), ee('close', r);
                            break;
                        case 'iframe':
                        case 'object':
                        case 'embed':
                            ee('load', r);
                            break;
                        case 'video':
                        case 'audio':
                            for (o = 0; o < ho.length; o++) ee(ho[o], r);
                            break;
                        case 'source':
                            ee('error', r);
                            break;
                        case 'img':
                        case 'image':
                        case 'link':
                            ee('error', r), ee('load', r);
                            break;
                        case 'details':
                            ee('toggle', r);
                            break;
                        case 'input':
                            Af(r, i), ee('invalid', r);
                            break;
                        case 'select':
                            (r._wrapperState = { wasMultiple: !!i.multiple }), ee('invalid', r);
                            break;
                        case 'textarea':
                            Mf(r, i), ee('invalid', r);
                    }
                    Ia(n, i), (o = null);
                    for (var s in i)
                        if (i.hasOwnProperty(s)) {
                            var l = i[s];
                            s === 'children'
                                ? typeof l == 'string'
                                    ? r.textContent !== l &&
                                      (i.suppressHydrationWarning !== !0 && Si(r.textContent, l, e), (o = ['children', l]))
                                    : typeof l == 'number' &&
                                      r.textContent !== '' + l &&
                                      (i.suppressHydrationWarning !== !0 && Si(r.textContent, l, e), (o = ['children', '' + l]))
                                : _o.hasOwnProperty(s) && l != null && s === 'onScroll' && ee('scroll', r);
                        }
                    switch (n) {
                        case 'input':
                            di(r), If(r, i, !0);
                            break;
                        case 'textarea':
                            di(r), Lf(r);
                            break;
                        case 'select':
                        case 'option':
                            break;
                        default:
                            typeof i.onClick == 'function' && (r.onclick = vs);
                    }
                    (r = o), (t.updateQueue = r), r !== null && (t.flags |= 4);
                } else {
                    (s = o.nodeType === 9 ? o : o.ownerDocument),
                        e === 'http://www.w3.org/1999/xhtml' && (e = ap(n)),
                        e === 'http://www.w3.org/1999/xhtml'
                            ? n === 'script'
                                ? ((e = s.createElement('div')),
                                  (e.innerHTML = '<script><\/script>'),
                                  (e = e.removeChild(e.firstChild)))
                                : typeof r.is == 'string'
                                  ? (e = s.createElement(n, { is: r.is }))
                                  : ((e = s.createElement(n)),
                                    n === 'select' && ((s = e), r.multiple ? (s.multiple = !0) : r.size && (s.size = r.size)))
                            : (e = s.createElementNS(e, n)),
                        (e[kt] = t),
                        (e[jo] = r),
                        Dg(e, t, !1, !1),
                        (t.stateNode = e);
                    e: {
                        switch (((s = Ma(n, r)), n)) {
                            case 'dialog':
                                ee('cancel', e), ee('close', e), (o = r);
                                break;
                            case 'iframe':
                            case 'object':
                            case 'embed':
                                ee('load', e), (o = r);
                                break;
                            case 'video':
                            case 'audio':
                                for (o = 0; o < ho.length; o++) ee(ho[o], e);
                                o = r;
                                break;
                            case 'source':
                                ee('error', e), (o = r);
                                break;
                            case 'img':
                            case 'image':
                            case 'link':
                                ee('error', e), ee('load', e), (o = r);
                                break;
                            case 'details':
                                ee('toggle', e), (o = r);
                                break;
                            case 'input':
                                Af(e, r), (o = Oa(e, r)), ee('invalid', e);
                                break;
                            case 'option':
                                o = r;
                                break;
                            case 'select':
                                (e._wrapperState = { wasMultiple: !!r.multiple }),
                                    (o = ie({}, r, { value: void 0 })),
                                    ee('invalid', e);
                                break;
                            case 'textarea':
                                Mf(e, r), (o = Da(e, r)), ee('invalid', e);
                                break;
                            default:
                                o = r;
                        }
                        Ia(n, o), (l = o);
                        for (i in l)
                            if (l.hasOwnProperty(i)) {
                                var a = l[i];
                                i === 'style'
                                    ? fp(e, a)
                                    : i === 'dangerouslySetInnerHTML'
                                      ? ((a = a ? a.__html : void 0), a != null && cp(e, a))
                                      : i === 'children'
                                        ? typeof a == 'string'
                                            ? (n !== 'textarea' || a !== '') && Oo(e, a)
                                            : typeof a == 'number' && Oo(e, '' + a)
                                        : i !== 'suppressContentEditableWarning' &&
                                          i !== 'suppressHydrationWarning' &&
                                          i !== 'autoFocus' &&
                                          (_o.hasOwnProperty(i)
                                              ? a != null && i === 'onScroll' && ee('scroll', e)
                                              : a != null && Xc(e, i, a, s));
                            }
                        switch (n) {
                            case 'input':
                                di(e), If(e, r, !1);
                                break;
                            case 'textarea':
                                di(e), Lf(e);
                                break;
                            case 'option':
                                r.value != null && e.setAttribute('value', '' + Sn(r.value));
                                break;
                            case 'select':
                                (e.multiple = !!r.multiple),
                                    (i = r.value),
                                    i != null
                                        ? vr(e, !!r.multiple, i, !1)
                                        : r.defaultValue != null && vr(e, !!r.multiple, r.defaultValue, !0);
                                break;
                            default:
                                typeof o.onClick == 'function' && (e.onclick = vs);
                        }
                        switch (n) {
                            case 'button':
                            case 'input':
                            case 'select':
                            case 'textarea':
                                r = !!r.autoFocus;
                                break e;
                            case 'img':
                                r = !0;
                                break e;
                            default:
                                r = !1;
                        }
                    }
                    r && (t.flags |= 4);
                }
                t.ref !== null && ((t.flags |= 512), (t.flags |= 2097152));
            }
            return Ce(t), null;
        case 6:
            if (e && t.stateNode != null) Ig(e, t, e.memoizedProps, r);
            else {
                if (typeof r != 'string' && t.stateNode === null) throw Error(D(166));
                if (((n = Ln(Uo.current)), Ln(Ot.current), Ei(t))) {
                    if (
                        ((r = t.stateNode),
                        (n = t.memoizedProps),
                        (r[kt] = t),
                        (i = r.nodeValue !== n) && ((e = Ve), e !== null))
                    )
                        switch (e.tag) {
                            case 3:
                                Si(r.nodeValue, n, (e.mode & 1) !== 0);
                                break;
                            case 5:
                                e.memoizedProps.suppressHydrationWarning !== !0 && Si(r.nodeValue, n, (e.mode & 1) !== 0);
                        }
                    i && (t.flags |= 4);
                } else (r = (n.nodeType === 9 ? n : n.ownerDocument).createTextNode(r)), (r[kt] = t), (t.stateNode = r);
            }
            return Ce(t), null;
        case 13:
            if (
                (te(re), (r = t.memoizedState), e === null || (e.memoizedState !== null && e.memoizedState.dehydrated !== null))
            ) {
                if (ne && We !== null && t.mode & 1 && !(t.flags & 128)) Jp(), Or(), (t.flags |= 98560), (i = !1);
                else if (((i = Ei(t)), r !== null && r.dehydrated !== null)) {
                    if (e === null) {
                        if (!i) throw Error(D(318));
                        if (((i = t.memoizedState), (i = i !== null ? i.dehydrated : null), !i)) throw Error(D(317));
                        i[kt] = t;
                    } else Or(), !(t.flags & 128) && (t.memoizedState = null), (t.flags |= 4);
                    Ce(t), (i = !1);
                } else gt !== null && (gc(gt), (gt = null)), (i = !0);
                if (!i) return t.flags & 65536 ? t : null;
            }
            return t.flags & 128
                ? ((t.lanes = n), t)
                : ((r = r !== null),
                  r !== (e !== null && e.memoizedState !== null) &&
                      r &&
                      ((t.child.flags |= 8192), t.mode & 1 && (e === null || re.current & 1 ? ge === 0 && (ge = 3) : Du())),
                  t.updateQueue !== null && (t.flags |= 4),
                  Ce(t),
                  null);
        case 4:
            return Nr(), lc(e, t), e === null && Lo(t.stateNode.containerInfo), Ce(t), null;
        case 10:
            return gu(t.type._context), Ce(t), null;
        case 17:
            return je(t.type) && ys(), Ce(t), null;
        case 19:
            if ((te(re), (i = t.memoizedState), i === null)) return Ce(t), null;
            if (((r = (t.flags & 128) !== 0), (s = i.rendering), s === null))
                if (r) ro(i, !1);
                else {
                    if (ge !== 0 || (e !== null && e.flags & 128))
                        for (e = t.child; e !== null; ) {
                            if (((s = Ts(e)), s !== null)) {
                                for (
                                    t.flags |= 128,
                                        ro(i, !1),
                                        r = s.updateQueue,
                                        r !== null && ((t.updateQueue = r), (t.flags |= 4)),
                                        t.subtreeFlags = 0,
                                        r = n,
                                        n = t.child;
                                    n !== null;

                                )
                                    (i = n),
                                        (e = r),
                                        (i.flags &= 14680066),
                                        (s = i.alternate),
                                        s === null
                                            ? ((i.childLanes = 0),
                                              (i.lanes = e),
                                              (i.child = null),
                                              (i.subtreeFlags = 0),
                                              (i.memoizedProps = null),
                                              (i.memoizedState = null),
                                              (i.updateQueue = null),
                                              (i.dependencies = null),
                                              (i.stateNode = null))
                                            : ((i.childLanes = s.childLanes),
                                              (i.lanes = s.lanes),
                                              (i.child = s.child),
                                              (i.subtreeFlags = 0),
                                              (i.deletions = null),
                                              (i.memoizedProps = s.memoizedProps),
                                              (i.memoizedState = s.memoizedState),
                                              (i.updateQueue = s.updateQueue),
                                              (i.type = s.type),
                                              (e = s.dependencies),
                                              (i.dependencies =
                                                  e === null ? null : { lanes: e.lanes, firstContext: e.firstContext })),
                                        (n = n.sibling);
                                return J(re, (re.current & 1) | 2), t.child;
                            }
                            e = e.sibling;
                        }
                    i.tail !== null && ae() > Ar && ((t.flags |= 128), (r = !0), ro(i, !1), (t.lanes = 4194304));
                }
            else {
                if (!r)
                    if (((e = Ts(s)), e !== null)) {
                        if (
                            ((t.flags |= 128),
                            (r = !0),
                            (n = e.updateQueue),
                            n !== null && ((t.updateQueue = n), (t.flags |= 4)),
                            ro(i, !0),
                            i.tail === null && i.tailMode === 'hidden' && !s.alternate && !ne)
                        )
                            return Ce(t), null;
                    } else
                        2 * ae() - i.renderingStartTime > Ar &&
                            n !== 1073741824 &&
                            ((t.flags |= 128), (r = !0), ro(i, !1), (t.lanes = 4194304));
                i.isBackwards
                    ? ((s.sibling = t.child), (t.child = s))
                    : ((n = i.last), n !== null ? (n.sibling = s) : (t.child = s), (i.last = s));
            }
            return i.tail !== null
                ? ((t = i.tail),
                  (i.rendering = t),
                  (i.tail = t.sibling),
                  (i.renderingStartTime = ae()),
                  (t.sibling = null),
                  (n = re.current),
                  J(re, r ? (n & 1) | 2 : n & 1),
                  t)
                : (Ce(t), null);
        case 22:
        case 23:
            return (
                Nu(),
                (r = t.memoizedState !== null),
                e !== null && (e.memoizedState !== null) !== r && (t.flags |= 8192),
                r && t.mode & 1 ? $e & 1073741824 && (Ce(t), t.subtreeFlags & 6 && (t.flags |= 8192)) : Ce(t),
                null
            );
        case 24:
            return null;
        case 25:
            return null;
    }
    throw Error(D(156, t.tag));
}
function k0(e, t) {
    switch ((fu(t), t.tag)) {
        case 1:
            return je(t.type) && ys(), (e = t.flags), e & 65536 ? ((t.flags = (e & -65537) | 128), t) : null;
        case 3:
            return (
                Nr(), te(Fe), te(ke), Su(), (e = t.flags), e & 65536 && !(e & 128) ? ((t.flags = (e & -65537) | 128), t) : null
            );
        case 5:
            return wu(t), null;
        case 13:
            if ((te(re), (e = t.memoizedState), e !== null && e.dehydrated !== null)) {
                if (t.alternate === null) throw Error(D(340));
                Or();
            }
            return (e = t.flags), e & 65536 ? ((t.flags = (e & -65537) | 128), t) : null;
        case 19:
            return te(re), null;
        case 4:
            return Nr(), null;
        case 10:
            return gu(t.type._context), null;
        case 22:
        case 23:
            return Nu(), null;
        case 24:
            return null;
        default:
            return null;
    }
}
var bi = !1,
    be = !1,
    R0 = typeof WeakSet == 'function' ? WeakSet : Set,
    A = null;
function gr(e, t) {
    var n = e.ref;
    if (n !== null)
        if (typeof n == 'function')
            try {
                n(null);
            } catch (r) {
                se(e, t, r);
            }
        else n.current = null;
}
function ac(e, t, n) {
    try {
        n();
    } catch (r) {
        se(e, t, r);
    }
}
var Td = !1;
function _0(e, t) {
    if (((Va = ps), (e = zp()), cu(e))) {
        if ('selectionStart' in e) var n = { start: e.selectionStart, end: e.selectionEnd };
        else
            e: {
                n = ((n = e.ownerDocument) && n.defaultView) || window;
                var r = n.getSelection && n.getSelection();
                if (r && r.rangeCount !== 0) {
                    n = r.anchorNode;
                    var o = r.anchorOffset,
                        i = r.focusNode;
                    r = r.focusOffset;
                    try {
                        n.nodeType, i.nodeType;
                    } catch {
                        n = null;
                        break e;
                    }
                    var s = 0,
                        l = -1,
                        a = -1,
                        c = 0,
                        u = 0,
                        f = e,
                        d = null;
                    t: for (;;) {
                        for (
                            var y;
                            f !== n || (o !== 0 && f.nodeType !== 3) || (l = s + o),
                                f !== i || (r !== 0 && f.nodeType !== 3) || (a = s + r),
                                f.nodeType === 3 && (s += f.nodeValue.length),
                                (y = f.firstChild) !== null;

                        )
                            (d = f), (f = y);
                        for (;;) {
                            if (f === e) break t;
                            if (
                                (d === n && ++c === o && (l = s), d === i && ++u === r && (a = s), (y = f.nextSibling) !== null)
                            )
                                break;
                            (f = d), (d = f.parentNode);
                        }
                        f = y;
                    }
                    n = l === -1 || a === -1 ? null : { start: l, end: a };
                } else n = null;
            }
        n = n || { start: 0, end: 0 };
    } else n = null;
    for (qa = { focusedElem: e, selectionRange: n }, ps = !1, A = t; A !== null; )
        if (((t = A), (e = t.child), (t.subtreeFlags & 1028) !== 0 && e !== null)) (e.return = t), (A = e);
        else
            for (; A !== null; ) {
                t = A;
                try {
                    var m = t.alternate;
                    if (t.flags & 1024)
                        switch (t.tag) {
                            case 0:
                            case 11:
                            case 15:
                                break;
                            case 1:
                                if (m !== null) {
                                    var v = m.memoizedProps,
                                        S = m.memoizedState,
                                        h = t.stateNode,
                                        p = h.getSnapshotBeforeUpdate(t.elementType === t.type ? v : dt(t.type, v), S);
                                    h.__reactInternalSnapshotBeforeUpdate = p;
                                }
                                break;
                            case 3:
                                var w = t.stateNode.containerInfo;
                                w.nodeType === 1
                                    ? (w.textContent = '')
                                    : w.nodeType === 9 && w.documentElement && w.removeChild(w.documentElement);
                                break;
                            case 5:
                            case 6:
                            case 4:
                            case 17:
                                break;
                            default:
                                throw Error(D(163));
                        }
                } catch (C) {
                    se(t, t.return, C);
                }
                if (((e = t.sibling), e !== null)) {
                    (e.return = t.return), (A = e);
                    break;
                }
                A = t.return;
            }
    return (m = Td), (Td = !1), m;
}
function bo(e, t, n) {
    var r = t.updateQueue;
    if (((r = r !== null ? r.lastEffect : null), r !== null)) {
        var o = (r = r.next);
        do {
            if ((o.tag & e) === e) {
                var i = o.destroy;
                (o.destroy = void 0), i !== void 0 && ac(t, n, i);
            }
            o = o.next;
        } while (o !== r);
    }
}
function Zs(e, t) {
    if (((t = t.updateQueue), (t = t !== null ? t.lastEffect : null), t !== null)) {
        var n = (t = t.next);
        do {
            if ((n.tag & e) === e) {
                var r = n.create;
                n.destroy = r();
            }
            n = n.next;
        } while (n !== t);
    }
}
function cc(e) {
    var t = e.ref;
    if (t !== null) {
        var n = e.stateNode;
        switch (e.tag) {
            case 5:
                e = n;
                break;
            default:
                e = n;
        }
        typeof t == 'function' ? t(e) : (t.current = e);
    }
}
function Mg(e) {
    var t = e.alternate;
    t !== null && ((e.alternate = null), Mg(t)),
        (e.child = null),
        (e.deletions = null),
        (e.sibling = null),
        e.tag === 5 &&
            ((t = e.stateNode), t !== null && (delete t[kt], delete t[jo], delete t[Ya], delete t[u0], delete t[f0])),
        (e.stateNode = null),
        (e.return = null),
        (e.dependencies = null),
        (e.memoizedProps = null),
        (e.memoizedState = null),
        (e.pendingProps = null),
        (e.stateNode = null),
        (e.updateQueue = null);
}
function Lg(e) {
    return e.tag === 5 || e.tag === 3 || e.tag === 4;
}
function kd(e) {
    e: for (;;) {
        for (; e.sibling === null; ) {
            if (e.return === null || Lg(e.return)) return null;
            e = e.return;
        }
        for (e.sibling.return = e.return, e = e.sibling; e.tag !== 5 && e.tag !== 6 && e.tag !== 18; ) {
            if (e.flags & 2 || e.child === null || e.tag === 4) continue e;
            (e.child.return = e), (e = e.child);
        }
        if (!(e.flags & 2)) return e.stateNode;
    }
}
function uc(e, t, n) {
    var r = e.tag;
    if (r === 5 || r === 6)
        (e = e.stateNode),
            t
                ? n.nodeType === 8
                    ? n.parentNode.insertBefore(e, t)
                    : n.insertBefore(e, t)
                : (n.nodeType === 8 ? ((t = n.parentNode), t.insertBefore(e, n)) : ((t = n), t.appendChild(e)),
                  (n = n._reactRootContainer),
                  n != null || t.onclick !== null || (t.onclick = vs));
    else if (r !== 4 && ((e = e.child), e !== null))
        for (uc(e, t, n), e = e.sibling; e !== null; ) uc(e, t, n), (e = e.sibling);
}
function fc(e, t, n) {
    var r = e.tag;
    if (r === 5 || r === 6) (e = e.stateNode), t ? n.insertBefore(e, t) : n.appendChild(e);
    else if (r !== 4 && ((e = e.child), e !== null))
        for (fc(e, t, n), e = e.sibling; e !== null; ) fc(e, t, n), (e = e.sibling);
}
var ye = null,
    ht = !1;
function Zt(e, t, n) {
    for (n = n.child; n !== null; ) Fg(e, t, n), (n = n.sibling);
}
function Fg(e, t, n) {
    if (_t && typeof _t.onCommitFiberUnmount == 'function')
        try {
            _t.onCommitFiberUnmount(Vs, n);
        } catch {}
    switch (n.tag) {
        case 5:
            be || gr(n, t);
        case 6:
            var r = ye,
                o = ht;
            (ye = null),
                Zt(e, t, n),
                (ye = r),
                (ht = o),
                ye !== null &&
                    (ht
                        ? ((e = ye), (n = n.stateNode), e.nodeType === 8 ? e.parentNode.removeChild(n) : e.removeChild(n))
                        : ye.removeChild(n.stateNode));
            break;
        case 18:
            ye !== null &&
                (ht
                    ? ((e = ye),
                      (n = n.stateNode),
                      e.nodeType === 8 ? Wl(e.parentNode, n) : e.nodeType === 1 && Wl(e, n),
                      Ao(e))
                    : Wl(ye, n.stateNode));
            break;
        case 4:
            (r = ye), (o = ht), (ye = n.stateNode.containerInfo), (ht = !0), Zt(e, t, n), (ye = r), (ht = o);
            break;
        case 0:
        case 11:
        case 14:
        case 15:
            if (!be && ((r = n.updateQueue), r !== null && ((r = r.lastEffect), r !== null))) {
                o = r = r.next;
                do {
                    var i = o,
                        s = i.destroy;
                    (i = i.tag), s !== void 0 && (i & 2 || i & 4) && ac(n, t, s), (o = o.next);
                } while (o !== r);
            }
            Zt(e, t, n);
            break;
        case 1:
            if (!be && (gr(n, t), (r = n.stateNode), typeof r.componentWillUnmount == 'function'))
                try {
                    (r.props = n.memoizedProps), (r.state = n.memoizedState), r.componentWillUnmount();
                } catch (l) {
                    se(n, t, l);
                }
            Zt(e, t, n);
            break;
        case 21:
            Zt(e, t, n);
            break;
        case 22:
            n.mode & 1 ? ((be = (r = be) || n.memoizedState !== null), Zt(e, t, n), (be = r)) : Zt(e, t, n);
            break;
        default:
            Zt(e, t, n);
    }
}
function Rd(e) {
    var t = e.updateQueue;
    if (t !== null) {
        e.updateQueue = null;
        var n = e.stateNode;
        n === null && (n = e.stateNode = new R0()),
            t.forEach(function (r) {
                var o = F0.bind(null, e, r);
                n.has(r) || (n.add(r), r.then(o, o));
            });
    }
}
function ft(e, t) {
    var n = t.deletions;
    if (n !== null)
        for (var r = 0; r < n.length; r++) {
            var o = n[r];
            try {
                var i = e,
                    s = t,
                    l = s;
                e: for (; l !== null; ) {
                    switch (l.tag) {
                        case 5:
                            (ye = l.stateNode), (ht = !1);
                            break e;
                        case 3:
                            (ye = l.stateNode.containerInfo), (ht = !0);
                            break e;
                        case 4:
                            (ye = l.stateNode.containerInfo), (ht = !0);
                            break e;
                    }
                    l = l.return;
                }
                if (ye === null) throw Error(D(160));
                Fg(i, s, o), (ye = null), (ht = !1);
                var a = o.alternate;
                a !== null && (a.return = null), (o.return = null);
            } catch (c) {
                se(o, t, c);
            }
        }
    if (t.subtreeFlags & 12854) for (t = t.child; t !== null; ) jg(t, e), (t = t.sibling);
}
function jg(e, t) {
    var n = e.alternate,
        r = e.flags;
    switch (e.tag) {
        case 0:
        case 11:
        case 14:
        case 15:
            if ((ft(t, e), Ct(e), r & 4)) {
                try {
                    bo(3, e, e.return), Zs(3, e);
                } catch (v) {
                    se(e, e.return, v);
                }
                try {
                    bo(5, e, e.return);
                } catch (v) {
                    se(e, e.return, v);
                }
            }
            break;
        case 1:
            ft(t, e), Ct(e), r & 512 && n !== null && gr(n, n.return);
            break;
        case 5:
            if ((ft(t, e), Ct(e), r & 512 && n !== null && gr(n, n.return), e.flags & 32)) {
                var o = e.stateNode;
                try {
                    Oo(o, '');
                } catch (v) {
                    se(e, e.return, v);
                }
            }
            if (r & 4 && ((o = e.stateNode), o != null)) {
                var i = e.memoizedProps,
                    s = n !== null ? n.memoizedProps : i,
                    l = e.type,
                    a = e.updateQueue;
                if (((e.updateQueue = null), a !== null))
                    try {
                        l === 'input' && i.type === 'radio' && i.name != null && sp(o, i), Ma(l, s);
                        var c = Ma(l, i);
                        for (s = 0; s < a.length; s += 2) {
                            var u = a[s],
                                f = a[s + 1];
                            u === 'style'
                                ? fp(o, f)
                                : u === 'dangerouslySetInnerHTML'
                                  ? cp(o, f)
                                  : u === 'children'
                                    ? Oo(o, f)
                                    : Xc(o, u, f, c);
                        }
                        switch (l) {
                            case 'input':
                                Pa(o, i);
                                break;
                            case 'textarea':
                                lp(o, i);
                                break;
                            case 'select':
                                var d = o._wrapperState.wasMultiple;
                                o._wrapperState.wasMultiple = !!i.multiple;
                                var y = i.value;
                                y != null
                                    ? vr(o, !!i.multiple, y, !1)
                                    : d !== !!i.multiple &&
                                      (i.defaultValue != null
                                          ? vr(o, !!i.multiple, i.defaultValue, !0)
                                          : vr(o, !!i.multiple, i.multiple ? [] : '', !1));
                        }
                        o[jo] = i;
                    } catch (v) {
                        se(e, e.return, v);
                    }
            }
            break;
        case 6:
            if ((ft(t, e), Ct(e), r & 4)) {
                if (e.stateNode === null) throw Error(D(162));
                (o = e.stateNode), (i = e.memoizedProps);
                try {
                    o.nodeValue = i;
                } catch (v) {
                    se(e, e.return, v);
                }
            }
            break;
        case 3:
            if ((ft(t, e), Ct(e), r & 4 && n !== null && n.memoizedState.isDehydrated))
                try {
                    Ao(t.containerInfo);
                } catch (v) {
                    se(e, e.return, v);
                }
            break;
        case 4:
            ft(t, e), Ct(e);
            break;
        case 13:
            ft(t, e),
                Ct(e),
                (o = e.child),
                o.flags & 8192 &&
                    ((i = o.memoizedState !== null),
                    (o.stateNode.isHidden = i),
                    !i || (o.alternate !== null && o.alternate.memoizedState !== null) || (Ou = ae())),
                r & 4 && Rd(e);
            break;
        case 22:
            if (
                ((u = n !== null && n.memoizedState !== null),
                e.mode & 1 ? ((be = (c = be) || u), ft(t, e), (be = c)) : ft(t, e),
                Ct(e),
                r & 8192)
            ) {
                if (((c = e.memoizedState !== null), (e.stateNode.isHidden = c) && !u && e.mode & 1))
                    for (A = e, u = e.child; u !== null; ) {
                        for (f = A = u; A !== null; ) {
                            switch (((d = A), (y = d.child), d.tag)) {
                                case 0:
                                case 11:
                                case 14:
                                case 15:
                                    bo(4, d, d.return);
                                    break;
                                case 1:
                                    gr(d, d.return);
                                    var m = d.stateNode;
                                    if (typeof m.componentWillUnmount == 'function') {
                                        (r = d), (n = d.return);
                                        try {
                                            (t = r),
                                                (m.props = t.memoizedProps),
                                                (m.state = t.memoizedState),
                                                m.componentWillUnmount();
                                        } catch (v) {
                                            se(r, n, v);
                                        }
                                    }
                                    break;
                                case 5:
                                    gr(d, d.return);
                                    break;
                                case 22:
                                    if (d.memoizedState !== null) {
                                        Od(f);
                                        continue;
                                    }
                            }
                            y !== null ? ((y.return = d), (A = y)) : Od(f);
                        }
                        u = u.sibling;
                    }
                e: for (u = null, f = e; ; ) {
                    if (f.tag === 5) {
                        if (u === null) {
                            u = f;
                            try {
                                (o = f.stateNode),
                                    c
                                        ? ((i = o.style),
                                          typeof i.setProperty == 'function'
                                              ? i.setProperty('display', 'none', 'important')
                                              : (i.display = 'none'))
                                        : ((l = f.stateNode),
                                          (a = f.memoizedProps.style),
                                          (s = a != null && a.hasOwnProperty('display') ? a.display : null),
                                          (l.style.display = up('display', s)));
                            } catch (v) {
                                se(e, e.return, v);
                            }
                        }
                    } else if (f.tag === 6) {
                        if (u === null)
                            try {
                                f.stateNode.nodeValue = c ? '' : f.memoizedProps;
                            } catch (v) {
                                se(e, e.return, v);
                            }
                    } else if (((f.tag !== 22 && f.tag !== 23) || f.memoizedState === null || f === e) && f.child !== null) {
                        (f.child.return = f), (f = f.child);
                        continue;
                    }
                    if (f === e) break e;
                    for (; f.sibling === null; ) {
                        if (f.return === null || f.return === e) break e;
                        u === f && (u = null), (f = f.return);
                    }
                    u === f && (u = null), (f.sibling.return = f.return), (f = f.sibling);
                }
            }
            break;
        case 19:
            ft(t, e), Ct(e), r & 4 && Rd(e);
            break;
        case 21:
            break;
        default:
            ft(t, e), Ct(e);
    }
}
function Ct(e) {
    var t = e.flags;
    if (t & 2) {
        try {
            e: {
                for (var n = e.return; n !== null; ) {
                    if (Lg(n)) {
                        var r = n;
                        break e;
                    }
                    n = n.return;
                }
                throw Error(D(160));
            }
            switch (r.tag) {
                case 5:
                    var o = r.stateNode;
                    r.flags & 32 && (Oo(o, ''), (r.flags &= -33));
                    var i = kd(e);
                    fc(e, i, o);
                    break;
                case 3:
                case 4:
                    var s = r.stateNode.containerInfo,
                        l = kd(e);
                    uc(e, l, s);
                    break;
                default:
                    throw Error(D(161));
            }
        } catch (a) {
            se(e, e.return, a);
        }
        e.flags &= -3;
    }
    t & 4096 && (e.flags &= -4097);
}
function O0(e, t, n) {
    (A = e), zg(e);
}
function zg(e, t, n) {
    for (var r = (e.mode & 1) !== 0; A !== null; ) {
        var o = A,
            i = o.child;
        if (o.tag === 22 && r) {
            var s = o.memoizedState !== null || bi;
            if (!s) {
                var l = o.alternate,
                    a = (l !== null && l.memoizedState !== null) || be;
                l = bi;
                var c = be;
                if (((bi = s), (be = a) && !c))
                    for (A = o; A !== null; )
                        (s = A),
                            (a = s.child),
                            s.tag === 22 && s.memoizedState !== null ? Pd(o) : a !== null ? ((a.return = s), (A = a)) : Pd(o);
                for (; i !== null; ) (A = i), zg(i), (i = i.sibling);
                (A = o), (bi = l), (be = c);
            }
            _d(e);
        } else o.subtreeFlags & 8772 && i !== null ? ((i.return = o), (A = i)) : _d(e);
    }
}
function _d(e) {
    for (; A !== null; ) {
        var t = A;
        if (t.flags & 8772) {
            var n = t.alternate;
            try {
                if (t.flags & 8772)
                    switch (t.tag) {
                        case 0:
                        case 11:
                        case 15:
                            be || Zs(5, t);
                            break;
                        case 1:
                            var r = t.stateNode;
                            if (t.flags & 4 && !be)
                                if (n === null) r.componentDidMount();
                                else {
                                    var o = t.elementType === t.type ? n.memoizedProps : dt(t.type, n.memoizedProps);
                                    r.componentDidUpdate(o, n.memoizedState, r.__reactInternalSnapshotBeforeUpdate);
                                }
                            var i = t.updateQueue;
                            i !== null && dd(t, i, r);
                            break;
                        case 3:
                            var s = t.updateQueue;
                            if (s !== null) {
                                if (((n = null), t.child !== null))
                                    switch (t.child.tag) {
                                        case 5:
                                            n = t.child.stateNode;
                                            break;
                                        case 1:
                                            n = t.child.stateNode;
                                    }
                                dd(t, s, n);
                            }
                            break;
                        case 5:
                            var l = t.stateNode;
                            if (n === null && t.flags & 4) {
                                n = l;
                                var a = t.memoizedProps;
                                switch (t.type) {
                                    case 'button':
                                    case 'input':
                                    case 'select':
                                    case 'textarea':
                                        a.autoFocus && n.focus();
                                        break;
                                    case 'img':
                                        a.src && (n.src = a.src);
                                }
                            }
                            break;
                        case 6:
                            break;
                        case 4:
                            break;
                        case 12:
                            break;
                        case 13:
                            if (t.memoizedState === null) {
                                var c = t.alternate;
                                if (c !== null) {
                                    var u = c.memoizedState;
                                    if (u !== null) {
                                        var f = u.dehydrated;
                                        f !== null && Ao(f);
                                    }
                                }
                            }
                            break;
                        case 19:
                        case 17:
                        case 21:
                        case 22:
                        case 23:
                        case 25:
                            break;
                        default:
                            throw Error(D(163));
                    }
                be || (t.flags & 512 && cc(t));
            } catch (d) {
                se(t, t.return, d);
            }
        }
        if (t === e) {
            A = null;
            break;
        }
        if (((n = t.sibling), n !== null)) {
            (n.return = t.return), (A = n);
            break;
        }
        A = t.return;
    }
}
function Od(e) {
    for (; A !== null; ) {
        var t = A;
        if (t === e) {
            A = null;
            break;
        }
        var n = t.sibling;
        if (n !== null) {
            (n.return = t.return), (A = n);
            break;
        }
        A = t.return;
    }
}
function Pd(e) {
    for (; A !== null; ) {
        var t = A;
        try {
            switch (t.tag) {
                case 0:
                case 11:
                case 15:
                    var n = t.return;
                    try {
                        Zs(4, t);
                    } catch (a) {
                        se(t, n, a);
                    }
                    break;
                case 1:
                    var r = t.stateNode;
                    if (typeof r.componentDidMount == 'function') {
                        var o = t.return;
                        try {
                            r.componentDidMount();
                        } catch (a) {
                            se(t, o, a);
                        }
                    }
                    var i = t.return;
                    try {
                        cc(t);
                    } catch (a) {
                        se(t, i, a);
                    }
                    break;
                case 5:
                    var s = t.return;
                    try {
                        cc(t);
                    } catch (a) {
                        se(t, s, a);
                    }
            }
        } catch (a) {
            se(t, t.return, a);
        }
        if (t === e) {
            A = null;
            break;
        }
        var l = t.sibling;
        if (l !== null) {
            (l.return = t.return), (A = l);
            break;
        }
        A = t.return;
    }
}
var P0 = Math.ceil,
    _s = Xt.ReactCurrentDispatcher,
    Ru = Xt.ReactCurrentOwner,
    it = Xt.ReactCurrentBatchConfig,
    G = 0,
    ve = null,
    ce = null,
    Se = 0,
    $e = 0,
    mr = _n(0),
    ge = 0,
    Wo = null,
    Vn = 0,
    el = 0,
    _u = 0,
    To = null,
    Me = null,
    Ou = 0,
    Ar = 1 / 0,
    zt = null,
    Os = !1,
    dc = null,
    mn = null,
    Ti = !1,
    un = null,
    Ps = 0,
    ko = 0,
    hc = null,
    Gi = -1,
    Ki = 0;
function Pe() {
    return G & 6 ? ae() : Gi !== -1 ? Gi : (Gi = ae());
}
function vn(e) {
    return e.mode & 1
        ? G & 2 && Se !== 0
            ? Se & -Se
            : h0.transition !== null
              ? (Ki === 0 && (Ki = Cp()), Ki)
              : ((e = X), e !== 0 || ((e = window.event), (e = e === void 0 ? 16 : Pp(e.type))), e)
        : 1;
}
function vt(e, t, n, r) {
    if (50 < ko) throw ((ko = 0), (hc = null), Error(D(185)));
    Zo(e, n, r),
        (!(G & 2) || e !== ve) &&
            (e === ve && (!(G & 2) && (el |= n), ge === 4 && an(e, Se)),
            ze(e, r),
            n === 1 && G === 0 && !(t.mode & 1) && ((Ar = ae() + 500), Xs && On()));
}
function ze(e, t) {
    var n = e.callbackNode;
    hS(e, t);
    var r = hs(e, e === ve ? Se : 0);
    if (r === 0) n !== null && zf(n), (e.callbackNode = null), (e.callbackPriority = 0);
    else if (((t = r & -r), e.callbackPriority !== t)) {
        if ((n != null && zf(n), t === 1))
            e.tag === 0 ? d0(Nd.bind(null, e)) : Yp(Nd.bind(null, e)),
                a0(function () {
                    !(G & 6) && On();
                }),
                (n = null);
        else {
            switch (bp(r)) {
                case 1:
                    n = tu;
                    break;
                case 4:
                    n = Ep;
                    break;
                case 16:
                    n = ds;
                    break;
                case 536870912:
                    n = xp;
                    break;
                default:
                    n = ds;
            }
            n = Gg(n, Ug.bind(null, e));
        }
        (e.callbackPriority = t), (e.callbackNode = n);
    }
}
function Ug(e, t) {
    if (((Gi = -1), (Ki = 0), G & 6)) throw Error(D(327));
    var n = e.callbackNode;
    if (xr() && e.callbackNode !== n) return null;
    var r = hs(e, e === ve ? Se : 0);
    if (r === 0) return null;
    if (r & 30 || r & e.expiredLanes || t) t = Ns(e, r);
    else {
        t = r;
        var o = G;
        G |= 2;
        var i = $g();
        (ve !== e || Se !== t) && ((zt = null), (Ar = ae() + 500), jn(e, t));
        do
            try {
                A0();
                break;
            } catch (l) {
                Bg(e, l);
            }
        while (!0);
        pu(), (_s.current = i), (G = o), ce !== null ? (t = 0) : ((ve = null), (Se = 0), (t = ge));
    }
    if (t !== 0) {
        if ((t === 2 && ((o = Ua(e)), o !== 0 && ((r = o), (t = pc(e, o)))), t === 1))
            throw ((n = Wo), jn(e, 0), an(e, r), ze(e, ae()), n);
        if (t === 6) an(e, r);
        else {
            if (
                ((o = e.current.alternate),
                !(r & 30) &&
                    !N0(o) &&
                    ((t = Ns(e, r)), t === 2 && ((i = Ua(e)), i !== 0 && ((r = i), (t = pc(e, i)))), t === 1))
            )
                throw ((n = Wo), jn(e, 0), an(e, r), ze(e, ae()), n);
            switch (((e.finishedWork = o), (e.finishedLanes = r), t)) {
                case 0:
                case 1:
                    throw Error(D(345));
                case 2:
                    An(e, Me, zt);
                    break;
                case 3:
                    if ((an(e, r), (r & 130023424) === r && ((t = Ou + 500 - ae()), 10 < t))) {
                        if (hs(e, 0) !== 0) break;
                        if (((o = e.suspendedLanes), (o & r) !== r)) {
                            Pe(), (e.pingedLanes |= e.suspendedLanes & o);
                            break;
                        }
                        e.timeoutHandle = Ka(An.bind(null, e, Me, zt), t);
                        break;
                    }
                    An(e, Me, zt);
                    break;
                case 4:
                    if ((an(e, r), (r & 4194240) === r)) break;
                    for (t = e.eventTimes, o = -1; 0 < r; ) {
                        var s = 31 - mt(r);
                        (i = 1 << s), (s = t[s]), s > o && (o = s), (r &= ~i);
                    }
                    if (
                        ((r = o),
                        (r = ae() - r),
                        (r =
                            (120 > r
                                ? 120
                                : 480 > r
                                  ? 480
                                  : 1080 > r
                                    ? 1080
                                    : 1920 > r
                                      ? 1920
                                      : 3e3 > r
                                        ? 3e3
                                        : 4320 > r
                                          ? 4320
                                          : 1960 * P0(r / 1960)) - r),
                        10 < r)
                    ) {
                        e.timeoutHandle = Ka(An.bind(null, e, Me, zt), r);
                        break;
                    }
                    An(e, Me, zt);
                    break;
                case 5:
                    An(e, Me, zt);
                    break;
                default:
                    throw Error(D(329));
            }
        }
    }
    return ze(e, ae()), e.callbackNode === n ? Ug.bind(null, e) : null;
}
function pc(e, t) {
    var n = To;
    return (
        e.current.memoizedState.isDehydrated && (jn(e, t).flags |= 256),
        (e = Ns(e, t)),
        e !== 2 && ((t = Me), (Me = n), t !== null && gc(t)),
        e
    );
}
function gc(e) {
    Me === null ? (Me = e) : Me.push.apply(Me, e);
}
function N0(e) {
    for (var t = e; ; ) {
        if (t.flags & 16384) {
            var n = t.updateQueue;
            if (n !== null && ((n = n.stores), n !== null))
                for (var r = 0; r < n.length; r++) {
                    var o = n[r],
                        i = o.getSnapshot;
                    o = o.value;
                    try {
                        if (!yt(i(), o)) return !1;
                    } catch {
                        return !1;
                    }
                }
        }
        if (((n = t.child), t.subtreeFlags & 16384 && n !== null)) (n.return = t), (t = n);
        else {
            if (t === e) break;
            for (; t.sibling === null; ) {
                if (t.return === null || t.return === e) return !0;
                t = t.return;
            }
            (t.sibling.return = t.return), (t = t.sibling);
        }
    }
    return !0;
}
function an(e, t) {
    for (t &= ~_u, t &= ~el, e.suspendedLanes |= t, e.pingedLanes &= ~t, e = e.expirationTimes; 0 < t; ) {
        var n = 31 - mt(t),
            r = 1 << n;
        (e[n] = -1), (t &= ~r);
    }
}
function Nd(e) {
    if (G & 6) throw Error(D(327));
    xr();
    var t = hs(e, 0);
    if (!(t & 1)) return ze(e, ae()), null;
    var n = Ns(e, t);
    if (e.tag !== 0 && n === 2) {
        var r = Ua(e);
        r !== 0 && ((t = r), (n = pc(e, r)));
    }
    if (n === 1) throw ((n = Wo), jn(e, 0), an(e, t), ze(e, ae()), n);
    if (n === 6) throw Error(D(345));
    return (e.finishedWork = e.current.alternate), (e.finishedLanes = t), An(e, Me, zt), ze(e, ae()), null;
}
function Pu(e, t) {
    var n = G;
    G |= 1;
    try {
        return e(t);
    } finally {
        (G = n), G === 0 && ((Ar = ae() + 500), Xs && On());
    }
}
function qn(e) {
    un !== null && un.tag === 0 && !(G & 6) && xr();
    var t = G;
    G |= 1;
    var n = it.transition,
        r = X;
    try {
        if (((it.transition = null), (X = 1), e)) return e();
    } finally {
        (X = r), (it.transition = n), (G = t), !(G & 6) && On();
    }
}
function Nu() {
    ($e = mr.current), te(mr);
}
function jn(e, t) {
    (e.finishedWork = null), (e.finishedLanes = 0);
    var n = e.timeoutHandle;
    if ((n !== -1 && ((e.timeoutHandle = -1), l0(n)), ce !== null))
        for (n = ce.return; n !== null; ) {
            var r = n;
            switch ((fu(r), r.tag)) {
                case 1:
                    (r = r.type.childContextTypes), r != null && ys();
                    break;
                case 3:
                    Nr(), te(Fe), te(ke), Su();
                    break;
                case 5:
                    wu(r);
                    break;
                case 4:
                    Nr();
                    break;
                case 13:
                    te(re);
                    break;
                case 19:
                    te(re);
                    break;
                case 10:
                    gu(r.type._context);
                    break;
                case 22:
                case 23:
                    Nu();
            }
            n = n.return;
        }
    if (
        ((ve = e),
        (ce = e = yn(e.current, null)),
        (Se = $e = t),
        (ge = 0),
        (Wo = null),
        (_u = el = Vn = 0),
        (Me = To = null),
        Mn !== null)
    ) {
        for (t = 0; t < Mn.length; t++)
            if (((n = Mn[t]), (r = n.interleaved), r !== null)) {
                n.interleaved = null;
                var o = r.next,
                    i = n.pending;
                if (i !== null) {
                    var s = i.next;
                    (i.next = o), (r.next = s);
                }
                n.pending = r;
            }
        Mn = null;
    }
    return e;
}
function Bg(e, t) {
    do {
        var n = ce;
        try {
            if ((pu(), (Wi.current = Rs), ks)) {
                for (var r = oe.memoizedState; r !== null; ) {
                    var o = r.queue;
                    o !== null && (o.pending = null), (r = r.next);
                }
                ks = !1;
            }
            if (((Wn = 0), (me = pe = oe = null), (Co = !1), (Bo = 0), (Ru.current = null), n === null || n.return === null)) {
                (ge = 1), (Wo = t), (ce = null);
                break;
            }
            e: {
                var i = e,
                    s = n.return,
                    l = n,
                    a = t;
                if (((t = Se), (l.flags |= 32768), a !== null && typeof a == 'object' && typeof a.then == 'function')) {
                    var c = a,
                        u = l,
                        f = u.tag;
                    if (!(u.mode & 1) && (f === 0 || f === 11 || f === 15)) {
                        var d = u.alternate;
                        d
                            ? ((u.updateQueue = d.updateQueue), (u.memoizedState = d.memoizedState), (u.lanes = d.lanes))
                            : ((u.updateQueue = null), (u.memoizedState = null));
                    }
                    var y = yd(s);
                    if (y !== null) {
                        (y.flags &= -257), wd(y, s, l, i, t), y.mode & 1 && vd(i, c, t), (t = y), (a = c);
                        var m = t.updateQueue;
                        if (m === null) {
                            var v = new Set();
                            v.add(a), (t.updateQueue = v);
                        } else m.add(a);
                        break e;
                    } else {
                        if (!(t & 1)) {
                            vd(i, c, t), Du();
                            break e;
                        }
                        a = Error(D(426));
                    }
                } else if (ne && l.mode & 1) {
                    var S = yd(s);
                    if (S !== null) {
                        !(S.flags & 65536) && (S.flags |= 256), wd(S, s, l, i, t), du(Dr(a, l));
                        break e;
                    }
                }
                (i = a = Dr(a, l)), ge !== 4 && (ge = 2), To === null ? (To = [i]) : To.push(i), (i = s);
                do {
                    switch (i.tag) {
                        case 3:
                            (i.flags |= 65536), (t &= -t), (i.lanes |= t);
                            var h = bg(i, a, t);
                            fd(i, h);
                            break e;
                        case 1:
                            l = a;
                            var p = i.type,
                                w = i.stateNode;
                            if (
                                !(i.flags & 128) &&
                                (typeof p.getDerivedStateFromError == 'function' ||
                                    (w !== null && typeof w.componentDidCatch == 'function' && (mn === null || !mn.has(w))))
                            ) {
                                (i.flags |= 65536), (t &= -t), (i.lanes |= t);
                                var C = Tg(i, l, t);
                                fd(i, C);
                                break e;
                            }
                    }
                    i = i.return;
                } while (i !== null);
            }
            Wg(n);
        } catch (T) {
            (t = T), ce === n && n !== null && (ce = n = n.return);
            continue;
        }
        break;
    } while (!0);
}
function $g() {
    var e = _s.current;
    return (_s.current = Rs), e === null ? Rs : e;
}
function Du() {
    (ge === 0 || ge === 3 || ge === 2) && (ge = 4), ve === null || (!(Vn & 268435455) && !(el & 268435455)) || an(ve, Se);
}
function Ns(e, t) {
    var n = G;
    G |= 2;
    var r = $g();
    (ve !== e || Se !== t) && ((zt = null), jn(e, t));
    do
        try {
            D0();
            break;
        } catch (o) {
            Bg(e, o);
        }
    while (!0);
    if ((pu(), (G = n), (_s.current = r), ce !== null)) throw Error(D(261));
    return (ve = null), (Se = 0), ge;
}
function D0() {
    for (; ce !== null; ) Hg(ce);
}
function A0() {
    for (; ce !== null && !oS(); ) Hg(ce);
}
function Hg(e) {
    var t = qg(e.alternate, e, $e);
    (e.memoizedProps = e.pendingProps), t === null ? Wg(e) : (ce = t), (Ru.current = null);
}
function Wg(e) {
    var t = e;
    do {
        var n = t.alternate;
        if (((e = t.return), t.flags & 32768)) {
            if (((n = k0(n, t)), n !== null)) {
                (n.flags &= 32767), (ce = n);
                return;
            }
            if (e !== null) (e.flags |= 32768), (e.subtreeFlags = 0), (e.deletions = null);
            else {
                (ge = 6), (ce = null);
                return;
            }
        } else if (((n = T0(n, t, $e)), n !== null)) {
            ce = n;
            return;
        }
        if (((t = t.sibling), t !== null)) {
            ce = t;
            return;
        }
        ce = t = e;
    } while (t !== null);
    ge === 0 && (ge = 5);
}
function An(e, t, n) {
    var r = X,
        o = it.transition;
    try {
        (it.transition = null), (X = 1), I0(e, t, n, r);
    } finally {
        (it.transition = o), (X = r);
    }
    return null;
}
function I0(e, t, n, r) {
    do xr();
    while (un !== null);
    if (G & 6) throw Error(D(327));
    n = e.finishedWork;
    var o = e.finishedLanes;
    if (n === null) return null;
    if (((e.finishedWork = null), (e.finishedLanes = 0), n === e.current)) throw Error(D(177));
    (e.callbackNode = null), (e.callbackPriority = 0);
    var i = n.lanes | n.childLanes;
    if (
        (pS(e, i),
        e === ve && ((ce = ve = null), (Se = 0)),
        (!(n.subtreeFlags & 2064) && !(n.flags & 2064)) ||
            Ti ||
            ((Ti = !0),
            Gg(ds, function () {
                return xr(), null;
            })),
        (i = (n.flags & 15990) !== 0),
        n.subtreeFlags & 15990 || i)
    ) {
        (i = it.transition), (it.transition = null);
        var s = X;
        X = 1;
        var l = G;
        (G |= 4),
            (Ru.current = null),
            _0(e, n),
            jg(n, e),
            e0(qa),
            (ps = !!Va),
            (qa = Va = null),
            (e.current = n),
            O0(n),
            iS(),
            (G = l),
            (X = s),
            (it.transition = i);
    } else e.current = n;
    if (
        (Ti && ((Ti = !1), (un = e), (Ps = o)),
        (i = e.pendingLanes),
        i === 0 && (mn = null),
        aS(n.stateNode),
        ze(e, ae()),
        t !== null)
    )
        for (r = e.onRecoverableError, n = 0; n < t.length; n++)
            (o = t[n]), r(o.value, { componentStack: o.stack, digest: o.digest });
    if (Os) throw ((Os = !1), (e = dc), (dc = null), e);
    return (
        Ps & 1 && e.tag !== 0 && xr(),
        (i = e.pendingLanes),
        i & 1 ? (e === hc ? ko++ : ((ko = 0), (hc = e))) : (ko = 0),
        On(),
        null
    );
}
function xr() {
    if (un !== null) {
        var e = bp(Ps),
            t = it.transition,
            n = X;
        try {
            if (((it.transition = null), (X = 16 > e ? 16 : e), un === null)) var r = !1;
            else {
                if (((e = un), (un = null), (Ps = 0), G & 6)) throw Error(D(331));
                var o = G;
                for (G |= 4, A = e.current; A !== null; ) {
                    var i = A,
                        s = i.child;
                    if (A.flags & 16) {
                        var l = i.deletions;
                        if (l !== null) {
                            for (var a = 0; a < l.length; a++) {
                                var c = l[a];
                                for (A = c; A !== null; ) {
                                    var u = A;
                                    switch (u.tag) {
                                        case 0:
                                        case 11:
                                        case 15:
                                            bo(8, u, i);
                                    }
                                    var f = u.child;
                                    if (f !== null) (f.return = u), (A = f);
                                    else
                                        for (; A !== null; ) {
                                            u = A;
                                            var d = u.sibling,
                                                y = u.return;
                                            if ((Mg(u), u === c)) {
                                                A = null;
                                                break;
                                            }
                                            if (d !== null) {
                                                (d.return = y), (A = d);
                                                break;
                                            }
                                            A = y;
                                        }
                                }
                            }
                            var m = i.alternate;
                            if (m !== null) {
                                var v = m.child;
                                if (v !== null) {
                                    m.child = null;
                                    do {
                                        var S = v.sibling;
                                        (v.sibling = null), (v = S);
                                    } while (v !== null);
                                }
                            }
                            A = i;
                        }
                    }
                    if (i.subtreeFlags & 2064 && s !== null) (s.return = i), (A = s);
                    else
                        e: for (; A !== null; ) {
                            if (((i = A), i.flags & 2048))
                                switch (i.tag) {
                                    case 0:
                                    case 11:
                                    case 15:
                                        bo(9, i, i.return);
                                }
                            var h = i.sibling;
                            if (h !== null) {
                                (h.return = i.return), (A = h);
                                break e;
                            }
                            A = i.return;
                        }
                }
                var p = e.current;
                for (A = p; A !== null; ) {
                    s = A;
                    var w = s.child;
                    if (s.subtreeFlags & 2064 && w !== null) (w.return = s), (A = w);
                    else
                        e: for (s = p; A !== null; ) {
                            if (((l = A), l.flags & 2048))
                                try {
                                    switch (l.tag) {
                                        case 0:
                                        case 11:
                                        case 15:
                                            Zs(9, l);
                                    }
                                } catch (T) {
                                    se(l, l.return, T);
                                }
                            if (l === s) {
                                A = null;
                                break e;
                            }
                            var C = l.sibling;
                            if (C !== null) {
                                (C.return = l.return), (A = C);
                                break e;
                            }
                            A = l.return;
                        }
                }
                if (((G = o), On(), _t && typeof _t.onPostCommitFiberRoot == 'function'))
                    try {
                        _t.onPostCommitFiberRoot(Vs, e);
                    } catch {}
                r = !0;
            }
            return r;
        } finally {
            (X = n), (it.transition = t);
        }
    }
    return !1;
}
function Dd(e, t, n) {
    (t = Dr(n, t)), (t = bg(e, t, 1)), (e = gn(e, t, 1)), (t = Pe()), e !== null && (Zo(e, 1, t), ze(e, t));
}
function se(e, t, n) {
    if (e.tag === 3) Dd(e, e, n);
    else
        for (; t !== null; ) {
            if (t.tag === 3) {
                Dd(t, e, n);
                break;
            } else if (t.tag === 1) {
                var r = t.stateNode;
                if (
                    typeof t.type.getDerivedStateFromError == 'function' ||
                    (typeof r.componentDidCatch == 'function' && (mn === null || !mn.has(r)))
                ) {
                    (e = Dr(n, e)), (e = Tg(t, e, 1)), (t = gn(t, e, 1)), (e = Pe()), t !== null && (Zo(t, 1, e), ze(t, e));
                    break;
                }
            }
            t = t.return;
        }
}
function M0(e, t, n) {
    var r = e.pingCache;
    r !== null && r.delete(t),
        (t = Pe()),
        (e.pingedLanes |= e.suspendedLanes & n),
        ve === e &&
            (Se & n) === n &&
            (ge === 4 || (ge === 3 && (Se & 130023424) === Se && 500 > ae() - Ou) ? jn(e, 0) : (_u |= n)),
        ze(e, t);
}
function Vg(e, t) {
    t === 0 && (e.mode & 1 ? ((t = gi), (gi <<= 1), !(gi & 130023424) && (gi = 4194304)) : (t = 1));
    var n = Pe();
    (e = qt(e, t)), e !== null && (Zo(e, t, n), ze(e, n));
}
function L0(e) {
    var t = e.memoizedState,
        n = 0;
    t !== null && (n = t.retryLane), Vg(e, n);
}
function F0(e, t) {
    var n = 0;
    switch (e.tag) {
        case 13:
            var r = e.stateNode,
                o = e.memoizedState;
            o !== null && (n = o.retryLane);
            break;
        case 19:
            r = e.stateNode;
            break;
        default:
            throw Error(D(314));
    }
    r !== null && r.delete(t), Vg(e, n);
}
var qg;
qg = function (e, t, n) {
    if (e !== null)
        if (e.memoizedProps !== t.pendingProps || Fe.current) Le = !0;
        else {
            if (!(e.lanes & n) && !(t.flags & 128)) return (Le = !1), b0(e, t, n);
            Le = !!(e.flags & 131072);
        }
    else (Le = !1), ne && t.flags & 1048576 && Xp(t, Es, t.index);
    switch (((t.lanes = 0), t.tag)) {
        case 2:
            var r = t.type;
            qi(e, t), (e = t.pendingProps);
            var o = _r(t, ke.current);
            Er(t, n), (o = xu(null, t, r, e, o, n));
            var i = Cu();
            return (
                (t.flags |= 1),
                typeof o == 'object' && o !== null && typeof o.render == 'function' && o.$$typeof === void 0
                    ? ((t.tag = 1),
                      (t.memoizedState = null),
                      (t.updateQueue = null),
                      je(r) ? ((i = !0), ws(t)) : (i = !1),
                      (t.memoizedState = o.state !== null && o.state !== void 0 ? o.state : null),
                      vu(t),
                      (o.updater = Js),
                      (t.stateNode = o),
                      (o._reactInternals = t),
                      tc(t, r, e, n),
                      (t = oc(null, t, r, !0, i, n)))
                    : ((t.tag = 0), ne && i && uu(t), Oe(null, t, o, n), (t = t.child)),
                t
            );
        case 16:
            r = t.elementType;
            e: {
                switch (
                    (qi(e, t),
                    (e = t.pendingProps),
                    (o = r._init),
                    (r = o(r._payload)),
                    (t.type = r),
                    (o = t.tag = z0(r)),
                    (e = dt(r, e)),
                    o)
                ) {
                    case 0:
                        t = rc(null, t, r, e, n);
                        break e;
                    case 1:
                        t = xd(null, t, r, e, n);
                        break e;
                    case 11:
                        t = Sd(null, t, r, e, n);
                        break e;
                    case 14:
                        t = Ed(null, t, r, dt(r.type, e), n);
                        break e;
                }
                throw Error(D(306, r, ''));
            }
            return t;
        case 0:
            return (r = t.type), (o = t.pendingProps), (o = t.elementType === r ? o : dt(r, o)), rc(e, t, r, o, n);
        case 1:
            return (r = t.type), (o = t.pendingProps), (o = t.elementType === r ? o : dt(r, o)), xd(e, t, r, o, n);
        case 3:
            e: {
                if ((Og(t), e === null)) throw Error(D(387));
                (r = t.pendingProps), (i = t.memoizedState), (o = i.element), ng(e, t), bs(t, r, null, n);
                var s = t.memoizedState;
                if (((r = s.element), i.isDehydrated))
                    if (
                        ((i = {
                            element: r,
                            isDehydrated: !1,
                            cache: s.cache,
                            pendingSuspenseBoundaries: s.pendingSuspenseBoundaries,
                            transitions: s.transitions,
                        }),
                        (t.updateQueue.baseState = i),
                        (t.memoizedState = i),
                        t.flags & 256)
                    ) {
                        (o = Dr(Error(D(423)), t)), (t = Cd(e, t, r, n, o));
                        break e;
                    } else if (r !== o) {
                        (o = Dr(Error(D(424)), t)), (t = Cd(e, t, r, n, o));
                        break e;
                    } else
                        for (
                            We = pn(t.stateNode.containerInfo.firstChild),
                                Ve = t,
                                ne = !0,
                                gt = null,
                                n = eg(t, null, r, n),
                                t.child = n;
                            n;

                        )
                            (n.flags = (n.flags & -3) | 4096), (n = n.sibling);
                else {
                    if ((Or(), r === o)) {
                        t = Gt(e, t, n);
                        break e;
                    }
                    Oe(e, t, r, n);
                }
                t = t.child;
            }
            return t;
        case 5:
            return (
                rg(t),
                e === null && Ja(t),
                (r = t.type),
                (o = t.pendingProps),
                (i = e !== null ? e.memoizedProps : null),
                (s = o.children),
                Ga(r, o) ? (s = null) : i !== null && Ga(r, i) && (t.flags |= 32),
                _g(e, t),
                Oe(e, t, s, n),
                t.child
            );
        case 6:
            return e === null && Ja(t), null;
        case 13:
            return Pg(e, t, n);
        case 4:
            return (
                yu(t, t.stateNode.containerInfo),
                (r = t.pendingProps),
                e === null ? (t.child = Pr(t, null, r, n)) : Oe(e, t, r, n),
                t.child
            );
        case 11:
            return (r = t.type), (o = t.pendingProps), (o = t.elementType === r ? o : dt(r, o)), Sd(e, t, r, o, n);
        case 7:
            return Oe(e, t, t.pendingProps, n), t.child;
        case 8:
            return Oe(e, t, t.pendingProps.children, n), t.child;
        case 12:
            return Oe(e, t, t.pendingProps.children, n), t.child;
        case 10:
            e: {
                if (
                    ((r = t.type._context),
                    (o = t.pendingProps),
                    (i = t.memoizedProps),
                    (s = o.value),
                    J(xs, r._currentValue),
                    (r._currentValue = s),
                    i !== null)
                )
                    if (yt(i.value, s)) {
                        if (i.children === o.children && !Fe.current) {
                            t = Gt(e, t, n);
                            break e;
                        }
                    } else
                        for (i = t.child, i !== null && (i.return = t); i !== null; ) {
                            var l = i.dependencies;
                            if (l !== null) {
                                s = i.child;
                                for (var a = l.firstContext; a !== null; ) {
                                    if (a.context === r) {
                                        if (i.tag === 1) {
                                            (a = Ht(-1, n & -n)), (a.tag = 2);
                                            var c = i.updateQueue;
                                            if (c !== null) {
                                                c = c.shared;
                                                var u = c.pending;
                                                u === null ? (a.next = a) : ((a.next = u.next), (u.next = a)), (c.pending = a);
                                            }
                                        }
                                        (i.lanes |= n),
                                            (a = i.alternate),
                                            a !== null && (a.lanes |= n),
                                            Za(i.return, n, t),
                                            (l.lanes |= n);
                                        break;
                                    }
                                    a = a.next;
                                }
                            } else if (i.tag === 10) s = i.type === t.type ? null : i.child;
                            else if (i.tag === 18) {
                                if (((s = i.return), s === null)) throw Error(D(341));
                                (s.lanes |= n), (l = s.alternate), l !== null && (l.lanes |= n), Za(s, n, t), (s = i.sibling);
                            } else s = i.child;
                            if (s !== null) s.return = i;
                            else
                                for (s = i; s !== null; ) {
                                    if (s === t) {
                                        s = null;
                                        break;
                                    }
                                    if (((i = s.sibling), i !== null)) {
                                        (i.return = s.return), (s = i);
                                        break;
                                    }
                                    s = s.return;
                                }
                            i = s;
                        }
                Oe(e, t, o.children, n), (t = t.child);
            }
            return t;
        case 9:
            return (
                (o = t.type),
                (r = t.pendingProps.children),
                Er(t, n),
                (o = lt(o)),
                (r = r(o)),
                (t.flags |= 1),
                Oe(e, t, r, n),
                t.child
            );
        case 14:
            return (r = t.type), (o = dt(r, t.pendingProps)), (o = dt(r.type, o)), Ed(e, t, r, o, n);
        case 15:
            return kg(e, t, t.type, t.pendingProps, n);
        case 17:
            return (
                (r = t.type),
                (o = t.pendingProps),
                (o = t.elementType === r ? o : dt(r, o)),
                qi(e, t),
                (t.tag = 1),
                je(r) ? ((e = !0), ws(t)) : (e = !1),
                Er(t, n),
                Cg(t, r, o),
                tc(t, r, o, n),
                oc(null, t, r, !0, e, n)
            );
        case 19:
            return Ng(e, t, n);
        case 22:
            return Rg(e, t, n);
    }
    throw Error(D(156, t.tag));
};
function Gg(e, t) {
    return Sp(e, t);
}
function j0(e, t, n, r) {
    (this.tag = e),
        (this.key = n),
        (this.sibling = this.child = this.return = this.stateNode = this.type = this.elementType = null),
        (this.index = 0),
        (this.ref = null),
        (this.pendingProps = t),
        (this.dependencies = this.memoizedState = this.updateQueue = this.memoizedProps = null),
        (this.mode = r),
        (this.subtreeFlags = this.flags = 0),
        (this.deletions = null),
        (this.childLanes = this.lanes = 0),
        (this.alternate = null);
}
function ot(e, t, n, r) {
    return new j0(e, t, n, r);
}
function Au(e) {
    return (e = e.prototype), !(!e || !e.isReactComponent);
}
function z0(e) {
    if (typeof e == 'function') return Au(e) ? 1 : 0;
    if (e != null) {
        if (((e = e.$$typeof), e === Jc)) return 11;
        if (e === Zc) return 14;
    }
    return 2;
}
function yn(e, t) {
    var n = e.alternate;
    return (
        n === null
            ? ((n = ot(e.tag, t, e.key, e.mode)),
              (n.elementType = e.elementType),
              (n.type = e.type),
              (n.stateNode = e.stateNode),
              (n.alternate = e),
              (e.alternate = n))
            : ((n.pendingProps = t), (n.type = e.type), (n.flags = 0), (n.subtreeFlags = 0), (n.deletions = null)),
        (n.flags = e.flags & 14680064),
        (n.childLanes = e.childLanes),
        (n.lanes = e.lanes),
        (n.child = e.child),
        (n.memoizedProps = e.memoizedProps),
        (n.memoizedState = e.memoizedState),
        (n.updateQueue = e.updateQueue),
        (t = e.dependencies),
        (n.dependencies = t === null ? null : { lanes: t.lanes, firstContext: t.firstContext }),
        (n.sibling = e.sibling),
        (n.index = e.index),
        (n.ref = e.ref),
        n
    );
}
function Yi(e, t, n, r, o, i) {
    var s = 2;
    if (((r = e), typeof e == 'function')) Au(e) && (s = 1);
    else if (typeof e == 'string') s = 5;
    else
        e: switch (e) {
            case sr:
                return zn(n.children, o, i, t);
            case Qc:
                (s = 8), (o |= 8);
                break;
            case Ta:
                return (e = ot(12, n, t, o | 2)), (e.elementType = Ta), (e.lanes = i), e;
            case ka:
                return (e = ot(13, n, t, o)), (e.elementType = ka), (e.lanes = i), e;
            case Ra:
                return (e = ot(19, n, t, o)), (e.elementType = Ra), (e.lanes = i), e;
            case rp:
                return tl(n, o, i, t);
            default:
                if (typeof e == 'object' && e !== null)
                    switch (e.$$typeof) {
                        case tp:
                            s = 10;
                            break e;
                        case np:
                            s = 9;
                            break e;
                        case Jc:
                            s = 11;
                            break e;
                        case Zc:
                            s = 14;
                            break e;
                        case on:
                            (s = 16), (r = null);
                            break e;
                    }
                throw Error(D(130, e == null ? e : typeof e, ''));
        }
    return (t = ot(s, n, t, o)), (t.elementType = e), (t.type = r), (t.lanes = i), t;
}
function zn(e, t, n, r) {
    return (e = ot(7, e, r, t)), (e.lanes = n), e;
}
function tl(e, t, n, r) {
    return (e = ot(22, e, r, t)), (e.elementType = rp), (e.lanes = n), (e.stateNode = { isHidden: !1 }), e;
}
function Jl(e, t, n) {
    return (e = ot(6, e, null, t)), (e.lanes = n), e;
}
function Zl(e, t, n) {
    return (
        (t = ot(4, e.children !== null ? e.children : [], e.key, t)),
        (t.lanes = n),
        (t.stateNode = { containerInfo: e.containerInfo, pendingChildren: null, implementation: e.implementation }),
        t
    );
}
function U0(e, t, n, r, o) {
    (this.tag = t),
        (this.containerInfo = e),
        (this.finishedWork = this.pingCache = this.current = this.pendingChildren = null),
        (this.timeoutHandle = -1),
        (this.callbackNode = this.pendingContext = this.context = null),
        (this.callbackPriority = 0),
        (this.eventTimes = Al(0)),
        (this.expirationTimes = Al(-1)),
        (this.entangledLanes =
            this.finishedLanes =
            this.mutableReadLanes =
            this.expiredLanes =
            this.pingedLanes =
            this.suspendedLanes =
            this.pendingLanes =
                0),
        (this.entanglements = Al(0)),
        (this.identifierPrefix = r),
        (this.onRecoverableError = o),
        (this.mutableSourceEagerHydrationData = null);
}
function Iu(e, t, n, r, o, i, s, l, a) {
    return (
        (e = new U0(e, t, n, l, a)),
        t === 1 ? ((t = 1), i === !0 && (t |= 8)) : (t = 0),
        (i = ot(3, null, null, t)),
        (e.current = i),
        (i.stateNode = e),
        (i.memoizedState = { element: r, isDehydrated: n, cache: null, transitions: null, pendingSuspenseBoundaries: null }),
        vu(i),
        e
    );
}
function B0(e, t, n) {
    var r = 3 < arguments.length && arguments[3] !== void 0 ? arguments[3] : null;
    return { $$typeof: ir, key: r == null ? null : '' + r, children: e, containerInfo: t, implementation: n };
}
function Kg(e) {
    if (!e) return En;
    e = e._reactInternals;
    e: {
        if (Qn(e) !== e || e.tag !== 1) throw Error(D(170));
        var t = e;
        do {
            switch (t.tag) {
                case 3:
                    t = t.stateNode.context;
                    break e;
                case 1:
                    if (je(t.type)) {
                        t = t.stateNode.__reactInternalMemoizedMergedChildContext;
                        break e;
                    }
            }
            t = t.return;
        } while (t !== null);
        throw Error(D(171));
    }
    if (e.tag === 1) {
        var n = e.type;
        if (je(n)) return Kp(e, n, t);
    }
    return t;
}
function Yg(e, t, n, r, o, i, s, l, a) {
    return (
        (e = Iu(n, r, !0, e, o, i, s, l, a)),
        (e.context = Kg(null)),
        (n = e.current),
        (r = Pe()),
        (o = vn(n)),
        (i = Ht(r, o)),
        (i.callback = t ?? null),
        gn(n, i, o),
        (e.current.lanes = o),
        Zo(e, o, r),
        ze(e, r),
        e
    );
}
function nl(e, t, n, r) {
    var o = t.current,
        i = Pe(),
        s = vn(o);
    return (
        (n = Kg(n)),
        t.context === null ? (t.context = n) : (t.pendingContext = n),
        (t = Ht(i, s)),
        (t.payload = { element: e }),
        (r = r === void 0 ? null : r),
        r !== null && (t.callback = r),
        (e = gn(o, t, s)),
        e !== null && (vt(e, o, s, i), Hi(e, o, s)),
        s
    );
}
function Ds(e) {
    if (((e = e.current), !e.child)) return null;
    switch (e.child.tag) {
        case 5:
            return e.child.stateNode;
        default:
            return e.child.stateNode;
    }
}
function Ad(e, t) {
    if (((e = e.memoizedState), e !== null && e.dehydrated !== null)) {
        var n = e.retryLane;
        e.retryLane = n !== 0 && n < t ? n : t;
    }
}
function Mu(e, t) {
    Ad(e, t), (e = e.alternate) && Ad(e, t);
}
function $0() {
    return null;
}
var Xg =
    typeof reportError == 'function'
        ? reportError
        : function (e) {
              console.error(e);
          };
function Lu(e) {
    this._internalRoot = e;
}
rl.prototype.render = Lu.prototype.render = function (e) {
    var t = this._internalRoot;
    if (t === null) throw Error(D(409));
    nl(e, t, null, null);
};
rl.prototype.unmount = Lu.prototype.unmount = function () {
    var e = this._internalRoot;
    if (e !== null) {
        this._internalRoot = null;
        var t = e.containerInfo;
        qn(function () {
            nl(null, e, null, null);
        }),
            (t[Vt] = null);
    }
};
function rl(e) {
    this._internalRoot = e;
}
rl.prototype.unstable_scheduleHydration = function (e) {
    if (e) {
        var t = Rp();
        e = { blockedOn: null, target: e, priority: t };
        for (var n = 0; n < ln.length && t !== 0 && t < ln[n].priority; n++);
        ln.splice(n, 0, e), n === 0 && Op(e);
    }
};
function Fu(e) {
    return !(!e || (e.nodeType !== 1 && e.nodeType !== 9 && e.nodeType !== 11));
}
function ol(e) {
    return !(
        !e ||
        (e.nodeType !== 1 &&
            e.nodeType !== 9 &&
            e.nodeType !== 11 &&
            (e.nodeType !== 8 || e.nodeValue !== ' react-mount-point-unstable '))
    );
}
function Id() {}
function H0(e, t, n, r, o) {
    if (o) {
        if (typeof r == 'function') {
            var i = r;
            r = function () {
                var c = Ds(s);
                i.call(c);
            };
        }
        var s = Yg(t, r, e, 0, null, !1, !1, '', Id);
        return (e._reactRootContainer = s), (e[Vt] = s.current), Lo(e.nodeType === 8 ? e.parentNode : e), qn(), s;
    }
    for (; (o = e.lastChild); ) e.removeChild(o);
    if (typeof r == 'function') {
        var l = r;
        r = function () {
            var c = Ds(a);
            l.call(c);
        };
    }
    var a = Iu(e, 0, !1, null, null, !1, !1, '', Id);
    return (
        (e._reactRootContainer = a),
        (e[Vt] = a.current),
        Lo(e.nodeType === 8 ? e.parentNode : e),
        qn(function () {
            nl(t, a, n, r);
        }),
        a
    );
}
function il(e, t, n, r, o) {
    var i = n._reactRootContainer;
    if (i) {
        var s = i;
        if (typeof o == 'function') {
            var l = o;
            o = function () {
                var a = Ds(s);
                l.call(a);
            };
        }
        nl(t, s, e, o);
    } else s = H0(n, t, e, o, r);
    return Ds(s);
}
Tp = function (e) {
    switch (e.tag) {
        case 3:
            var t = e.stateNode;
            if (t.current.memoizedState.isDehydrated) {
                var n = fo(t.pendingLanes);
                n !== 0 && (nu(t, n | 1), ze(t, ae()), !(G & 6) && ((Ar = ae() + 500), On()));
            }
            break;
        case 13:
            qn(function () {
                var r = qt(e, 1);
                if (r !== null) {
                    var o = Pe();
                    vt(r, e, 1, o);
                }
            }),
                Mu(e, 1);
    }
};
ru = function (e) {
    if (e.tag === 13) {
        var t = qt(e, 134217728);
        if (t !== null) {
            var n = Pe();
            vt(t, e, 134217728, n);
        }
        Mu(e, 134217728);
    }
};
kp = function (e) {
    if (e.tag === 13) {
        var t = vn(e),
            n = qt(e, t);
        if (n !== null) {
            var r = Pe();
            vt(n, e, t, r);
        }
        Mu(e, t);
    }
};
Rp = function () {
    return X;
};
_p = function (e, t) {
    var n = X;
    try {
        return (X = e), t();
    } finally {
        X = n;
    }
};
Fa = function (e, t, n) {
    switch (t) {
        case 'input':
            if ((Pa(e, n), (t = n.name), n.type === 'radio' && t != null)) {
                for (n = e; n.parentNode; ) n = n.parentNode;
                for (
                    n = n.querySelectorAll('input[name=' + JSON.stringify('' + t) + '][type="radio"]'), t = 0;
                    t < n.length;
                    t++
                ) {
                    var r = n[t];
                    if (r !== e && r.form === e.form) {
                        var o = Ys(r);
                        if (!o) throw Error(D(90));
                        ip(r), Pa(r, o);
                    }
                }
            }
            break;
        case 'textarea':
            lp(e, n);
            break;
        case 'select':
            (t = n.value), t != null && vr(e, !!n.multiple, t, !1);
    }
};
pp = Pu;
gp = qn;
var W0 = { usingClientEntryPoint: !1, Events: [ti, ur, Ys, dp, hp, Pu] },
    oo = { findFiberByHostInstance: In, bundleType: 0, version: '18.3.1', rendererPackageName: 'react-dom' },
    V0 = {
        bundleType: oo.bundleType,
        version: oo.version,
        rendererPackageName: oo.rendererPackageName,
        rendererConfig: oo.rendererConfig,
        overrideHookState: null,
        overrideHookStateDeletePath: null,
        overrideHookStateRenamePath: null,
        overrideProps: null,
        overridePropsDeletePath: null,
        overridePropsRenamePath: null,
        setErrorHandler: null,
        setSuspenseHandler: null,
        scheduleUpdate: null,
        currentDispatcherRef: Xt.ReactCurrentDispatcher,
        findHostInstanceByFiber: function (e) {
            return (e = yp(e)), e === null ? null : e.stateNode;
        },
        findFiberByHostInstance: oo.findFiberByHostInstance || $0,
        findHostInstancesForRefresh: null,
        scheduleRefresh: null,
        scheduleRoot: null,
        setRefreshHandler: null,
        getCurrentFiber: null,
        reconcilerVersion: '18.3.1-next-f1338f8080-20240426',
    };
if (typeof __REACT_DEVTOOLS_GLOBAL_HOOK__ < 'u') {
    var ki = __REACT_DEVTOOLS_GLOBAL_HOOK__;
    if (!ki.isDisabled && ki.supportsFiber)
        try {
            (Vs = ki.inject(V0)), (_t = ki);
        } catch {}
}
Xe.__SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED = W0;
Xe.createPortal = function (e, t) {
    var n = 2 < arguments.length && arguments[2] !== void 0 ? arguments[2] : null;
    if (!Fu(t)) throw Error(D(200));
    return B0(e, t, null, n);
};
Xe.createRoot = function (e, t) {
    if (!Fu(e)) throw Error(D(299));
    var n = !1,
        r = '',
        o = Xg;
    return (
        t != null &&
            (t.unstable_strictMode === !0 && (n = !0),
            t.identifierPrefix !== void 0 && (r = t.identifierPrefix),
            t.onRecoverableError !== void 0 && (o = t.onRecoverableError)),
        (t = Iu(e, 1, !1, null, null, n, !1, r, o)),
        (e[Vt] = t.current),
        Lo(e.nodeType === 8 ? e.parentNode : e),
        new Lu(t)
    );
};
Xe.findDOMNode = function (e) {
    if (e == null) return null;
    if (e.nodeType === 1) return e;
    var t = e._reactInternals;
    if (t === void 0) throw typeof e.render == 'function' ? Error(D(188)) : ((e = Object.keys(e).join(',')), Error(D(268, e)));
    return (e = yp(t)), (e = e === null ? null : e.stateNode), e;
};
Xe.flushSync = function (e) {
    return qn(e);
};
Xe.hydrate = function (e, t, n) {
    if (!ol(t)) throw Error(D(200));
    return il(null, e, t, !0, n);
};
Xe.hydrateRoot = function (e, t, n) {
    if (!Fu(e)) throw Error(D(405));
    var r = (n != null && n.hydratedSources) || null,
        o = !1,
        i = '',
        s = Xg;
    if (
        (n != null &&
            (n.unstable_strictMode === !0 && (o = !0),
            n.identifierPrefix !== void 0 && (i = n.identifierPrefix),
            n.onRecoverableError !== void 0 && (s = n.onRecoverableError)),
        (t = Yg(t, null, e, 1, n ?? null, o, !1, i, s)),
        (e[Vt] = t.current),
        Lo(e),
        r)
    )
        for (e = 0; e < r.length; e++)
            (n = r[e]),
                (o = n._getVersion),
                (o = o(n._source)),
                t.mutableSourceEagerHydrationData == null
                    ? (t.mutableSourceEagerHydrationData = [n, o])
                    : t.mutableSourceEagerHydrationData.push(n, o);
    return new rl(t);
};
Xe.render = function (e, t, n) {
    if (!ol(t)) throw Error(D(200));
    return il(null, e, t, !1, n);
};
Xe.unmountComponentAtNode = function (e) {
    if (!ol(e)) throw Error(D(40));
    return e._reactRootContainer
        ? (qn(function () {
              il(null, null, e, !1, function () {
                  (e._reactRootContainer = null), (e[Vt] = null);
              });
          }),
          !0)
        : !1;
};
Xe.unstable_batchedUpdates = Pu;
Xe.unstable_renderSubtreeIntoContainer = function (e, t, n, r) {
    if (!ol(n)) throw Error(D(200));
    if (e == null || e._reactInternals === void 0) throw Error(D(38));
    return il(e, t, n, !1, r);
};
Xe.version = '18.3.1-next-f1338f8080-20240426';
function Qg() {
    if (!(typeof __REACT_DEVTOOLS_GLOBAL_HOOK__ > 'u' || typeof __REACT_DEVTOOLS_GLOBAL_HOOK__.checkDCE != 'function'))
        try {
            __REACT_DEVTOOLS_GLOBAL_HOOK__.checkDCE(Qg);
        } catch (e) {
            console.error(e);
        }
}
Qg(), (Qh.exports = Xe);
var sl = Qh.exports;
const q0 = Hc(sl);
var Md = sl;
(Ca.createRoot = Md.createRoot), (Ca.hydrateRoot = Md.hydrateRoot);
const Jg = g.createContext({ dragDropManager: void 0 });
function Ze(e) {
    return (
        'Minified Redux error #' +
        e +
        '; visit https://redux.js.org/Errors?code=' +
        e +
        ' for the full message or use the non-minified dev environment for full errors. '
    );
}
var Ld = (function () {
        return (typeof Symbol == 'function' && Symbol.observable) || '@@observable';
    })(),
    Fd = function () {
        return Math.random().toString(36).substring(7).split('').join('.');
    },
    jd = { INIT: '@@redux/INIT' + Fd(), REPLACE: '@@redux/REPLACE' + Fd() };
function G0(e) {
    if (typeof e != 'object' || e === null) return !1;
    for (var t = e; Object.getPrototypeOf(t) !== null; ) t = Object.getPrototypeOf(t);
    return Object.getPrototypeOf(e) === t;
}
function Zg(e, t, n) {
    var r;
    if ((typeof t == 'function' && typeof n == 'function') || (typeof n == 'function' && typeof arguments[3] == 'function'))
        throw new Error(Ze(0));
    if ((typeof t == 'function' && typeof n > 'u' && ((n = t), (t = void 0)), typeof n < 'u')) {
        if (typeof n != 'function') throw new Error(Ze(1));
        return n(Zg)(e, t);
    }
    if (typeof e != 'function') throw new Error(Ze(2));
    var o = e,
        i = t,
        s = [],
        l = s,
        a = !1;
    function c() {
        l === s && (l = s.slice());
    }
    function u() {
        if (a) throw new Error(Ze(3));
        return i;
    }
    function f(v) {
        if (typeof v != 'function') throw new Error(Ze(4));
        if (a) throw new Error(Ze(5));
        var S = !0;
        return (
            c(),
            l.push(v),
            function () {
                if (S) {
                    if (a) throw new Error(Ze(6));
                    (S = !1), c();
                    var p = l.indexOf(v);
                    l.splice(p, 1), (s = null);
                }
            }
        );
    }
    function d(v) {
        if (!G0(v)) throw new Error(Ze(7));
        if (typeof v.type > 'u') throw new Error(Ze(8));
        if (a) throw new Error(Ze(9));
        try {
            (a = !0), (i = o(i, v));
        } finally {
            a = !1;
        }
        for (var S = (s = l), h = 0; h < S.length; h++) {
            var p = S[h];
            p();
        }
        return v;
    }
    function y(v) {
        if (typeof v != 'function') throw new Error(Ze(10));
        (o = v), d({ type: jd.REPLACE });
    }
    function m() {
        var v,
            S = f;
        return (
            (v = {
                subscribe: function (p) {
                    if (typeof p != 'object' || p === null) throw new Error(Ze(11));
                    function w() {
                        p.next && p.next(u());
                    }
                    w();
                    var C = S(w);
                    return { unsubscribe: C };
                },
            }),
            (v[Ld] = function () {
                return this;
            }),
            v
        );
    }
    return d({ type: jd.INIT }), (r = { dispatch: d, subscribe: f, getState: u, replaceReducer: y }), (r[Ld] = m), r;
}
function B(e, t, ...n) {
    if (K0() && t === void 0) throw new Error('invariant requires an error message argument');
    if (!e) {
        let r;
        if (t === void 0)
            r = new Error(
                'Minified exception occurred; use the non-minified dev environment for the full error message and additional helpful warnings.',
            );
        else {
            let o = 0;
            (r = new Error(
                t.replace(/%s/g, function () {
                    return n[o++];
                }),
            )),
                (r.name = 'Invariant Violation');
        }
        throw ((r.framesToPop = 1), r);
    }
}
function K0() {
    return typeof process < 'u' && !0;
}
function Y0(e, t, n) {
    return t.split('.').reduce((r, o) => (r && r[o] ? r[o] : n || null), e);
}
function X0(e, t) {
    return e.filter((n) => n !== t);
}
function em(e) {
    return typeof e == 'object';
}
function Q0(e, t) {
    const n = new Map(),
        r = (i) => {
            n.set(i, n.has(i) ? n.get(i) + 1 : 1);
        };
    e.forEach(r), t.forEach(r);
    const o = [];
    return (
        n.forEach((i, s) => {
            i === 1 && o.push(s);
        }),
        o
    );
}
function J0(e, t) {
    return e.filter((n) => t.indexOf(n) > -1);
}
const ju = 'dnd-core/INIT_COORDS',
    ll = 'dnd-core/BEGIN_DRAG',
    zu = 'dnd-core/PUBLISH_DRAG_SOURCE',
    al = 'dnd-core/HOVER',
    cl = 'dnd-core/DROP',
    ul = 'dnd-core/END_DRAG';
function zd(e, t) {
    return { type: ju, payload: { sourceClientOffset: t || null, clientOffset: e || null } };
}
const Z0 = { type: ju, payload: { clientOffset: null, sourceClientOffset: null } };
function eE(e) {
    return function (n = [], r = { publishSource: !0 }) {
        const { publishSource: o = !0, clientOffset: i, getSourceClientOffset: s } = r,
            l = e.getMonitor(),
            a = e.getRegistry();
        e.dispatch(zd(i)), tE(n, l, a);
        const c = oE(n, l);
        if (c == null) {
            e.dispatch(Z0);
            return;
        }
        let u = null;
        if (i) {
            if (!s) throw new Error('getSourceClientOffset must be defined');
            nE(s), (u = s(c));
        }
        e.dispatch(zd(i, u));
        const d = a.getSource(c).beginDrag(l, c);
        if (d == null) return;
        rE(d), a.pinSource(c);
        const y = a.getSourceType(c);
        return {
            type: ll,
            payload: {
                itemType: y,
                item: d,
                sourceId: c,
                clientOffset: i || null,
                sourceClientOffset: u || null,
                isSourcePublic: !!o,
            },
        };
    };
}
function tE(e, t, n) {
    B(!t.isDragging(), 'Cannot call beginDrag while dragging.'),
        e.forEach(function (r) {
            B(n.getSource(r), 'Expected sourceIds to be registered.');
        });
}
function nE(e) {
    B(typeof e == 'function', 'When clientOffset is provided, getSourceClientOffset must be a function.');
}
function rE(e) {
    B(em(e), 'Item must be an object.');
}
function oE(e, t) {
    let n = null;
    for (let r = e.length - 1; r >= 0; r--)
        if (t.canDragSource(e[r])) {
            n = e[r];
            break;
        }
    return n;
}
function iE(e, t, n) {
    return t in e ? Object.defineProperty(e, t, { value: n, enumerable: !0, configurable: !0, writable: !0 }) : (e[t] = n), e;
}
function sE(e) {
    for (var t = 1; t < arguments.length; t++) {
        var n = arguments[t] != null ? arguments[t] : {},
            r = Object.keys(n);
        typeof Object.getOwnPropertySymbols == 'function' &&
            (r = r.concat(
                Object.getOwnPropertySymbols(n).filter(function (o) {
                    return Object.getOwnPropertyDescriptor(n, o).enumerable;
                }),
            )),
            r.forEach(function (o) {
                iE(e, o, n[o]);
            });
    }
    return e;
}
function lE(e) {
    return function (n = {}) {
        const r = e.getMonitor(),
            o = e.getRegistry();
        aE(r),
            fE(r).forEach((s, l) => {
                const a = cE(s, l, o, r),
                    c = { type: cl, payload: { dropResult: sE({}, n, a) } };
                e.dispatch(c);
            });
    };
}
function aE(e) {
    B(e.isDragging(), 'Cannot call drop while not dragging.'),
        B(!e.didDrop(), 'Cannot call drop twice during one drag operation.');
}
function cE(e, t, n, r) {
    const o = n.getTarget(e);
    let i = o ? o.drop(r, e) : void 0;
    return uE(i), typeof i > 'u' && (i = t === 0 ? {} : r.getDropResult()), i;
}
function uE(e) {
    B(typeof e > 'u' || em(e), 'Drop result must either be an object or undefined.');
}
function fE(e) {
    const t = e.getTargetIds().filter(e.canDropOnTarget, e);
    return t.reverse(), t;
}
function dE(e) {
    return function () {
        const n = e.getMonitor(),
            r = e.getRegistry();
        hE(n);
        const o = n.getSourceId();
        return o != null && (r.getSource(o, !0).endDrag(n, o), r.unpinSource()), { type: ul };
    };
}
function hE(e) {
    B(e.isDragging(), 'Cannot call endDrag while not dragging.');
}
function mc(e, t) {
    return t === null ? e === null : Array.isArray(e) ? e.some((n) => n === t) : e === t;
}
function pE(e) {
    return function (n, { clientOffset: r } = {}) {
        gE(n);
        const o = n.slice(0),
            i = e.getMonitor(),
            s = e.getRegistry(),
            l = i.getItemType();
        return vE(o, s, l), mE(o, i, s), yE(o, i, s), { type: al, payload: { targetIds: o, clientOffset: r || null } };
    };
}
function gE(e) {
    B(Array.isArray(e), 'Expected targetIds to be an array.');
}
function mE(e, t, n) {
    B(t.isDragging(), 'Cannot call hover while not dragging.'), B(!t.didDrop(), 'Cannot call hover after drop.');
    for (let r = 0; r < e.length; r++) {
        const o = e[r];
        B(e.lastIndexOf(o) === r, 'Expected targetIds to be unique in the passed array.');
        const i = n.getTarget(o);
        B(i, 'Expected targetIds to be registered.');
    }
}
function vE(e, t, n) {
    for (let r = e.length - 1; r >= 0; r--) {
        const o = e[r],
            i = t.getTargetType(o);
        mc(i, n) || e.splice(r, 1);
    }
}
function yE(e, t, n) {
    e.forEach(function (r) {
        n.getTarget(r).hover(t, r);
    });
}
function wE(e) {
    return function () {
        if (e.getMonitor().isDragging()) return { type: zu };
    };
}
function SE(e) {
    return { beginDrag: eE(e), publishDragSource: wE(e), hover: pE(e), drop: lE(e), endDrag: dE(e) };
}
class EE {
    receiveBackend(t) {
        this.backend = t;
    }
    getMonitor() {
        return this.monitor;
    }
    getBackend() {
        return this.backend;
    }
    getRegistry() {
        return this.monitor.registry;
    }
    getActions() {
        const t = this,
            { dispatch: n } = this.store;
        function r(i) {
            return (...s) => {
                const l = i.apply(t, s);
                typeof l < 'u' && n(l);
            };
        }
        const o = SE(this);
        return Object.keys(o).reduce((i, s) => {
            const l = o[s];
            return (i[s] = r(l)), i;
        }, {});
    }
    dispatch(t) {
        this.store.dispatch(t);
    }
    constructor(t, n) {
        (this.isSetUp = !1),
            (this.handleRefCountChange = () => {
                const r = this.store.getState().refCount > 0;
                this.backend &&
                    (r && !this.isSetUp
                        ? (this.backend.setup(), (this.isSetUp = !0))
                        : !r && this.isSetUp && (this.backend.teardown(), (this.isSetUp = !1)));
            }),
            (this.store = t),
            (this.monitor = n),
            t.subscribe(this.handleRefCountChange);
    }
}
function xE(e, t) {
    return { x: e.x + t.x, y: e.y + t.y };
}
function tm(e, t) {
    return { x: e.x - t.x, y: e.y - t.y };
}
function CE(e) {
    const { clientOffset: t, initialClientOffset: n, initialSourceClientOffset: r } = e;
    return !t || !n || !r ? null : tm(xE(t, r), n);
}
function bE(e) {
    const { clientOffset: t, initialClientOffset: n } = e;
    return !t || !n ? null : tm(t, n);
}
const Ro = [],
    Uu = [];
Ro.__IS_NONE__ = !0;
Uu.__IS_ALL__ = !0;
function TE(e, t) {
    return e === Ro ? !1 : e === Uu || typeof t > 'u' ? !0 : J0(t, e).length > 0;
}
class kE {
    subscribeToStateChange(t, n = {}) {
        const { handlerIds: r } = n;
        B(typeof t == 'function', 'listener must be a function.'),
            B(typeof r > 'u' || Array.isArray(r), 'handlerIds, when specified, must be an array of strings.');
        let o = this.store.getState().stateId;
        const i = () => {
            const s = this.store.getState(),
                l = s.stateId;
            try {
                l === o || (l === o + 1 && !TE(s.dirtyHandlerIds, r)) || t();
            } finally {
                o = l;
            }
        };
        return this.store.subscribe(i);
    }
    subscribeToOffsetChange(t) {
        B(typeof t == 'function', 'listener must be a function.');
        let n = this.store.getState().dragOffset;
        const r = () => {
            const o = this.store.getState().dragOffset;
            o !== n && ((n = o), t());
        };
        return this.store.subscribe(r);
    }
    canDragSource(t) {
        if (!t) return !1;
        const n = this.registry.getSource(t);
        return B(n, `Expected to find a valid source. sourceId=${t}`), this.isDragging() ? !1 : n.canDrag(this, t);
    }
    canDropOnTarget(t) {
        if (!t) return !1;
        const n = this.registry.getTarget(t);
        if ((B(n, `Expected to find a valid target. targetId=${t}`), !this.isDragging() || this.didDrop())) return !1;
        const r = this.registry.getTargetType(t),
            o = this.getItemType();
        return mc(r, o) && n.canDrop(this, t);
    }
    isDragging() {
        return !!this.getItemType();
    }
    isDraggingSource(t) {
        if (!t) return !1;
        const n = this.registry.getSource(t, !0);
        if ((B(n, `Expected to find a valid source. sourceId=${t}`), !this.isDragging() || !this.isSourcePublic())) return !1;
        const r = this.registry.getSourceType(t),
            o = this.getItemType();
        return r !== o ? !1 : n.isDragging(this, t);
    }
    isOverTarget(t, n = { shallow: !1 }) {
        if (!t) return !1;
        const { shallow: r } = n;
        if (!this.isDragging()) return !1;
        const o = this.registry.getTargetType(t),
            i = this.getItemType();
        if (i && !mc(o, i)) return !1;
        const s = this.getTargetIds();
        if (!s.length) return !1;
        const l = s.indexOf(t);
        return r ? l === s.length - 1 : l > -1;
    }
    getItemType() {
        return this.store.getState().dragOperation.itemType;
    }
    getItem() {
        return this.store.getState().dragOperation.item;
    }
    getSourceId() {
        return this.store.getState().dragOperation.sourceId;
    }
    getTargetIds() {
        return this.store.getState().dragOperation.targetIds;
    }
    getDropResult() {
        return this.store.getState().dragOperation.dropResult;
    }
    didDrop() {
        return this.store.getState().dragOperation.didDrop;
    }
    isSourcePublic() {
        return !!this.store.getState().dragOperation.isSourcePublic;
    }
    getInitialClientOffset() {
        return this.store.getState().dragOffset.initialClientOffset;
    }
    getInitialSourceClientOffset() {
        return this.store.getState().dragOffset.initialSourceClientOffset;
    }
    getClientOffset() {
        return this.store.getState().dragOffset.clientOffset;
    }
    getSourceClientOffset() {
        return CE(this.store.getState().dragOffset);
    }
    getDifferenceFromInitialOffset() {
        return bE(this.store.getState().dragOffset);
    }
    constructor(t, n) {
        (this.store = t), (this.registry = n);
    }
}
const Ud = typeof global < 'u' ? global : self,
    nm = Ud.MutationObserver || Ud.WebKitMutationObserver;
function rm(e) {
    return function () {
        const n = setTimeout(o, 0),
            r = setInterval(o, 50);
        function o() {
            clearTimeout(n), clearInterval(r), e();
        }
    };
}
function RE(e) {
    let t = 1;
    const n = new nm(e),
        r = document.createTextNode('');
    return (
        n.observe(r, { characterData: !0 }),
        function () {
            (t = -t), (r.data = t);
        }
    );
}
const _E = typeof nm == 'function' ? RE : rm;
class OE {
    enqueueTask(t) {
        const { queue: n, requestFlush: r } = this;
        n.length || (r(), (this.flushing = !0)), (n[n.length] = t);
    }
    constructor() {
        (this.queue = []),
            (this.pendingErrors = []),
            (this.flushing = !1),
            (this.index = 0),
            (this.capacity = 1024),
            (this.flush = () => {
                const { queue: t } = this;
                for (; this.index < t.length; ) {
                    const n = this.index;
                    if ((this.index++, t[n].call(), this.index > this.capacity)) {
                        for (let r = 0, o = t.length - this.index; r < o; r++) t[r] = t[r + this.index];
                        (t.length -= this.index), (this.index = 0);
                    }
                }
                (t.length = 0), (this.index = 0), (this.flushing = !1);
            }),
            (this.registerPendingError = (t) => {
                this.pendingErrors.push(t), this.requestErrorThrow();
            }),
            (this.requestFlush = _E(this.flush)),
            (this.requestErrorThrow = rm(() => {
                if (this.pendingErrors.length) throw this.pendingErrors.shift();
            }));
    }
}
class PE {
    call() {
        try {
            this.task && this.task();
        } catch (t) {
            this.onError(t);
        } finally {
            (this.task = null), this.release(this);
        }
    }
    constructor(t, n) {
        (this.onError = t), (this.release = n), (this.task = null);
    }
}
class NE {
    create(t) {
        const n = this.freeTasks,
            r = n.length ? n.pop() : new PE(this.onError, (o) => (n[n.length] = o));
        return (r.task = t), r;
    }
    constructor(t) {
        (this.onError = t), (this.freeTasks = []);
    }
}
const om = new OE(),
    DE = new NE(om.registerPendingError);
function AE(e) {
    om.enqueueTask(DE.create(e));
}
const Bu = 'dnd-core/ADD_SOURCE',
    $u = 'dnd-core/ADD_TARGET',
    Hu = 'dnd-core/REMOVE_SOURCE',
    fl = 'dnd-core/REMOVE_TARGET';
function IE(e) {
    return { type: Bu, payload: { sourceId: e } };
}
function ME(e) {
    return { type: $u, payload: { targetId: e } };
}
function LE(e) {
    return { type: Hu, payload: { sourceId: e } };
}
function FE(e) {
    return { type: fl, payload: { targetId: e } };
}
function jE(e) {
    B(typeof e.canDrag == 'function', 'Expected canDrag to be a function.'),
        B(typeof e.beginDrag == 'function', 'Expected beginDrag to be a function.'),
        B(typeof e.endDrag == 'function', 'Expected endDrag to be a function.');
}
function zE(e) {
    B(typeof e.canDrop == 'function', 'Expected canDrop to be a function.'),
        B(typeof e.hover == 'function', 'Expected hover to be a function.'),
        B(typeof e.drop == 'function', 'Expected beginDrag to be a function.');
}
function vc(e, t) {
    if (t && Array.isArray(e)) {
        e.forEach((n) => vc(n, !1));
        return;
    }
    B(
        typeof e == 'string' || typeof e == 'symbol',
        t ? 'Type can only be a string, a symbol, or an array of either.' : 'Type can only be a string or a symbol.',
    );
}
var nt;
(function (e) {
    (e.SOURCE = 'SOURCE'), (e.TARGET = 'TARGET');
})(nt || (nt = {}));
let UE = 0;
function BE() {
    return UE++;
}
function $E(e) {
    const t = BE().toString();
    switch (e) {
        case nt.SOURCE:
            return `S${t}`;
        case nt.TARGET:
            return `T${t}`;
        default:
            throw new Error(`Unknown Handler Role: ${e}`);
    }
}
function Bd(e) {
    switch (e[0]) {
        case 'S':
            return nt.SOURCE;
        case 'T':
            return nt.TARGET;
        default:
            throw new Error(`Cannot parse handler ID: ${e}`);
    }
}
function $d(e, t) {
    const n = e.entries();
    let r = !1;
    do {
        const {
            done: o,
            value: [, i],
        } = n.next();
        if (i === t) return !0;
        r = !!o;
    } while (!r);
    return !1;
}
class HE {
    addSource(t, n) {
        vc(t), jE(n);
        const r = this.addHandler(nt.SOURCE, t, n);
        return this.store.dispatch(IE(r)), r;
    }
    addTarget(t, n) {
        vc(t, !0), zE(n);
        const r = this.addHandler(nt.TARGET, t, n);
        return this.store.dispatch(ME(r)), r;
    }
    containsHandler(t) {
        return $d(this.dragSources, t) || $d(this.dropTargets, t);
    }
    getSource(t, n = !1) {
        return (
            B(this.isSourceId(t), 'Expected a valid source ID.'),
            n && t === this.pinnedSourceId ? this.pinnedSource : this.dragSources.get(t)
        );
    }
    getTarget(t) {
        return B(this.isTargetId(t), 'Expected a valid target ID.'), this.dropTargets.get(t);
    }
    getSourceType(t) {
        return B(this.isSourceId(t), 'Expected a valid source ID.'), this.types.get(t);
    }
    getTargetType(t) {
        return B(this.isTargetId(t), 'Expected a valid target ID.'), this.types.get(t);
    }
    isSourceId(t) {
        return Bd(t) === nt.SOURCE;
    }
    isTargetId(t) {
        return Bd(t) === nt.TARGET;
    }
    removeSource(t) {
        B(this.getSource(t), 'Expected an existing source.'),
            this.store.dispatch(LE(t)),
            AE(() => {
                this.dragSources.delete(t), this.types.delete(t);
            });
    }
    removeTarget(t) {
        B(this.getTarget(t), 'Expected an existing target.'),
            this.store.dispatch(FE(t)),
            this.dropTargets.delete(t),
            this.types.delete(t);
    }
    pinSource(t) {
        const n = this.getSource(t);
        B(n, 'Expected an existing source.'), (this.pinnedSourceId = t), (this.pinnedSource = n);
    }
    unpinSource() {
        B(this.pinnedSource, 'No source is pinned at the time.'), (this.pinnedSourceId = null), (this.pinnedSource = null);
    }
    addHandler(t, n, r) {
        const o = $E(t);
        return (
            this.types.set(o, n),
            t === nt.SOURCE ? this.dragSources.set(o, r) : t === nt.TARGET && this.dropTargets.set(o, r),
            o
        );
    }
    constructor(t) {
        (this.types = new Map()),
            (this.dragSources = new Map()),
            (this.dropTargets = new Map()),
            (this.pinnedSourceId = null),
            (this.pinnedSource = null),
            (this.store = t);
    }
}
const WE = (e, t) => e === t;
function VE(e, t) {
    return !e && !t ? !0 : !e || !t ? !1 : e.x === t.x && e.y === t.y;
}
function qE(e, t, n = WE) {
    if (e.length !== t.length) return !1;
    for (let r = 0; r < e.length; ++r) if (!n(e[r], t[r])) return !1;
    return !0;
}
function GE(e = Ro, t) {
    switch (t.type) {
        case al:
            break;
        case Bu:
        case $u:
        case fl:
        case Hu:
            return Ro;
        case ll:
        case zu:
        case ul:
        case cl:
        default:
            return Uu;
    }
    const { targetIds: n = [], prevTargetIds: r = [] } = t.payload,
        o = Q0(n, r);
    if (!(o.length > 0 || !qE(n, r))) return Ro;
    const s = r[r.length - 1],
        l = n[n.length - 1];
    return s !== l && (s && o.push(s), l && o.push(l)), o;
}
function KE(e, t, n) {
    return t in e ? Object.defineProperty(e, t, { value: n, enumerable: !0, configurable: !0, writable: !0 }) : (e[t] = n), e;
}
function YE(e) {
    for (var t = 1; t < arguments.length; t++) {
        var n = arguments[t] != null ? arguments[t] : {},
            r = Object.keys(n);
        typeof Object.getOwnPropertySymbols == 'function' &&
            (r = r.concat(
                Object.getOwnPropertySymbols(n).filter(function (o) {
                    return Object.getOwnPropertyDescriptor(n, o).enumerable;
                }),
            )),
            r.forEach(function (o) {
                KE(e, o, n[o]);
            });
    }
    return e;
}
const Hd = { initialSourceClientOffset: null, initialClientOffset: null, clientOffset: null };
function XE(e = Hd, t) {
    const { payload: n } = t;
    switch (t.type) {
        case ju:
        case ll:
            return {
                initialSourceClientOffset: n.sourceClientOffset,
                initialClientOffset: n.clientOffset,
                clientOffset: n.clientOffset,
            };
        case al:
            return VE(e.clientOffset, n.clientOffset) ? e : YE({}, e, { clientOffset: n.clientOffset });
        case ul:
        case cl:
            return Hd;
        default:
            return e;
    }
}
function QE(e, t, n) {
    return t in e ? Object.defineProperty(e, t, { value: n, enumerable: !0, configurable: !0, writable: !0 }) : (e[t] = n), e;
}
function er(e) {
    for (var t = 1; t < arguments.length; t++) {
        var n = arguments[t] != null ? arguments[t] : {},
            r = Object.keys(n);
        typeof Object.getOwnPropertySymbols == 'function' &&
            (r = r.concat(
                Object.getOwnPropertySymbols(n).filter(function (o) {
                    return Object.getOwnPropertyDescriptor(n, o).enumerable;
                }),
            )),
            r.forEach(function (o) {
                QE(e, o, n[o]);
            });
    }
    return e;
}
const JE = { itemType: null, item: null, sourceId: null, targetIds: [], dropResult: null, didDrop: !1, isSourcePublic: null };
function ZE(e = JE, t) {
    const { payload: n } = t;
    switch (t.type) {
        case ll:
            return er({}, e, {
                itemType: n.itemType,
                item: n.item,
                sourceId: n.sourceId,
                isSourcePublic: n.isSourcePublic,
                dropResult: null,
                didDrop: !1,
            });
        case zu:
            return er({}, e, { isSourcePublic: !0 });
        case al:
            return er({}, e, { targetIds: n.targetIds });
        case fl:
            return e.targetIds.indexOf(n.targetId) === -1 ? e : er({}, e, { targetIds: X0(e.targetIds, n.targetId) });
        case cl:
            return er({}, e, { dropResult: n.dropResult, didDrop: !0, targetIds: [] });
        case ul:
            return er({}, e, {
                itemType: null,
                item: null,
                sourceId: null,
                dropResult: null,
                didDrop: !1,
                isSourcePublic: null,
                targetIds: [],
            });
        default:
            return e;
    }
}
function ex(e = 0, t) {
    switch (t.type) {
        case Bu:
        case $u:
            return e + 1;
        case Hu:
        case fl:
            return e - 1;
        default:
            return e;
    }
}
function tx(e = 0) {
    return e + 1;
}
function nx(e, t, n) {
    return t in e ? Object.defineProperty(e, t, { value: n, enumerable: !0, configurable: !0, writable: !0 }) : (e[t] = n), e;
}
function rx(e) {
    for (var t = 1; t < arguments.length; t++) {
        var n = arguments[t] != null ? arguments[t] : {},
            r = Object.keys(n);
        typeof Object.getOwnPropertySymbols == 'function' &&
            (r = r.concat(
                Object.getOwnPropertySymbols(n).filter(function (o) {
                    return Object.getOwnPropertyDescriptor(n, o).enumerable;
                }),
            )),
            r.forEach(function (o) {
                nx(e, o, n[o]);
            });
    }
    return e;
}
function ox(e = {}, t) {
    return {
        dirtyHandlerIds: GE(e.dirtyHandlerIds, {
            type: t.type,
            payload: rx({}, t.payload, { prevTargetIds: Y0(e, 'dragOperation.targetIds', []) }),
        }),
        dragOffset: XE(e.dragOffset, t),
        refCount: ex(e.refCount, t),
        dragOperation: ZE(e.dragOperation, t),
        stateId: tx(e.stateId),
    };
}
function ix(e, t = void 0, n = {}, r = !1) {
    const o = sx(r),
        i = new kE(o, new HE(o)),
        s = new EE(o, i),
        l = e(s, t, n);
    return s.receiveBackend(l), s;
}
function sx(e) {
    const t = typeof window < 'u' && window.__REDUX_DEVTOOLS_EXTENSION__;
    return Zg(ox, e && t && t({ name: 'dnd-core', instanceId: 'dnd-core' }));
}
function lx(e, t) {
    if (e == null) return {};
    var n = ax(e, t),
        r,
        o;
    if (Object.getOwnPropertySymbols) {
        var i = Object.getOwnPropertySymbols(e);
        for (o = 0; o < i.length; o++)
            (r = i[o]), !(t.indexOf(r) >= 0) && Object.prototype.propertyIsEnumerable.call(e, r) && (n[r] = e[r]);
    }
    return n;
}
function ax(e, t) {
    if (e == null) return {};
    var n = {},
        r = Object.keys(e),
        o,
        i;
    for (i = 0; i < r.length; i++) (o = r[i]), !(t.indexOf(o) >= 0) && (n[o] = e[o]);
    return n;
}
let Wd = 0;
const Xi = Symbol.for('__REACT_DND_CONTEXT_INSTANCE__');
var cx = g.memo(function (t) {
    var { children: n } = t,
        r = lx(t, ['children']);
    const [o, i] = ux(r);
    return (
        g.useEffect(() => {
            if (i) {
                const s = im();
                return (
                    ++Wd,
                    () => {
                        --Wd === 0 && (s[Xi] = null);
                    }
                );
            }
        }, []),
        E.jsx(Jg.Provider, { value: o, children: n })
    );
});
function ux(e) {
    if ('manager' in e) return [{ dragDropManager: e.manager }, !1];
    const t = fx(e.backend, e.context, e.options, e.debugMode),
        n = !e.context;
    return [t, n];
}
function fx(e, t = im(), n, r) {
    const o = t;
    return o[Xi] || (o[Xi] = { dragDropManager: ix(e, t, n, r) }), o[Xi];
}
function im() {
    return typeof global < 'u' ? global : window;
}
var dx = function e(t, n) {
    if (t === n) return !0;
    if (t && n && typeof t == 'object' && typeof n == 'object') {
        if (t.constructor !== n.constructor) return !1;
        var r, o, i;
        if (Array.isArray(t)) {
            if (((r = t.length), r != n.length)) return !1;
            for (o = r; o-- !== 0; ) if (!e(t[o], n[o])) return !1;
            return !0;
        }
        if (t.constructor === RegExp) return t.source === n.source && t.flags === n.flags;
        if (t.valueOf !== Object.prototype.valueOf) return t.valueOf() === n.valueOf();
        if (t.toString !== Object.prototype.toString) return t.toString() === n.toString();
        if (((i = Object.keys(t)), (r = i.length), r !== Object.keys(n).length)) return !1;
        for (o = r; o-- !== 0; ) if (!Object.prototype.hasOwnProperty.call(n, i[o])) return !1;
        for (o = r; o-- !== 0; ) {
            var s = i[o];
            if (!e(t[s], n[s])) return !1;
        }
        return !0;
    }
    return t !== t && n !== n;
};
const hx = Hc(dx),
    Gn = typeof window < 'u' ? g.useLayoutEffect : g.useEffect;
function px(e, t, n) {
    const [r, o] = g.useState(() => t(e)),
        i = g.useCallback(() => {
            const s = t(e);
            hx(r, s) || (o(s), n && n());
        }, [r, e, n]);
    return Gn(i), [r, i];
}
function gx(e, t, n) {
    const [r, o] = px(e, t, n);
    return (
        Gn(
            function () {
                const s = e.getHandlerId();
                if (s != null) return e.subscribeToStateChange(o, { handlerIds: [s] });
            },
            [e, o],
        ),
        r
    );
}
function sm(e, t, n) {
    return gx(t, e || (() => ({})), () => n.reconnect());
}
function lm(e, t) {
    const n = [];
    return typeof e != 'function' && n.push(e), g.useMemo(() => (typeof e == 'function' ? e() : e), n);
}
function mx(e) {
    return g.useMemo(() => e.hooks.dragSource(), [e]);
}
function vx(e) {
    return g.useMemo(() => e.hooks.dragPreview(), [e]);
}
let ea = !1,
    ta = !1;
class yx {
    receiveHandlerId(t) {
        this.sourceId = t;
    }
    getHandlerId() {
        return this.sourceId;
    }
    canDrag() {
        B(
            !ea,
            'You may not call monitor.canDrag() inside your canDrag() implementation. Read more: http://react-dnd.github.io/react-dnd/docs/api/drag-source-monitor',
        );
        try {
            return (ea = !0), this.internalMonitor.canDragSource(this.sourceId);
        } finally {
            ea = !1;
        }
    }
    isDragging() {
        if (!this.sourceId) return !1;
        B(
            !ta,
            'You may not call monitor.isDragging() inside your isDragging() implementation. Read more: http://react-dnd.github.io/react-dnd/docs/api/drag-source-monitor',
        );
        try {
            return (ta = !0), this.internalMonitor.isDraggingSource(this.sourceId);
        } finally {
            ta = !1;
        }
    }
    subscribeToStateChange(t, n) {
        return this.internalMonitor.subscribeToStateChange(t, n);
    }
    isDraggingSource(t) {
        return this.internalMonitor.isDraggingSource(t);
    }
    isOverTarget(t, n) {
        return this.internalMonitor.isOverTarget(t, n);
    }
    getTargetIds() {
        return this.internalMonitor.getTargetIds();
    }
    isSourcePublic() {
        return this.internalMonitor.isSourcePublic();
    }
    getSourceId() {
        return this.internalMonitor.getSourceId();
    }
    subscribeToOffsetChange(t) {
        return this.internalMonitor.subscribeToOffsetChange(t);
    }
    canDragSource(t) {
        return this.internalMonitor.canDragSource(t);
    }
    canDropOnTarget(t) {
        return this.internalMonitor.canDropOnTarget(t);
    }
    getItemType() {
        return this.internalMonitor.getItemType();
    }
    getItem() {
        return this.internalMonitor.getItem();
    }
    getDropResult() {
        return this.internalMonitor.getDropResult();
    }
    didDrop() {
        return this.internalMonitor.didDrop();
    }
    getInitialClientOffset() {
        return this.internalMonitor.getInitialClientOffset();
    }
    getInitialSourceClientOffset() {
        return this.internalMonitor.getInitialSourceClientOffset();
    }
    getSourceClientOffset() {
        return this.internalMonitor.getSourceClientOffset();
    }
    getClientOffset() {
        return this.internalMonitor.getClientOffset();
    }
    getDifferenceFromInitialOffset() {
        return this.internalMonitor.getDifferenceFromInitialOffset();
    }
    constructor(t) {
        (this.sourceId = null), (this.internalMonitor = t.getMonitor());
    }
}
let na = !1;
class wx {
    receiveHandlerId(t) {
        this.targetId = t;
    }
    getHandlerId() {
        return this.targetId;
    }
    subscribeToStateChange(t, n) {
        return this.internalMonitor.subscribeToStateChange(t, n);
    }
    canDrop() {
        if (!this.targetId) return !1;
        B(
            !na,
            'You may not call monitor.canDrop() inside your canDrop() implementation. Read more: http://react-dnd.github.io/react-dnd/docs/api/drop-target-monitor',
        );
        try {
            return (na = !0), this.internalMonitor.canDropOnTarget(this.targetId);
        } finally {
            na = !1;
        }
    }
    isOver(t) {
        return this.targetId ? this.internalMonitor.isOverTarget(this.targetId, t) : !1;
    }
    getItemType() {
        return this.internalMonitor.getItemType();
    }
    getItem() {
        return this.internalMonitor.getItem();
    }
    getDropResult() {
        return this.internalMonitor.getDropResult();
    }
    didDrop() {
        return this.internalMonitor.didDrop();
    }
    getInitialClientOffset() {
        return this.internalMonitor.getInitialClientOffset();
    }
    getInitialSourceClientOffset() {
        return this.internalMonitor.getInitialSourceClientOffset();
    }
    getSourceClientOffset() {
        return this.internalMonitor.getSourceClientOffset();
    }
    getClientOffset() {
        return this.internalMonitor.getClientOffset();
    }
    getDifferenceFromInitialOffset() {
        return this.internalMonitor.getDifferenceFromInitialOffset();
    }
    constructor(t) {
        (this.targetId = null), (this.internalMonitor = t.getMonitor());
    }
}
function Sx(e, t, n) {
    const r = n.getRegistry(),
        o = r.addTarget(e, t);
    return [o, () => r.removeTarget(o)];
}
function Ex(e, t, n) {
    const r = n.getRegistry(),
        o = r.addSource(e, t);
    return [o, () => r.removeSource(o)];
}
function yc(e, t, n, r) {
    let o;
    if (o !== void 0) return !!o;
    if (e === t) return !0;
    if (typeof e != 'object' || !e || typeof t != 'object' || !t) return !1;
    const i = Object.keys(e),
        s = Object.keys(t);
    if (i.length !== s.length) return !1;
    const l = Object.prototype.hasOwnProperty.bind(t);
    for (let a = 0; a < i.length; a++) {
        const c = i[a];
        if (!l(c)) return !1;
        const u = e[c],
            f = t[c];
        if (((o = void 0), o === !1 || (o === void 0 && u !== f))) return !1;
    }
    return !0;
}
function wc(e) {
    return e !== null && typeof e == 'object' && Object.prototype.hasOwnProperty.call(e, 'current');
}
function xx(e) {
    if (typeof e.type == 'string') return;
    const t = e.type.displayName || e.type.name || 'the component';
    throw new Error(
        `Only native element nodes can now be passed to React DnD connectors.You can either wrap ${t} into a <div>, or turn it into a drag source or a drop target itself.`,
    );
}
function Cx(e) {
    return (t = null, n = null) => {
        if (!g.isValidElement(t)) {
            const i = t;
            return e(i, n), i;
        }
        const r = t;
        return xx(r), bx(r, n ? (i) => e(i, n) : e);
    };
}
function am(e) {
    const t = {};
    return (
        Object.keys(e).forEach((n) => {
            const r = e[n];
            if (n.endsWith('Ref')) t[n] = e[n];
            else {
                const o = Cx(r);
                t[n] = () => o;
            }
        }),
        t
    );
}
function Vd(e, t) {
    typeof e == 'function' ? e(t) : (e.current = t);
}
function bx(e, t) {
    const n = e.ref;
    return (
        B(
            typeof n != 'string',
            'Cannot connect React DnD to an element with an existing string ref. Please convert it to use a callback ref instead, or wrap it into a <span> or <div>. Read more: https://reactjs.org/docs/refs-and-the-dom.html#callback-refs',
        ),
        n
            ? g.cloneElement(e, {
                  ref: (r) => {
                      Vd(n, r), Vd(t, r);
                  },
              })
            : g.cloneElement(e, { ref: t })
    );
}
class Tx {
    receiveHandlerId(t) {
        this.handlerId !== t && ((this.handlerId = t), this.reconnect());
    }
    get connectTarget() {
        return this.dragSource;
    }
    get dragSourceOptions() {
        return this.dragSourceOptionsInternal;
    }
    set dragSourceOptions(t) {
        this.dragSourceOptionsInternal = t;
    }
    get dragPreviewOptions() {
        return this.dragPreviewOptionsInternal;
    }
    set dragPreviewOptions(t) {
        this.dragPreviewOptionsInternal = t;
    }
    reconnect() {
        const t = this.reconnectDragSource();
        this.reconnectDragPreview(t);
    }
    reconnectDragSource() {
        const t = this.dragSource,
            n = this.didHandlerIdChange() || this.didConnectedDragSourceChange() || this.didDragSourceOptionsChange();
        return (
            n && this.disconnectDragSource(),
            this.handlerId
                ? t
                    ? (n &&
                          ((this.lastConnectedHandlerId = this.handlerId),
                          (this.lastConnectedDragSource = t),
                          (this.lastConnectedDragSourceOptions = this.dragSourceOptions),
                          (this.dragSourceUnsubscribe = this.backend.connectDragSource(
                              this.handlerId,
                              t,
                              this.dragSourceOptions,
                          ))),
                      n)
                    : ((this.lastConnectedDragSource = t), n)
                : n
        );
    }
    reconnectDragPreview(t = !1) {
        const n = this.dragPreview,
            r = t || this.didHandlerIdChange() || this.didConnectedDragPreviewChange() || this.didDragPreviewOptionsChange();
        if ((r && this.disconnectDragPreview(), !!this.handlerId)) {
            if (!n) {
                this.lastConnectedDragPreview = n;
                return;
            }
            r &&
                ((this.lastConnectedHandlerId = this.handlerId),
                (this.lastConnectedDragPreview = n),
                (this.lastConnectedDragPreviewOptions = this.dragPreviewOptions),
                (this.dragPreviewUnsubscribe = this.backend.connectDragPreview(this.handlerId, n, this.dragPreviewOptions)));
        }
    }
    didHandlerIdChange() {
        return this.lastConnectedHandlerId !== this.handlerId;
    }
    didConnectedDragSourceChange() {
        return this.lastConnectedDragSource !== this.dragSource;
    }
    didConnectedDragPreviewChange() {
        return this.lastConnectedDragPreview !== this.dragPreview;
    }
    didDragSourceOptionsChange() {
        return !yc(this.lastConnectedDragSourceOptions, this.dragSourceOptions);
    }
    didDragPreviewOptionsChange() {
        return !yc(this.lastConnectedDragPreviewOptions, this.dragPreviewOptions);
    }
    disconnectDragSource() {
        this.dragSourceUnsubscribe && (this.dragSourceUnsubscribe(), (this.dragSourceUnsubscribe = void 0));
    }
    disconnectDragPreview() {
        this.dragPreviewUnsubscribe &&
            (this.dragPreviewUnsubscribe(),
            (this.dragPreviewUnsubscribe = void 0),
            (this.dragPreviewNode = null),
            (this.dragPreviewRef = null));
    }
    get dragSource() {
        return this.dragSourceNode || (this.dragSourceRef && this.dragSourceRef.current);
    }
    get dragPreview() {
        return this.dragPreviewNode || (this.dragPreviewRef && this.dragPreviewRef.current);
    }
    clearDragSource() {
        (this.dragSourceNode = null), (this.dragSourceRef = null);
    }
    clearDragPreview() {
        (this.dragPreviewNode = null), (this.dragPreviewRef = null);
    }
    constructor(t) {
        (this.hooks = am({
            dragSource: (n, r) => {
                this.clearDragSource(),
                    (this.dragSourceOptions = r || null),
                    wc(n) ? (this.dragSourceRef = n) : (this.dragSourceNode = n),
                    this.reconnectDragSource();
            },
            dragPreview: (n, r) => {
                this.clearDragPreview(),
                    (this.dragPreviewOptions = r || null),
                    wc(n) ? (this.dragPreviewRef = n) : (this.dragPreviewNode = n),
                    this.reconnectDragPreview();
            },
        })),
            (this.handlerId = null),
            (this.dragSourceRef = null),
            (this.dragSourceOptionsInternal = null),
            (this.dragPreviewRef = null),
            (this.dragPreviewOptionsInternal = null),
            (this.lastConnectedHandlerId = null),
            (this.lastConnectedDragSource = null),
            (this.lastConnectedDragSourceOptions = null),
            (this.lastConnectedDragPreview = null),
            (this.lastConnectedDragPreviewOptions = null),
            (this.backend = t);
    }
}
class kx {
    get connectTarget() {
        return this.dropTarget;
    }
    reconnect() {
        const t = this.didHandlerIdChange() || this.didDropTargetChange() || this.didOptionsChange();
        t && this.disconnectDropTarget();
        const n = this.dropTarget;
        if (this.handlerId) {
            if (!n) {
                this.lastConnectedDropTarget = n;
                return;
            }
            t &&
                ((this.lastConnectedHandlerId = this.handlerId),
                (this.lastConnectedDropTarget = n),
                (this.lastConnectedDropTargetOptions = this.dropTargetOptions),
                (this.unsubscribeDropTarget = this.backend.connectDropTarget(this.handlerId, n, this.dropTargetOptions)));
        }
    }
    receiveHandlerId(t) {
        t !== this.handlerId && ((this.handlerId = t), this.reconnect());
    }
    get dropTargetOptions() {
        return this.dropTargetOptionsInternal;
    }
    set dropTargetOptions(t) {
        this.dropTargetOptionsInternal = t;
    }
    didHandlerIdChange() {
        return this.lastConnectedHandlerId !== this.handlerId;
    }
    didDropTargetChange() {
        return this.lastConnectedDropTarget !== this.dropTarget;
    }
    didOptionsChange() {
        return !yc(this.lastConnectedDropTargetOptions, this.dropTargetOptions);
    }
    disconnectDropTarget() {
        this.unsubscribeDropTarget && (this.unsubscribeDropTarget(), (this.unsubscribeDropTarget = void 0));
    }
    get dropTarget() {
        return this.dropTargetNode || (this.dropTargetRef && this.dropTargetRef.current);
    }
    clearDropTarget() {
        (this.dropTargetRef = null), (this.dropTargetNode = null);
    }
    constructor(t) {
        (this.hooks = am({
            dropTarget: (n, r) => {
                this.clearDropTarget(),
                    (this.dropTargetOptions = r),
                    wc(n) ? (this.dropTargetRef = n) : (this.dropTargetNode = n),
                    this.reconnect();
            },
        })),
            (this.handlerId = null),
            (this.dropTargetRef = null),
            (this.dropTargetOptionsInternal = null),
            (this.lastConnectedHandlerId = null),
            (this.lastConnectedDropTarget = null),
            (this.lastConnectedDropTargetOptions = null),
            (this.backend = t);
    }
}
function zr() {
    const { dragDropManager: e } = g.useContext(Jg);
    return B(e != null, 'Expected drag drop context'), e;
}
function Rx(e, t) {
    const n = zr(),
        r = g.useMemo(() => new Tx(n.getBackend()), [n]);
    return (
        Gn(() => ((r.dragSourceOptions = e || null), r.reconnect(), () => r.disconnectDragSource()), [r, e]),
        Gn(() => ((r.dragPreviewOptions = t || null), r.reconnect(), () => r.disconnectDragPreview()), [r, t]),
        r
    );
}
function _x() {
    const e = zr();
    return g.useMemo(() => new yx(e), [e]);
}
class Ox {
    beginDrag() {
        const t = this.spec,
            n = this.monitor;
        let r = null;
        return typeof t.item == 'object' ? (r = t.item) : typeof t.item == 'function' ? (r = t.item(n)) : (r = {}), r ?? null;
    }
    canDrag() {
        const t = this.spec,
            n = this.monitor;
        return typeof t.canDrag == 'boolean' ? t.canDrag : typeof t.canDrag == 'function' ? t.canDrag(n) : !0;
    }
    isDragging(t, n) {
        const r = this.spec,
            o = this.monitor,
            { isDragging: i } = r;
        return i ? i(o) : n === t.getSourceId();
    }
    endDrag() {
        const t = this.spec,
            n = this.monitor,
            r = this.connector,
            { end: o } = t;
        o && o(n.getItem(), n), r.reconnect();
    }
    constructor(t, n, r) {
        (this.spec = t), (this.monitor = n), (this.connector = r);
    }
}
function Px(e, t, n) {
    const r = g.useMemo(() => new Ox(e, t, n), [t, n]);
    return (
        g.useEffect(() => {
            r.spec = e;
        }, [e]),
        r
    );
}
function Nx(e) {
    return g.useMemo(() => {
        const t = e.type;
        return B(t != null, 'spec.type must be defined'), t;
    }, [e]);
}
function Dx(e, t, n) {
    const r = zr(),
        o = Px(e, t, n),
        i = Nx(e);
    Gn(
        function () {
            if (i != null) {
                const [l, a] = Ex(i, o, r);
                return t.receiveHandlerId(l), n.receiveHandlerId(l), a;
            }
        },
        [r, t, n, o, i],
    );
}
function Ax(e, t) {
    const n = lm(e);
    B(
        !n.begin,
        'useDrag::spec.begin was deprecated in v14. Replace spec.begin() with spec.item(). (see more here - https://react-dnd.github.io/react-dnd/docs/api/use-drag)',
    );
    const r = _x(),
        o = Rx(n.options, n.previewOptions);
    return Dx(n, r, o), [sm(n.collect, r, o), mx(o), vx(o)];
}
function Ix(e) {
    return g.useMemo(() => e.hooks.dropTarget(), [e]);
}
function Mx(e) {
    const t = zr(),
        n = g.useMemo(() => new kx(t.getBackend()), [t]);
    return Gn(() => ((n.dropTargetOptions = e || null), n.reconnect(), () => n.disconnectDropTarget()), [e]), n;
}
function Lx() {
    const e = zr();
    return g.useMemo(() => new wx(e), [e]);
}
function Fx(e) {
    const { accept: t } = e;
    return g.useMemo(() => (B(e.accept != null, 'accept must be defined'), Array.isArray(t) ? t : [t]), [t]);
}
class jx {
    canDrop() {
        const t = this.spec,
            n = this.monitor;
        return t.canDrop ? t.canDrop(n.getItem(), n) : !0;
    }
    hover() {
        const t = this.spec,
            n = this.monitor;
        t.hover && t.hover(n.getItem(), n);
    }
    drop() {
        const t = this.spec,
            n = this.monitor;
        if (t.drop) return t.drop(n.getItem(), n);
    }
    constructor(t, n) {
        (this.spec = t), (this.monitor = n);
    }
}
function zx(e, t) {
    const n = g.useMemo(() => new jx(e, t), [t]);
    return (
        g.useEffect(() => {
            n.spec = e;
        }, [e]),
        n
    );
}
function Ux(e, t, n) {
    const r = zr(),
        o = zx(e, t),
        i = Fx(e);
    Gn(
        function () {
            const [l, a] = Sx(i, o, r);
            return t.receiveHandlerId(l), n.receiveHandlerId(l), a;
        },
        [r, t, o, n, i.map((s) => s.toString()).join('|')],
    );
}
function Bx(e, t) {
    const n = lm(e),
        r = Lx(),
        o = Mx(n.options);
    return Ux(n, r, o), [sm(n.collect, r, o), Ix(o)];
}
function cm(e) {
    let t = null;
    return () => (t == null && (t = e()), t);
}
function $x(e, t) {
    return e.filter((n) => n !== t);
}
function Hx(e, t) {
    const n = new Set(),
        r = (i) => n.add(i);
    e.forEach(r), t.forEach(r);
    const o = [];
    return n.forEach((i) => o.push(i)), o;
}
class Wx {
    enter(t) {
        const n = this.entered.length,
            r = (o) => this.isNodeInDocument(o) && (!o.contains || o.contains(t));
        return (this.entered = Hx(this.entered.filter(r), [t])), n === 0 && this.entered.length > 0;
    }
    leave(t) {
        const n = this.entered.length;
        return (this.entered = $x(this.entered.filter(this.isNodeInDocument), t)), n > 0 && this.entered.length === 0;
    }
    reset() {
        this.entered = [];
    }
    constructor(t) {
        (this.entered = []), (this.isNodeInDocument = t);
    }
}
class Vx {
    initializeExposedProperties() {
        Object.keys(this.config.exposeProperties).forEach((t) => {
            Object.defineProperty(this.item, t, {
                configurable: !0,
                enumerable: !0,
                get() {
                    return console.warn(`Browser doesn't allow reading "${t}" until the drop event.`), null;
                },
            });
        });
    }
    loadDataTransfer(t) {
        if (t) {
            const n = {};
            Object.keys(this.config.exposeProperties).forEach((r) => {
                const o = this.config.exposeProperties[r];
                o != null && (n[r] = { value: o(t, this.config.matchesTypes), configurable: !0, enumerable: !0 });
            }),
                Object.defineProperties(this.item, n);
        }
    }
    canDrag() {
        return !0;
    }
    beginDrag() {
        return this.item;
    }
    isDragging(t, n) {
        return n === t.getSourceId();
    }
    endDrag() {}
    constructor(t) {
        (this.config = t), (this.item = {}), this.initializeExposedProperties();
    }
}
const um = '__NATIVE_FILE__',
    fm = '__NATIVE_URL__',
    dm = '__NATIVE_TEXT__',
    hm = '__NATIVE_HTML__',
    qd = Object.freeze(
        Object.defineProperty({ __proto__: null, FILE: um, HTML: hm, TEXT: dm, URL: fm }, Symbol.toStringTag, {
            value: 'Module',
        }),
    );
function ra(e, t, n) {
    const r = t.reduce((o, i) => o || e.getData(i), '');
    return r ?? n;
}
const Sc = {
    [um]: {
        exposeProperties: { files: (e) => Array.prototype.slice.call(e.files), items: (e) => e.items, dataTransfer: (e) => e },
        matchesTypes: ['Files'],
    },
    [hm]: { exposeProperties: { html: (e, t) => ra(e, t, ''), dataTransfer: (e) => e }, matchesTypes: ['Html', 'text/html'] },
    [fm]: {
        exposeProperties: {
            urls: (e, t) =>
                ra(e, t, '').split(`
`),
            dataTransfer: (e) => e,
        },
        matchesTypes: ['Url', 'text/uri-list'],
    },
    [dm]: { exposeProperties: { text: (e, t) => ra(e, t, ''), dataTransfer: (e) => e }, matchesTypes: ['Text', 'text/plain'] },
};
function qx(e, t) {
    const n = Sc[e];
    if (!n) throw new Error(`native type ${e} has no configuration`);
    const r = new Vx(n);
    return r.loadDataTransfer(t), r;
}
function oa(e) {
    if (!e) return null;
    const t = Array.prototype.slice.call(e.types || []);
    return (
        Object.keys(Sc).filter((n) => {
            const r = Sc[n];
            return r != null && r.matchesTypes ? r.matchesTypes.some((o) => t.indexOf(o) > -1) : !1;
        })[0] || null
    );
}
const Gx = cm(() => /firefox/i.test(navigator.userAgent)),
    pm = cm(() => !!window.safari);
class Gd {
    interpolate(t) {
        const { xs: n, ys: r, c1s: o, c2s: i, c3s: s } = this;
        let l = n.length - 1;
        if (t === n[l]) return r[l];
        let a = 0,
            c = s.length - 1,
            u;
        for (; a <= c; ) {
            u = Math.floor(0.5 * (a + c));
            const y = n[u];
            if (y < t) a = u + 1;
            else if (y > t) c = u - 1;
            else return r[u];
        }
        l = Math.max(0, c);
        const f = t - n[l],
            d = f * f;
        return r[l] + o[l] * f + i[l] * d + s[l] * f * d;
    }
    constructor(t, n) {
        const { length: r } = t,
            o = [];
        for (let y = 0; y < r; y++) o.push(y);
        o.sort((y, m) => (t[y] < t[m] ? -1 : 1));
        const i = [],
            s = [];
        let l, a;
        for (let y = 0; y < r - 1; y++) (l = t[y + 1] - t[y]), (a = n[y + 1] - n[y]), i.push(l), s.push(a / l);
        const c = [s[0]];
        for (let y = 0; y < i.length - 1; y++) {
            const m = s[y],
                v = s[y + 1];
            if (m * v <= 0) c.push(0);
            else {
                l = i[y];
                const S = i[y + 1],
                    h = l + S;
                c.push((3 * h) / ((h + S) / m + (h + l) / v));
            }
        }
        c.push(s[s.length - 1]);
        const u = [],
            f = [];
        let d;
        for (let y = 0; y < c.length - 1; y++) {
            d = s[y];
            const m = c[y],
                v = 1 / i[y],
                S = m + c[y + 1] - d - d;
            u.push((d - m - S) * v), f.push(S * v * v);
        }
        (this.xs = t), (this.ys = n), (this.c1s = c), (this.c2s = u), (this.c3s = f);
    }
}
const Kx = 1;
function gm(e) {
    const t = e.nodeType === Kx ? e : e.parentElement;
    if (!t) return null;
    const { top: n, left: r } = t.getBoundingClientRect();
    return { x: r, y: n };
}
function Ri(e) {
    return { x: e.clientX, y: e.clientY };
}
function Yx(e) {
    var t;
    return e.nodeName === 'IMG' && (Gx() || !(!((t = document.documentElement) === null || t === void 0) && t.contains(e)));
}
function Xx(e, t, n, r) {
    let o = e ? t.width : n,
        i = e ? t.height : r;
    return (
        pm() && e && ((i /= window.devicePixelRatio), (o /= window.devicePixelRatio)),
        { dragPreviewWidth: o, dragPreviewHeight: i }
    );
}
function Qx(e, t, n, r, o) {
    const i = Yx(t),
        l = gm(i ? e : t),
        a = { x: n.x - l.x, y: n.y - l.y },
        { offsetWidth: c, offsetHeight: u } = e,
        { anchorX: f, anchorY: d } = r,
        { dragPreviewWidth: y, dragPreviewHeight: m } = Xx(i, t, c, u),
        v = () => {
            let _ = new Gd([0, 0.5, 1], [a.y, (a.y / u) * m, a.y + m - u]).interpolate(d);
            return pm() && i && (_ += (window.devicePixelRatio - 1) * m), _;
        },
        S = () => new Gd([0, 0.5, 1], [a.x, (a.x / c) * y, a.x + y - c]).interpolate(f),
        { offsetX: h, offsetY: p } = o,
        w = h === 0 || h,
        C = p === 0 || p;
    return { x: w ? h : S(), y: C ? p : v() };
}
class Jx {
    get window() {
        if (this.globalContext) return this.globalContext;
        if (typeof window < 'u') return window;
    }
    get document() {
        var t;
        return !((t = this.globalContext) === null || t === void 0) && t.document
            ? this.globalContext.document
            : this.window
              ? this.window.document
              : void 0;
    }
    get rootElement() {
        var t;
        return ((t = this.optionsArgs) === null || t === void 0 ? void 0 : t.rootElement) || this.window;
    }
    constructor(t, n) {
        (this.ownerDocument = null), (this.globalContext = t), (this.optionsArgs = n);
    }
}
function Zx(e, t, n) {
    return t in e ? Object.defineProperty(e, t, { value: n, enumerable: !0, configurable: !0, writable: !0 }) : (e[t] = n), e;
}
function Kd(e) {
    for (var t = 1; t < arguments.length; t++) {
        var n = arguments[t] != null ? arguments[t] : {},
            r = Object.keys(n);
        typeof Object.getOwnPropertySymbols == 'function' &&
            (r = r.concat(
                Object.getOwnPropertySymbols(n).filter(function (o) {
                    return Object.getOwnPropertyDescriptor(n, o).enumerable;
                }),
            )),
            r.forEach(function (o) {
                Zx(e, o, n[o]);
            });
    }
    return e;
}
class eC {
    profile() {
        var t, n;
        return {
            sourcePreviewNodes: this.sourcePreviewNodes.size,
            sourcePreviewNodeOptions: this.sourcePreviewNodeOptions.size,
            sourceNodeOptions: this.sourceNodeOptions.size,
            sourceNodes: this.sourceNodes.size,
            dragStartSourceIds: ((t = this.dragStartSourceIds) === null || t === void 0 ? void 0 : t.length) || 0,
            dropTargetIds: this.dropTargetIds.length,
            dragEnterTargetIds: this.dragEnterTargetIds.length,
            dragOverTargetIds: ((n = this.dragOverTargetIds) === null || n === void 0 ? void 0 : n.length) || 0,
        };
    }
    get window() {
        return this.options.window;
    }
    get document() {
        return this.options.document;
    }
    get rootElement() {
        return this.options.rootElement;
    }
    setup() {
        const t = this.rootElement;
        if (t !== void 0) {
            if (t.__isReactDndBackendSetUp) throw new Error('Cannot have two HTML5 backends at the same time.');
            (t.__isReactDndBackendSetUp = !0), this.addEventListeners(t);
        }
    }
    teardown() {
        const t = this.rootElement;
        if (
            t !== void 0 &&
            ((t.__isReactDndBackendSetUp = !1),
            this.removeEventListeners(this.rootElement),
            this.clearCurrentDragSourceNode(),
            this.asyncEndDragFrameId)
        ) {
            var n;
            (n = this.window) === null || n === void 0 || n.cancelAnimationFrame(this.asyncEndDragFrameId);
        }
    }
    connectDragPreview(t, n, r) {
        return (
            this.sourcePreviewNodeOptions.set(t, r),
            this.sourcePreviewNodes.set(t, n),
            () => {
                this.sourcePreviewNodes.delete(t), this.sourcePreviewNodeOptions.delete(t);
            }
        );
    }
    connectDragSource(t, n, r) {
        this.sourceNodes.set(t, n), this.sourceNodeOptions.set(t, r);
        const o = (s) => this.handleDragStart(s, t),
            i = (s) => this.handleSelectStart(s);
        return (
            n.setAttribute('draggable', 'true'),
            n.addEventListener('dragstart', o),
            n.addEventListener('selectstart', i),
            () => {
                this.sourceNodes.delete(t),
                    this.sourceNodeOptions.delete(t),
                    n.removeEventListener('dragstart', o),
                    n.removeEventListener('selectstart', i),
                    n.setAttribute('draggable', 'false');
            }
        );
    }
    connectDropTarget(t, n) {
        const r = (s) => this.handleDragEnter(s, t),
            o = (s) => this.handleDragOver(s, t),
            i = (s) => this.handleDrop(s, t);
        return (
            n.addEventListener('dragenter', r),
            n.addEventListener('dragover', o),
            n.addEventListener('drop', i),
            () => {
                n.removeEventListener('dragenter', r), n.removeEventListener('dragover', o), n.removeEventListener('drop', i);
            }
        );
    }
    addEventListeners(t) {
        t.addEventListener &&
            (t.addEventListener('dragstart', this.handleTopDragStart),
            t.addEventListener('dragstart', this.handleTopDragStartCapture, !0),
            t.addEventListener('dragend', this.handleTopDragEndCapture, !0),
            t.addEventListener('dragenter', this.handleTopDragEnter),
            t.addEventListener('dragenter', this.handleTopDragEnterCapture, !0),
            t.addEventListener('dragleave', this.handleTopDragLeaveCapture, !0),
            t.addEventListener('dragover', this.handleTopDragOver),
            t.addEventListener('dragover', this.handleTopDragOverCapture, !0),
            t.addEventListener('drop', this.handleTopDrop),
            t.addEventListener('drop', this.handleTopDropCapture, !0));
    }
    removeEventListeners(t) {
        t.removeEventListener &&
            (t.removeEventListener('dragstart', this.handleTopDragStart),
            t.removeEventListener('dragstart', this.handleTopDragStartCapture, !0),
            t.removeEventListener('dragend', this.handleTopDragEndCapture, !0),
            t.removeEventListener('dragenter', this.handleTopDragEnter),
            t.removeEventListener('dragenter', this.handleTopDragEnterCapture, !0),
            t.removeEventListener('dragleave', this.handleTopDragLeaveCapture, !0),
            t.removeEventListener('dragover', this.handleTopDragOver),
            t.removeEventListener('dragover', this.handleTopDragOverCapture, !0),
            t.removeEventListener('drop', this.handleTopDrop),
            t.removeEventListener('drop', this.handleTopDropCapture, !0));
    }
    getCurrentSourceNodeOptions() {
        const t = this.monitor.getSourceId(),
            n = this.sourceNodeOptions.get(t);
        return Kd({ dropEffect: this.altKeyPressed ? 'copy' : 'move' }, n || {});
    }
    getCurrentDropEffect() {
        return this.isDraggingNativeItem() ? 'copy' : this.getCurrentSourceNodeOptions().dropEffect;
    }
    getCurrentSourcePreviewNodeOptions() {
        const t = this.monitor.getSourceId(),
            n = this.sourcePreviewNodeOptions.get(t);
        return Kd({ anchorX: 0.5, anchorY: 0.5, captureDraggingState: !1 }, n || {});
    }
    isDraggingNativeItem() {
        const t = this.monitor.getItemType();
        return Object.keys(qd).some((n) => qd[n] === t);
    }
    beginDragNativeItem(t, n) {
        this.clearCurrentDragSourceNode(),
            (this.currentNativeSource = qx(t, n)),
            (this.currentNativeHandle = this.registry.addSource(t, this.currentNativeSource)),
            this.actions.beginDrag([this.currentNativeHandle]);
    }
    setCurrentDragSourceNode(t) {
        this.clearCurrentDragSourceNode(), (this.currentDragSourceNode = t);
        const n = 1e3;
        this.mouseMoveTimeoutTimer = setTimeout(() => {
            var r;
            return (r = this.rootElement) === null || r === void 0
                ? void 0
                : r.addEventListener('mousemove', this.endDragIfSourceWasRemovedFromDOM, !0);
        }, n);
    }
    clearCurrentDragSourceNode() {
        if (this.currentDragSourceNode) {
            if (((this.currentDragSourceNode = null), this.rootElement)) {
                var t;
                (t = this.window) === null || t === void 0 || t.clearTimeout(this.mouseMoveTimeoutTimer || void 0),
                    this.rootElement.removeEventListener('mousemove', this.endDragIfSourceWasRemovedFromDOM, !0);
            }
            return (this.mouseMoveTimeoutTimer = null), !0;
        }
        return !1;
    }
    handleDragStart(t, n) {
        t.defaultPrevented || (this.dragStartSourceIds || (this.dragStartSourceIds = []), this.dragStartSourceIds.unshift(n));
    }
    handleDragEnter(t, n) {
        this.dragEnterTargetIds.unshift(n);
    }
    handleDragOver(t, n) {
        this.dragOverTargetIds === null && (this.dragOverTargetIds = []), this.dragOverTargetIds.unshift(n);
    }
    handleDrop(t, n) {
        this.dropTargetIds.unshift(n);
    }
    constructor(t, n, r) {
        (this.sourcePreviewNodes = new Map()),
            (this.sourcePreviewNodeOptions = new Map()),
            (this.sourceNodes = new Map()),
            (this.sourceNodeOptions = new Map()),
            (this.dragStartSourceIds = null),
            (this.dropTargetIds = []),
            (this.dragEnterTargetIds = []),
            (this.currentNativeSource = null),
            (this.currentNativeHandle = null),
            (this.currentDragSourceNode = null),
            (this.altKeyPressed = !1),
            (this.mouseMoveTimeoutTimer = null),
            (this.asyncEndDragFrameId = null),
            (this.dragOverTargetIds = null),
            (this.lastClientOffset = null),
            (this.hoverRafId = null),
            (this.getSourceClientOffset = (o) => {
                const i = this.sourceNodes.get(o);
                return (i && gm(i)) || null;
            }),
            (this.endDragNativeItem = () => {
                this.isDraggingNativeItem() &&
                    (this.actions.endDrag(),
                    this.currentNativeHandle && this.registry.removeSource(this.currentNativeHandle),
                    (this.currentNativeHandle = null),
                    (this.currentNativeSource = null));
            }),
            (this.isNodeInDocument = (o) => !!(o && this.document && this.document.body && this.document.body.contains(o))),
            (this.endDragIfSourceWasRemovedFromDOM = () => {
                const o = this.currentDragSourceNode;
                o == null ||
                    this.isNodeInDocument(o) ||
                    (this.clearCurrentDragSourceNode() && this.monitor.isDragging() && this.actions.endDrag(),
                    this.cancelHover());
            }),
            (this.scheduleHover = (o) => {
                this.hoverRafId === null &&
                    typeof requestAnimationFrame < 'u' &&
                    (this.hoverRafId = requestAnimationFrame(() => {
                        this.monitor.isDragging() && this.actions.hover(o || [], { clientOffset: this.lastClientOffset }),
                            (this.hoverRafId = null);
                    }));
            }),
            (this.cancelHover = () => {
                this.hoverRafId !== null &&
                    typeof cancelAnimationFrame < 'u' &&
                    (cancelAnimationFrame(this.hoverRafId), (this.hoverRafId = null));
            }),
            (this.handleTopDragStartCapture = () => {
                this.clearCurrentDragSourceNode(), (this.dragStartSourceIds = []);
            }),
            (this.handleTopDragStart = (o) => {
                if (o.defaultPrevented) return;
                const { dragStartSourceIds: i } = this;
                this.dragStartSourceIds = null;
                const s = Ri(o);
                this.monitor.isDragging() && (this.actions.endDrag(), this.cancelHover()),
                    this.actions.beginDrag(i || [], {
                        publishSource: !1,
                        getSourceClientOffset: this.getSourceClientOffset,
                        clientOffset: s,
                    });
                const { dataTransfer: l } = o,
                    a = oa(l);
                if (this.monitor.isDragging()) {
                    if (l && typeof l.setDragImage == 'function') {
                        const u = this.monitor.getSourceId(),
                            f = this.sourceNodes.get(u),
                            d = this.sourcePreviewNodes.get(u) || f;
                        if (d) {
                            const {
                                    anchorX: y,
                                    anchorY: m,
                                    offsetX: v,
                                    offsetY: S,
                                } = this.getCurrentSourcePreviewNodeOptions(),
                                w = Qx(f, d, s, { anchorX: y, anchorY: m }, { offsetX: v, offsetY: S });
                            l.setDragImage(d, w.x, w.y);
                        }
                    }
                    try {
                        l == null || l.setData('application/json', {});
                    } catch {}
                    this.setCurrentDragSourceNode(o.target);
                    const { captureDraggingState: c } = this.getCurrentSourcePreviewNodeOptions();
                    c ? this.actions.publishDragSource() : setTimeout(() => this.actions.publishDragSource(), 0);
                } else if (a) this.beginDragNativeItem(a);
                else {
                    if (l && !l.types && ((o.target && !o.target.hasAttribute) || !o.target.hasAttribute('draggable'))) return;
                    o.preventDefault();
                }
            }),
            (this.handleTopDragEndCapture = () => {
                this.clearCurrentDragSourceNode() && this.monitor.isDragging() && this.actions.endDrag(), this.cancelHover();
            }),
            (this.handleTopDragEnterCapture = (o) => {
                if (((this.dragEnterTargetIds = []), this.isDraggingNativeItem())) {
                    var i;
                    (i = this.currentNativeSource) === null || i === void 0 || i.loadDataTransfer(o.dataTransfer);
                }
                if (!this.enterLeaveCounter.enter(o.target) || this.monitor.isDragging()) return;
                const { dataTransfer: l } = o,
                    a = oa(l);
                a && this.beginDragNativeItem(a, l);
            }),
            (this.handleTopDragEnter = (o) => {
                const { dragEnterTargetIds: i } = this;
                if (((this.dragEnterTargetIds = []), !this.monitor.isDragging())) return;
                (this.altKeyPressed = o.altKey),
                    i.length > 0 && this.actions.hover(i, { clientOffset: Ri(o) }),
                    i.some((l) => this.monitor.canDropOnTarget(l)) &&
                        (o.preventDefault(), o.dataTransfer && (o.dataTransfer.dropEffect = this.getCurrentDropEffect()));
            }),
            (this.handleTopDragOverCapture = (o) => {
                if (((this.dragOverTargetIds = []), this.isDraggingNativeItem())) {
                    var i;
                    (i = this.currentNativeSource) === null || i === void 0 || i.loadDataTransfer(o.dataTransfer);
                }
            }),
            (this.handleTopDragOver = (o) => {
                const { dragOverTargetIds: i } = this;
                if (((this.dragOverTargetIds = []), !this.monitor.isDragging())) {
                    o.preventDefault(), o.dataTransfer && (o.dataTransfer.dropEffect = 'none');
                    return;
                }
                (this.altKeyPressed = o.altKey),
                    (this.lastClientOffset = Ri(o)),
                    this.scheduleHover(i),
                    (i || []).some((l) => this.monitor.canDropOnTarget(l))
                        ? (o.preventDefault(), o.dataTransfer && (o.dataTransfer.dropEffect = this.getCurrentDropEffect()))
                        : this.isDraggingNativeItem()
                          ? o.preventDefault()
                          : (o.preventDefault(), o.dataTransfer && (o.dataTransfer.dropEffect = 'none'));
            }),
            (this.handleTopDragLeaveCapture = (o) => {
                this.isDraggingNativeItem() && o.preventDefault(),
                    this.enterLeaveCounter.leave(o.target) &&
                        (this.isDraggingNativeItem() && setTimeout(() => this.endDragNativeItem(), 0), this.cancelHover());
            }),
            (this.handleTopDropCapture = (o) => {
                if (((this.dropTargetIds = []), this.isDraggingNativeItem())) {
                    var i;
                    o.preventDefault(),
                        (i = this.currentNativeSource) === null || i === void 0 || i.loadDataTransfer(o.dataTransfer);
                } else oa(o.dataTransfer) && o.preventDefault();
                this.enterLeaveCounter.reset();
            }),
            (this.handleTopDrop = (o) => {
                const { dropTargetIds: i } = this;
                (this.dropTargetIds = []),
                    this.actions.hover(i, { clientOffset: Ri(o) }),
                    this.actions.drop({ dropEffect: this.getCurrentDropEffect() }),
                    this.isDraggingNativeItem()
                        ? this.endDragNativeItem()
                        : this.monitor.isDragging() && this.actions.endDrag(),
                    this.cancelHover();
            }),
            (this.handleSelectStart = (o) => {
                const i = o.target;
                typeof i.dragDrop == 'function' &&
                    (i.tagName === 'INPUT' ||
                        i.tagName === 'SELECT' ||
                        i.tagName === 'TEXTAREA' ||
                        i.isContentEditable ||
                        (o.preventDefault(), i.dragDrop()));
            }),
            (this.options = new Jx(n, r)),
            (this.actions = t.getActions()),
            (this.monitor = t.getMonitor()),
            (this.registry = t.getRegistry()),
            (this.enterLeaveCounter = new Wx(this.isNodeInDocument));
    }
}
const tC = function (t, n, r) {
    return new eC(t, n, r);
};
function mm(e, t) {
    return function () {
        return e.apply(t, arguments);
    };
}
const { toString: nC } = Object.prototype,
    { getPrototypeOf: Wu } = Object,
    dl = ((e) => (t) => {
        const n = nC.call(t);
        return e[n] || (e[n] = n.slice(8, -1).toLowerCase());
    })(Object.create(null)),
    Et = (e) => ((e = e.toLowerCase()), (t) => dl(t) === e),
    hl = (e) => (t) => typeof t === e,
    { isArray: Ur } = Array,
    Vo = hl('undefined');
function rC(e) {
    return (
        e !== null &&
        !Vo(e) &&
        e.constructor !== null &&
        !Vo(e.constructor) &&
        qe(e.constructor.isBuffer) &&
        e.constructor.isBuffer(e)
    );
}
const vm = Et('ArrayBuffer');
function oC(e) {
    let t;
    return (
        typeof ArrayBuffer < 'u' && ArrayBuffer.isView ? (t = ArrayBuffer.isView(e)) : (t = e && e.buffer && vm(e.buffer)), t
    );
}
const iC = hl('string'),
    qe = hl('function'),
    ym = hl('number'),
    pl = (e) => e !== null && typeof e == 'object',
    sC = (e) => e === !0 || e === !1,
    Qi = (e) => {
        if (dl(e) !== 'object') return !1;
        const t = Wu(e);
        return (
            (t === null || t === Object.prototype || Object.getPrototypeOf(t) === null) &&
            !(Symbol.toStringTag in e) &&
            !(Symbol.iterator in e)
        );
    },
    lC = Et('Date'),
    aC = Et('File'),
    cC = Et('Blob'),
    uC = Et('FileList'),
    fC = (e) => pl(e) && qe(e.pipe),
    dC = (e) => {
        let t;
        return (
            e &&
            ((typeof FormData == 'function' && e instanceof FormData) ||
                (qe(e.append) &&
                    ((t = dl(e)) === 'formdata' || (t === 'object' && qe(e.toString) && e.toString() === '[object FormData]'))))
        );
    },
    hC = Et('URLSearchParams'),
    [pC, gC, mC, vC] = ['ReadableStream', 'Request', 'Response', 'Headers'].map(Et),
    yC = (e) => (e.trim ? e.trim() : e.replace(/^[\s\uFEFF\xA0]+|[\s\uFEFF\xA0]+$/g, ''));
function ri(e, t, { allOwnKeys: n = !1 } = {}) {
    if (e === null || typeof e > 'u') return;
    let r, o;
    if ((typeof e != 'object' && (e = [e]), Ur(e))) for (r = 0, o = e.length; r < o; r++) t.call(null, e[r], r, e);
    else {
        const i = n ? Object.getOwnPropertyNames(e) : Object.keys(e),
            s = i.length;
        let l;
        for (r = 0; r < s; r++) (l = i[r]), t.call(null, e[l], l, e);
    }
}
function wm(e, t) {
    t = t.toLowerCase();
    const n = Object.keys(e);
    let r = n.length,
        o;
    for (; r-- > 0; ) if (((o = n[r]), t === o.toLowerCase())) return o;
    return null;
}
const Fn = typeof globalThis < 'u' ? globalThis : typeof self < 'u' ? self : typeof window < 'u' ? window : global,
    Sm = (e) => !Vo(e) && e !== Fn;
function Ec() {
    const { caseless: e } = (Sm(this) && this) || {},
        t = {},
        n = (r, o) => {
            const i = (e && wm(t, o)) || o;
            Qi(t[i]) && Qi(r) ? (t[i] = Ec(t[i], r)) : Qi(r) ? (t[i] = Ec({}, r)) : Ur(r) ? (t[i] = r.slice()) : (t[i] = r);
        };
    for (let r = 0, o = arguments.length; r < o; r++) arguments[r] && ri(arguments[r], n);
    return t;
}
const wC = (e, t, n, { allOwnKeys: r } = {}) => (
        ri(
            t,
            (o, i) => {
                n && qe(o) ? (e[i] = mm(o, n)) : (e[i] = o);
            },
            { allOwnKeys: r },
        ),
        e
    ),
    SC = (e) => (e.charCodeAt(0) === 65279 && (e = e.slice(1)), e),
    EC = (e, t, n, r) => {
        (e.prototype = Object.create(t.prototype, r)),
            (e.prototype.constructor = e),
            Object.defineProperty(e, 'super', { value: t.prototype }),
            n && Object.assign(e.prototype, n);
    },
    xC = (e, t, n, r) => {
        let o, i, s;
        const l = {};
        if (((t = t || {}), e == null)) return t;
        do {
            for (o = Object.getOwnPropertyNames(e), i = o.length; i-- > 0; )
                (s = o[i]), (!r || r(s, e, t)) && !l[s] && ((t[s] = e[s]), (l[s] = !0));
            e = n !== !1 && Wu(e);
        } while (e && (!n || n(e, t)) && e !== Object.prototype);
        return t;
    },
    CC = (e, t, n) => {
        (e = String(e)), (n === void 0 || n > e.length) && (n = e.length), (n -= t.length);
        const r = e.indexOf(t, n);
        return r !== -1 && r === n;
    },
    bC = (e) => {
        if (!e) return null;
        if (Ur(e)) return e;
        let t = e.length;
        if (!ym(t)) return null;
        const n = new Array(t);
        for (; t-- > 0; ) n[t] = e[t];
        return n;
    },
    TC = (
        (e) => (t) =>
            e && t instanceof e
    )(typeof Uint8Array < 'u' && Wu(Uint8Array)),
    kC = (e, t) => {
        const r = (e && e[Symbol.iterator]).call(e);
        let o;
        for (; (o = r.next()) && !o.done; ) {
            const i = o.value;
            t.call(e, i[0], i[1]);
        }
    },
    RC = (e, t) => {
        let n;
        const r = [];
        for (; (n = e.exec(t)) !== null; ) r.push(n);
        return r;
    },
    _C = Et('HTMLFormElement'),
    OC = (e) =>
        e.toLowerCase().replace(/[-_\s]([a-z\d])(\w*)/g, function (n, r, o) {
            return r.toUpperCase() + o;
        }),
    Yd = (
        ({ hasOwnProperty: e }) =>
        (t, n) =>
            e.call(t, n)
    )(Object.prototype),
    PC = Et('RegExp'),
    Em = (e, t) => {
        const n = Object.getOwnPropertyDescriptors(e),
            r = {};
        ri(n, (o, i) => {
            let s;
            (s = t(o, i, e)) !== !1 && (r[i] = s || o);
        }),
            Object.defineProperties(e, r);
    },
    NC = (e) => {
        Em(e, (t, n) => {
            if (qe(e) && ['arguments', 'caller', 'callee'].indexOf(n) !== -1) return !1;
            const r = e[n];
            if (qe(r)) {
                if (((t.enumerable = !1), 'writable' in t)) {
                    t.writable = !1;
                    return;
                }
                t.set ||
                    (t.set = () => {
                        throw Error("Can not rewrite read-only method '" + n + "'");
                    });
            }
        });
    },
    DC = (e, t) => {
        const n = {},
            r = (o) => {
                o.forEach((i) => {
                    n[i] = !0;
                });
            };
        return Ur(e) ? r(e) : r(String(e).split(t)), n;
    },
    AC = () => {},
    IC = (e, t) => (e != null && Number.isFinite((e = +e)) ? e : t);
function MC(e) {
    return !!(e && qe(e.append) && e[Symbol.toStringTag] === 'FormData' && e[Symbol.iterator]);
}
const LC = (e) => {
        const t = new Array(10),
            n = (r, o) => {
                if (pl(r)) {
                    if (t.indexOf(r) >= 0) return;
                    if (!('toJSON' in r)) {
                        t[o] = r;
                        const i = Ur(r) ? [] : {};
                        return (
                            ri(r, (s, l) => {
                                const a = n(s, o + 1);
                                !Vo(a) && (i[l] = a);
                            }),
                            (t[o] = void 0),
                            i
                        );
                    }
                }
                return r;
            };
        return n(e, 0);
    },
    FC = Et('AsyncFunction'),
    jC = (e) => e && (pl(e) || qe(e)) && qe(e.then) && qe(e.catch),
    xm = ((e, t) =>
        e
            ? setImmediate
            : t
              ? ((n, r) => (
                    Fn.addEventListener(
                        'message',
                        ({ source: o, data: i }) => {
                            o === Fn && i === n && r.length && r.shift()();
                        },
                        !1,
                    ),
                    (o) => {
                        r.push(o), Fn.postMessage(n, '*');
                    }
                ))(`axios@${Math.random()}`, [])
              : (n) => setTimeout(n))(typeof setImmediate == 'function', qe(Fn.postMessage)),
    zC = typeof queueMicrotask < 'u' ? queueMicrotask.bind(Fn) : (typeof process < 'u' && process.nextTick) || xm,
    k = {
        isArray: Ur,
        isArrayBuffer: vm,
        isBuffer: rC,
        isFormData: dC,
        isArrayBufferView: oC,
        isString: iC,
        isNumber: ym,
        isBoolean: sC,
        isObject: pl,
        isPlainObject: Qi,
        isReadableStream: pC,
        isRequest: gC,
        isResponse: mC,
        isHeaders: vC,
        isUndefined: Vo,
        isDate: lC,
        isFile: aC,
        isBlob: cC,
        isRegExp: PC,
        isFunction: qe,
        isStream: fC,
        isURLSearchParams: hC,
        isTypedArray: TC,
        isFileList: uC,
        forEach: ri,
        merge: Ec,
        extend: wC,
        trim: yC,
        stripBOM: SC,
        inherits: EC,
        toFlatObject: xC,
        kindOf: dl,
        kindOfTest: Et,
        endsWith: CC,
        toArray: bC,
        forEachEntry: kC,
        matchAll: RC,
        isHTMLForm: _C,
        hasOwnProperty: Yd,
        hasOwnProp: Yd,
        reduceDescriptors: Em,
        freezeMethods: NC,
        toObjectSet: DC,
        toCamelCase: OC,
        noop: AC,
        toFiniteNumber: IC,
        findKey: wm,
        global: Fn,
        isContextDefined: Sm,
        isSpecCompliantForm: MC,
        toJSONObject: LC,
        isAsyncFn: FC,
        isThenable: jC,
        setImmediate: xm,
        asap: zC,
    };
function U(e, t, n, r, o) {
    Error.call(this),
        Error.captureStackTrace ? Error.captureStackTrace(this, this.constructor) : (this.stack = new Error().stack),
        (this.message = e),
        (this.name = 'AxiosError'),
        t && (this.code = t),
        n && (this.config = n),
        r && (this.request = r),
        o && ((this.response = o), (this.status = o.status ? o.status : null));
}
k.inherits(U, Error, {
    toJSON: function () {
        return {
            message: this.message,
            name: this.name,
            description: this.description,
            number: this.number,
            fileName: this.fileName,
            lineNumber: this.lineNumber,
            columnNumber: this.columnNumber,
            stack: this.stack,
            config: k.toJSONObject(this.config),
            code: this.code,
            status: this.status,
        };
    },
});
const Cm = U.prototype,
    bm = {};
[
    'ERR_BAD_OPTION_VALUE',
    'ERR_BAD_OPTION',
    'ECONNABORTED',
    'ETIMEDOUT',
    'ERR_NETWORK',
    'ERR_FR_TOO_MANY_REDIRECTS',
    'ERR_DEPRECATED',
    'ERR_BAD_RESPONSE',
    'ERR_BAD_REQUEST',
    'ERR_CANCELED',
    'ERR_NOT_SUPPORT',
    'ERR_INVALID_URL',
].forEach((e) => {
    bm[e] = { value: e };
});
Object.defineProperties(U, bm);
Object.defineProperty(Cm, 'isAxiosError', { value: !0 });
U.from = (e, t, n, r, o, i) => {
    const s = Object.create(Cm);
    return (
        k.toFlatObject(
            e,
            s,
            function (a) {
                return a !== Error.prototype;
            },
            (l) => l !== 'isAxiosError',
        ),
        U.call(s, e.message, t, n, r, o),
        (s.cause = e),
        (s.name = e.name),
        i && Object.assign(s, i),
        s
    );
};
const UC = null;
function xc(e) {
    return k.isPlainObject(e) || k.isArray(e);
}
function Tm(e) {
    return k.endsWith(e, '[]') ? e.slice(0, -2) : e;
}
function Xd(e, t, n) {
    return e
        ? e
              .concat(t)
              .map(function (o, i) {
                  return (o = Tm(o)), !n && i ? '[' + o + ']' : o;
              })
              .join(n ? '.' : '')
        : t;
}
function BC(e) {
    return k.isArray(e) && !e.some(xc);
}
const $C = k.toFlatObject(k, {}, null, function (t) {
    return /^is[A-Z]/.test(t);
});
function gl(e, t, n) {
    if (!k.isObject(e)) throw new TypeError('target must be an object');
    (t = t || new FormData()),
        (n = k.toFlatObject(n, { metaTokens: !0, dots: !1, indexes: !1 }, !1, function (v, S) {
            return !k.isUndefined(S[v]);
        }));
    const r = n.metaTokens,
        o = n.visitor || u,
        i = n.dots,
        s = n.indexes,
        a = (n.Blob || (typeof Blob < 'u' && Blob)) && k.isSpecCompliantForm(t);
    if (!k.isFunction(o)) throw new TypeError('visitor must be a function');
    function c(m) {
        if (m === null) return '';
        if (k.isDate(m)) return m.toISOString();
        if (!a && k.isBlob(m)) throw new U('Blob is not supported. Use a Buffer instead.');
        return k.isArrayBuffer(m) || k.isTypedArray(m) ? (a && typeof Blob == 'function' ? new Blob([m]) : Buffer.from(m)) : m;
    }
    function u(m, v, S) {
        let h = m;
        if (m && !S && typeof m == 'object') {
            if (k.endsWith(v, '{}')) (v = r ? v : v.slice(0, -2)), (m = JSON.stringify(m));
            else if ((k.isArray(m) && BC(m)) || ((k.isFileList(m) || k.endsWith(v, '[]')) && (h = k.toArray(m))))
                return (
                    (v = Tm(v)),
                    h.forEach(function (w, C) {
                        !(k.isUndefined(w) || w === null) &&
                            t.append(s === !0 ? Xd([v], C, i) : s === null ? v : v + '[]', c(w));
                    }),
                    !1
                );
        }
        return xc(m) ? !0 : (t.append(Xd(S, v, i), c(m)), !1);
    }
    const f = [],
        d = Object.assign($C, { defaultVisitor: u, convertValue: c, isVisitable: xc });
    function y(m, v) {
        if (!k.isUndefined(m)) {
            if (f.indexOf(m) !== -1) throw Error('Circular reference detected in ' + v.join('.'));
            f.push(m),
                k.forEach(m, function (h, p) {
                    (!(k.isUndefined(h) || h === null) && o.call(t, h, k.isString(p) ? p.trim() : p, v, d)) === !0 &&
                        y(h, v ? v.concat(p) : [p]);
                }),
                f.pop();
        }
    }
    if (!k.isObject(e)) throw new TypeError('data must be an object');
    return y(e), t;
}
function Qd(e) {
    const t = { '!': '%21', "'": '%27', '(': '%28', ')': '%29', '~': '%7E', '%20': '+', '%00': '\0' };
    return encodeURIComponent(e).replace(/[!'()~]|%20|%00/g, function (r) {
        return t[r];
    });
}
function Vu(e, t) {
    (this._pairs = []), e && gl(e, this, t);
}
const km = Vu.prototype;
km.append = function (t, n) {
    this._pairs.push([t, n]);
};
km.toString = function (t) {
    const n = t
        ? function (r) {
              return t.call(this, r, Qd);
          }
        : Qd;
    return this._pairs
        .map(function (o) {
            return n(o[0]) + '=' + n(o[1]);
        }, '')
        .join('&');
};
function HC(e) {
    return encodeURIComponent(e)
        .replace(/%3A/gi, ':')
        .replace(/%24/g, '$')
        .replace(/%2C/gi, ',')
        .replace(/%20/g, '+')
        .replace(/%5B/gi, '[')
        .replace(/%5D/gi, ']');
}
function Rm(e, t, n) {
    if (!t) return e;
    const r = (n && n.encode) || HC;
    k.isFunction(n) && (n = { serialize: n });
    const o = n && n.serialize;
    let i;
    if ((o ? (i = o(t, n)) : (i = k.isURLSearchParams(t) ? t.toString() : new Vu(t, n).toString(r)), i)) {
        const s = e.indexOf('#');
        s !== -1 && (e = e.slice(0, s)), (e += (e.indexOf('?') === -1 ? '?' : '&') + i);
    }
    return e;
}
class Jd {
    constructor() {
        this.handlers = [];
    }
    use(t, n, r) {
        return (
            this.handlers.push({
                fulfilled: t,
                rejected: n,
                synchronous: r ? r.synchronous : !1,
                runWhen: r ? r.runWhen : null,
            }),
            this.handlers.length - 1
        );
    }
    eject(t) {
        this.handlers[t] && (this.handlers[t] = null);
    }
    clear() {
        this.handlers && (this.handlers = []);
    }
    forEach(t) {
        k.forEach(this.handlers, function (r) {
            r !== null && t(r);
        });
    }
}
const _m = { silentJSONParsing: !0, forcedJSONParsing: !0, clarifyTimeoutError: !1 },
    WC = typeof URLSearchParams < 'u' ? URLSearchParams : Vu,
    VC = typeof FormData < 'u' ? FormData : null,
    qC = typeof Blob < 'u' ? Blob : null,
    GC = {
        isBrowser: !0,
        classes: { URLSearchParams: WC, FormData: VC, Blob: qC },
        protocols: ['http', 'https', 'file', 'blob', 'url', 'data'],
    },
    qu = typeof window < 'u' && typeof document < 'u',
    Cc = (typeof navigator == 'object' && navigator) || void 0,
    KC = qu && (!Cc || ['ReactNative', 'NativeScript', 'NS'].indexOf(Cc.product) < 0),
    YC = typeof WorkerGlobalScope < 'u' && self instanceof WorkerGlobalScope && typeof self.importScripts == 'function',
    XC = (qu && window.location.href) || 'http://localhost',
    QC = Object.freeze(
        Object.defineProperty(
            {
                __proto__: null,
                hasBrowserEnv: qu,
                hasStandardBrowserEnv: KC,
                hasStandardBrowserWebWorkerEnv: YC,
                navigator: Cc,
                origin: XC,
            },
            Symbol.toStringTag,
            { value: 'Module' },
        ),
    ),
    Te = { ...QC, ...GC };
function JC(e, t) {
    return gl(
        e,
        new Te.classes.URLSearchParams(),
        Object.assign(
            {
                visitor: function (n, r, o, i) {
                    return Te.isNode && k.isBuffer(n)
                        ? (this.append(r, n.toString('base64')), !1)
                        : i.defaultVisitor.apply(this, arguments);
                },
            },
            t,
        ),
    );
}
function ZC(e) {
    return k.matchAll(/\w+|\[(\w*)]/g, e).map((t) => (t[0] === '[]' ? '' : t[1] || t[0]));
}
function e1(e) {
    const t = {},
        n = Object.keys(e);
    let r;
    const o = n.length;
    let i;
    for (r = 0; r < o; r++) (i = n[r]), (t[i] = e[i]);
    return t;
}
function Om(e) {
    function t(n, r, o, i) {
        let s = n[i++];
        if (s === '__proto__') return !0;
        const l = Number.isFinite(+s),
            a = i >= n.length;
        return (
            (s = !s && k.isArray(o) ? o.length : s),
            a
                ? (k.hasOwnProp(o, s) ? (o[s] = [o[s], r]) : (o[s] = r), !l)
                : ((!o[s] || !k.isObject(o[s])) && (o[s] = []), t(n, r, o[s], i) && k.isArray(o[s]) && (o[s] = e1(o[s])), !l)
        );
    }
    if (k.isFormData(e) && k.isFunction(e.entries)) {
        const n = {};
        return (
            k.forEachEntry(e, (r, o) => {
                t(ZC(r), o, n, 0);
            }),
            n
        );
    }
    return null;
}
function t1(e, t, n) {
    if (k.isString(e))
        try {
            return (t || JSON.parse)(e), k.trim(e);
        } catch (r) {
            if (r.name !== 'SyntaxError') throw r;
        }
    return (n || JSON.stringify)(e);
}
const oi = {
    transitional: _m,
    adapter: ['xhr', 'http', 'fetch'],
    transformRequest: [
        function (t, n) {
            const r = n.getContentType() || '',
                o = r.indexOf('application/json') > -1,
                i = k.isObject(t);
            if ((i && k.isHTMLForm(t) && (t = new FormData(t)), k.isFormData(t))) return o ? JSON.stringify(Om(t)) : t;
            if (k.isArrayBuffer(t) || k.isBuffer(t) || k.isStream(t) || k.isFile(t) || k.isBlob(t) || k.isReadableStream(t))
                return t;
            if (k.isArrayBufferView(t)) return t.buffer;
            if (k.isURLSearchParams(t))
                return n.setContentType('application/x-www-form-urlencoded;charset=utf-8', !1), t.toString();
            let l;
            if (i) {
                if (r.indexOf('application/x-www-form-urlencoded') > -1) return JC(t, this.formSerializer).toString();
                if ((l = k.isFileList(t)) || r.indexOf('multipart/form-data') > -1) {
                    const a = this.env && this.env.FormData;
                    return gl(l ? { 'files[]': t } : t, a && new a(), this.formSerializer);
                }
            }
            return i || o ? (n.setContentType('application/json', !1), t1(t)) : t;
        },
    ],
    transformResponse: [
        function (t) {
            const n = this.transitional || oi.transitional,
                r = n && n.forcedJSONParsing,
                o = this.responseType === 'json';
            if (k.isResponse(t) || k.isReadableStream(t)) return t;
            if (t && k.isString(t) && ((r && !this.responseType) || o)) {
                const s = !(n && n.silentJSONParsing) && o;
                try {
                    return JSON.parse(t);
                } catch (l) {
                    if (s) throw l.name === 'SyntaxError' ? U.from(l, U.ERR_BAD_RESPONSE, this, null, this.response) : l;
                }
            }
            return t;
        },
    ],
    timeout: 0,
    xsrfCookieName: 'XSRF-TOKEN',
    xsrfHeaderName: 'X-XSRF-TOKEN',
    maxContentLength: -1,
    maxBodyLength: -1,
    env: { FormData: Te.classes.FormData, Blob: Te.classes.Blob },
    validateStatus: function (t) {
        return t >= 200 && t < 300;
    },
    headers: { common: { Accept: 'application/json, text/plain, */*', 'Content-Type': void 0 } },
};
k.forEach(['delete', 'get', 'head', 'post', 'put', 'patch'], (e) => {
    oi.headers[e] = {};
});
const n1 = k.toObjectSet([
        'age',
        'authorization',
        'content-length',
        'content-type',
        'etag',
        'expires',
        'from',
        'host',
        'if-modified-since',
        'if-unmodified-since',
        'last-modified',
        'location',
        'max-forwards',
        'proxy-authorization',
        'referer',
        'retry-after',
        'user-agent',
    ]),
    r1 = (e) => {
        const t = {};
        let n, r, o;
        return (
            e &&
                e
                    .split(
                        `
`,
                    )
                    .forEach(function (s) {
                        (o = s.indexOf(':')),
                            (n = s.substring(0, o).trim().toLowerCase()),
                            (r = s.substring(o + 1).trim()),
                            !(!n || (t[n] && n1[n])) &&
                                (n === 'set-cookie'
                                    ? t[n]
                                        ? t[n].push(r)
                                        : (t[n] = [r])
                                    : (t[n] = t[n] ? t[n] + ', ' + r : r));
                    }),
            t
        );
    },
    Zd = Symbol('internals');
function io(e) {
    return e && String(e).trim().toLowerCase();
}
function Ji(e) {
    return e === !1 || e == null ? e : k.isArray(e) ? e.map(Ji) : String(e);
}
function o1(e) {
    const t = Object.create(null),
        n = /([^\s,;=]+)\s*(?:=\s*([^,;]+))?/g;
    let r;
    for (; (r = n.exec(e)); ) t[r[1]] = r[2];
    return t;
}
const i1 = (e) => /^[-_a-zA-Z0-9^`|~,!#$%&'*+.]+$/.test(e.trim());
function ia(e, t, n, r, o) {
    if (k.isFunction(r)) return r.call(this, t, n);
    if ((o && (t = n), !!k.isString(t))) {
        if (k.isString(r)) return t.indexOf(r) !== -1;
        if (k.isRegExp(r)) return r.test(t);
    }
}
function s1(e) {
    return e
        .trim()
        .toLowerCase()
        .replace(/([a-z\d])(\w*)/g, (t, n, r) => n.toUpperCase() + r);
}
function l1(e, t) {
    const n = k.toCamelCase(' ' + t);
    ['get', 'set', 'has'].forEach((r) => {
        Object.defineProperty(e, r + n, {
            value: function (o, i, s) {
                return this[r].call(this, t, o, i, s);
            },
            configurable: !0,
        });
    });
}
let Ue = class {
    constructor(t) {
        t && this.set(t);
    }
    set(t, n, r) {
        const o = this;
        function i(l, a, c) {
            const u = io(a);
            if (!u) throw new Error('header name must be a non-empty string');
            const f = k.findKey(o, u);
            (!f || o[f] === void 0 || c === !0 || (c === void 0 && o[f] !== !1)) && (o[f || a] = Ji(l));
        }
        const s = (l, a) => k.forEach(l, (c, u) => i(c, u, a));
        if (k.isPlainObject(t) || t instanceof this.constructor) s(t, n);
        else if (k.isString(t) && (t = t.trim()) && !i1(t)) s(r1(t), n);
        else if (k.isHeaders(t)) for (const [l, a] of t.entries()) i(a, l, r);
        else t != null && i(n, t, r);
        return this;
    }
    get(t, n) {
        if (((t = io(t)), t)) {
            const r = k.findKey(this, t);
            if (r) {
                const o = this[r];
                if (!n) return o;
                if (n === !0) return o1(o);
                if (k.isFunction(n)) return n.call(this, o, r);
                if (k.isRegExp(n)) return n.exec(o);
                throw new TypeError('parser must be boolean|regexp|function');
            }
        }
    }
    has(t, n) {
        if (((t = io(t)), t)) {
            const r = k.findKey(this, t);
            return !!(r && this[r] !== void 0 && (!n || ia(this, this[r], r, n)));
        }
        return !1;
    }
    delete(t, n) {
        const r = this;
        let o = !1;
        function i(s) {
            if (((s = io(s)), s)) {
                const l = k.findKey(r, s);
                l && (!n || ia(r, r[l], l, n)) && (delete r[l], (o = !0));
            }
        }
        return k.isArray(t) ? t.forEach(i) : i(t), o;
    }
    clear(t) {
        const n = Object.keys(this);
        let r = n.length,
            o = !1;
        for (; r--; ) {
            const i = n[r];
            (!t || ia(this, this[i], i, t, !0)) && (delete this[i], (o = !0));
        }
        return o;
    }
    normalize(t) {
        const n = this,
            r = {};
        return (
            k.forEach(this, (o, i) => {
                const s = k.findKey(r, i);
                if (s) {
                    (n[s] = Ji(o)), delete n[i];
                    return;
                }
                const l = t ? s1(i) : String(i).trim();
                l !== i && delete n[i], (n[l] = Ji(o)), (r[l] = !0);
            }),
            this
        );
    }
    concat(...t) {
        return this.constructor.concat(this, ...t);
    }
    toJSON(t) {
        const n = Object.create(null);
        return (
            k.forEach(this, (r, o) => {
                r != null && r !== !1 && (n[o] = t && k.isArray(r) ? r.join(', ') : r);
            }),
            n
        );
    }
    [Symbol.iterator]() {
        return Object.entries(this.toJSON())[Symbol.iterator]();
    }
    toString() {
        return Object.entries(this.toJSON()).map(([t, n]) => t + ': ' + n).join(`
`);
    }
    get [Symbol.toStringTag]() {
        return 'AxiosHeaders';
    }
    static from(t) {
        return t instanceof this ? t : new this(t);
    }
    static concat(t, ...n) {
        const r = new this(t);
        return n.forEach((o) => r.set(o)), r;
    }
    static accessor(t) {
        const r = (this[Zd] = this[Zd] = { accessors: {} }).accessors,
            o = this.prototype;
        function i(s) {
            const l = io(s);
            r[l] || (l1(o, s), (r[l] = !0));
        }
        return k.isArray(t) ? t.forEach(i) : i(t), this;
    }
};
Ue.accessor(['Content-Type', 'Content-Length', 'Accept', 'Accept-Encoding', 'User-Agent', 'Authorization']);
k.reduceDescriptors(Ue.prototype, ({ value: e }, t) => {
    let n = t[0].toUpperCase() + t.slice(1);
    return {
        get: () => e,
        set(r) {
            this[n] = r;
        },
    };
});
k.freezeMethods(Ue);
function sa(e, t) {
    const n = this || oi,
        r = t || n,
        o = Ue.from(r.headers);
    let i = r.data;
    return (
        k.forEach(e, function (l) {
            i = l.call(n, i, o.normalize(), t ? t.status : void 0);
        }),
        o.normalize(),
        i
    );
}
function Pm(e) {
    return !!(e && e.__CANCEL__);
}
function Br(e, t, n) {
    U.call(this, e ?? 'canceled', U.ERR_CANCELED, t, n), (this.name = 'CanceledError');
}
k.inherits(Br, U, { __CANCEL__: !0 });
function Nm(e, t, n) {
    const r = n.config.validateStatus;
    !n.status || !r || r(n.status)
        ? e(n)
        : t(
              new U(
                  'Request failed with status code ' + n.status,
                  [U.ERR_BAD_REQUEST, U.ERR_BAD_RESPONSE][Math.floor(n.status / 100) - 4],
                  n.config,
                  n.request,
                  n,
              ),
          );
}
function a1(e) {
    const t = /^([-+\w]{1,25})(:?\/\/|:)/.exec(e);
    return (t && t[1]) || '';
}
function c1(e, t) {
    e = e || 10;
    const n = new Array(e),
        r = new Array(e);
    let o = 0,
        i = 0,
        s;
    return (
        (t = t !== void 0 ? t : 1e3),
        function (a) {
            const c = Date.now(),
                u = r[i];
            s || (s = c), (n[o] = a), (r[o] = c);
            let f = i,
                d = 0;
            for (; f !== o; ) (d += n[f++]), (f = f % e);
            if (((o = (o + 1) % e), o === i && (i = (i + 1) % e), c - s < t)) return;
            const y = u && c - u;
            return y ? Math.round((d * 1e3) / y) : void 0;
        }
    );
}
function u1(e, t) {
    let n = 0,
        r = 1e3 / t,
        o,
        i;
    const s = (c, u = Date.now()) => {
        (n = u), (o = null), i && (clearTimeout(i), (i = null)), e.apply(null, c);
    };
    return [
        (...c) => {
            const u = Date.now(),
                f = u - n;
            f >= r
                ? s(c, u)
                : ((o = c),
                  i ||
                      (i = setTimeout(() => {
                          (i = null), s(o);
                      }, r - f)));
        },
        () => o && s(o),
    ];
}
const As = (e, t, n = 3) => {
        let r = 0;
        const o = c1(50, 250);
        return u1((i) => {
            const s = i.loaded,
                l = i.lengthComputable ? i.total : void 0,
                a = s - r,
                c = o(a),
                u = s <= l;
            r = s;
            const f = {
                loaded: s,
                total: l,
                progress: l ? s / l : void 0,
                bytes: a,
                rate: c || void 0,
                estimated: c && l && u ? (l - s) / c : void 0,
                event: i,
                lengthComputable: l != null,
                [t ? 'download' : 'upload']: !0,
            };
            e(f);
        }, n);
    },
    eh = (e, t) => {
        const n = e != null;
        return [(r) => t[0]({ lengthComputable: n, total: e, loaded: r }), t[1]];
    },
    th =
        (e) =>
        (...t) =>
            k.asap(() => e(...t)),
    f1 = Te.hasStandardBrowserEnv
        ? ((e, t) => (n) => (
              (n = new URL(n, Te.origin)), e.protocol === n.protocol && e.host === n.host && (t || e.port === n.port)
          ))(new URL(Te.origin), Te.navigator && /(msie|trident)/i.test(Te.navigator.userAgent))
        : () => !0,
    d1 = Te.hasStandardBrowserEnv
        ? {
              write(e, t, n, r, o, i) {
                  const s = [e + '=' + encodeURIComponent(t)];
                  k.isNumber(n) && s.push('expires=' + new Date(n).toGMTString()),
                      k.isString(r) && s.push('path=' + r),
                      k.isString(o) && s.push('domain=' + o),
                      i === !0 && s.push('secure'),
                      (document.cookie = s.join('; '));
              },
              read(e) {
                  const t = document.cookie.match(new RegExp('(^|;\\s*)(' + e + ')=([^;]*)'));
                  return t ? decodeURIComponent(t[3]) : null;
              },
              remove(e) {
                  this.write(e, '', Date.now() - 864e5);
              },
          }
        : {
              write() {},
              read() {
                  return null;
              },
              remove() {},
          };
function h1(e) {
    return /^([a-z][a-z\d+\-.]*:)?\/\//i.test(e);
}
function p1(e, t) {
    return t ? e.replace(/\/?\/$/, '') + '/' + t.replace(/^\/+/, '') : e;
}
function Dm(e, t, n) {
    let r = !h1(t);
    return (e && r) || n == !1 ? p1(e, t) : t;
}
const nh = (e) => (e instanceof Ue ? { ...e } : e);
function Kn(e, t) {
    t = t || {};
    const n = {};
    function r(c, u, f, d) {
        return k.isPlainObject(c) && k.isPlainObject(u)
            ? k.merge.call({ caseless: d }, c, u)
            : k.isPlainObject(u)
              ? k.merge({}, u)
              : k.isArray(u)
                ? u.slice()
                : u;
    }
    function o(c, u, f, d) {
        if (k.isUndefined(u)) {
            if (!k.isUndefined(c)) return r(void 0, c, f, d);
        } else return r(c, u, f, d);
    }
    function i(c, u) {
        if (!k.isUndefined(u)) return r(void 0, u);
    }
    function s(c, u) {
        if (k.isUndefined(u)) {
            if (!k.isUndefined(c)) return r(void 0, c);
        } else return r(void 0, u);
    }
    function l(c, u, f) {
        if (f in t) return r(c, u);
        if (f in e) return r(void 0, c);
    }
    const a = {
        url: i,
        method: i,
        data: i,
        baseURL: s,
        transformRequest: s,
        transformResponse: s,
        paramsSerializer: s,
        timeout: s,
        timeoutMessage: s,
        withCredentials: s,
        withXSRFToken: s,
        adapter: s,
        responseType: s,
        xsrfCookieName: s,
        xsrfHeaderName: s,
        onUploadProgress: s,
        onDownloadProgress: s,
        decompress: s,
        maxContentLength: s,
        maxBodyLength: s,
        beforeRedirect: s,
        transport: s,
        httpAgent: s,
        httpsAgent: s,
        cancelToken: s,
        socketPath: s,
        responseEncoding: s,
        validateStatus: l,
        headers: (c, u, f) => o(nh(c), nh(u), f, !0),
    };
    return (
        k.forEach(Object.keys(Object.assign({}, e, t)), function (u) {
            const f = a[u] || o,
                d = f(e[u], t[u], u);
            (k.isUndefined(d) && f !== l) || (n[u] = d);
        }),
        n
    );
}
const Am = (e) => {
        const t = Kn({}, e);
        let { data: n, withXSRFToken: r, xsrfHeaderName: o, xsrfCookieName: i, headers: s, auth: l } = t;
        (t.headers = s = Ue.from(s)),
            (t.url = Rm(Dm(t.baseURL, t.url, t.allowAbsoluteUrls), e.params, e.paramsSerializer)),
            l &&
                s.set(
                    'Authorization',
                    'Basic ' + btoa((l.username || '') + ':' + (l.password ? unescape(encodeURIComponent(l.password)) : '')),
                );
        let a;
        if (k.isFormData(n)) {
            if (Te.hasStandardBrowserEnv || Te.hasStandardBrowserWebWorkerEnv) s.setContentType(void 0);
            else if ((a = s.getContentType()) !== !1) {
                const [c, ...u] = a
                    ? a
                          .split(';')
                          .map((f) => f.trim())
                          .filter(Boolean)
                    : [];
                s.setContentType([c || 'multipart/form-data', ...u].join('; '));
            }
        }
        if (Te.hasStandardBrowserEnv && (r && k.isFunction(r) && (r = r(t)), r || (r !== !1 && f1(t.url)))) {
            const c = o && i && d1.read(i);
            c && s.set(o, c);
        }
        return t;
    },
    g1 = typeof XMLHttpRequest < 'u',
    m1 =
        g1 &&
        function (e) {
            return new Promise(function (n, r) {
                const o = Am(e);
                let i = o.data;
                const s = Ue.from(o.headers).normalize();
                let { responseType: l, onUploadProgress: a, onDownloadProgress: c } = o,
                    u,
                    f,
                    d,
                    y,
                    m;
                function v() {
                    y && y(),
                        m && m(),
                        o.cancelToken && o.cancelToken.unsubscribe(u),
                        o.signal && o.signal.removeEventListener('abort', u);
                }
                let S = new XMLHttpRequest();
                S.open(o.method.toUpperCase(), o.url, !0), (S.timeout = o.timeout);
                function h() {
                    if (!S) return;
                    const w = Ue.from('getAllResponseHeaders' in S && S.getAllResponseHeaders()),
                        T = {
                            data: !l || l === 'text' || l === 'json' ? S.responseText : S.response,
                            status: S.status,
                            statusText: S.statusText,
                            headers: w,
                            config: e,
                            request: S,
                        };
                    Nm(
                        function (b) {
                            n(b), v();
                        },
                        function (b) {
                            r(b), v();
                        },
                        T,
                    ),
                        (S = null);
                }
                'onloadend' in S
                    ? (S.onloadend = h)
                    : (S.onreadystatechange = function () {
                          !S ||
                              S.readyState !== 4 ||
                              (S.status === 0 && !(S.responseURL && S.responseURL.indexOf('file:') === 0)) ||
                              setTimeout(h);
                      }),
                    (S.onabort = function () {
                        S && (r(new U('Request aborted', U.ECONNABORTED, e, S)), (S = null));
                    }),
                    (S.onerror = function () {
                        r(new U('Network Error', U.ERR_NETWORK, e, S)), (S = null);
                    }),
                    (S.ontimeout = function () {
                        let C = o.timeout ? 'timeout of ' + o.timeout + 'ms exceeded' : 'timeout exceeded';
                        const T = o.transitional || _m;
                        o.timeoutErrorMessage && (C = o.timeoutErrorMessage),
                            r(new U(C, T.clarifyTimeoutError ? U.ETIMEDOUT : U.ECONNABORTED, e, S)),
                            (S = null);
                    }),
                    i === void 0 && s.setContentType(null),
                    'setRequestHeader' in S &&
                        k.forEach(s.toJSON(), function (C, T) {
                            S.setRequestHeader(T, C);
                        }),
                    k.isUndefined(o.withCredentials) || (S.withCredentials = !!o.withCredentials),
                    l && l !== 'json' && (S.responseType = o.responseType),
                    c && (([d, m] = As(c, !0)), S.addEventListener('progress', d)),
                    a &&
                        S.upload &&
                        (([f, y] = As(a)), S.upload.addEventListener('progress', f), S.upload.addEventListener('loadend', y)),
                    (o.cancelToken || o.signal) &&
                        ((u = (w) => {
                            S && (r(!w || w.type ? new Br(null, e, S) : w), S.abort(), (S = null));
                        }),
                        o.cancelToken && o.cancelToken.subscribe(u),
                        o.signal && (o.signal.aborted ? u() : o.signal.addEventListener('abort', u)));
                const p = a1(o.url);
                if (p && Te.protocols.indexOf(p) === -1) {
                    r(new U('Unsupported protocol ' + p + ':', U.ERR_BAD_REQUEST, e));
                    return;
                }
                S.send(i || null);
            });
        },
    v1 = (e, t) => {
        const { length: n } = (e = e ? e.filter(Boolean) : []);
        if (t || n) {
            let r = new AbortController(),
                o;
            const i = function (c) {
                if (!o) {
                    (o = !0), l();
                    const u = c instanceof Error ? c : this.reason;
                    r.abort(u instanceof U ? u : new Br(u instanceof Error ? u.message : u));
                }
            };
            let s =
                t &&
                setTimeout(() => {
                    (s = null), i(new U(`timeout ${t} of ms exceeded`, U.ETIMEDOUT));
                }, t);
            const l = () => {
                e &&
                    (s && clearTimeout(s),
                    (s = null),
                    e.forEach((c) => {
                        c.unsubscribe ? c.unsubscribe(i) : c.removeEventListener('abort', i);
                    }),
                    (e = null));
            };
            e.forEach((c) => c.addEventListener('abort', i));
            const { signal: a } = r;
            return (a.unsubscribe = () => k.asap(l)), a;
        }
    },
    y1 = function* (e, t) {
        let n = e.byteLength;
        if (n < t) {
            yield e;
            return;
        }
        let r = 0,
            o;
        for (; r < n; ) (o = r + t), yield e.slice(r, o), (r = o);
    },
    w1 = async function* (e, t) {
        for await (const n of S1(e)) yield* y1(n, t);
    },
    S1 = async function* (e) {
        if (e[Symbol.asyncIterator]) {
            yield* e;
            return;
        }
        const t = e.getReader();
        try {
            for (;;) {
                const { done: n, value: r } = await t.read();
                if (n) break;
                yield r;
            }
        } finally {
            await t.cancel();
        }
    },
    rh = (e, t, n, r) => {
        const o = w1(e, t);
        let i = 0,
            s,
            l = (a) => {
                s || ((s = !0), r && r(a));
            };
        return new ReadableStream(
            {
                async pull(a) {
                    try {
                        const { done: c, value: u } = await o.next();
                        if (c) {
                            l(), a.close();
                            return;
                        }
                        let f = u.byteLength;
                        if (n) {
                            let d = (i += f);
                            n(d);
                        }
                        a.enqueue(new Uint8Array(u));
                    } catch (c) {
                        throw (l(c), c);
                    }
                },
                cancel(a) {
                    return l(a), o.return();
                },
            },
            { highWaterMark: 2 },
        );
    },
    ml = typeof fetch == 'function' && typeof Request == 'function' && typeof Response == 'function',
    Im = ml && typeof ReadableStream == 'function',
    E1 =
        ml &&
        (typeof TextEncoder == 'function'
            ? (
                  (e) => (t) =>
                      e.encode(t)
              )(new TextEncoder())
            : async (e) => new Uint8Array(await new Response(e).arrayBuffer())),
    Mm = (e, ...t) => {
        try {
            return !!e(...t);
        } catch {
            return !1;
        }
    },
    x1 =
        Im &&
        Mm(() => {
            let e = !1;
            const t = new Request(Te.origin, {
                body: new ReadableStream(),
                method: 'POST',
                get duplex() {
                    return (e = !0), 'half';
                },
            }).headers.has('Content-Type');
            return e && !t;
        }),
    oh = 64 * 1024,
    bc = Im && Mm(() => k.isReadableStream(new Response('').body)),
    Is = { stream: bc && ((e) => e.body) };
ml &&
    ((e) => {
        ['text', 'arrayBuffer', 'blob', 'formData', 'stream'].forEach((t) => {
            !Is[t] &&
                (Is[t] = k.isFunction(e[t])
                    ? (n) => n[t]()
                    : (n, r) => {
                          throw new U(`Response type '${t}' is not supported`, U.ERR_NOT_SUPPORT, r);
                      });
        });
    })(new Response());
const C1 = async (e) => {
        if (e == null) return 0;
        if (k.isBlob(e)) return e.size;
        if (k.isSpecCompliantForm(e))
            return (await new Request(Te.origin, { method: 'POST', body: e }).arrayBuffer()).byteLength;
        if (k.isArrayBufferView(e) || k.isArrayBuffer(e)) return e.byteLength;
        if ((k.isURLSearchParams(e) && (e = e + ''), k.isString(e))) return (await E1(e)).byteLength;
    },
    b1 = async (e, t) => {
        const n = k.toFiniteNumber(e.getContentLength());
        return n ?? C1(t);
    },
    T1 =
        ml &&
        (async (e) => {
            let {
                url: t,
                method: n,
                data: r,
                signal: o,
                cancelToken: i,
                timeout: s,
                onDownloadProgress: l,
                onUploadProgress: a,
                responseType: c,
                headers: u,
                withCredentials: f = 'same-origin',
                fetchOptions: d,
            } = Am(e);
            c = c ? (c + '').toLowerCase() : 'text';
            let y = v1([o, i && i.toAbortSignal()], s),
                m;
            const v =
                y &&
                y.unsubscribe &&
                (() => {
                    y.unsubscribe();
                });
            let S;
            try {
                if (a && x1 && n !== 'get' && n !== 'head' && (S = await b1(u, r)) !== 0) {
                    let T = new Request(t, { method: 'POST', body: r, duplex: 'half' }),
                        _;
                    if ((k.isFormData(r) && (_ = T.headers.get('content-type')) && u.setContentType(_), T.body)) {
                        const [b, x] = eh(S, As(th(a)));
                        r = rh(T.body, oh, b, x);
                    }
                }
                k.isString(f) || (f = f ? 'include' : 'omit');
                const h = 'credentials' in Request.prototype;
                m = new Request(t, {
                    ...d,
                    signal: y,
                    method: n.toUpperCase(),
                    headers: u.normalize().toJSON(),
                    body: r,
                    duplex: 'half',
                    credentials: h ? f : void 0,
                });
                let p = await fetch(m);
                const w = bc && (c === 'stream' || c === 'response');
                if (bc && (l || (w && v))) {
                    const T = {};
                    ['status', 'statusText', 'headers'].forEach((R) => {
                        T[R] = p[R];
                    });
                    const _ = k.toFiniteNumber(p.headers.get('content-length')),
                        [b, x] = (l && eh(_, As(th(l), !0))) || [];
                    p = new Response(
                        rh(p.body, oh, b, () => {
                            x && x(), v && v();
                        }),
                        T,
                    );
                }
                c = c || 'text';
                let C = await Is[k.findKey(Is, c) || 'text'](p, e);
                return (
                    !w && v && v(),
                    await new Promise((T, _) => {
                        Nm(T, _, {
                            data: C,
                            headers: Ue.from(p.headers),
                            status: p.status,
                            statusText: p.statusText,
                            config: e,
                            request: m,
                        });
                    })
                );
            } catch (h) {
                throw (
                    (v && v(),
                    h && h.name === 'TypeError' && /fetch/i.test(h.message)
                        ? Object.assign(new U('Network Error', U.ERR_NETWORK, e, m), { cause: h.cause || h })
                        : U.from(h, h && h.code, e, m))
                );
            }
        }),
    Tc = { http: UC, xhr: m1, fetch: T1 };
k.forEach(Tc, (e, t) => {
    if (e) {
        try {
            Object.defineProperty(e, 'name', { value: t });
        } catch {}
        Object.defineProperty(e, 'adapterName', { value: t });
    }
});
const ih = (e) => `- ${e}`,
    k1 = (e) => k.isFunction(e) || e === null || e === !1,
    Lm = {
        getAdapter: (e) => {
            e = k.isArray(e) ? e : [e];
            const { length: t } = e;
            let n, r;
            const o = {};
            for (let i = 0; i < t; i++) {
                n = e[i];
                let s;
                if (((r = n), !k1(n) && ((r = Tc[(s = String(n)).toLowerCase()]), r === void 0)))
                    throw new U(`Unknown adapter '${s}'`);
                if (r) break;
                o[s || '#' + i] = r;
            }
            if (!r) {
                const i = Object.entries(o).map(
                    ([l, a]) =>
                        `adapter ${l} ` + (a === !1 ? 'is not supported by the environment' : 'is not available in the build'),
                );
                let s = t
                    ? i.length > 1
                        ? `since :
` +
                          i.map(ih).join(`
`)
                        : ' ' + ih(i[0])
                    : 'as no adapter specified';
                throw new U('There is no suitable adapter to dispatch the request ' + s, 'ERR_NOT_SUPPORT');
            }
            return r;
        },
        adapters: Tc,
    };
function la(e) {
    if ((e.cancelToken && e.cancelToken.throwIfRequested(), e.signal && e.signal.aborted)) throw new Br(null, e);
}
function sh(e) {
    return (
        la(e),
        (e.headers = Ue.from(e.headers)),
        (e.data = sa.call(e, e.transformRequest)),
        ['post', 'put', 'patch'].indexOf(e.method) !== -1 && e.headers.setContentType('application/x-www-form-urlencoded', !1),
        Lm.getAdapter(e.adapter || oi.adapter)(e).then(
            function (r) {
                return la(e), (r.data = sa.call(e, e.transformResponse, r)), (r.headers = Ue.from(r.headers)), r;
            },
            function (r) {
                return (
                    Pm(r) ||
                        (la(e),
                        r &&
                            r.response &&
                            ((r.response.data = sa.call(e, e.transformResponse, r.response)),
                            (r.response.headers = Ue.from(r.response.headers)))),
                    Promise.reject(r)
                );
            },
        )
    );
}
const Fm = '1.8.3',
    vl = {};
['object', 'boolean', 'number', 'function', 'string', 'symbol'].forEach((e, t) => {
    vl[e] = function (r) {
        return typeof r === e || 'a' + (t < 1 ? 'n ' : ' ') + e;
    };
});
const lh = {};
vl.transitional = function (t, n, r) {
    function o(i, s) {
        return '[Axios v' + Fm + "] Transitional option '" + i + "'" + s + (r ? '. ' + r : '');
    }
    return (i, s, l) => {
        if (t === !1) throw new U(o(s, ' has been removed' + (n ? ' in ' + n : '')), U.ERR_DEPRECATED);
        return (
            n &&
                !lh[s] &&
                ((lh[s] = !0),
                console.warn(o(s, ' has been deprecated since v' + n + ' and will be removed in the near future'))),
            t ? t(i, s, l) : !0
        );
    };
};
vl.spelling = function (t) {
    return (n, r) => (console.warn(`${r} is likely a misspelling of ${t}`), !0);
};
function R1(e, t, n) {
    if (typeof e != 'object') throw new U('options must be an object', U.ERR_BAD_OPTION_VALUE);
    const r = Object.keys(e);
    let o = r.length;
    for (; o-- > 0; ) {
        const i = r[o],
            s = t[i];
        if (s) {
            const l = e[i],
                a = l === void 0 || s(l, i, e);
            if (a !== !0) throw new U('option ' + i + ' must be ' + a, U.ERR_BAD_OPTION_VALUE);
            continue;
        }
        if (n !== !0) throw new U('Unknown option ' + i, U.ERR_BAD_OPTION);
    }
}
const Zi = { assertOptions: R1, validators: vl },
    bt = Zi.validators;
let Un = class {
    constructor(t) {
        (this.defaults = t), (this.interceptors = { request: new Jd(), response: new Jd() });
    }
    async request(t, n) {
        try {
            return await this._request(t, n);
        } catch (r) {
            if (r instanceof Error) {
                let o = {};
                Error.captureStackTrace ? Error.captureStackTrace(o) : (o = new Error());
                const i = o.stack ? o.stack.replace(/^.+\n/, '') : '';
                try {
                    r.stack
                        ? i &&
                          !String(r.stack).endsWith(i.replace(/^.+\n.+\n/, '')) &&
                          (r.stack +=
                              `
` + i)
                        : (r.stack = i);
                } catch {}
            }
            throw r;
        }
    }
    _request(t, n) {
        typeof t == 'string' ? ((n = n || {}), (n.url = t)) : (n = t || {}), (n = Kn(this.defaults, n));
        const { transitional: r, paramsSerializer: o, headers: i } = n;
        r !== void 0 &&
            Zi.assertOptions(
                r,
                {
                    silentJSONParsing: bt.transitional(bt.boolean),
                    forcedJSONParsing: bt.transitional(bt.boolean),
                    clarifyTimeoutError: bt.transitional(bt.boolean),
                },
                !1,
            ),
            o != null &&
                (k.isFunction(o)
                    ? (n.paramsSerializer = { serialize: o })
                    : Zi.assertOptions(o, { encode: bt.function, serialize: bt.function }, !0)),
            n.allowAbsoluteUrls !== void 0 ||
                (this.defaults.allowAbsoluteUrls !== void 0
                    ? (n.allowAbsoluteUrls = this.defaults.allowAbsoluteUrls)
                    : (n.allowAbsoluteUrls = !0)),
            Zi.assertOptions(n, { baseUrl: bt.spelling('baseURL'), withXsrfToken: bt.spelling('withXSRFToken') }, !0),
            (n.method = (n.method || this.defaults.method || 'get').toLowerCase());
        let s = i && k.merge(i.common, i[n.method]);
        i &&
            k.forEach(['delete', 'get', 'head', 'post', 'put', 'patch', 'common'], (m) => {
                delete i[m];
            }),
            (n.headers = Ue.concat(s, i));
        const l = [];
        let a = !0;
        this.interceptors.request.forEach(function (v) {
            (typeof v.runWhen == 'function' && v.runWhen(n) === !1) ||
                ((a = a && v.synchronous), l.unshift(v.fulfilled, v.rejected));
        });
        const c = [];
        this.interceptors.response.forEach(function (v) {
            c.push(v.fulfilled, v.rejected);
        });
        let u,
            f = 0,
            d;
        if (!a) {
            const m = [sh.bind(this), void 0];
            for (m.unshift.apply(m, l), m.push.apply(m, c), d = m.length, u = Promise.resolve(n); f < d; )
                u = u.then(m[f++], m[f++]);
            return u;
        }
        d = l.length;
        let y = n;
        for (f = 0; f < d; ) {
            const m = l[f++],
                v = l[f++];
            try {
                y = m(y);
            } catch (S) {
                v.call(this, S);
                break;
            }
        }
        try {
            u = sh.call(this, y);
        } catch (m) {
            return Promise.reject(m);
        }
        for (f = 0, d = c.length; f < d; ) u = u.then(c[f++], c[f++]);
        return u;
    }
    getUri(t) {
        t = Kn(this.defaults, t);
        const n = Dm(t.baseURL, t.url, t.allowAbsoluteUrls);
        return Rm(n, t.params, t.paramsSerializer);
    }
};
k.forEach(['delete', 'get', 'head', 'options'], function (t) {
    Un.prototype[t] = function (n, r) {
        return this.request(Kn(r || {}, { method: t, url: n, data: (r || {}).data }));
    };
});
k.forEach(['post', 'put', 'patch'], function (t) {
    function n(r) {
        return function (i, s, l) {
            return this.request(
                Kn(l || {}, { method: t, headers: r ? { 'Content-Type': 'multipart/form-data' } : {}, url: i, data: s }),
            );
        };
    }
    (Un.prototype[t] = n()), (Un.prototype[t + 'Form'] = n(!0));
});
let _1 = class jm {
    constructor(t) {
        if (typeof t != 'function') throw new TypeError('executor must be a function.');
        let n;
        this.promise = new Promise(function (i) {
            n = i;
        });
        const r = this;
        this.promise.then((o) => {
            if (!r._listeners) return;
            let i = r._listeners.length;
            for (; i-- > 0; ) r._listeners[i](o);
            r._listeners = null;
        }),
            (this.promise.then = (o) => {
                let i;
                const s = new Promise((l) => {
                    r.subscribe(l), (i = l);
                }).then(o);
                return (
                    (s.cancel = function () {
                        r.unsubscribe(i);
                    }),
                    s
                );
            }),
            t(function (i, s, l) {
                r.reason || ((r.reason = new Br(i, s, l)), n(r.reason));
            });
    }
    throwIfRequested() {
        if (this.reason) throw this.reason;
    }
    subscribe(t) {
        if (this.reason) {
            t(this.reason);
            return;
        }
        this._listeners ? this._listeners.push(t) : (this._listeners = [t]);
    }
    unsubscribe(t) {
        if (!this._listeners) return;
        const n = this._listeners.indexOf(t);
        n !== -1 && this._listeners.splice(n, 1);
    }
    toAbortSignal() {
        const t = new AbortController(),
            n = (r) => {
                t.abort(r);
            };
        return this.subscribe(n), (t.signal.unsubscribe = () => this.unsubscribe(n)), t.signal;
    }
    static source() {
        let t;
        return {
            token: new jm(function (o) {
                t = o;
            }),
            cancel: t,
        };
    }
};
function O1(e) {
    return function (n) {
        return e.apply(null, n);
    };
}
function P1(e) {
    return k.isObject(e) && e.isAxiosError === !0;
}
const kc = {
    Continue: 100,
    SwitchingProtocols: 101,
    Processing: 102,
    EarlyHints: 103,
    Ok: 200,
    Created: 201,
    Accepted: 202,
    NonAuthoritativeInformation: 203,
    NoContent: 204,
    ResetContent: 205,
    PartialContent: 206,
    MultiStatus: 207,
    AlreadyReported: 208,
    ImUsed: 226,
    MultipleChoices: 300,
    MovedPermanently: 301,
    Found: 302,
    SeeOther: 303,
    NotModified: 304,
    UseProxy: 305,
    Unused: 306,
    TemporaryRedirect: 307,
    PermanentRedirect: 308,
    BadRequest: 400,
    Unauthorized: 401,
    PaymentRequired: 402,
    Forbidden: 403,
    NotFound: 404,
    MethodNotAllowed: 405,
    NotAcceptable: 406,
    ProxyAuthenticationRequired: 407,
    RequestTimeout: 408,
    Conflict: 409,
    Gone: 410,
    LengthRequired: 411,
    PreconditionFailed: 412,
    PayloadTooLarge: 413,
    UriTooLong: 414,
    UnsupportedMediaType: 415,
    RangeNotSatisfiable: 416,
    ExpectationFailed: 417,
    ImATeapot: 418,
    MisdirectedRequest: 421,
    UnprocessableEntity: 422,
    Locked: 423,
    FailedDependency: 424,
    TooEarly: 425,
    UpgradeRequired: 426,
    PreconditionRequired: 428,
    TooManyRequests: 429,
    RequestHeaderFieldsTooLarge: 431,
    UnavailableForLegalReasons: 451,
    InternalServerError: 500,
    NotImplemented: 501,
    BadGateway: 502,
    ServiceUnavailable: 503,
    GatewayTimeout: 504,
    HttpVersionNotSupported: 505,
    VariantAlsoNegotiates: 506,
    InsufficientStorage: 507,
    LoopDetected: 508,
    NotExtended: 510,
    NetworkAuthenticationRequired: 511,
};
Object.entries(kc).forEach(([e, t]) => {
    kc[t] = e;
});
function zm(e) {
    const t = new Un(e),
        n = mm(Un.prototype.request, t);
    return (
        k.extend(n, Un.prototype, t, { allOwnKeys: !0 }),
        k.extend(n, t, null, { allOwnKeys: !0 }),
        (n.create = function (o) {
            return zm(Kn(e, o));
        }),
        n
    );
}
const K = zm(oi);
K.Axios = Un;
K.CanceledError = Br;
K.CancelToken = _1;
K.isCancel = Pm;
K.VERSION = Fm;
K.toFormData = gl;
K.AxiosError = U;
K.Cancel = K.CanceledError;
K.all = function (t) {
    return Promise.all(t);
};
K.spread = O1;
K.isAxiosError = P1;
K.mergeConfig = Kn;
K.AxiosHeaders = Ue;
K.formToJSON = (e) => Om(k.isHTMLForm(e) ? new FormData(e) : e);
K.getAdapter = Lm.getAdapter;
K.HttpStatusCode = kc;
K.default = K;
const {
    Axios: BO,
    AxiosError: $O,
    CanceledError: HO,
    isCancel: WO,
    CancelToken: VO,
    VERSION: qO,
    all: GO,
    Cancel: KO,
    isAxiosError: YO,
    spread: XO,
    toFormData: QO,
    AxiosHeaders: JO,
    HttpStatusCode: ZO,
    formToJSON: eP,
    getAdapter: tP,
    mergeConfig: nP,
} = K;
function ah(e, t) {
    if (typeof e == 'function') return e(t);
    e != null && (e.current = t);
}
function Gu(...e) {
    return (t) => {
        let n = !1;
        const r = e.map((o) => {
            const i = ah(o, t);
            return !n && typeof i == 'function' && (n = !0), i;
        });
        if (n)
            return () => {
                for (let o = 0; o < r.length; o++) {
                    const i = r[o];
                    typeof i == 'function' ? i() : ah(e[o], null);
                }
            };
    };
}
function de(...e) {
    return g.useCallback(Gu(...e), e);
}
var qo = g.forwardRef((e, t) => {
    const { children: n, ...r } = e,
        o = g.Children.toArray(n),
        i = o.find(D1);
    if (i) {
        const s = i.props.children,
            l = o.map((a) =>
                a === i ? (g.Children.count(s) > 1 ? g.Children.only(null) : g.isValidElement(s) ? s.props.children : null) : a,
            );
        return E.jsx(Rc, { ...r, ref: t, children: g.isValidElement(s) ? g.cloneElement(s, void 0, l) : null });
    }
    return E.jsx(Rc, { ...r, ref: t, children: n });
});
qo.displayName = 'Slot';
var Rc = g.forwardRef((e, t) => {
    const { children: n, ...r } = e;
    if (g.isValidElement(n)) {
        const o = I1(n),
            i = A1(r, n.props);
        return n.type !== g.Fragment && (i.ref = t ? Gu(t, o) : o), g.cloneElement(n, i);
    }
    return g.Children.count(n) > 1 ? g.Children.only(null) : null;
});
Rc.displayName = 'SlotClone';
var N1 = ({ children: e }) => E.jsx(E.Fragment, { children: e });
function D1(e) {
    return g.isValidElement(e) && e.type === N1;
}
function A1(e, t) {
    const n = { ...t };
    for (const r in t) {
        const o = e[r],
            i = t[r];
        /^on[A-Z]/.test(r)
            ? o && i
                ? (n[r] = (...l) => {
                      i(...l), o(...l);
                  })
                : o && (n[r] = o)
            : r === 'style'
              ? (n[r] = { ...o, ...i })
              : r === 'className' && (n[r] = [o, i].filter(Boolean).join(' '));
    }
    return { ...e, ...n };
}
function I1(e) {
    var r, o;
    let t = (r = Object.getOwnPropertyDescriptor(e.props, 'ref')) == null ? void 0 : r.get,
        n = t && 'isReactWarning' in t && t.isReactWarning;
    return n
        ? e.ref
        : ((t = (o = Object.getOwnPropertyDescriptor(e, 'ref')) == null ? void 0 : o.get),
          (n = t && 'isReactWarning' in t && t.isReactWarning),
          n ? e.props.ref : e.props.ref || e.ref);
}
var M1 = ['a', 'button', 'div', 'form', 'h2', 'h3', 'img', 'input', 'label', 'li', 'nav', 'ol', 'p', 'span', 'svg', 'ul'],
    he = M1.reduce((e, t) => {
        const n = g.forwardRef((r, o) => {
            const { asChild: i, ...s } = r,
                l = i ? qo : t;
            return typeof window < 'u' && (window[Symbol.for('radix-ui')] = !0), E.jsx(l, { ...s, ref: o });
        });
        return (n.displayName = `Primitive.${t}`), { ...e, [t]: n };
    }, {});
function Um(e, t) {
    e && sl.flushSync(() => e.dispatchEvent(t));
}
var xn = globalThis != null && globalThis.document ? g.useLayoutEffect : () => {};
function L1(e, t) {
    return g.useReducer((n, r) => t[n][r] ?? n, e);
}
var Qt = (e) => {
    const { present: t, children: n } = e,
        r = F1(t),
        o = typeof n == 'function' ? n({ present: r.isPresent }) : g.Children.only(n),
        i = de(r.ref, j1(o));
    return typeof n == 'function' || r.isPresent ? g.cloneElement(o, { ref: i }) : null;
};
Qt.displayName = 'Presence';
function F1(e) {
    const [t, n] = g.useState(),
        r = g.useRef({}),
        o = g.useRef(e),
        i = g.useRef('none'),
        s = e ? 'mounted' : 'unmounted',
        [l, a] = L1(s, {
            mounted: { UNMOUNT: 'unmounted', ANIMATION_OUT: 'unmountSuspended' },
            unmountSuspended: { MOUNT: 'mounted', ANIMATION_END: 'unmounted' },
            unmounted: { MOUNT: 'mounted' },
        });
    return (
        g.useEffect(() => {
            const c = _i(r.current);
            i.current = l === 'mounted' ? c : 'none';
        }, [l]),
        xn(() => {
            const c = r.current,
                u = o.current;
            if (u !== e) {
                const d = i.current,
                    y = _i(c);
                e
                    ? a('MOUNT')
                    : y === 'none' || (c == null ? void 0 : c.display) === 'none'
                      ? a('UNMOUNT')
                      : a(u && d !== y ? 'ANIMATION_OUT' : 'UNMOUNT'),
                    (o.current = e);
            }
        }, [e, a]),
        xn(() => {
            if (t) {
                let c;
                const u = t.ownerDocument.defaultView ?? window,
                    f = (y) => {
                        const v = _i(r.current).includes(y.animationName);
                        if (y.target === t && v && (a('ANIMATION_END'), !o.current)) {
                            const S = t.style.animationFillMode;
                            (t.style.animationFillMode = 'forwards'),
                                (c = u.setTimeout(() => {
                                    t.style.animationFillMode === 'forwards' && (t.style.animationFillMode = S);
                                }));
                        }
                    },
                    d = (y) => {
                        y.target === t && (i.current = _i(r.current));
                    };
                return (
                    t.addEventListener('animationstart', d),
                    t.addEventListener('animationcancel', f),
                    t.addEventListener('animationend', f),
                    () => {
                        u.clearTimeout(c),
                            t.removeEventListener('animationstart', d),
                            t.removeEventListener('animationcancel', f),
                            t.removeEventListener('animationend', f);
                    }
                );
            } else a('ANIMATION_END');
        }, [t, a]),
        {
            isPresent: ['mounted', 'unmountSuspended'].includes(l),
            ref: g.useCallback((c) => {
                c && (r.current = getComputedStyle(c)), n(c);
            }, []),
        }
    );
}
function _i(e) {
    return (e == null ? void 0 : e.animationName) || 'none';
}
function j1(e) {
    var r, o;
    let t = (r = Object.getOwnPropertyDescriptor(e.props, 'ref')) == null ? void 0 : r.get,
        n = t && 'isReactWarning' in t && t.isReactWarning;
    return n
        ? e.ref
        : ((t = (o = Object.getOwnPropertyDescriptor(e, 'ref')) == null ? void 0 : o.get),
          (n = t && 'isReactWarning' in t && t.isReactWarning),
          n ? e.props.ref : e.props.ref || e.ref);
}
function $r(e, t = []) {
    let n = [];
    function r(i, s) {
        const l = g.createContext(s),
            a = n.length;
        n = [...n, s];
        const c = (f) => {
            var h;
            const { scope: d, children: y, ...m } = f,
                v = ((h = d == null ? void 0 : d[e]) == null ? void 0 : h[a]) || l,
                S = g.useMemo(() => m, Object.values(m));
            return E.jsx(v.Provider, { value: S, children: y });
        };
        c.displayName = i + 'Provider';
        function u(f, d) {
            var v;
            const y = ((v = d == null ? void 0 : d[e]) == null ? void 0 : v[a]) || l,
                m = g.useContext(y);
            if (m) return m;
            if (s !== void 0) return s;
            throw new Error(`\`${f}\` must be used within \`${i}\``);
        }
        return [c, u];
    }
    const o = () => {
        const i = n.map((s) => g.createContext(s));
        return function (l) {
            const a = (l == null ? void 0 : l[e]) || i;
            return g.useMemo(() => ({ [`__scope${e}`]: { ...l, [e]: a } }), [l, a]);
        };
    };
    return (o.scopeName = e), [r, z1(o, ...t)];
}
function z1(...e) {
    const t = e[0];
    if (e.length === 1) return t;
    const n = () => {
        const r = e.map((o) => ({ useScope: o(), scopeName: o.scopeName }));
        return function (i) {
            const s = r.reduce((l, { useScope: a, scopeName: c }) => {
                const f = a(i)[`__scope${c}`];
                return { ...l, ...f };
            }, {});
            return g.useMemo(() => ({ [`__scope${t.scopeName}`]: s }), [s]);
        };
    };
    return (n.scopeName = t.scopeName), n;
}
function ue(e) {
    const t = g.useRef(e);
    return (
        g.useEffect(() => {
            t.current = e;
        }),
        g.useMemo(
            () =>
                (...n) => {
                    var r;
                    return (r = t.current) == null ? void 0 : r.call(t, ...n);
                },
            [],
        )
    );
}
var U1 = g.createContext(void 0);
function Ku(e) {
    const t = g.useContext(U1);
    return e || t || 'ltr';
}
function B1(e, [t, n]) {
    return Math.min(n, Math.max(t, e));
}
function $(e, t, { checkForDefaultPrevented: n = !0 } = {}) {
    return function (o) {
        if ((e == null || e(o), n === !1 || !o.defaultPrevented)) return t == null ? void 0 : t(o);
    };
}
function $1(e, t) {
    return g.useReducer((n, r) => t[n][r] ?? n, e);
}
var Yu = 'ScrollArea',
    [Bm, rP] = $r(Yu),
    [H1, ut] = Bm(Yu),
    $m = g.forwardRef((e, t) => {
        const { __scopeScrollArea: n, type: r = 'hover', dir: o, scrollHideDelay: i = 600, ...s } = e,
            [l, a] = g.useState(null),
            [c, u] = g.useState(null),
            [f, d] = g.useState(null),
            [y, m] = g.useState(null),
            [v, S] = g.useState(null),
            [h, p] = g.useState(0),
            [w, C] = g.useState(0),
            [T, _] = g.useState(!1),
            [b, x] = g.useState(!1),
            R = de(t, (L) => a(L)),
            N = Ku(o);
        return E.jsx(H1, {
            scope: n,
            type: r,
            dir: N,
            scrollHideDelay: i,
            scrollArea: l,
            viewport: c,
            onViewportChange: u,
            content: f,
            onContentChange: d,
            scrollbarX: y,
            onScrollbarXChange: m,
            scrollbarXEnabled: T,
            onScrollbarXEnabledChange: _,
            scrollbarY: v,
            onScrollbarYChange: S,
            scrollbarYEnabled: b,
            onScrollbarYEnabledChange: x,
            onCornerWidthChange: p,
            onCornerHeightChange: C,
            children: E.jsx(he.div, {
                dir: N,
                ...s,
                ref: R,
                style: {
                    position: 'relative',
                    '--radix-scroll-area-corner-width': h + 'px',
                    '--radix-scroll-area-corner-height': w + 'px',
                    ...e.style,
                },
            }),
        });
    });
$m.displayName = Yu;
var Hm = 'ScrollAreaViewport',
    Wm = g.forwardRef((e, t) => {
        const { __scopeScrollArea: n, children: r, nonce: o, ...i } = e,
            s = ut(Hm, n),
            l = g.useRef(null),
            a = de(t, l, s.onViewportChange);
        return E.jsxs(E.Fragment, {
            children: [
                E.jsx('style', {
                    dangerouslySetInnerHTML: {
                        __html: '[data-radix-scroll-area-viewport]{scrollbar-width:none;-ms-overflow-style:none;-webkit-overflow-scrolling:touch;}[data-radix-scroll-area-viewport]::-webkit-scrollbar{display:none}',
                    },
                    nonce: o,
                }),
                E.jsx(he.div, {
                    'data-radix-scroll-area-viewport': '',
                    ...i,
                    ref: a,
                    style: {
                        overflowX: s.scrollbarXEnabled ? 'scroll' : 'hidden',
                        overflowY: s.scrollbarYEnabled ? 'scroll' : 'hidden',
                        ...e.style,
                    },
                    children: E.jsx('div', {
                        ref: s.onContentChange,
                        style: { minWidth: '100%', display: 'table' },
                        children: r,
                    }),
                }),
            ],
        });
    });
Wm.displayName = Hm;
var It = 'ScrollAreaScrollbar',
    Xu = g.forwardRef((e, t) => {
        const { forceMount: n, ...r } = e,
            o = ut(It, e.__scopeScrollArea),
            { onScrollbarXEnabledChange: i, onScrollbarYEnabledChange: s } = o,
            l = e.orientation === 'horizontal';
        return (
            g.useEffect(
                () => (
                    l ? i(!0) : s(!0),
                    () => {
                        l ? i(!1) : s(!1);
                    }
                ),
                [l, i, s],
            ),
            o.type === 'hover'
                ? E.jsx(W1, { ...r, ref: t, forceMount: n })
                : o.type === 'scroll'
                  ? E.jsx(V1, { ...r, ref: t, forceMount: n })
                  : o.type === 'auto'
                    ? E.jsx(Vm, { ...r, ref: t, forceMount: n })
                    : o.type === 'always'
                      ? E.jsx(Qu, { ...r, ref: t })
                      : null
        );
    });
Xu.displayName = It;
var W1 = g.forwardRef((e, t) => {
        const { forceMount: n, ...r } = e,
            o = ut(It, e.__scopeScrollArea),
            [i, s] = g.useState(!1);
        return (
            g.useEffect(() => {
                const l = o.scrollArea;
                let a = 0;
                if (l) {
                    const c = () => {
                            window.clearTimeout(a), s(!0);
                        },
                        u = () => {
                            a = window.setTimeout(() => s(!1), o.scrollHideDelay);
                        };
                    return (
                        l.addEventListener('pointerenter', c),
                        l.addEventListener('pointerleave', u),
                        () => {
                            window.clearTimeout(a),
                                l.removeEventListener('pointerenter', c),
                                l.removeEventListener('pointerleave', u);
                        }
                    );
                }
            }, [o.scrollArea, o.scrollHideDelay]),
            E.jsx(Qt, { present: n || i, children: E.jsx(Vm, { 'data-state': i ? 'visible' : 'hidden', ...r, ref: t }) })
        );
    }),
    V1 = g.forwardRef((e, t) => {
        const { forceMount: n, ...r } = e,
            o = ut(It, e.__scopeScrollArea),
            i = e.orientation === 'horizontal',
            s = wl(() => a('SCROLL_END'), 100),
            [l, a] = $1('hidden', {
                hidden: { SCROLL: 'scrolling' },
                scrolling: { SCROLL_END: 'idle', POINTER_ENTER: 'interacting' },
                interacting: { SCROLL: 'interacting', POINTER_LEAVE: 'idle' },
                idle: { HIDE: 'hidden', SCROLL: 'scrolling', POINTER_ENTER: 'interacting' },
            });
        return (
            g.useEffect(() => {
                if (l === 'idle') {
                    const c = window.setTimeout(() => a('HIDE'), o.scrollHideDelay);
                    return () => window.clearTimeout(c);
                }
            }, [l, o.scrollHideDelay, a]),
            g.useEffect(() => {
                const c = o.viewport,
                    u = i ? 'scrollLeft' : 'scrollTop';
                if (c) {
                    let f = c[u];
                    const d = () => {
                        const y = c[u];
                        f !== y && (a('SCROLL'), s()), (f = y);
                    };
                    return c.addEventListener('scroll', d), () => c.removeEventListener('scroll', d);
                }
            }, [o.viewport, i, a, s]),
            E.jsx(Qt, {
                present: n || l !== 'hidden',
                children: E.jsx(Qu, {
                    'data-state': l === 'hidden' ? 'hidden' : 'visible',
                    ...r,
                    ref: t,
                    onPointerEnter: $(e.onPointerEnter, () => a('POINTER_ENTER')),
                    onPointerLeave: $(e.onPointerLeave, () => a('POINTER_LEAVE')),
                }),
            })
        );
    }),
    Vm = g.forwardRef((e, t) => {
        const n = ut(It, e.__scopeScrollArea),
            { forceMount: r, ...o } = e,
            [i, s] = g.useState(!1),
            l = e.orientation === 'horizontal',
            a = wl(() => {
                if (n.viewport) {
                    const c = n.viewport.offsetWidth < n.viewport.scrollWidth,
                        u = n.viewport.offsetHeight < n.viewport.scrollHeight;
                    s(l ? c : u);
                }
            }, 10);
        return (
            Ir(n.viewport, a),
            Ir(n.content, a),
            E.jsx(Qt, { present: r || i, children: E.jsx(Qu, { 'data-state': i ? 'visible' : 'hidden', ...o, ref: t }) })
        );
    }),
    Qu = g.forwardRef((e, t) => {
        const { orientation: n = 'vertical', ...r } = e,
            o = ut(It, e.__scopeScrollArea),
            i = g.useRef(null),
            s = g.useRef(0),
            [l, a] = g.useState({ content: 0, viewport: 0, scrollbar: { size: 0, paddingStart: 0, paddingEnd: 0 } }),
            c = Xm(l.viewport, l.content),
            u = {
                ...r,
                sizes: l,
                onSizesChange: a,
                hasThumb: c > 0 && c < 1,
                onThumbChange: (d) => (i.current = d),
                onThumbPointerUp: () => (s.current = 0),
                onThumbPointerDown: (d) => (s.current = d),
            };
        function f(d, y) {
            return Q1(d, s.current, l, y);
        }
        return n === 'horizontal'
            ? E.jsx(q1, {
                  ...u,
                  ref: t,
                  onThumbPositionChange: () => {
                      if (o.viewport && i.current) {
                          const d = o.viewport.scrollLeft,
                              y = ch(d, l, o.dir);
                          i.current.style.transform = `translate3d(${y}px, 0, 0)`;
                      }
                  },
                  onWheelScroll: (d) => {
                      o.viewport && (o.viewport.scrollLeft = d);
                  },
                  onDragScroll: (d) => {
                      o.viewport && (o.viewport.scrollLeft = f(d, o.dir));
                  },
              })
            : n === 'vertical'
              ? E.jsx(G1, {
                    ...u,
                    ref: t,
                    onThumbPositionChange: () => {
                        if (o.viewport && i.current) {
                            const d = o.viewport.scrollTop,
                                y = ch(d, l);
                            i.current.style.transform = `translate3d(0, ${y}px, 0)`;
                        }
                    },
                    onWheelScroll: (d) => {
                        o.viewport && (o.viewport.scrollTop = d);
                    },
                    onDragScroll: (d) => {
                        o.viewport && (o.viewport.scrollTop = f(d));
                    },
                })
              : null;
    }),
    q1 = g.forwardRef((e, t) => {
        const { sizes: n, onSizesChange: r, ...o } = e,
            i = ut(It, e.__scopeScrollArea),
            [s, l] = g.useState(),
            a = g.useRef(null),
            c = de(t, a, i.onScrollbarXChange);
        return (
            g.useEffect(() => {
                a.current && l(getComputedStyle(a.current));
            }, [a]),
            E.jsx(Gm, {
                'data-orientation': 'horizontal',
                ...o,
                ref: c,
                sizes: n,
                style: {
                    bottom: 0,
                    left: i.dir === 'rtl' ? 'var(--radix-scroll-area-corner-width)' : 0,
                    right: i.dir === 'ltr' ? 'var(--radix-scroll-area-corner-width)' : 0,
                    '--radix-scroll-area-thumb-width': yl(n) + 'px',
                    ...e.style,
                },
                onThumbPointerDown: (u) => e.onThumbPointerDown(u.x),
                onDragScroll: (u) => e.onDragScroll(u.x),
                onWheelScroll: (u, f) => {
                    if (i.viewport) {
                        const d = i.viewport.scrollLeft + u.deltaX;
                        e.onWheelScroll(d), Jm(d, f) && u.preventDefault();
                    }
                },
                onResize: () => {
                    a.current &&
                        i.viewport &&
                        s &&
                        r({
                            content: i.viewport.scrollWidth,
                            viewport: i.viewport.offsetWidth,
                            scrollbar: {
                                size: a.current.clientWidth,
                                paddingStart: Ls(s.paddingLeft),
                                paddingEnd: Ls(s.paddingRight),
                            },
                        });
                },
            })
        );
    }),
    G1 = g.forwardRef((e, t) => {
        const { sizes: n, onSizesChange: r, ...o } = e,
            i = ut(It, e.__scopeScrollArea),
            [s, l] = g.useState(),
            a = g.useRef(null),
            c = de(t, a, i.onScrollbarYChange);
        return (
            g.useEffect(() => {
                a.current && l(getComputedStyle(a.current));
            }, [a]),
            E.jsx(Gm, {
                'data-orientation': 'vertical',
                ...o,
                ref: c,
                sizes: n,
                style: {
                    top: 0,
                    right: i.dir === 'ltr' ? 0 : void 0,
                    left: i.dir === 'rtl' ? 0 : void 0,
                    bottom: 'var(--radix-scroll-area-corner-height)',
                    '--radix-scroll-area-thumb-height': yl(n) + 'px',
                    ...e.style,
                },
                onThumbPointerDown: (u) => e.onThumbPointerDown(u.y),
                onDragScroll: (u) => e.onDragScroll(u.y),
                onWheelScroll: (u, f) => {
                    if (i.viewport) {
                        const d = i.viewport.scrollTop + u.deltaY;
                        e.onWheelScroll(d), Jm(d, f) && u.preventDefault();
                    }
                },
                onResize: () => {
                    a.current &&
                        i.viewport &&
                        s &&
                        r({
                            content: i.viewport.scrollHeight,
                            viewport: i.viewport.offsetHeight,
                            scrollbar: {
                                size: a.current.clientHeight,
                                paddingStart: Ls(s.paddingTop),
                                paddingEnd: Ls(s.paddingBottom),
                            },
                        });
                },
            })
        );
    }),
    [K1, qm] = Bm(It),
    Gm = g.forwardRef((e, t) => {
        const {
                __scopeScrollArea: n,
                sizes: r,
                hasThumb: o,
                onThumbChange: i,
                onThumbPointerUp: s,
                onThumbPointerDown: l,
                onThumbPositionChange: a,
                onDragScroll: c,
                onWheelScroll: u,
                onResize: f,
                ...d
            } = e,
            y = ut(It, n),
            [m, v] = g.useState(null),
            S = de(t, (R) => v(R)),
            h = g.useRef(null),
            p = g.useRef(''),
            w = y.viewport,
            C = r.content - r.viewport,
            T = ue(u),
            _ = ue(a),
            b = wl(f, 10);
        function x(R) {
            if (h.current) {
                const N = R.clientX - h.current.left,
                    L = R.clientY - h.current.top;
                c({ x: N, y: L });
            }
        }
        return (
            g.useEffect(() => {
                const R = (N) => {
                    const L = N.target;
                    (m == null ? void 0 : m.contains(L)) && T(N, C);
                };
                return (
                    document.addEventListener('wheel', R, { passive: !1 }),
                    () => document.removeEventListener('wheel', R, { passive: !1 })
                );
            }, [w, m, C, T]),
            g.useEffect(_, [r, _]),
            Ir(m, b),
            Ir(y.content, b),
            E.jsx(K1, {
                scope: n,
                scrollbar: m,
                hasThumb: o,
                onThumbChange: ue(i),
                onThumbPointerUp: ue(s),
                onThumbPositionChange: _,
                onThumbPointerDown: ue(l),
                children: E.jsx(he.div, {
                    ...d,
                    ref: S,
                    style: { position: 'absolute', ...d.style },
                    onPointerDown: $(e.onPointerDown, (R) => {
                        R.button === 0 &&
                            (R.target.setPointerCapture(R.pointerId),
                            (h.current = m.getBoundingClientRect()),
                            (p.current = document.body.style.webkitUserSelect),
                            (document.body.style.webkitUserSelect = 'none'),
                            y.viewport && (y.viewport.style.scrollBehavior = 'auto'),
                            x(R));
                    }),
                    onPointerMove: $(e.onPointerMove, x),
                    onPointerUp: $(e.onPointerUp, (R) => {
                        const N = R.target;
                        N.hasPointerCapture(R.pointerId) && N.releasePointerCapture(R.pointerId),
                            (document.body.style.webkitUserSelect = p.current),
                            y.viewport && (y.viewport.style.scrollBehavior = ''),
                            (h.current = null);
                    }),
                }),
            })
        );
    }),
    Ms = 'ScrollAreaThumb',
    Km = g.forwardRef((e, t) => {
        const { forceMount: n, ...r } = e,
            o = qm(Ms, e.__scopeScrollArea);
        return E.jsx(Qt, { present: n || o.hasThumb, children: E.jsx(Y1, { ref: t, ...r }) });
    }),
    Y1 = g.forwardRef((e, t) => {
        const { __scopeScrollArea: n, style: r, ...o } = e,
            i = ut(Ms, n),
            s = qm(Ms, n),
            { onThumbPositionChange: l } = s,
            a = de(t, (f) => s.onThumbChange(f)),
            c = g.useRef(void 0),
            u = wl(() => {
                c.current && (c.current(), (c.current = void 0));
            }, 100);
        return (
            g.useEffect(() => {
                const f = i.viewport;
                if (f) {
                    const d = () => {
                        if ((u(), !c.current)) {
                            const y = J1(f, l);
                            (c.current = y), l();
                        }
                    };
                    return l(), f.addEventListener('scroll', d), () => f.removeEventListener('scroll', d);
                }
            }, [i.viewport, u, l]),
            E.jsx(he.div, {
                'data-state': s.hasThumb ? 'visible' : 'hidden',
                ...o,
                ref: a,
                style: { width: 'var(--radix-scroll-area-thumb-width)', height: 'var(--radix-scroll-area-thumb-height)', ...r },
                onPointerDownCapture: $(e.onPointerDownCapture, (f) => {
                    const y = f.target.getBoundingClientRect(),
                        m = f.clientX - y.left,
                        v = f.clientY - y.top;
                    s.onThumbPointerDown({ x: m, y: v });
                }),
                onPointerUp: $(e.onPointerUp, s.onThumbPointerUp),
            })
        );
    });
Km.displayName = Ms;
var Ju = 'ScrollAreaCorner',
    Ym = g.forwardRef((e, t) => {
        const n = ut(Ju, e.__scopeScrollArea),
            r = !!(n.scrollbarX && n.scrollbarY);
        return n.type !== 'scroll' && r ? E.jsx(X1, { ...e, ref: t }) : null;
    });
Ym.displayName = Ju;
var X1 = g.forwardRef((e, t) => {
    const { __scopeScrollArea: n, ...r } = e,
        o = ut(Ju, n),
        [i, s] = g.useState(0),
        [l, a] = g.useState(0),
        c = !!(i && l);
    return (
        Ir(o.scrollbarX, () => {
            var f;
            const u = ((f = o.scrollbarX) == null ? void 0 : f.offsetHeight) || 0;
            o.onCornerHeightChange(u), a(u);
        }),
        Ir(o.scrollbarY, () => {
            var f;
            const u = ((f = o.scrollbarY) == null ? void 0 : f.offsetWidth) || 0;
            o.onCornerWidthChange(u), s(u);
        }),
        c
            ? E.jsx(he.div, {
                  ...r,
                  ref: t,
                  style: {
                      width: i,
                      height: l,
                      position: 'absolute',
                      right: o.dir === 'ltr' ? 0 : void 0,
                      left: o.dir === 'rtl' ? 0 : void 0,
                      bottom: 0,
                      ...e.style,
                  },
              })
            : null
    );
});
function Ls(e) {
    return e ? parseInt(e, 10) : 0;
}
function Xm(e, t) {
    const n = e / t;
    return isNaN(n) ? 0 : n;
}
function yl(e) {
    const t = Xm(e.viewport, e.content),
        n = e.scrollbar.paddingStart + e.scrollbar.paddingEnd,
        r = (e.scrollbar.size - n) * t;
    return Math.max(r, 18);
}
function Q1(e, t, n, r = 'ltr') {
    const o = yl(n),
        i = o / 2,
        s = t || i,
        l = o - s,
        a = n.scrollbar.paddingStart + s,
        c = n.scrollbar.size - n.scrollbar.paddingEnd - l,
        u = n.content - n.viewport,
        f = r === 'ltr' ? [0, u] : [u * -1, 0];
    return Qm([a, c], f)(e);
}
function ch(e, t, n = 'ltr') {
    const r = yl(t),
        o = t.scrollbar.paddingStart + t.scrollbar.paddingEnd,
        i = t.scrollbar.size - o,
        s = t.content - t.viewport,
        l = i - r,
        a = n === 'ltr' ? [0, s] : [s * -1, 0],
        c = B1(e, a);
    return Qm([0, s], [0, l])(c);
}
function Qm(e, t) {
    return (n) => {
        if (e[0] === e[1] || t[0] === t[1]) return t[0];
        const r = (t[1] - t[0]) / (e[1] - e[0]);
        return t[0] + r * (n - e[0]);
    };
}
function Jm(e, t) {
    return e > 0 && e < t;
}
var J1 = (e, t = () => {}) => {
    let n = { left: e.scrollLeft, top: e.scrollTop },
        r = 0;
    return (
        (function o() {
            const i = { left: e.scrollLeft, top: e.scrollTop },
                s = n.left !== i.left,
                l = n.top !== i.top;
            (s || l) && t(), (n = i), (r = window.requestAnimationFrame(o));
        })(),
        () => window.cancelAnimationFrame(r)
    );
};
function wl(e, t) {
    const n = ue(e),
        r = g.useRef(0);
    return (
        g.useEffect(() => () => window.clearTimeout(r.current), []),
        g.useCallback(() => {
            window.clearTimeout(r.current), (r.current = window.setTimeout(n, t));
        }, [n, t])
    );
}
function Ir(e, t) {
    const n = ue(t);
    xn(() => {
        let r = 0;
        if (e) {
            const o = new ResizeObserver(() => {
                cancelAnimationFrame(r), (r = window.requestAnimationFrame(n));
            });
            return (
                o.observe(e),
                () => {
                    window.cancelAnimationFrame(r), o.unobserve(e);
                }
            );
        }
    }, [e, n]);
}
var Zm = $m,
    Z1 = Wm,
    eb = Ym;
function ev(e) {
    var t,
        n,
        r = '';
    if (typeof e == 'string' || typeof e == 'number') r += e;
    else if (typeof e == 'object')
        if (Array.isArray(e)) {
            var o = e.length;
            for (t = 0; t < o; t++) e[t] && (n = ev(e[t])) && (r && (r += ' '), (r += n));
        } else for (n in e) e[n] && (r && (r += ' '), (r += n));
    return r;
}
function tb() {
    for (var e, t, n = 0, r = '', o = arguments.length; n < o; n++)
        (e = arguments[n]) && (t = ev(e)) && (r && (r += ' '), (r += t));
    return r;
}
const Zu = '-',
    nb = (e) => {
        const t = ob(e),
            { conflictingClassGroups: n, conflictingClassGroupModifiers: r } = e;
        return {
            getClassGroupId: (s) => {
                const l = s.split(Zu);
                return l[0] === '' && l.length !== 1 && l.shift(), tv(l, t) || rb(s);
            },
            getConflictingClassGroupIds: (s, l) => {
                const a = n[s] || [];
                return l && r[s] ? [...a, ...r[s]] : a;
            },
        };
    },
    tv = (e, t) => {
        var s;
        if (e.length === 0) return t.classGroupId;
        const n = e[0],
            r = t.nextPart.get(n),
            o = r ? tv(e.slice(1), r) : void 0;
        if (o) return o;
        if (t.validators.length === 0) return;
        const i = e.join(Zu);
        return (s = t.validators.find(({ validator: l }) => l(i))) == null ? void 0 : s.classGroupId;
    },
    uh = /^\[(.+)\]$/,
    rb = (e) => {
        if (uh.test(e)) {
            const t = uh.exec(e)[1],
                n = t == null ? void 0 : t.substring(0, t.indexOf(':'));
            if (n) return 'arbitrary..' + n;
        }
    },
    ob = (e) => {
        const { theme: t, prefix: n } = e,
            r = { nextPart: new Map(), validators: [] };
        return (
            sb(Object.entries(e.classGroups), n).forEach(([i, s]) => {
                _c(s, r, i, t);
            }),
            r
        );
    },
    _c = (e, t, n, r) => {
        e.forEach((o) => {
            if (typeof o == 'string') {
                const i = o === '' ? t : fh(t, o);
                i.classGroupId = n;
                return;
            }
            if (typeof o == 'function') {
                if (ib(o)) {
                    _c(o(r), t, n, r);
                    return;
                }
                t.validators.push({ validator: o, classGroupId: n });
                return;
            }
            Object.entries(o).forEach(([i, s]) => {
                _c(s, fh(t, i), n, r);
            });
        });
    },
    fh = (e, t) => {
        let n = e;
        return (
            t.split(Zu).forEach((r) => {
                n.nextPart.has(r) || n.nextPart.set(r, { nextPart: new Map(), validators: [] }), (n = n.nextPart.get(r));
            }),
            n
        );
    },
    ib = (e) => e.isThemeGetter,
    sb = (e, t) =>
        t
            ? e.map(([n, r]) => {
                  const o = r.map((i) =>
                      typeof i == 'string'
                          ? t + i
                          : typeof i == 'object'
                            ? Object.fromEntries(Object.entries(i).map(([s, l]) => [t + s, l]))
                            : i,
                  );
                  return [n, o];
              })
            : e,
    lb = (e) => {
        if (e < 1) return { get: () => {}, set: () => {} };
        let t = 0,
            n = new Map(),
            r = new Map();
        const o = (i, s) => {
            n.set(i, s), t++, t > e && ((t = 0), (r = n), (n = new Map()));
        };
        return {
            get(i) {
                let s = n.get(i);
                if (s !== void 0) return s;
                if ((s = r.get(i)) !== void 0) return o(i, s), s;
            },
            set(i, s) {
                n.has(i) ? n.set(i, s) : o(i, s);
            },
        };
    },
    nv = '!',
    ab = (e) => {
        const { separator: t, experimentalParseClassName: n } = e,
            r = t.length === 1,
            o = t[0],
            i = t.length,
            s = (l) => {
                const a = [];
                let c = 0,
                    u = 0,
                    f;
                for (let S = 0; S < l.length; S++) {
                    let h = l[S];
                    if (c === 0) {
                        if (h === o && (r || l.slice(S, S + i) === t)) {
                            a.push(l.slice(u, S)), (u = S + i);
                            continue;
                        }
                        if (h === '/') {
                            f = S;
                            continue;
                        }
                    }
                    h === '[' ? c++ : h === ']' && c--;
                }
                const d = a.length === 0 ? l : l.substring(u),
                    y = d.startsWith(nv),
                    m = y ? d.substring(1) : d,
                    v = f && f > u ? f - u : void 0;
                return { modifiers: a, hasImportantModifier: y, baseClassName: m, maybePostfixModifierPosition: v };
            };
        return n ? (l) => n({ className: l, parseClassName: s }) : s;
    },
    cb = (e) => {
        if (e.length <= 1) return e;
        const t = [];
        let n = [];
        return (
            e.forEach((r) => {
                r[0] === '[' ? (t.push(...n.sort(), r), (n = [])) : n.push(r);
            }),
            t.push(...n.sort()),
            t
        );
    },
    ub = (e) => ({ cache: lb(e.cacheSize), parseClassName: ab(e), ...nb(e) }),
    fb = /\s+/,
    db = (e, t) => {
        const { parseClassName: n, getClassGroupId: r, getConflictingClassGroupIds: o } = t,
            i = [],
            s = e.trim().split(fb);
        let l = '';
        for (let a = s.length - 1; a >= 0; a -= 1) {
            const c = s[a],
                { modifiers: u, hasImportantModifier: f, baseClassName: d, maybePostfixModifierPosition: y } = n(c);
            let m = !!y,
                v = r(m ? d.substring(0, y) : d);
            if (!v) {
                if (!m) {
                    l = c + (l.length > 0 ? ' ' + l : l);
                    continue;
                }
                if (((v = r(d)), !v)) {
                    l = c + (l.length > 0 ? ' ' + l : l);
                    continue;
                }
                m = !1;
            }
            const S = cb(u).join(':'),
                h = f ? S + nv : S,
                p = h + v;
            if (i.includes(p)) continue;
            i.push(p);
            const w = o(v, m);
            for (let C = 0; C < w.length; ++C) {
                const T = w[C];
                i.push(h + T);
            }
            l = c + (l.length > 0 ? ' ' + l : l);
        }
        return l;
    };
function hb() {
    let e = 0,
        t,
        n,
        r = '';
    for (; e < arguments.length; ) (t = arguments[e++]) && (n = rv(t)) && (r && (r += ' '), (r += n));
    return r;
}
const rv = (e) => {
    if (typeof e == 'string') return e;
    let t,
        n = '';
    for (let r = 0; r < e.length; r++) e[r] && (t = rv(e[r])) && (n && (n += ' '), (n += t));
    return n;
};
function pb(e, ...t) {
    let n,
        r,
        o,
        i = s;
    function s(a) {
        const c = t.reduce((u, f) => f(u), e());
        return (n = ub(c)), (r = n.cache.get), (o = n.cache.set), (i = l), l(a);
    }
    function l(a) {
        const c = r(a);
        if (c) return c;
        const u = db(a, n);
        return o(a, u), u;
    }
    return function () {
        return i(hb.apply(null, arguments));
    };
}
const Z = (e) => {
        const t = (n) => n[e] || [];
        return (t.isThemeGetter = !0), t;
    },
    ov = /^\[(?:([a-z-]+):)?(.+)\]$/i,
    gb = /^\d+\/\d+$/,
    mb = new Set(['px', 'full', 'screen']),
    vb = /^(\d+(\.\d+)?)?(xs|sm|md|lg|xl)$/,
    yb =
        /\d+(%|px|r?em|[sdl]?v([hwib]|min|max)|pt|pc|in|cm|mm|cap|ch|ex|r?lh|cq(w|h|i|b|min|max))|\b(calc|min|max|clamp)\(.+\)|^0$/,
    wb = /^(rgba?|hsla?|hwb|(ok)?(lab|lch))\(.+\)$/,
    Sb = /^(inset_)?-?((\d+)?\.?(\d+)[a-z]+|0)_-?((\d+)?\.?(\d+)[a-z]+|0)/,
    Eb = /^(url|image|image-set|cross-fade|element|(repeating-)?(linear|radial|conic)-gradient)\(.+\)$/,
    Ft = (e) => Cr(e) || mb.has(e) || gb.test(e),
    en = (e) => Hr(e, 'length', Ob),
    Cr = (e) => !!e && !Number.isNaN(Number(e)),
    aa = (e) => Hr(e, 'number', Cr),
    so = (e) => !!e && Number.isInteger(Number(e)),
    xb = (e) => e.endsWith('%') && Cr(e.slice(0, -1)),
    H = (e) => ov.test(e),
    tn = (e) => vb.test(e),
    Cb = new Set(['length', 'size', 'percentage']),
    bb = (e) => Hr(e, Cb, iv),
    Tb = (e) => Hr(e, 'position', iv),
    kb = new Set(['image', 'url']),
    Rb = (e) => Hr(e, kb, Nb),
    _b = (e) => Hr(e, '', Pb),
    lo = () => !0,
    Hr = (e, t, n) => {
        const r = ov.exec(e);
        return r ? (r[1] ? (typeof t == 'string' ? r[1] === t : t.has(r[1])) : n(r[2])) : !1;
    },
    Ob = (e) => yb.test(e) && !wb.test(e),
    iv = () => !1,
    Pb = (e) => Sb.test(e),
    Nb = (e) => Eb.test(e),
    Db = () => {
        const e = Z('colors'),
            t = Z('spacing'),
            n = Z('blur'),
            r = Z('brightness'),
            o = Z('borderColor'),
            i = Z('borderRadius'),
            s = Z('borderSpacing'),
            l = Z('borderWidth'),
            a = Z('contrast'),
            c = Z('grayscale'),
            u = Z('hueRotate'),
            f = Z('invert'),
            d = Z('gap'),
            y = Z('gradientColorStops'),
            m = Z('gradientColorStopPositions'),
            v = Z('inset'),
            S = Z('margin'),
            h = Z('opacity'),
            p = Z('padding'),
            w = Z('saturate'),
            C = Z('scale'),
            T = Z('sepia'),
            _ = Z('skew'),
            b = Z('space'),
            x = Z('translate'),
            R = () => ['auto', 'contain', 'none'],
            N = () => ['auto', 'hidden', 'clip', 'visible', 'scroll'],
            L = () => ['auto', H, t],
            I = () => [H, t],
            z = () => ['', Ft, en],
            j = () => ['auto', Cr, H],
            le = () => ['bottom', 'center', 'left', 'left-bottom', 'left-top', 'right', 'right-bottom', 'right-top', 'top'],
            W = () => ['solid', 'dashed', 'dotted', 'double', 'none'],
            Q = () => [
                'normal',
                'multiply',
                'screen',
                'overlay',
                'darken',
                'lighten',
                'color-dodge',
                'color-burn',
                'hard-light',
                'soft-light',
                'difference',
                'exclusion',
                'hue',
                'saturation',
                'color',
                'luminosity',
            ],
            O = () => ['start', 'end', 'center', 'between', 'around', 'evenly', 'stretch'],
            P = () => ['', '0', H],
            M = () => ['auto', 'avoid', 'all', 'avoid-page', 'page', 'left', 'right', 'column'],
            F = () => [Cr, H];
        return {
            cacheSize: 500,
            separator: ':',
            theme: {
                colors: [lo],
                spacing: [Ft, en],
                blur: ['none', '', tn, H],
                brightness: F(),
                borderColor: [e],
                borderRadius: ['none', '', 'full', tn, H],
                borderSpacing: I(),
                borderWidth: z(),
                contrast: F(),
                grayscale: P(),
                hueRotate: F(),
                invert: P(),
                gap: I(),
                gradientColorStops: [e],
                gradientColorStopPositions: [xb, en],
                inset: L(),
                margin: L(),
                opacity: F(),
                padding: I(),
                saturate: F(),
                scale: F(),
                sepia: P(),
                skew: F(),
                space: I(),
                translate: I(),
            },
            classGroups: {
                aspect: [{ aspect: ['auto', 'square', 'video', H] }],
                container: ['container'],
                columns: [{ columns: [tn] }],
                'break-after': [{ 'break-after': M() }],
                'break-before': [{ 'break-before': M() }],
                'break-inside': [{ 'break-inside': ['auto', 'avoid', 'avoid-page', 'avoid-column'] }],
                'box-decoration': [{ 'box-decoration': ['slice', 'clone'] }],
                box: [{ box: ['border', 'content'] }],
                display: [
                    'block',
                    'inline-block',
                    'inline',
                    'flex',
                    'inline-flex',
                    'table',
                    'inline-table',
                    'table-caption',
                    'table-cell',
                    'table-column',
                    'table-column-group',
                    'table-footer-group',
                    'table-header-group',
                    'table-row-group',
                    'table-row',
                    'flow-root',
                    'grid',
                    'inline-grid',
                    'contents',
                    'list-item',
                    'hidden',
                ],
                float: [{ float: ['right', 'left', 'none', 'start', 'end'] }],
                clear: [{ clear: ['left', 'right', 'both', 'none', 'start', 'end'] }],
                isolation: ['isolate', 'isolation-auto'],
                'object-fit': [{ object: ['contain', 'cover', 'fill', 'none', 'scale-down'] }],
                'object-position': [{ object: [...le(), H] }],
                overflow: [{ overflow: N() }],
                'overflow-x': [{ 'overflow-x': N() }],
                'overflow-y': [{ 'overflow-y': N() }],
                overscroll: [{ overscroll: R() }],
                'overscroll-x': [{ 'overscroll-x': R() }],
                'overscroll-y': [{ 'overscroll-y': R() }],
                position: ['static', 'fixed', 'absolute', 'relative', 'sticky'],
                inset: [{ inset: [v] }],
                'inset-x': [{ 'inset-x': [v] }],
                'inset-y': [{ 'inset-y': [v] }],
                start: [{ start: [v] }],
                end: [{ end: [v] }],
                top: [{ top: [v] }],
                right: [{ right: [v] }],
                bottom: [{ bottom: [v] }],
                left: [{ left: [v] }],
                visibility: ['visible', 'invisible', 'collapse'],
                z: [{ z: ['auto', so, H] }],
                basis: [{ basis: L() }],
                'flex-direction': [{ flex: ['row', 'row-reverse', 'col', 'col-reverse'] }],
                'flex-wrap': [{ flex: ['wrap', 'wrap-reverse', 'nowrap'] }],
                flex: [{ flex: ['1', 'auto', 'initial', 'none', H] }],
                grow: [{ grow: P() }],
                shrink: [{ shrink: P() }],
                order: [{ order: ['first', 'last', 'none', so, H] }],
                'grid-cols': [{ 'grid-cols': [lo] }],
                'col-start-end': [{ col: ['auto', { span: ['full', so, H] }, H] }],
                'col-start': [{ 'col-start': j() }],
                'col-end': [{ 'col-end': j() }],
                'grid-rows': [{ 'grid-rows': [lo] }],
                'row-start-end': [{ row: ['auto', { span: [so, H] }, H] }],
                'row-start': [{ 'row-start': j() }],
                'row-end': [{ 'row-end': j() }],
                'grid-flow': [{ 'grid-flow': ['row', 'col', 'dense', 'row-dense', 'col-dense'] }],
                'auto-cols': [{ 'auto-cols': ['auto', 'min', 'max', 'fr', H] }],
                'auto-rows': [{ 'auto-rows': ['auto', 'min', 'max', 'fr', H] }],
                gap: [{ gap: [d] }],
                'gap-x': [{ 'gap-x': [d] }],
                'gap-y': [{ 'gap-y': [d] }],
                'justify-content': [{ justify: ['normal', ...O()] }],
                'justify-items': [{ 'justify-items': ['start', 'end', 'center', 'stretch'] }],
                'justify-self': [{ 'justify-self': ['auto', 'start', 'end', 'center', 'stretch'] }],
                'align-content': [{ content: ['normal', ...O(), 'baseline'] }],
                'align-items': [{ items: ['start', 'end', 'center', 'baseline', 'stretch'] }],
                'align-self': [{ self: ['auto', 'start', 'end', 'center', 'stretch', 'baseline'] }],
                'place-content': [{ 'place-content': [...O(), 'baseline'] }],
                'place-items': [{ 'place-items': ['start', 'end', 'center', 'baseline', 'stretch'] }],
                'place-self': [{ 'place-self': ['auto', 'start', 'end', 'center', 'stretch'] }],
                p: [{ p: [p] }],
                px: [{ px: [p] }],
                py: [{ py: [p] }],
                ps: [{ ps: [p] }],
                pe: [{ pe: [p] }],
                pt: [{ pt: [p] }],
                pr: [{ pr: [p] }],
                pb: [{ pb: [p] }],
                pl: [{ pl: [p] }],
                m: [{ m: [S] }],
                mx: [{ mx: [S] }],
                my: [{ my: [S] }],
                ms: [{ ms: [S] }],
                me: [{ me: [S] }],
                mt: [{ mt: [S] }],
                mr: [{ mr: [S] }],
                mb: [{ mb: [S] }],
                ml: [{ ml: [S] }],
                'space-x': [{ 'space-x': [b] }],
                'space-x-reverse': ['space-x-reverse'],
                'space-y': [{ 'space-y': [b] }],
                'space-y-reverse': ['space-y-reverse'],
                w: [{ w: ['auto', 'min', 'max', 'fit', 'svw', 'lvw', 'dvw', H, t] }],
                'min-w': [{ 'min-w': [H, t, 'min', 'max', 'fit'] }],
                'max-w': [{ 'max-w': [H, t, 'none', 'full', 'min', 'max', 'fit', 'prose', { screen: [tn] }, tn] }],
                h: [{ h: [H, t, 'auto', 'min', 'max', 'fit', 'svh', 'lvh', 'dvh'] }],
                'min-h': [{ 'min-h': [H, t, 'min', 'max', 'fit', 'svh', 'lvh', 'dvh'] }],
                'max-h': [{ 'max-h': [H, t, 'min', 'max', 'fit', 'svh', 'lvh', 'dvh'] }],
                size: [{ size: [H, t, 'auto', 'min', 'max', 'fit'] }],
                'font-size': [{ text: ['base', tn, en] }],
                'font-smoothing': ['antialiased', 'subpixel-antialiased'],
                'font-style': ['italic', 'not-italic'],
                'font-weight': [
                    { font: ['thin', 'extralight', 'light', 'normal', 'medium', 'semibold', 'bold', 'extrabold', 'black', aa] },
                ],
                'font-family': [{ font: [lo] }],
                'fvn-normal': ['normal-nums'],
                'fvn-ordinal': ['ordinal'],
                'fvn-slashed-zero': ['slashed-zero'],
                'fvn-figure': ['lining-nums', 'oldstyle-nums'],
                'fvn-spacing': ['proportional-nums', 'tabular-nums'],
                'fvn-fraction': ['diagonal-fractions', 'stacked-fractions'],
                tracking: [{ tracking: ['tighter', 'tight', 'normal', 'wide', 'wider', 'widest', H] }],
                'line-clamp': [{ 'line-clamp': ['none', Cr, aa] }],
                leading: [{ leading: ['none', 'tight', 'snug', 'normal', 'relaxed', 'loose', Ft, H] }],
                'list-image': [{ 'list-image': ['none', H] }],
                'list-style-type': [{ list: ['none', 'disc', 'decimal', H] }],
                'list-style-position': [{ list: ['inside', 'outside'] }],
                'placeholder-color': [{ placeholder: [e] }],
                'placeholder-opacity': [{ 'placeholder-opacity': [h] }],
                'text-alignment': [{ text: ['left', 'center', 'right', 'justify', 'start', 'end'] }],
                'text-color': [{ text: [e] }],
                'text-opacity': [{ 'text-opacity': [h] }],
                'text-decoration': ['underline', 'overline', 'line-through', 'no-underline'],
                'text-decoration-style': [{ decoration: [...W(), 'wavy'] }],
                'text-decoration-thickness': [{ decoration: ['auto', 'from-font', Ft, en] }],
                'underline-offset': [{ 'underline-offset': ['auto', Ft, H] }],
                'text-decoration-color': [{ decoration: [e] }],
                'text-transform': ['uppercase', 'lowercase', 'capitalize', 'normal-case'],
                'text-overflow': ['truncate', 'text-ellipsis', 'text-clip'],
                'text-wrap': [{ text: ['wrap', 'nowrap', 'balance', 'pretty'] }],
                indent: [{ indent: I() }],
                'vertical-align': [
                    { align: ['baseline', 'top', 'middle', 'bottom', 'text-top', 'text-bottom', 'sub', 'super', H] },
                ],
                whitespace: [{ whitespace: ['normal', 'nowrap', 'pre', 'pre-line', 'pre-wrap', 'break-spaces'] }],
                break: [{ break: ['normal', 'words', 'all', 'keep'] }],
                hyphens: [{ hyphens: ['none', 'manual', 'auto'] }],
                content: [{ content: ['none', H] }],
                'bg-attachment': [{ bg: ['fixed', 'local', 'scroll'] }],
                'bg-clip': [{ 'bg-clip': ['border', 'padding', 'content', 'text'] }],
                'bg-opacity': [{ 'bg-opacity': [h] }],
                'bg-origin': [{ 'bg-origin': ['border', 'padding', 'content'] }],
                'bg-position': [{ bg: [...le(), Tb] }],
                'bg-repeat': [{ bg: ['no-repeat', { repeat: ['', 'x', 'y', 'round', 'space'] }] }],
                'bg-size': [{ bg: ['auto', 'cover', 'contain', bb] }],
                'bg-image': [{ bg: ['none', { 'gradient-to': ['t', 'tr', 'r', 'br', 'b', 'bl', 'l', 'tl'] }, Rb] }],
                'bg-color': [{ bg: [e] }],
                'gradient-from-pos': [{ from: [m] }],
                'gradient-via-pos': [{ via: [m] }],
                'gradient-to-pos': [{ to: [m] }],
                'gradient-from': [{ from: [y] }],
                'gradient-via': [{ via: [y] }],
                'gradient-to': [{ to: [y] }],
                rounded: [{ rounded: [i] }],
                'rounded-s': [{ 'rounded-s': [i] }],
                'rounded-e': [{ 'rounded-e': [i] }],
                'rounded-t': [{ 'rounded-t': [i] }],
                'rounded-r': [{ 'rounded-r': [i] }],
                'rounded-b': [{ 'rounded-b': [i] }],
                'rounded-l': [{ 'rounded-l': [i] }],
                'rounded-ss': [{ 'rounded-ss': [i] }],
                'rounded-se': [{ 'rounded-se': [i] }],
                'rounded-ee': [{ 'rounded-ee': [i] }],
                'rounded-es': [{ 'rounded-es': [i] }],
                'rounded-tl': [{ 'rounded-tl': [i] }],
                'rounded-tr': [{ 'rounded-tr': [i] }],
                'rounded-br': [{ 'rounded-br': [i] }],
                'rounded-bl': [{ 'rounded-bl': [i] }],
                'border-w': [{ border: [l] }],
                'border-w-x': [{ 'border-x': [l] }],
                'border-w-y': [{ 'border-y': [l] }],
                'border-w-s': [{ 'border-s': [l] }],
                'border-w-e': [{ 'border-e': [l] }],
                'border-w-t': [{ 'border-t': [l] }],
                'border-w-r': [{ 'border-r': [l] }],
                'border-w-b': [{ 'border-b': [l] }],
                'border-w-l': [{ 'border-l': [l] }],
                'border-opacity': [{ 'border-opacity': [h] }],
                'border-style': [{ border: [...W(), 'hidden'] }],
                'divide-x': [{ 'divide-x': [l] }],
                'divide-x-reverse': ['divide-x-reverse'],
                'divide-y': [{ 'divide-y': [l] }],
                'divide-y-reverse': ['divide-y-reverse'],
                'divide-opacity': [{ 'divide-opacity': [h] }],
                'divide-style': [{ divide: W() }],
                'border-color': [{ border: [o] }],
                'border-color-x': [{ 'border-x': [o] }],
                'border-color-y': [{ 'border-y': [o] }],
                'border-color-s': [{ 'border-s': [o] }],
                'border-color-e': [{ 'border-e': [o] }],
                'border-color-t': [{ 'border-t': [o] }],
                'border-color-r': [{ 'border-r': [o] }],
                'border-color-b': [{ 'border-b': [o] }],
                'border-color-l': [{ 'border-l': [o] }],
                'divide-color': [{ divide: [o] }],
                'outline-style': [{ outline: ['', ...W()] }],
                'outline-offset': [{ 'outline-offset': [Ft, H] }],
                'outline-w': [{ outline: [Ft, en] }],
                'outline-color': [{ outline: [e] }],
                'ring-w': [{ ring: z() }],
                'ring-w-inset': ['ring-inset'],
                'ring-color': [{ ring: [e] }],
                'ring-opacity': [{ 'ring-opacity': [h] }],
                'ring-offset-w': [{ 'ring-offset': [Ft, en] }],
                'ring-offset-color': [{ 'ring-offset': [e] }],
                shadow: [{ shadow: ['', 'inner', 'none', tn, _b] }],
                'shadow-color': [{ shadow: [lo] }],
                opacity: [{ opacity: [h] }],
                'mix-blend': [{ 'mix-blend': [...Q(), 'plus-lighter', 'plus-darker'] }],
                'bg-blend': [{ 'bg-blend': Q() }],
                filter: [{ filter: ['', 'none'] }],
                blur: [{ blur: [n] }],
                brightness: [{ brightness: [r] }],
                contrast: [{ contrast: [a] }],
                'drop-shadow': [{ 'drop-shadow': ['', 'none', tn, H] }],
                grayscale: [{ grayscale: [c] }],
                'hue-rotate': [{ 'hue-rotate': [u] }],
                invert: [{ invert: [f] }],
                saturate: [{ saturate: [w] }],
                sepia: [{ sepia: [T] }],
                'backdrop-filter': [{ 'backdrop-filter': ['', 'none'] }],
                'backdrop-blur': [{ 'backdrop-blur': [n] }],
                'backdrop-brightness': [{ 'backdrop-brightness': [r] }],
                'backdrop-contrast': [{ 'backdrop-contrast': [a] }],
                'backdrop-grayscale': [{ 'backdrop-grayscale': [c] }],
                'backdrop-hue-rotate': [{ 'backdrop-hue-rotate': [u] }],
                'backdrop-invert': [{ 'backdrop-invert': [f] }],
                'backdrop-opacity': [{ 'backdrop-opacity': [h] }],
                'backdrop-saturate': [{ 'backdrop-saturate': [w] }],
                'backdrop-sepia': [{ 'backdrop-sepia': [T] }],
                'border-collapse': [{ border: ['collapse', 'separate'] }],
                'border-spacing': [{ 'border-spacing': [s] }],
                'border-spacing-x': [{ 'border-spacing-x': [s] }],
                'border-spacing-y': [{ 'border-spacing-y': [s] }],
                'table-layout': [{ table: ['auto', 'fixed'] }],
                caption: [{ caption: ['top', 'bottom'] }],
                transition: [{ transition: ['none', 'all', '', 'colors', 'opacity', 'shadow', 'transform', H] }],
                duration: [{ duration: F() }],
                ease: [{ ease: ['linear', 'in', 'out', 'in-out', H] }],
                delay: [{ delay: F() }],
                animate: [{ animate: ['none', 'spin', 'ping', 'pulse', 'bounce', H] }],
                transform: [{ transform: ['', 'gpu', 'none'] }],
                scale: [{ scale: [C] }],
                'scale-x': [{ 'scale-x': [C] }],
                'scale-y': [{ 'scale-y': [C] }],
                rotate: [{ rotate: [so, H] }],
                'translate-x': [{ 'translate-x': [x] }],
                'translate-y': [{ 'translate-y': [x] }],
                'skew-x': [{ 'skew-x': [_] }],
                'skew-y': [{ 'skew-y': [_] }],
                'transform-origin': [
                    {
                        origin: [
                            'center',
                            'top',
                            'top-right',
                            'right',
                            'bottom-right',
                            'bottom',
                            'bottom-left',
                            'left',
                            'top-left',
                            H,
                        ],
                    },
                ],
                accent: [{ accent: ['auto', e] }],
                appearance: [{ appearance: ['none', 'auto'] }],
                cursor: [
                    {
                        cursor: [
                            'auto',
                            'default',
                            'pointer',
                            'wait',
                            'text',
                            'move',
                            'help',
                            'not-allowed',
                            'none',
                            'context-menu',
                            'progress',
                            'cell',
                            'crosshair',
                            'vertical-text',
                            'alias',
                            'copy',
                            'no-drop',
                            'grab',
                            'grabbing',
                            'all-scroll',
                            'col-resize',
                            'row-resize',
                            'n-resize',
                            'e-resize',
                            's-resize',
                            'w-resize',
                            'ne-resize',
                            'nw-resize',
                            'se-resize',
                            'sw-resize',
                            'ew-resize',
                            'ns-resize',
                            'nesw-resize',
                            'nwse-resize',
                            'zoom-in',
                            'zoom-out',
                            H,
                        ],
                    },
                ],
                'caret-color': [{ caret: [e] }],
                'pointer-events': [{ 'pointer-events': ['none', 'auto'] }],
                resize: [{ resize: ['none', 'y', 'x', ''] }],
                'scroll-behavior': [{ scroll: ['auto', 'smooth'] }],
                'scroll-m': [{ 'scroll-m': I() }],
                'scroll-mx': [{ 'scroll-mx': I() }],
                'scroll-my': [{ 'scroll-my': I() }],
                'scroll-ms': [{ 'scroll-ms': I() }],
                'scroll-me': [{ 'scroll-me': I() }],
                'scroll-mt': [{ 'scroll-mt': I() }],
                'scroll-mr': [{ 'scroll-mr': I() }],
                'scroll-mb': [{ 'scroll-mb': I() }],
                'scroll-ml': [{ 'scroll-ml': I() }],
                'scroll-p': [{ 'scroll-p': I() }],
                'scroll-px': [{ 'scroll-px': I() }],
                'scroll-py': [{ 'scroll-py': I() }],
                'scroll-ps': [{ 'scroll-ps': I() }],
                'scroll-pe': [{ 'scroll-pe': I() }],
                'scroll-pt': [{ 'scroll-pt': I() }],
                'scroll-pr': [{ 'scroll-pr': I() }],
                'scroll-pb': [{ 'scroll-pb': I() }],
                'scroll-pl': [{ 'scroll-pl': I() }],
                'snap-align': [{ snap: ['start', 'end', 'center', 'align-none'] }],
                'snap-stop': [{ snap: ['normal', 'always'] }],
                'snap-type': [{ snap: ['none', 'x', 'y', 'both'] }],
                'snap-strictness': [{ snap: ['mandatory', 'proximity'] }],
                touch: [{ touch: ['auto', 'none', 'manipulation'] }],
                'touch-x': [{ 'touch-pan': ['x', 'left', 'right'] }],
                'touch-y': [{ 'touch-pan': ['y', 'up', 'down'] }],
                'touch-pz': ['touch-pinch-zoom'],
                select: [{ select: ['none', 'text', 'all', 'auto'] }],
                'will-change': [{ 'will-change': ['auto', 'scroll', 'contents', 'transform', H] }],
                fill: [{ fill: [e, 'none'] }],
                'stroke-w': [{ stroke: [Ft, en, aa] }],
                stroke: [{ stroke: [e, 'none'] }],
                sr: ['sr-only', 'not-sr-only'],
                'forced-color-adjust': [{ 'forced-color-adjust': ['auto', 'none'] }],
            },
            conflictingClassGroups: {
                overflow: ['overflow-x', 'overflow-y'],
                overscroll: ['overscroll-x', 'overscroll-y'],
                inset: ['inset-x', 'inset-y', 'start', 'end', 'top', 'right', 'bottom', 'left'],
                'inset-x': ['right', 'left'],
                'inset-y': ['top', 'bottom'],
                flex: ['basis', 'grow', 'shrink'],
                gap: ['gap-x', 'gap-y'],
                p: ['px', 'py', 'ps', 'pe', 'pt', 'pr', 'pb', 'pl'],
                px: ['pr', 'pl'],
                py: ['pt', 'pb'],
                m: ['mx', 'my', 'ms', 'me', 'mt', 'mr', 'mb', 'ml'],
                mx: ['mr', 'ml'],
                my: ['mt', 'mb'],
                size: ['w', 'h'],
                'font-size': ['leading'],
                'fvn-normal': ['fvn-ordinal', 'fvn-slashed-zero', 'fvn-figure', 'fvn-spacing', 'fvn-fraction'],
                'fvn-ordinal': ['fvn-normal'],
                'fvn-slashed-zero': ['fvn-normal'],
                'fvn-figure': ['fvn-normal'],
                'fvn-spacing': ['fvn-normal'],
                'fvn-fraction': ['fvn-normal'],
                'line-clamp': ['display', 'overflow'],
                rounded: [
                    'rounded-s',
                    'rounded-e',
                    'rounded-t',
                    'rounded-r',
                    'rounded-b',
                    'rounded-l',
                    'rounded-ss',
                    'rounded-se',
                    'rounded-ee',
                    'rounded-es',
                    'rounded-tl',
                    'rounded-tr',
                    'rounded-br',
                    'rounded-bl',
                ],
                'rounded-s': ['rounded-ss', 'rounded-es'],
                'rounded-e': ['rounded-se', 'rounded-ee'],
                'rounded-t': ['rounded-tl', 'rounded-tr'],
                'rounded-r': ['rounded-tr', 'rounded-br'],
                'rounded-b': ['rounded-br', 'rounded-bl'],
                'rounded-l': ['rounded-tl', 'rounded-bl'],
                'border-spacing': ['border-spacing-x', 'border-spacing-y'],
                'border-w': ['border-w-s', 'border-w-e', 'border-w-t', 'border-w-r', 'border-w-b', 'border-w-l'],
                'border-w-x': ['border-w-r', 'border-w-l'],
                'border-w-y': ['border-w-t', 'border-w-b'],
                'border-color': [
                    'border-color-s',
                    'border-color-e',
                    'border-color-t',
                    'border-color-r',
                    'border-color-b',
                    'border-color-l',
                ],
                'border-color-x': ['border-color-r', 'border-color-l'],
                'border-color-y': ['border-color-t', 'border-color-b'],
                'scroll-m': [
                    'scroll-mx',
                    'scroll-my',
                    'scroll-ms',
                    'scroll-me',
                    'scroll-mt',
                    'scroll-mr',
                    'scroll-mb',
                    'scroll-ml',
                ],
                'scroll-mx': ['scroll-mr', 'scroll-ml'],
                'scroll-my': ['scroll-mt', 'scroll-mb'],
                'scroll-p': [
                    'scroll-px',
                    'scroll-py',
                    'scroll-ps',
                    'scroll-pe',
                    'scroll-pt',
                    'scroll-pr',
                    'scroll-pb',
                    'scroll-pl',
                ],
                'scroll-px': ['scroll-pr', 'scroll-pl'],
                'scroll-py': ['scroll-pt', 'scroll-pb'],
                touch: ['touch-x', 'touch-y', 'touch-pz'],
                'touch-x': ['touch'],
                'touch-y': ['touch'],
                'touch-pz': ['touch'],
            },
            conflictingClassGroupModifiers: { 'font-size': ['leading'] },
        };
    },
    Ab = pb(Db);
function ct(...e) {
    return Ab(tb(e));
}
const sv = g.forwardRef(({ className: e, children: t, ...n }, r) =>
    E.jsxs(Zm, {
        ref: r,
        className: ct('relative overflow-hidden', e),
        ...n,
        children: [E.jsx(Z1, { className: 'h-full w-full rounded-[inherit]', children: t }), E.jsx(lv, {}), E.jsx(eb, {})],
    }),
);
sv.displayName = Zm.displayName;
const lv = g.forwardRef(({ className: e, orientation: t = 'vertical', ...n }, r) =>
    E.jsx(Xu, {
        ref: r,
        orientation: t,
        className: ct(
            'flex touch-none select-none transition-colors',
            t === 'vertical' && 'h-full w-2.5 border-l border-l-transparent p-[1px]',
            t === 'horizontal' && 'h-2.5 flex-col border-t border-t-transparent p-[1px]',
            e,
        ),
        ...n,
        children: E.jsx(Km, { className: 'relative flex-1 rounded-full bg-border' }),
    }),
);
lv.displayName = Xu.displayName;
/**
 * @license lucide-react v0.344.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */ var Ib = {
    xmlns: 'http://www.w3.org/2000/svg',
    width: 24,
    height: 24,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 2,
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
};
/**
 * @license lucide-react v0.344.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */ const Mb = (e) =>
        e
            .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
            .toLowerCase()
            .trim(),
    Wr = (e, t) => {
        const n = g.forwardRef(
            (
                {
                    color: r = 'currentColor',
                    size: o = 24,
                    strokeWidth: i = 2,
                    absoluteStrokeWidth: s,
                    className: l = '',
                    children: a,
                    ...c
                },
                u,
            ) =>
                g.createElement(
                    'svg',
                    {
                        ref: u,
                        ...Ib,
                        width: o,
                        height: o,
                        stroke: r,
                        strokeWidth: s ? (Number(i) * 24) / Number(o) : i,
                        className: ['lucide', `lucide-${Mb(e)}`, l].join(' '),
                        ...c,
                    },
                    [...t.map(([f, d]) => g.createElement(f, d)), ...(Array.isArray(a) ? a : [a])],
                ),
        );
        return (n.displayName = `${e}`), n;
    };
/**
 * @license lucide-react v0.344.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */ const Lb = Wr('Check', [['path', { d: 'M20 6 9 17l-5-5', key: '1gmf2c' }]]);
/**
 * @license lucide-react v0.344.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */ const Fb = Wr('ChevronDown', [['path', { d: 'm6 9 6 6 6-6', key: 'qrunsl' }]]);
/**
 * @license lucide-react v0.344.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */ const av = Wr('ChevronRight', [['path', { d: 'm9 18 6-6-6-6', key: 'mthhwq' }]]);
/**
 * @license lucide-react v0.344.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */ const jb = Wr('Circle', [['circle', { cx: '12', cy: '12', r: '10', key: '1mglay' }]]);
/**
 * @license lucide-react v0.344.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */ const dh = Wr('File', [
    ['path', { d: 'M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z', key: '1rqfz7' }],
    ['path', { d: 'M14 2v4a2 2 0 0 0 2 2h4', key: 'tnqrlb' }],
]);
/**
 * @license lucide-react v0.344.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */ const zb = Wr('Folder', [
    [
        'path',
        {
            d: 'M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z',
            key: '1kt360',
        },
    ],
]);
function cv(e) {
    const t = e + 'CollectionProvider',
        [n, r] = $r(t),
        [o, i] = n(t, { collectionRef: { current: null }, itemMap: new Map() }),
        s = (y) => {
            const { scope: m, children: v } = y,
                S = jt.useRef(null),
                h = jt.useRef(new Map()).current;
            return E.jsx(o, { scope: m, itemMap: h, collectionRef: S, children: v });
        };
    s.displayName = t;
    const l = e + 'CollectionSlot',
        a = jt.forwardRef((y, m) => {
            const { scope: v, children: S } = y,
                h = i(l, v),
                p = de(m, h.collectionRef);
            return E.jsx(qo, { ref: p, children: S });
        });
    a.displayName = l;
    const c = e + 'CollectionItemSlot',
        u = 'data-radix-collection-item',
        f = jt.forwardRef((y, m) => {
            const { scope: v, children: S, ...h } = y,
                p = jt.useRef(null),
                w = de(m, p),
                C = i(c, v);
            return (
                jt.useEffect(() => (C.itemMap.set(p, { ref: p, ...h }), () => void C.itemMap.delete(p))),
                E.jsx(qo, { [u]: '', ref: w, children: S })
            );
        });
    f.displayName = c;
    function d(y) {
        const m = i(e + 'CollectionConsumer', y);
        return jt.useCallback(() => {
            const S = m.collectionRef.current;
            if (!S) return [];
            const h = Array.from(S.querySelectorAll(`[${u}]`));
            return Array.from(m.itemMap.values()).sort((C, T) => h.indexOf(C.ref.current) - h.indexOf(T.ref.current));
        }, [m.collectionRef, m.itemMap]);
    }
    return [{ Provider: s, Slot: a, ItemSlot: f }, d, r];
}
function Ub(e, t = globalThis == null ? void 0 : globalThis.document) {
    const n = ue(e);
    g.useEffect(() => {
        const r = (o) => {
            o.key === 'Escape' && n(o);
        };
        return t.addEventListener('keydown', r, { capture: !0 }), () => t.removeEventListener('keydown', r, { capture: !0 });
    }, [n, t]);
}
var Bb = 'DismissableLayer',
    Oc = 'dismissableLayer.update',
    $b = 'dismissableLayer.pointerDownOutside',
    Hb = 'dismissableLayer.focusOutside',
    hh,
    uv = g.createContext({ layers: new Set(), layersWithOutsidePointerEventsDisabled: new Set(), branches: new Set() }),
    fv = g.forwardRef((e, t) => {
        const {
                disableOutsidePointerEvents: n = !1,
                onEscapeKeyDown: r,
                onPointerDownOutside: o,
                onFocusOutside: i,
                onInteractOutside: s,
                onDismiss: l,
                ...a
            } = e,
            c = g.useContext(uv),
            [u, f] = g.useState(null),
            d = (u == null ? void 0 : u.ownerDocument) ?? (globalThis == null ? void 0 : globalThis.document),
            [, y] = g.useState({}),
            m = de(t, (b) => f(b)),
            v = Array.from(c.layers),
            [S] = [...c.layersWithOutsidePointerEventsDisabled].slice(-1),
            h = v.indexOf(S),
            p = u ? v.indexOf(u) : -1,
            w = c.layersWithOutsidePointerEventsDisabled.size > 0,
            C = p >= h,
            T = qb((b) => {
                const x = b.target,
                    R = [...c.branches].some((N) => N.contains(x));
                !C || R || (o == null || o(b), s == null || s(b), b.defaultPrevented || l == null || l());
            }, d),
            _ = Gb((b) => {
                const x = b.target;
                [...c.branches].some((N) => N.contains(x)) ||
                    (i == null || i(b), s == null || s(b), b.defaultPrevented || l == null || l());
            }, d);
        return (
            Ub((b) => {
                p === c.layers.size - 1 && (r == null || r(b), !b.defaultPrevented && l && (b.preventDefault(), l()));
            }, d),
            g.useEffect(() => {
                if (u)
                    return (
                        n &&
                            (c.layersWithOutsidePointerEventsDisabled.size === 0 &&
                                ((hh = d.body.style.pointerEvents), (d.body.style.pointerEvents = 'none')),
                            c.layersWithOutsidePointerEventsDisabled.add(u)),
                        c.layers.add(u),
                        ph(),
                        () => {
                            n && c.layersWithOutsidePointerEventsDisabled.size === 1 && (d.body.style.pointerEvents = hh);
                        }
                    );
            }, [u, d, n, c]),
            g.useEffect(
                () => () => {
                    u && (c.layers.delete(u), c.layersWithOutsidePointerEventsDisabled.delete(u), ph());
                },
                [u, c],
            ),
            g.useEffect(() => {
                const b = () => y({});
                return document.addEventListener(Oc, b), () => document.removeEventListener(Oc, b);
            }, []),
            E.jsx(he.div, {
                ...a,
                ref: m,
                style: { pointerEvents: w ? (C ? 'auto' : 'none') : void 0, ...e.style },
                onFocusCapture: $(e.onFocusCapture, _.onFocusCapture),
                onBlurCapture: $(e.onBlurCapture, _.onBlurCapture),
                onPointerDownCapture: $(e.onPointerDownCapture, T.onPointerDownCapture),
            })
        );
    });
fv.displayName = Bb;
var Wb = 'DismissableLayerBranch',
    Vb = g.forwardRef((e, t) => {
        const n = g.useContext(uv),
            r = g.useRef(null),
            o = de(t, r);
        return (
            g.useEffect(() => {
                const i = r.current;
                if (i)
                    return (
                        n.branches.add(i),
                        () => {
                            n.branches.delete(i);
                        }
                    );
            }, [n.branches]),
            E.jsx(he.div, { ...e, ref: o })
        );
    });
Vb.displayName = Wb;
function qb(e, t = globalThis == null ? void 0 : globalThis.document) {
    const n = ue(e),
        r = g.useRef(!1),
        o = g.useRef(() => {});
    return (
        g.useEffect(() => {
            const i = (l) => {
                    if (l.target && !r.current) {
                        let a = function () {
                            dv($b, n, c, { discrete: !0 });
                        };
                        const c = { originalEvent: l };
                        l.pointerType === 'touch'
                            ? (t.removeEventListener('click', o.current),
                              (o.current = a),
                              t.addEventListener('click', o.current, { once: !0 }))
                            : a();
                    } else t.removeEventListener('click', o.current);
                    r.current = !1;
                },
                s = window.setTimeout(() => {
                    t.addEventListener('pointerdown', i);
                }, 0);
            return () => {
                window.clearTimeout(s), t.removeEventListener('pointerdown', i), t.removeEventListener('click', o.current);
            };
        }, [t, n]),
        { onPointerDownCapture: () => (r.current = !0) }
    );
}
function Gb(e, t = globalThis == null ? void 0 : globalThis.document) {
    const n = ue(e),
        r = g.useRef(!1);
    return (
        g.useEffect(() => {
            const o = (i) => {
                i.target && !r.current && dv(Hb, n, { originalEvent: i }, { discrete: !1 });
            };
            return t.addEventListener('focusin', o), () => t.removeEventListener('focusin', o);
        }, [t, n]),
        { onFocusCapture: () => (r.current = !0), onBlurCapture: () => (r.current = !1) }
    );
}
function ph() {
    const e = new CustomEvent(Oc);
    document.dispatchEvent(e);
}
function dv(e, t, n, { discrete: r }) {
    const o = n.originalEvent.target,
        i = new CustomEvent(e, { bubbles: !1, cancelable: !0, detail: n });
    t && o.addEventListener(e, t, { once: !0 }), r ? Um(o, i) : o.dispatchEvent(i);
}
var ca = 0;
function Kb() {
    g.useEffect(() => {
        const e = document.querySelectorAll('[data-radix-focus-guard]');
        return (
            document.body.insertAdjacentElement('afterbegin', e[0] ?? gh()),
            document.body.insertAdjacentElement('beforeend', e[1] ?? gh()),
            ca++,
            () => {
                ca === 1 && document.querySelectorAll('[data-radix-focus-guard]').forEach((t) => t.remove()), ca--;
            }
        );
    }, []);
}
function gh() {
    const e = document.createElement('span');
    return (
        e.setAttribute('data-radix-focus-guard', ''),
        (e.tabIndex = 0),
        (e.style.outline = 'none'),
        (e.style.opacity = '0'),
        (e.style.position = 'fixed'),
        (e.style.pointerEvents = 'none'),
        e
    );
}
var ua = 'focusScope.autoFocusOnMount',
    fa = 'focusScope.autoFocusOnUnmount',
    mh = { bubbles: !1, cancelable: !0 },
    Yb = 'FocusScope',
    hv = g.forwardRef((e, t) => {
        const { loop: n = !1, trapped: r = !1, onMountAutoFocus: o, onUnmountAutoFocus: i, ...s } = e,
            [l, a] = g.useState(null),
            c = ue(o),
            u = ue(i),
            f = g.useRef(null),
            d = de(t, (v) => a(v)),
            y = g.useRef({
                paused: !1,
                pause() {
                    this.paused = !0;
                },
                resume() {
                    this.paused = !1;
                },
            }).current;
        g.useEffect(() => {
            if (r) {
                let v = function (w) {
                        if (y.paused || !l) return;
                        const C = w.target;
                        l.contains(C) ? (f.current = C) : rn(f.current, { select: !0 });
                    },
                    S = function (w) {
                        if (y.paused || !l) return;
                        const C = w.relatedTarget;
                        C !== null && (l.contains(C) || rn(f.current, { select: !0 }));
                    },
                    h = function (w) {
                        if (document.activeElement === document.body) for (const T of w) T.removedNodes.length > 0 && rn(l);
                    };
                document.addEventListener('focusin', v), document.addEventListener('focusout', S);
                const p = new MutationObserver(h);
                return (
                    l && p.observe(l, { childList: !0, subtree: !0 }),
                    () => {
                        document.removeEventListener('focusin', v), document.removeEventListener('focusout', S), p.disconnect();
                    }
                );
            }
        }, [r, l, y.paused]),
            g.useEffect(() => {
                if (l) {
                    yh.add(y);
                    const v = document.activeElement;
                    if (!l.contains(v)) {
                        const h = new CustomEvent(ua, mh);
                        l.addEventListener(ua, c),
                            l.dispatchEvent(h),
                            h.defaultPrevented || (Xb(tT(pv(l)), { select: !0 }), document.activeElement === v && rn(l));
                    }
                    return () => {
                        l.removeEventListener(ua, c),
                            setTimeout(() => {
                                const h = new CustomEvent(fa, mh);
                                l.addEventListener(fa, u),
                                    l.dispatchEvent(h),
                                    h.defaultPrevented || rn(v ?? document.body, { select: !0 }),
                                    l.removeEventListener(fa, u),
                                    yh.remove(y);
                            }, 0);
                    };
                }
            }, [l, c, u, y]);
        const m = g.useCallback(
            (v) => {
                if ((!n && !r) || y.paused) return;
                const S = v.key === 'Tab' && !v.altKey && !v.ctrlKey && !v.metaKey,
                    h = document.activeElement;
                if (S && h) {
                    const p = v.currentTarget,
                        [w, C] = Qb(p);
                    w && C
                        ? !v.shiftKey && h === C
                            ? (v.preventDefault(), n && rn(w, { select: !0 }))
                            : v.shiftKey && h === w && (v.preventDefault(), n && rn(C, { select: !0 }))
                        : h === p && v.preventDefault();
                }
            },
            [n, r, y.paused],
        );
        return E.jsx(he.div, { tabIndex: -1, ...s, ref: d, onKeyDown: m });
    });
hv.displayName = Yb;
function Xb(e, { select: t = !1 } = {}) {
    const n = document.activeElement;
    for (const r of e) if ((rn(r, { select: t }), document.activeElement !== n)) return;
}
function Qb(e) {
    const t = pv(e),
        n = vh(t, e),
        r = vh(t.reverse(), e);
    return [n, r];
}
function pv(e) {
    const t = [],
        n = document.createTreeWalker(e, NodeFilter.SHOW_ELEMENT, {
            acceptNode: (r) => {
                const o = r.tagName === 'INPUT' && r.type === 'hidden';
                return r.disabled || r.hidden || o
                    ? NodeFilter.FILTER_SKIP
                    : r.tabIndex >= 0
                      ? NodeFilter.FILTER_ACCEPT
                      : NodeFilter.FILTER_SKIP;
            },
        });
    for (; n.nextNode(); ) t.push(n.currentNode);
    return t;
}
function vh(e, t) {
    for (const n of e) if (!Jb(n, { upTo: t })) return n;
}
function Jb(e, { upTo: t }) {
    if (getComputedStyle(e).visibility === 'hidden') return !0;
    for (; e; ) {
        if (t !== void 0 && e === t) return !1;
        if (getComputedStyle(e).display === 'none') return !0;
        e = e.parentElement;
    }
    return !1;
}
function Zb(e) {
    return e instanceof HTMLInputElement && 'select' in e;
}
function rn(e, { select: t = !1 } = {}) {
    if (e && e.focus) {
        const n = document.activeElement;
        e.focus({ preventScroll: !0 }), e !== n && Zb(e) && t && e.select();
    }
}
var yh = eT();
function eT() {
    let e = [];
    return {
        add(t) {
            const n = e[0];
            t !== n && (n == null || n.pause()), (e = wh(e, t)), e.unshift(t);
        },
        remove(t) {
            var n;
            (e = wh(e, t)), (n = e[0]) == null || n.resume();
        },
    };
}
function wh(e, t) {
    const n = [...e],
        r = n.indexOf(t);
    return r !== -1 && n.splice(r, 1), n;
}
function tT(e) {
    return e.filter((t) => t.tagName !== 'A');
}
var nT = Mw.useId || (() => {}),
    rT = 0;
function Pc(e) {
    const [t, n] = g.useState(nT());
    return (
        xn(() => {
            n((r) => r ?? String(rT++));
        }, [e]),
        t ? `radix-${t}` : ''
    );
}
const oT = ['top', 'right', 'bottom', 'left'],
    Cn = Math.min,
    He = Math.max,
    Fs = Math.round,
    Oi = Math.floor,
    Pt = (e) => ({ x: e, y: e }),
    iT = { left: 'right', right: 'left', bottom: 'top', top: 'bottom' },
    sT = { start: 'end', end: 'start' };
function Nc(e, t, n) {
    return He(e, Cn(t, n));
}
function Kt(e, t) {
    return typeof e == 'function' ? e(t) : e;
}
function Yt(e) {
    return e.split('-')[0];
}
function Vr(e) {
    return e.split('-')[1];
}
function ef(e) {
    return e === 'x' ? 'y' : 'x';
}
function tf(e) {
    return e === 'y' ? 'height' : 'width';
}
function bn(e) {
    return ['top', 'bottom'].includes(Yt(e)) ? 'y' : 'x';
}
function nf(e) {
    return ef(bn(e));
}
function lT(e, t, n) {
    n === void 0 && (n = !1);
    const r = Vr(e),
        o = nf(e),
        i = tf(o);
    let s = o === 'x' ? (r === (n ? 'end' : 'start') ? 'right' : 'left') : r === 'start' ? 'bottom' : 'top';
    return t.reference[i] > t.floating[i] && (s = js(s)), [s, js(s)];
}
function aT(e) {
    const t = js(e);
    return [Dc(e), t, Dc(t)];
}
function Dc(e) {
    return e.replace(/start|end/g, (t) => sT[t]);
}
function cT(e, t, n) {
    const r = ['left', 'right'],
        o = ['right', 'left'],
        i = ['top', 'bottom'],
        s = ['bottom', 'top'];
    switch (e) {
        case 'top':
        case 'bottom':
            return n ? (t ? o : r) : t ? r : o;
        case 'left':
        case 'right':
            return t ? i : s;
        default:
            return [];
    }
}
function uT(e, t, n, r) {
    const o = Vr(e);
    let i = cT(Yt(e), n === 'start', r);
    return o && ((i = i.map((s) => s + '-' + o)), t && (i = i.concat(i.map(Dc)))), i;
}
function js(e) {
    return e.replace(/left|right|bottom|top/g, (t) => iT[t]);
}
function fT(e) {
    return { top: 0, right: 0, bottom: 0, left: 0, ...e };
}
function gv(e) {
    return typeof e != 'number' ? fT(e) : { top: e, right: e, bottom: e, left: e };
}
function zs(e) {
    const { x: t, y: n, width: r, height: o } = e;
    return { width: r, height: o, top: n, left: t, right: t + r, bottom: n + o, x: t, y: n };
}
function Sh(e, t, n) {
    let { reference: r, floating: o } = e;
    const i = bn(t),
        s = nf(t),
        l = tf(s),
        a = Yt(t),
        c = i === 'y',
        u = r.x + r.width / 2 - o.width / 2,
        f = r.y + r.height / 2 - o.height / 2,
        d = r[l] / 2 - o[l] / 2;
    let y;
    switch (a) {
        case 'top':
            y = { x: u, y: r.y - o.height };
            break;
        case 'bottom':
            y = { x: u, y: r.y + r.height };
            break;
        case 'right':
            y = { x: r.x + r.width, y: f };
            break;
        case 'left':
            y = { x: r.x - o.width, y: f };
            break;
        default:
            y = { x: r.x, y: r.y };
    }
    switch (Vr(t)) {
        case 'start':
            y[s] -= d * (n && c ? -1 : 1);
            break;
        case 'end':
            y[s] += d * (n && c ? -1 : 1);
            break;
    }
    return y;
}
const dT = async (e, t, n) => {
    const { placement: r = 'bottom', strategy: o = 'absolute', middleware: i = [], platform: s } = n,
        l = i.filter(Boolean),
        a = await (s.isRTL == null ? void 0 : s.isRTL(t));
    let c = await s.getElementRects({ reference: e, floating: t, strategy: o }),
        { x: u, y: f } = Sh(c, r, a),
        d = r,
        y = {},
        m = 0;
    for (let v = 0; v < l.length; v++) {
        const { name: S, fn: h } = l[v],
            {
                x: p,
                y: w,
                data: C,
                reset: T,
            } = await h({
                x: u,
                y: f,
                initialPlacement: r,
                placement: d,
                strategy: o,
                middlewareData: y,
                rects: c,
                platform: s,
                elements: { reference: e, floating: t },
            });
        (u = p ?? u),
            (f = w ?? f),
            (y = { ...y, [S]: { ...y[S], ...C } }),
            T &&
                m <= 50 &&
                (m++,
                typeof T == 'object' &&
                    (T.placement && (d = T.placement),
                    T.rects &&
                        (c = T.rects === !0 ? await s.getElementRects({ reference: e, floating: t, strategy: o }) : T.rects),
                    ({ x: u, y: f } = Sh(c, d, a))),
                (v = -1));
    }
    return { x: u, y: f, placement: d, strategy: o, middlewareData: y };
};
async function Go(e, t) {
    var n;
    t === void 0 && (t = {});
    const { x: r, y: o, platform: i, rects: s, elements: l, strategy: a } = e,
        {
            boundary: c = 'clippingAncestors',
            rootBoundary: u = 'viewport',
            elementContext: f = 'floating',
            altBoundary: d = !1,
            padding: y = 0,
        } = Kt(t, e),
        m = gv(y),
        S = l[d ? (f === 'floating' ? 'reference' : 'floating') : f],
        h = zs(
            await i.getClippingRect({
                element:
                    (n = await (i.isElement == null ? void 0 : i.isElement(S))) == null || n
                        ? S
                        : S.contextElement ||
                          (await (i.getDocumentElement == null ? void 0 : i.getDocumentElement(l.floating))),
                boundary: c,
                rootBoundary: u,
                strategy: a,
            }),
        ),
        p = f === 'floating' ? { x: r, y: o, width: s.floating.width, height: s.floating.height } : s.reference,
        w = await (i.getOffsetParent == null ? void 0 : i.getOffsetParent(l.floating)),
        C = (await (i.isElement == null ? void 0 : i.isElement(w)))
            ? (await (i.getScale == null ? void 0 : i.getScale(w))) || { x: 1, y: 1 }
            : { x: 1, y: 1 },
        T = zs(
            i.convertOffsetParentRelativeRectToViewportRelativeRect
                ? await i.convertOffsetParentRelativeRectToViewportRelativeRect({
                      elements: l,
                      rect: p,
                      offsetParent: w,
                      strategy: a,
                  })
                : p,
        );
    return {
        top: (h.top - T.top + m.top) / C.y,
        bottom: (T.bottom - h.bottom + m.bottom) / C.y,
        left: (h.left - T.left + m.left) / C.x,
        right: (T.right - h.right + m.right) / C.x,
    };
}
const hT = (e) => ({
        name: 'arrow',
        options: e,
        async fn(t) {
            const { x: n, y: r, placement: o, rects: i, platform: s, elements: l, middlewareData: a } = t,
                { element: c, padding: u = 0 } = Kt(e, t) || {};
            if (c == null) return {};
            const f = gv(u),
                d = { x: n, y: r },
                y = nf(o),
                m = tf(y),
                v = await s.getDimensions(c),
                S = y === 'y',
                h = S ? 'top' : 'left',
                p = S ? 'bottom' : 'right',
                w = S ? 'clientHeight' : 'clientWidth',
                C = i.reference[m] + i.reference[y] - d[y] - i.floating[m],
                T = d[y] - i.reference[y],
                _ = await (s.getOffsetParent == null ? void 0 : s.getOffsetParent(c));
            let b = _ ? _[w] : 0;
            (!b || !(await (s.isElement == null ? void 0 : s.isElement(_)))) && (b = l.floating[w] || i.floating[m]);
            const x = C / 2 - T / 2,
                R = b / 2 - v[m] / 2 - 1,
                N = Cn(f[h], R),
                L = Cn(f[p], R),
                I = N,
                z = b - v[m] - L,
                j = b / 2 - v[m] / 2 + x,
                le = Nc(I, j, z),
                W = !a.arrow && Vr(o) != null && j !== le && i.reference[m] / 2 - (j < I ? N : L) - v[m] / 2 < 0,
                Q = W ? (j < I ? j - I : j - z) : 0;
            return { [y]: d[y] + Q, data: { [y]: le, centerOffset: j - le - Q, ...(W && { alignmentOffset: Q }) }, reset: W };
        },
    }),
    pT = function (e) {
        return (
            e === void 0 && (e = {}),
            {
                name: 'flip',
                options: e,
                async fn(t) {
                    var n, r;
                    const { placement: o, middlewareData: i, rects: s, initialPlacement: l, platform: a, elements: c } = t,
                        {
                            mainAxis: u = !0,
                            crossAxis: f = !0,
                            fallbackPlacements: d,
                            fallbackStrategy: y = 'bestFit',
                            fallbackAxisSideDirection: m = 'none',
                            flipAlignment: v = !0,
                            ...S
                        } = Kt(e, t);
                    if ((n = i.arrow) != null && n.alignmentOffset) return {};
                    const h = Yt(o),
                        p = bn(l),
                        w = Yt(l) === l,
                        C = await (a.isRTL == null ? void 0 : a.isRTL(c.floating)),
                        T = d || (w || !v ? [js(l)] : aT(l)),
                        _ = m !== 'none';
                    !d && _ && T.push(...uT(l, v, m, C));
                    const b = [l, ...T],
                        x = await Go(t, S),
                        R = [];
                    let N = ((r = i.flip) == null ? void 0 : r.overflows) || [];
                    if ((u && R.push(x[h]), f)) {
                        const j = lT(o, s, C);
                        R.push(x[j[0]], x[j[1]]);
                    }
                    if (((N = [...N, { placement: o, overflows: R }]), !R.every((j) => j <= 0))) {
                        var L, I;
                        const j = (((L = i.flip) == null ? void 0 : L.index) || 0) + 1,
                            le = b[j];
                        if (le) return { data: { index: j, overflows: N }, reset: { placement: le } };
                        let W =
                            (I = N.filter((Q) => Q.overflows[0] <= 0).sort((Q, O) => Q.overflows[1] - O.overflows[1])[0]) ==
                            null
                                ? void 0
                                : I.placement;
                        if (!W)
                            switch (y) {
                                case 'bestFit': {
                                    var z;
                                    const Q =
                                        (z = N.filter((O) => {
                                            if (_) {
                                                const P = bn(O.placement);
                                                return P === p || P === 'y';
                                            }
                                            return !0;
                                        })
                                            .map((O) => [
                                                O.placement,
                                                O.overflows.filter((P) => P > 0).reduce((P, M) => P + M, 0),
                                            ])
                                            .sort((O, P) => O[1] - P[1])[0]) == null
                                            ? void 0
                                            : z[0];
                                    Q && (W = Q);
                                    break;
                                }
                                case 'initialPlacement':
                                    W = l;
                                    break;
                            }
                        if (o !== W) return { reset: { placement: W } };
                    }
                    return {};
                },
            }
        );
    };
function Eh(e, t) {
    return { top: e.top - t.height, right: e.right - t.width, bottom: e.bottom - t.height, left: e.left - t.width };
}
function xh(e) {
    return oT.some((t) => e[t] >= 0);
}
const gT = function (e) {
    return (
        e === void 0 && (e = {}),
        {
            name: 'hide',
            options: e,
            async fn(t) {
                const { rects: n } = t,
                    { strategy: r = 'referenceHidden', ...o } = Kt(e, t);
                switch (r) {
                    case 'referenceHidden': {
                        const i = await Go(t, { ...o, elementContext: 'reference' }),
                            s = Eh(i, n.reference);
                        return { data: { referenceHiddenOffsets: s, referenceHidden: xh(s) } };
                    }
                    case 'escaped': {
                        const i = await Go(t, { ...o, altBoundary: !0 }),
                            s = Eh(i, n.floating);
                        return { data: { escapedOffsets: s, escaped: xh(s) } };
                    }
                    default:
                        return {};
                }
            },
        }
    );
};
async function mT(e, t) {
    const { placement: n, platform: r, elements: o } = e,
        i = await (r.isRTL == null ? void 0 : r.isRTL(o.floating)),
        s = Yt(n),
        l = Vr(n),
        a = bn(n) === 'y',
        c = ['left', 'top'].includes(s) ? -1 : 1,
        u = i && a ? -1 : 1,
        f = Kt(t, e);
    let {
        mainAxis: d,
        crossAxis: y,
        alignmentAxis: m,
    } = typeof f == 'number'
        ? { mainAxis: f, crossAxis: 0, alignmentAxis: null }
        : { mainAxis: f.mainAxis || 0, crossAxis: f.crossAxis || 0, alignmentAxis: f.alignmentAxis };
    return l && typeof m == 'number' && (y = l === 'end' ? m * -1 : m), a ? { x: y * u, y: d * c } : { x: d * c, y: y * u };
}
const vT = function (e) {
        return (
            e === void 0 && (e = 0),
            {
                name: 'offset',
                options: e,
                async fn(t) {
                    var n, r;
                    const { x: o, y: i, placement: s, middlewareData: l } = t,
                        a = await mT(t, e);
                    return s === ((n = l.offset) == null ? void 0 : n.placement) && (r = l.arrow) != null && r.alignmentOffset
                        ? {}
                        : { x: o + a.x, y: i + a.y, data: { ...a, placement: s } };
                },
            }
        );
    },
    yT = function (e) {
        return (
            e === void 0 && (e = {}),
            {
                name: 'shift',
                options: e,
                async fn(t) {
                    const { x: n, y: r, placement: o } = t,
                        {
                            mainAxis: i = !0,
                            crossAxis: s = !1,
                            limiter: l = {
                                fn: (S) => {
                                    let { x: h, y: p } = S;
                                    return { x: h, y: p };
                                },
                            },
                            ...a
                        } = Kt(e, t),
                        c = { x: n, y: r },
                        u = await Go(t, a),
                        f = bn(Yt(o)),
                        d = ef(f);
                    let y = c[d],
                        m = c[f];
                    if (i) {
                        const S = d === 'y' ? 'top' : 'left',
                            h = d === 'y' ? 'bottom' : 'right',
                            p = y + u[S],
                            w = y - u[h];
                        y = Nc(p, y, w);
                    }
                    if (s) {
                        const S = f === 'y' ? 'top' : 'left',
                            h = f === 'y' ? 'bottom' : 'right',
                            p = m + u[S],
                            w = m - u[h];
                        m = Nc(p, m, w);
                    }
                    const v = l.fn({ ...t, [d]: y, [f]: m });
                    return { ...v, data: { x: v.x - n, y: v.y - r, enabled: { [d]: i, [f]: s } } };
                },
            }
        );
    },
    wT = function (e) {
        return (
            e === void 0 && (e = {}),
            {
                options: e,
                fn(t) {
                    const { x: n, y: r, placement: o, rects: i, middlewareData: s } = t,
                        { offset: l = 0, mainAxis: a = !0, crossAxis: c = !0 } = Kt(e, t),
                        u = { x: n, y: r },
                        f = bn(o),
                        d = ef(f);
                    let y = u[d],
                        m = u[f];
                    const v = Kt(l, t),
                        S = typeof v == 'number' ? { mainAxis: v, crossAxis: 0 } : { mainAxis: 0, crossAxis: 0, ...v };
                    if (a) {
                        const w = d === 'y' ? 'height' : 'width',
                            C = i.reference[d] - i.floating[w] + S.mainAxis,
                            T = i.reference[d] + i.reference[w] - S.mainAxis;
                        y < C ? (y = C) : y > T && (y = T);
                    }
                    if (c) {
                        var h, p;
                        const w = d === 'y' ? 'width' : 'height',
                            C = ['top', 'left'].includes(Yt(o)),
                            T =
                                i.reference[f] -
                                i.floating[w] +
                                ((C && ((h = s.offset) == null ? void 0 : h[f])) || 0) +
                                (C ? 0 : S.crossAxis),
                            _ =
                                i.reference[f] +
                                i.reference[w] +
                                (C ? 0 : ((p = s.offset) == null ? void 0 : p[f]) || 0) -
                                (C ? S.crossAxis : 0);
                        m < T ? (m = T) : m > _ && (m = _);
                    }
                    return { [d]: y, [f]: m };
                },
            }
        );
    },
    ST = function (e) {
        return (
            e === void 0 && (e = {}),
            {
                name: 'size',
                options: e,
                async fn(t) {
                    var n, r;
                    const { placement: o, rects: i, platform: s, elements: l } = t,
                        { apply: a = () => {}, ...c } = Kt(e, t),
                        u = await Go(t, c),
                        f = Yt(o),
                        d = Vr(o),
                        y = bn(o) === 'y',
                        { width: m, height: v } = i.floating;
                    let S, h;
                    f === 'top' || f === 'bottom'
                        ? ((S = f),
                          (h =
                              d === ((await (s.isRTL == null ? void 0 : s.isRTL(l.floating))) ? 'start' : 'end')
                                  ? 'left'
                                  : 'right'))
                        : ((h = f), (S = d === 'end' ? 'top' : 'bottom'));
                    const p = v - u.top - u.bottom,
                        w = m - u.left - u.right,
                        C = Cn(v - u[S], p),
                        T = Cn(m - u[h], w),
                        _ = !t.middlewareData.shift;
                    let b = C,
                        x = T;
                    if (
                        ((n = t.middlewareData.shift) != null && n.enabled.x && (x = w),
                        (r = t.middlewareData.shift) != null && r.enabled.y && (b = p),
                        _ && !d)
                    ) {
                        const N = He(u.left, 0),
                            L = He(u.right, 0),
                            I = He(u.top, 0),
                            z = He(u.bottom, 0);
                        y
                            ? (x = m - 2 * (N !== 0 || L !== 0 ? N + L : He(u.left, u.right)))
                            : (b = v - 2 * (I !== 0 || z !== 0 ? I + z : He(u.top, u.bottom)));
                    }
                    await a({ ...t, availableWidth: x, availableHeight: b });
                    const R = await s.getDimensions(l.floating);
                    return m !== R.width || v !== R.height ? { reset: { rects: !0 } } : {};
                },
            }
        );
    };
function Sl() {
    return typeof window < 'u';
}
function qr(e) {
    return mv(e) ? (e.nodeName || '').toLowerCase() : '#document';
}
function Ge(e) {
    var t;
    return (e == null || (t = e.ownerDocument) == null ? void 0 : t.defaultView) || window;
}
function Mt(e) {
    var t;
    return (t = (mv(e) ? e.ownerDocument : e.document) || window.document) == null ? void 0 : t.documentElement;
}
function mv(e) {
    return Sl() ? e instanceof Node || e instanceof Ge(e).Node : !1;
}
function wt(e) {
    return Sl() ? e instanceof Element || e instanceof Ge(e).Element : !1;
}
function Nt(e) {
    return Sl() ? e instanceof HTMLElement || e instanceof Ge(e).HTMLElement : !1;
}
function Ch(e) {
    return !Sl() || typeof ShadowRoot > 'u' ? !1 : e instanceof ShadowRoot || e instanceof Ge(e).ShadowRoot;
}
function ii(e) {
    const { overflow: t, overflowX: n, overflowY: r, display: o } = St(e);
    return /auto|scroll|overlay|hidden|clip/.test(t + r + n) && !['inline', 'contents'].includes(o);
}
function ET(e) {
    return ['table', 'td', 'th'].includes(qr(e));
}
function El(e) {
    return [':popover-open', ':modal'].some((t) => {
        try {
            return e.matches(t);
        } catch {
            return !1;
        }
    });
}
function rf(e) {
    const t = of(),
        n = wt(e) ? St(e) : e;
    return (
        ['transform', 'translate', 'scale', 'rotate', 'perspective'].some((r) => (n[r] ? n[r] !== 'none' : !1)) ||
        (n.containerType ? n.containerType !== 'normal' : !1) ||
        (!t && (n.backdropFilter ? n.backdropFilter !== 'none' : !1)) ||
        (!t && (n.filter ? n.filter !== 'none' : !1)) ||
        ['transform', 'translate', 'scale', 'rotate', 'perspective', 'filter'].some((r) => (n.willChange || '').includes(r)) ||
        ['paint', 'layout', 'strict', 'content'].some((r) => (n.contain || '').includes(r))
    );
}
function xT(e) {
    let t = Tn(e);
    for (; Nt(t) && !Mr(t); ) {
        if (rf(t)) return t;
        if (El(t)) return null;
        t = Tn(t);
    }
    return null;
}
function of() {
    return typeof CSS > 'u' || !CSS.supports ? !1 : CSS.supports('-webkit-backdrop-filter', 'none');
}
function Mr(e) {
    return ['html', 'body', '#document'].includes(qr(e));
}
function St(e) {
    return Ge(e).getComputedStyle(e);
}
function xl(e) {
    return wt(e) ? { scrollLeft: e.scrollLeft, scrollTop: e.scrollTop } : { scrollLeft: e.scrollX, scrollTop: e.scrollY };
}
function Tn(e) {
    if (qr(e) === 'html') return e;
    const t = e.assignedSlot || e.parentNode || (Ch(e) && e.host) || Mt(e);
    return Ch(t) ? t.host : t;
}
function vv(e) {
    const t = Tn(e);
    return Mr(t) ? (e.ownerDocument ? e.ownerDocument.body : e.body) : Nt(t) && ii(t) ? t : vv(t);
}
function Ko(e, t, n) {
    var r;
    t === void 0 && (t = []), n === void 0 && (n = !0);
    const o = vv(e),
        i = o === ((r = e.ownerDocument) == null ? void 0 : r.body),
        s = Ge(o);
    if (i) {
        const l = Ac(s);
        return t.concat(s, s.visualViewport || [], ii(o) ? o : [], l && n ? Ko(l) : []);
    }
    return t.concat(o, Ko(o, [], n));
}
function Ac(e) {
    return e.parent && Object.getPrototypeOf(e.parent) ? e.frameElement : null;
}
function yv(e) {
    const t = St(e);
    let n = parseFloat(t.width) || 0,
        r = parseFloat(t.height) || 0;
    const o = Nt(e),
        i = o ? e.offsetWidth : n,
        s = o ? e.offsetHeight : r,
        l = Fs(n) !== i || Fs(r) !== s;
    return l && ((n = i), (r = s)), { width: n, height: r, $: l };
}
function sf(e) {
    return wt(e) ? e : e.contextElement;
}
function br(e) {
    const t = sf(e);
    if (!Nt(t)) return Pt(1);
    const n = t.getBoundingClientRect(),
        { width: r, height: o, $: i } = yv(t);
    let s = (i ? Fs(n.width) : n.width) / r,
        l = (i ? Fs(n.height) : n.height) / o;
    return (!s || !Number.isFinite(s)) && (s = 1), (!l || !Number.isFinite(l)) && (l = 1), { x: s, y: l };
}
const CT = Pt(0);
function wv(e) {
    const t = Ge(e);
    return !of() || !t.visualViewport ? CT : { x: t.visualViewport.offsetLeft, y: t.visualViewport.offsetTop };
}
function bT(e, t, n) {
    return t === void 0 && (t = !1), !n || (t && n !== Ge(e)) ? !1 : t;
}
function Yn(e, t, n, r) {
    t === void 0 && (t = !1), n === void 0 && (n = !1);
    const o = e.getBoundingClientRect(),
        i = sf(e);
    let s = Pt(1);
    t && (r ? wt(r) && (s = br(r)) : (s = br(e)));
    const l = bT(i, n, r) ? wv(i) : Pt(0);
    let a = (o.left + l.x) / s.x,
        c = (o.top + l.y) / s.y,
        u = o.width / s.x,
        f = o.height / s.y;
    if (i) {
        const d = Ge(i),
            y = r && wt(r) ? Ge(r) : r;
        let m = d,
            v = Ac(m);
        for (; v && r && y !== m; ) {
            const S = br(v),
                h = v.getBoundingClientRect(),
                p = St(v),
                w = h.left + (v.clientLeft + parseFloat(p.paddingLeft)) * S.x,
                C = h.top + (v.clientTop + parseFloat(p.paddingTop)) * S.y;
            (a *= S.x), (c *= S.y), (u *= S.x), (f *= S.y), (a += w), (c += C), (m = Ge(v)), (v = Ac(m));
        }
    }
    return zs({ width: u, height: f, x: a, y: c });
}
function lf(e, t) {
    const n = xl(e).scrollLeft;
    return t ? t.left + n : Yn(Mt(e)).left + n;
}
function Sv(e, t, n) {
    n === void 0 && (n = !1);
    const r = e.getBoundingClientRect(),
        o = r.left + t.scrollLeft - (n ? 0 : lf(e, r)),
        i = r.top + t.scrollTop;
    return { x: o, y: i };
}
function TT(e) {
    let { elements: t, rect: n, offsetParent: r, strategy: o } = e;
    const i = o === 'fixed',
        s = Mt(r),
        l = t ? El(t.floating) : !1;
    if (r === s || (l && i)) return n;
    let a = { scrollLeft: 0, scrollTop: 0 },
        c = Pt(1);
    const u = Pt(0),
        f = Nt(r);
    if ((f || (!f && !i)) && ((qr(r) !== 'body' || ii(s)) && (a = xl(r)), Nt(r))) {
        const y = Yn(r);
        (c = br(r)), (u.x = y.x + r.clientLeft), (u.y = y.y + r.clientTop);
    }
    const d = s && !f && !i ? Sv(s, a, !0) : Pt(0);
    return {
        width: n.width * c.x,
        height: n.height * c.y,
        x: n.x * c.x - a.scrollLeft * c.x + u.x + d.x,
        y: n.y * c.y - a.scrollTop * c.y + u.y + d.y,
    };
}
function kT(e) {
    return Array.from(e.getClientRects());
}
function RT(e) {
    const t = Mt(e),
        n = xl(e),
        r = e.ownerDocument.body,
        o = He(t.scrollWidth, t.clientWidth, r.scrollWidth, r.clientWidth),
        i = He(t.scrollHeight, t.clientHeight, r.scrollHeight, r.clientHeight);
    let s = -n.scrollLeft + lf(e);
    const l = -n.scrollTop;
    return St(r).direction === 'rtl' && (s += He(t.clientWidth, r.clientWidth) - o), { width: o, height: i, x: s, y: l };
}
function _T(e, t) {
    const n = Ge(e),
        r = Mt(e),
        o = n.visualViewport;
    let i = r.clientWidth,
        s = r.clientHeight,
        l = 0,
        a = 0;
    if (o) {
        (i = o.width), (s = o.height);
        const c = of();
        (!c || (c && t === 'fixed')) && ((l = o.offsetLeft), (a = o.offsetTop));
    }
    return { width: i, height: s, x: l, y: a };
}
function OT(e, t) {
    const n = Yn(e, !0, t === 'fixed'),
        r = n.top + e.clientTop,
        o = n.left + e.clientLeft,
        i = Nt(e) ? br(e) : Pt(1),
        s = e.clientWidth * i.x,
        l = e.clientHeight * i.y,
        a = o * i.x,
        c = r * i.y;
    return { width: s, height: l, x: a, y: c };
}
function bh(e, t, n) {
    let r;
    if (t === 'viewport') r = _T(e, n);
    else if (t === 'document') r = RT(Mt(e));
    else if (wt(t)) r = OT(t, n);
    else {
        const o = wv(e);
        r = { x: t.x - o.x, y: t.y - o.y, width: t.width, height: t.height };
    }
    return zs(r);
}
function Ev(e, t) {
    const n = Tn(e);
    return n === t || !wt(n) || Mr(n) ? !1 : St(n).position === 'fixed' || Ev(n, t);
}
function PT(e, t) {
    const n = t.get(e);
    if (n) return n;
    let r = Ko(e, [], !1).filter((l) => wt(l) && qr(l) !== 'body'),
        o = null;
    const i = St(e).position === 'fixed';
    let s = i ? Tn(e) : e;
    for (; wt(s) && !Mr(s); ) {
        const l = St(s),
            a = rf(s);
        !a && l.position === 'fixed' && (o = null),
            (
                i
                    ? !a && !o
                    : (!a && l.position === 'static' && !!o && ['absolute', 'fixed'].includes(o.position)) ||
                      (ii(s) && !a && Ev(e, s))
            )
                ? (r = r.filter((u) => u !== s))
                : (o = l),
            (s = Tn(s));
    }
    return t.set(e, r), r;
}
function NT(e) {
    let { element: t, boundary: n, rootBoundary: r, strategy: o } = e;
    const s = [...(n === 'clippingAncestors' ? (El(t) ? [] : PT(t, this._c)) : [].concat(n)), r],
        l = s[0],
        a = s.reduce(
            (c, u) => {
                const f = bh(t, u, o);
                return (
                    (c.top = He(f.top, c.top)),
                    (c.right = Cn(f.right, c.right)),
                    (c.bottom = Cn(f.bottom, c.bottom)),
                    (c.left = He(f.left, c.left)),
                    c
                );
            },
            bh(t, l, o),
        );
    return { width: a.right - a.left, height: a.bottom - a.top, x: a.left, y: a.top };
}
function DT(e) {
    const { width: t, height: n } = yv(e);
    return { width: t, height: n };
}
function AT(e, t, n) {
    const r = Nt(t),
        o = Mt(t),
        i = n === 'fixed',
        s = Yn(e, !0, i, t);
    let l = { scrollLeft: 0, scrollTop: 0 };
    const a = Pt(0);
    if (r || (!r && !i))
        if (((qr(t) !== 'body' || ii(o)) && (l = xl(t)), r)) {
            const d = Yn(t, !0, i, t);
            (a.x = d.x + t.clientLeft), (a.y = d.y + t.clientTop);
        } else o && (a.x = lf(o));
    const c = o && !r && !i ? Sv(o, l) : Pt(0),
        u = s.left + l.scrollLeft - a.x - c.x,
        f = s.top + l.scrollTop - a.y - c.y;
    return { x: u, y: f, width: s.width, height: s.height };
}
function da(e) {
    return St(e).position === 'static';
}
function Th(e, t) {
    if (!Nt(e) || St(e).position === 'fixed') return null;
    if (t) return t(e);
    let n = e.offsetParent;
    return Mt(e) === n && (n = n.ownerDocument.body), n;
}
function xv(e, t) {
    const n = Ge(e);
    if (El(e)) return n;
    if (!Nt(e)) {
        let o = Tn(e);
        for (; o && !Mr(o); ) {
            if (wt(o) && !da(o)) return o;
            o = Tn(o);
        }
        return n;
    }
    let r = Th(e, t);
    for (; r && ET(r) && da(r); ) r = Th(r, t);
    return r && Mr(r) && da(r) && !rf(r) ? n : r || xT(e) || n;
}
const IT = async function (e) {
    const t = this.getOffsetParent || xv,
        n = this.getDimensions,
        r = await n(e.floating);
    return {
        reference: AT(e.reference, await t(e.floating), e.strategy),
        floating: { x: 0, y: 0, width: r.width, height: r.height },
    };
};
function MT(e) {
    return St(e).direction === 'rtl';
}
const LT = {
    convertOffsetParentRelativeRectToViewportRelativeRect: TT,
    getDocumentElement: Mt,
    getClippingRect: NT,
    getOffsetParent: xv,
    getElementRects: IT,
    getClientRects: kT,
    getDimensions: DT,
    getScale: br,
    isElement: wt,
    isRTL: MT,
};
function Cv(e, t) {
    return e.x === t.x && e.y === t.y && e.width === t.width && e.height === t.height;
}
function FT(e, t) {
    let n = null,
        r;
    const o = Mt(e);
    function i() {
        var l;
        clearTimeout(r), (l = n) == null || l.disconnect(), (n = null);
    }
    function s(l, a) {
        l === void 0 && (l = !1), a === void 0 && (a = 1), i();
        const c = e.getBoundingClientRect(),
            { left: u, top: f, width: d, height: y } = c;
        if ((l || t(), !d || !y)) return;
        const m = Oi(f),
            v = Oi(o.clientWidth - (u + d)),
            S = Oi(o.clientHeight - (f + y)),
            h = Oi(u),
            w = { rootMargin: -m + 'px ' + -v + 'px ' + -S + 'px ' + -h + 'px', threshold: He(0, Cn(1, a)) || 1 };
        let C = !0;
        function T(_) {
            const b = _[0].intersectionRatio;
            if (b !== a) {
                if (!C) return s();
                b
                    ? s(!1, b)
                    : (r = setTimeout(() => {
                          s(!1, 1e-7);
                      }, 1e3));
            }
            b === 1 && !Cv(c, e.getBoundingClientRect()) && s(), (C = !1);
        }
        try {
            n = new IntersectionObserver(T, { ...w, root: o.ownerDocument });
        } catch {
            n = new IntersectionObserver(T, w);
        }
        n.observe(e);
    }
    return s(!0), i;
}
function jT(e, t, n, r) {
    r === void 0 && (r = {});
    const {
            ancestorScroll: o = !0,
            ancestorResize: i = !0,
            elementResize: s = typeof ResizeObserver == 'function',
            layoutShift: l = typeof IntersectionObserver == 'function',
            animationFrame: a = !1,
        } = r,
        c = sf(e),
        u = o || i ? [...(c ? Ko(c) : []), ...Ko(t)] : [];
    u.forEach((h) => {
        o && h.addEventListener('scroll', n, { passive: !0 }), i && h.addEventListener('resize', n);
    });
    const f = c && l ? FT(c, n) : null;
    let d = -1,
        y = null;
    s &&
        ((y = new ResizeObserver((h) => {
            let [p] = h;
            p &&
                p.target === c &&
                y &&
                (y.unobserve(t),
                cancelAnimationFrame(d),
                (d = requestAnimationFrame(() => {
                    var w;
                    (w = y) == null || w.observe(t);
                }))),
                n();
        })),
        c && !a && y.observe(c),
        y.observe(t));
    let m,
        v = a ? Yn(e) : null;
    a && S();
    function S() {
        const h = Yn(e);
        v && !Cv(v, h) && n(), (v = h), (m = requestAnimationFrame(S));
    }
    return (
        n(),
        () => {
            var h;
            u.forEach((p) => {
                o && p.removeEventListener('scroll', n), i && p.removeEventListener('resize', n);
            }),
                f == null || f(),
                (h = y) == null || h.disconnect(),
                (y = null),
                a && cancelAnimationFrame(m);
        }
    );
}
const zT = vT,
    UT = yT,
    BT = pT,
    $T = ST,
    HT = gT,
    kh = hT,
    WT = wT,
    VT = (e, t, n) => {
        const r = new Map(),
            o = { platform: LT, ...n },
            i = { ...o.platform, _c: r };
        return dT(e, t, { ...o, platform: i });
    };
var es = typeof document < 'u' ? g.useLayoutEffect : g.useEffect;
function Us(e, t) {
    if (e === t) return !0;
    if (typeof e != typeof t) return !1;
    if (typeof e == 'function' && e.toString() === t.toString()) return !0;
    let n, r, o;
    if (e && t && typeof e == 'object') {
        if (Array.isArray(e)) {
            if (((n = e.length), n !== t.length)) return !1;
            for (r = n; r-- !== 0; ) if (!Us(e[r], t[r])) return !1;
            return !0;
        }
        if (((o = Object.keys(e)), (n = o.length), n !== Object.keys(t).length)) return !1;
        for (r = n; r-- !== 0; ) if (!{}.hasOwnProperty.call(t, o[r])) return !1;
        for (r = n; r-- !== 0; ) {
            const i = o[r];
            if (!(i === '_owner' && e.$$typeof) && !Us(e[i], t[i])) return !1;
        }
        return !0;
    }
    return e !== e && t !== t;
}
function bv(e) {
    return typeof window > 'u' ? 1 : (e.ownerDocument.defaultView || window).devicePixelRatio || 1;
}
function Rh(e, t) {
    const n = bv(e);
    return Math.round(t * n) / n;
}
function ha(e) {
    const t = g.useRef(e);
    return (
        es(() => {
            t.current = e;
        }),
        t
    );
}
function qT(e) {
    e === void 0 && (e = {});
    const {
            placement: t = 'bottom',
            strategy: n = 'absolute',
            middleware: r = [],
            platform: o,
            elements: { reference: i, floating: s } = {},
            transform: l = !0,
            whileElementsMounted: a,
            open: c,
        } = e,
        [u, f] = g.useState({ x: 0, y: 0, strategy: n, placement: t, middlewareData: {}, isPositioned: !1 }),
        [d, y] = g.useState(r);
    Us(d, r) || y(r);
    const [m, v] = g.useState(null),
        [S, h] = g.useState(null),
        p = g.useCallback((O) => {
            O !== _.current && ((_.current = O), v(O));
        }, []),
        w = g.useCallback((O) => {
            O !== b.current && ((b.current = O), h(O));
        }, []),
        C = i || m,
        T = s || S,
        _ = g.useRef(null),
        b = g.useRef(null),
        x = g.useRef(u),
        R = a != null,
        N = ha(a),
        L = ha(o),
        I = ha(c),
        z = g.useCallback(() => {
            if (!_.current || !b.current) return;
            const O = { placement: t, strategy: n, middleware: d };
            L.current && (O.platform = L.current),
                VT(_.current, b.current, O).then((P) => {
                    const M = { ...P, isPositioned: I.current !== !1 };
                    j.current &&
                        !Us(x.current, M) &&
                        ((x.current = M),
                        sl.flushSync(() => {
                            f(M);
                        }));
                });
        }, [d, t, n, L, I]);
    es(() => {
        c === !1 && x.current.isPositioned && ((x.current.isPositioned = !1), f((O) => ({ ...O, isPositioned: !1 })));
    }, [c]);
    const j = g.useRef(!1);
    es(
        () => (
            (j.current = !0),
            () => {
                j.current = !1;
            }
        ),
        [],
    ),
        es(() => {
            if ((C && (_.current = C), T && (b.current = T), C && T)) {
                if (N.current) return N.current(C, T, z);
                z();
            }
        }, [C, T, z, N, R]);
    const le = g.useMemo(() => ({ reference: _, floating: b, setReference: p, setFloating: w }), [p, w]),
        W = g.useMemo(() => ({ reference: C, floating: T }), [C, T]),
        Q = g.useMemo(() => {
            const O = { position: n, left: 0, top: 0 };
            if (!W.floating) return O;
            const P = Rh(W.floating, u.x),
                M = Rh(W.floating, u.y);
            return l
                ? {
                      ...O,
                      transform: 'translate(' + P + 'px, ' + M + 'px)',
                      ...(bv(W.floating) >= 1.5 && { willChange: 'transform' }),
                  }
                : { position: n, left: P, top: M };
        }, [n, l, W.floating, u.x, u.y]);
    return g.useMemo(() => ({ ...u, update: z, refs: le, elements: W, floatingStyles: Q }), [u, z, le, W, Q]);
}
const GT = (e) => {
        function t(n) {
            return {}.hasOwnProperty.call(n, 'current');
        }
        return {
            name: 'arrow',
            options: e,
            fn(n) {
                const { element: r, padding: o } = typeof e == 'function' ? e(n) : e;
                return r && t(r)
                    ? r.current != null
                        ? kh({ element: r.current, padding: o }).fn(n)
                        : {}
                    : r
                      ? kh({ element: r, padding: o }).fn(n)
                      : {};
            },
        };
    },
    KT = (e, t) => ({ ...zT(e), options: [e, t] }),
    YT = (e, t) => ({ ...UT(e), options: [e, t] }),
    XT = (e, t) => ({ ...WT(e), options: [e, t] }),
    QT = (e, t) => ({ ...BT(e), options: [e, t] }),
    JT = (e, t) => ({ ...$T(e), options: [e, t] }),
    ZT = (e, t) => ({ ...HT(e), options: [e, t] }),
    ek = (e, t) => ({ ...GT(e), options: [e, t] });
var tk = 'Arrow',
    Tv = g.forwardRef((e, t) => {
        const { children: n, width: r = 10, height: o = 5, ...i } = e;
        return E.jsx(he.svg, {
            ...i,
            ref: t,
            width: r,
            height: o,
            viewBox: '0 0 30 10',
            preserveAspectRatio: 'none',
            children: e.asChild ? n : E.jsx('polygon', { points: '0,0 30,0 15,10' }),
        });
    });
Tv.displayName = tk;
var nk = Tv;
function rk(e) {
    const [t, n] = g.useState(void 0);
    return (
        xn(() => {
            if (e) {
                n({ width: e.offsetWidth, height: e.offsetHeight });
                const r = new ResizeObserver((o) => {
                    if (!Array.isArray(o) || !o.length) return;
                    const i = o[0];
                    let s, l;
                    if ('borderBoxSize' in i) {
                        const a = i.borderBoxSize,
                            c = Array.isArray(a) ? a[0] : a;
                        (s = c.inlineSize), (l = c.blockSize);
                    } else (s = e.offsetWidth), (l = e.offsetHeight);
                    n({ width: s, height: l });
                });
                return r.observe(e, { box: 'border-box' }), () => r.unobserve(e);
            } else n(void 0);
        }, [e]),
        t
    );
}
var af = 'Popper',
    [kv, Rv] = $r(af),
    [ok, _v] = kv(af),
    Ov = (e) => {
        const { __scopePopper: t, children: n } = e,
            [r, o] = g.useState(null);
        return E.jsx(ok, { scope: t, anchor: r, onAnchorChange: o, children: n });
    };
Ov.displayName = af;
var Pv = 'PopperAnchor',
    Nv = g.forwardRef((e, t) => {
        const { __scopePopper: n, virtualRef: r, ...o } = e,
            i = _v(Pv, n),
            s = g.useRef(null),
            l = de(t, s);
        return (
            g.useEffect(() => {
                i.onAnchorChange((r == null ? void 0 : r.current) || s.current);
            }),
            r ? null : E.jsx(he.div, { ...o, ref: l })
        );
    });
Nv.displayName = Pv;
var cf = 'PopperContent',
    [ik, sk] = kv(cf),
    Dv = g.forwardRef((e, t) => {
        var Ae, Kr, Je, Yr, bf, Tf;
        const {
                __scopePopper: n,
                side: r = 'bottom',
                sideOffset: o = 0,
                align: i = 'center',
                alignOffset: s = 0,
                arrowPadding: l = 0,
                avoidCollisions: a = !0,
                collisionBoundary: c = [],
                collisionPadding: u = 0,
                sticky: f = 'partial',
                hideWhenDetached: d = !1,
                updatePositionStrategy: y = 'optimized',
                onPlaced: m,
                ...v
            } = e,
            S = _v(cf, n),
            [h, p] = g.useState(null),
            w = de(t, (Xr) => p(Xr)),
            [C, T] = g.useState(null),
            _ = rk(C),
            b = (_ == null ? void 0 : _.width) ?? 0,
            x = (_ == null ? void 0 : _.height) ?? 0,
            R = r + (i !== 'center' ? '-' + i : ''),
            N = typeof u == 'number' ? u : { top: 0, right: 0, bottom: 0, left: 0, ...u },
            L = Array.isArray(c) ? c : [c],
            I = L.length > 0,
            z = { padding: N, boundary: L.filter(ak), altBoundary: I },
            {
                refs: j,
                floatingStyles: le,
                placement: W,
                isPositioned: Q,
                middlewareData: O,
            } = qT({
                strategy: 'fixed',
                placement: R,
                whileElementsMounted: (...Xr) => jT(...Xr, { animationFrame: y === 'always' }),
                elements: { reference: S.anchor },
                middleware: [
                    KT({ mainAxis: o + x, alignmentAxis: s }),
                    a && YT({ mainAxis: !0, crossAxis: !1, limiter: f === 'partial' ? XT() : void 0, ...z }),
                    a && QT({ ...z }),
                    JT({
                        ...z,
                        apply: ({ elements: Xr, rects: kf, availableWidth: hw, availableHeight: pw }) => {
                            const { width: gw, height: mw } = kf.reference,
                                ci = Xr.floating.style;
                            ci.setProperty('--radix-popper-available-width', `${hw}px`),
                                ci.setProperty('--radix-popper-available-height', `${pw}px`),
                                ci.setProperty('--radix-popper-anchor-width', `${gw}px`),
                                ci.setProperty('--radix-popper-anchor-height', `${mw}px`);
                        },
                    }),
                    C && ek({ element: C, padding: l }),
                    ck({ arrowWidth: b, arrowHeight: x }),
                    d && ZT({ strategy: 'referenceHidden', ...z }),
                ],
            }),
            [P, M] = Mv(W),
            F = ue(m);
        xn(() => {
            Q && (F == null || F());
        }, [Q, F]);
        const Y = (Ae = O.arrow) == null ? void 0 : Ae.x,
            xt = (Kr = O.arrow) == null ? void 0 : Kr.y,
            Be = ((Je = O.arrow) == null ? void 0 : Je.centerOffset) !== 0,
            [Jt, _e] = g.useState();
        return (
            xn(() => {
                h && _e(window.getComputedStyle(h).zIndex);
            }, [h]),
            E.jsx('div', {
                ref: j.setFloating,
                'data-radix-popper-content-wrapper': '',
                style: {
                    ...le,
                    transform: Q ? le.transform : 'translate(0, -200%)',
                    minWidth: 'max-content',
                    zIndex: Jt,
                    '--radix-popper-transform-origin': [
                        (Yr = O.transformOrigin) == null ? void 0 : Yr.x,
                        (bf = O.transformOrigin) == null ? void 0 : bf.y,
                    ].join(' '),
                    ...(((Tf = O.hide) == null ? void 0 : Tf.referenceHidden) && {
                        visibility: 'hidden',
                        pointerEvents: 'none',
                    }),
                },
                dir: e.dir,
                children: E.jsx(ik, {
                    scope: n,
                    placedSide: P,
                    onArrowChange: T,
                    arrowX: Y,
                    arrowY: xt,
                    shouldHideArrow: Be,
                    children: E.jsx(he.div, {
                        'data-side': P,
                        'data-align': M,
                        ...v,
                        ref: w,
                        style: { ...v.style, animation: Q ? void 0 : 'none' },
                    }),
                }),
            })
        );
    });
Dv.displayName = cf;
var Av = 'PopperArrow',
    lk = { top: 'bottom', right: 'left', bottom: 'top', left: 'right' },
    Iv = g.forwardRef(function (t, n) {
        const { __scopePopper: r, ...o } = t,
            i = sk(Av, r),
            s = lk[i.placedSide];
        return E.jsx('span', {
            ref: i.onArrowChange,
            style: {
                position: 'absolute',
                left: i.arrowX,
                top: i.arrowY,
                [s]: 0,
                transformOrigin: { top: '', right: '0 0', bottom: 'center 0', left: '100% 0' }[i.placedSide],
                transform: {
                    top: 'translateY(100%)',
                    right: 'translateY(50%) rotate(90deg) translateX(-50%)',
                    bottom: 'rotate(180deg)',
                    left: 'translateY(50%) rotate(-90deg) translateX(50%)',
                }[i.placedSide],
                visibility: i.shouldHideArrow ? 'hidden' : void 0,
            },
            children: E.jsx(nk, { ...o, ref: n, style: { ...o.style, display: 'block' } }),
        });
    });
Iv.displayName = Av;
function ak(e) {
    return e !== null;
}
var ck = (e) => ({
    name: 'transformOrigin',
    options: e,
    fn(t) {
        var S, h, p;
        const { placement: n, rects: r, middlewareData: o } = t,
            s = ((S = o.arrow) == null ? void 0 : S.centerOffset) !== 0,
            l = s ? 0 : e.arrowWidth,
            a = s ? 0 : e.arrowHeight,
            [c, u] = Mv(n),
            f = { start: '0%', center: '50%', end: '100%' }[u],
            d = (((h = o.arrow) == null ? void 0 : h.x) ?? 0) + l / 2,
            y = (((p = o.arrow) == null ? void 0 : p.y) ?? 0) + a / 2;
        let m = '',
            v = '';
        return (
            c === 'bottom'
                ? ((m = s ? f : `${d}px`), (v = `${-a}px`))
                : c === 'top'
                  ? ((m = s ? f : `${d}px`), (v = `${r.floating.height + a}px`))
                  : c === 'right'
                    ? ((m = `${-a}px`), (v = s ? f : `${y}px`))
                    : c === 'left' && ((m = `${r.floating.width + a}px`), (v = s ? f : `${y}px`)),
            { data: { x: m, y: v } }
        );
    },
});
function Mv(e) {
    const [t, n = 'center'] = e.split('-');
    return [t, n];
}
var Lv = Ov,
    uk = Nv,
    fk = Dv,
    dk = Iv,
    hk = 'Portal',
    Fv = g.forwardRef((e, t) => {
        var l;
        const { container: n, ...r } = e,
            [o, i] = g.useState(!1);
        xn(() => i(!0), []);
        const s = n || (o && ((l = globalThis == null ? void 0 : globalThis.document) == null ? void 0 : l.body));
        return s ? q0.createPortal(E.jsx(he.div, { ...r, ref: t }), s) : null;
    });
Fv.displayName = hk;
function jv({ prop: e, defaultProp: t, onChange: n = () => {} }) {
    const [r, o] = pk({ defaultProp: t, onChange: n }),
        i = e !== void 0,
        s = i ? e : r,
        l = ue(n),
        a = g.useCallback(
            (c) => {
                if (i) {
                    const f = typeof c == 'function' ? c(e) : c;
                    f !== e && l(f);
                } else o(c);
            },
            [i, e, o, l],
        );
    return [s, a];
}
function pk({ defaultProp: e, onChange: t }) {
    const n = g.useState(e),
        [r] = n,
        o = g.useRef(r),
        i = ue(t);
    return (
        g.useEffect(() => {
            o.current !== r && (i(r), (o.current = r));
        }, [r, o, i]),
        n
    );
}
var pa = 'rovingFocusGroup.onEntryFocus',
    gk = { bubbles: !1, cancelable: !0 },
    Cl = 'RovingFocusGroup',
    [Ic, zv, mk] = cv(Cl),
    [vk, Uv] = $r(Cl, [mk]),
    [yk, wk] = vk(Cl),
    Bv = g.forwardRef((e, t) =>
        E.jsx(Ic.Provider, {
            scope: e.__scopeRovingFocusGroup,
            children: E.jsx(Ic.Slot, { scope: e.__scopeRovingFocusGroup, children: E.jsx(Sk, { ...e, ref: t }) }),
        }),
    );
Bv.displayName = Cl;
var Sk = g.forwardRef((e, t) => {
        const {
                __scopeRovingFocusGroup: n,
                orientation: r,
                loop: o = !1,
                dir: i,
                currentTabStopId: s,
                defaultCurrentTabStopId: l,
                onCurrentTabStopIdChange: a,
                onEntryFocus: c,
                preventScrollOnEntryFocus: u = !1,
                ...f
            } = e,
            d = g.useRef(null),
            y = de(t, d),
            m = Ku(i),
            [v = null, S] = jv({ prop: s, defaultProp: l, onChange: a }),
            [h, p] = g.useState(!1),
            w = ue(c),
            C = zv(n),
            T = g.useRef(!1),
            [_, b] = g.useState(0);
        return (
            g.useEffect(() => {
                const x = d.current;
                if (x) return x.addEventListener(pa, w), () => x.removeEventListener(pa, w);
            }, [w]),
            E.jsx(yk, {
                scope: n,
                orientation: r,
                dir: m,
                loop: o,
                currentTabStopId: v,
                onItemFocus: g.useCallback((x) => S(x), [S]),
                onItemShiftTab: g.useCallback(() => p(!0), []),
                onFocusableItemAdd: g.useCallback(() => b((x) => x + 1), []),
                onFocusableItemRemove: g.useCallback(() => b((x) => x - 1), []),
                children: E.jsx(he.div, {
                    tabIndex: h || _ === 0 ? -1 : 0,
                    'data-orientation': r,
                    ...f,
                    ref: y,
                    style: { outline: 'none', ...e.style },
                    onMouseDown: $(e.onMouseDown, () => {
                        T.current = !0;
                    }),
                    onFocus: $(e.onFocus, (x) => {
                        const R = !T.current;
                        if (x.target === x.currentTarget && R && !h) {
                            const N = new CustomEvent(pa, gk);
                            if ((x.currentTarget.dispatchEvent(N), !N.defaultPrevented)) {
                                const L = C().filter((W) => W.focusable),
                                    I = L.find((W) => W.active),
                                    z = L.find((W) => W.id === v),
                                    le = [I, z, ...L].filter(Boolean).map((W) => W.ref.current);
                                Wv(le, u);
                            }
                        }
                        T.current = !1;
                    }),
                    onBlur: $(e.onBlur, () => p(!1)),
                }),
            })
        );
    }),
    $v = 'RovingFocusGroupItem',
    Hv = g.forwardRef((e, t) => {
        const { __scopeRovingFocusGroup: n, focusable: r = !0, active: o = !1, tabStopId: i, ...s } = e,
            l = Pc(),
            a = i || l,
            c = wk($v, n),
            u = c.currentTabStopId === a,
            f = zv(n),
            { onFocusableItemAdd: d, onFocusableItemRemove: y } = c;
        return (
            g.useEffect(() => {
                if (r) return d(), () => y();
            }, [r, d, y]),
            E.jsx(Ic.ItemSlot, {
                scope: n,
                id: a,
                focusable: r,
                active: o,
                children: E.jsx(he.span, {
                    tabIndex: u ? 0 : -1,
                    'data-orientation': c.orientation,
                    ...s,
                    ref: t,
                    onMouseDown: $(e.onMouseDown, (m) => {
                        r ? c.onItemFocus(a) : m.preventDefault();
                    }),
                    onFocus: $(e.onFocus, () => c.onItemFocus(a)),
                    onKeyDown: $(e.onKeyDown, (m) => {
                        if (m.key === 'Tab' && m.shiftKey) {
                            c.onItemShiftTab();
                            return;
                        }
                        if (m.target !== m.currentTarget) return;
                        const v = Ck(m, c.orientation, c.dir);
                        if (v !== void 0) {
                            if (m.metaKey || m.ctrlKey || m.altKey || m.shiftKey) return;
                            m.preventDefault();
                            let h = f()
                                .filter((p) => p.focusable)
                                .map((p) => p.ref.current);
                            if (v === 'last') h.reverse();
                            else if (v === 'prev' || v === 'next') {
                                v === 'prev' && h.reverse();
                                const p = h.indexOf(m.currentTarget);
                                h = c.loop ? bk(h, p + 1) : h.slice(p + 1);
                            }
                            setTimeout(() => Wv(h));
                        }
                    }),
                }),
            })
        );
    });
Hv.displayName = $v;
var Ek = {
    ArrowLeft: 'prev',
    ArrowUp: 'prev',
    ArrowRight: 'next',
    ArrowDown: 'next',
    PageUp: 'first',
    Home: 'first',
    PageDown: 'last',
    End: 'last',
};
function xk(e, t) {
    return t !== 'rtl' ? e : e === 'ArrowLeft' ? 'ArrowRight' : e === 'ArrowRight' ? 'ArrowLeft' : e;
}
function Ck(e, t, n) {
    const r = xk(e.key, n);
    if (
        !(t === 'vertical' && ['ArrowLeft', 'ArrowRight'].includes(r)) &&
        !(t === 'horizontal' && ['ArrowUp', 'ArrowDown'].includes(r))
    )
        return Ek[r];
}
function Wv(e, t = !1) {
    const n = document.activeElement;
    for (const r of e) if (r === n || (r.focus({ preventScroll: t }), document.activeElement !== n)) return;
}
function bk(e, t) {
    return e.map((n, r) => e[(t + r) % e.length]);
}
var Tk = Bv,
    kk = Hv,
    Rk = function (e) {
        if (typeof document > 'u') return null;
        var t = Array.isArray(e) ? e[0] : e;
        return t.ownerDocument.body;
    },
    tr = new WeakMap(),
    Pi = new WeakMap(),
    Ni = {},
    ga = 0,
    Vv = function (e) {
        return e && (e.host || Vv(e.parentNode));
    },
    _k = function (e, t) {
        return t
            .map(function (n) {
                if (e.contains(n)) return n;
                var r = Vv(n);
                return r && e.contains(r)
                    ? r
                    : (console.error('aria-hidden', n, 'in not contained inside', e, '. Doing nothing'), null);
            })
            .filter(function (n) {
                return !!n;
            });
    },
    Ok = function (e, t, n, r) {
        var o = _k(t, Array.isArray(e) ? e : [e]);
        Ni[n] || (Ni[n] = new WeakMap());
        var i = Ni[n],
            s = [],
            l = new Set(),
            a = new Set(o),
            c = function (f) {
                !f || l.has(f) || (l.add(f), c(f.parentNode));
            };
        o.forEach(c);
        var u = function (f) {
            !f ||
                a.has(f) ||
                Array.prototype.forEach.call(f.children, function (d) {
                    if (l.has(d)) u(d);
                    else
                        try {
                            var y = d.getAttribute(r),
                                m = y !== null && y !== 'false',
                                v = (tr.get(d) || 0) + 1,
                                S = (i.get(d) || 0) + 1;
                            tr.set(d, v),
                                i.set(d, S),
                                s.push(d),
                                v === 1 && m && Pi.set(d, !0),
                                S === 1 && d.setAttribute(n, 'true'),
                                m || d.setAttribute(r, 'true');
                        } catch (h) {
                            console.error('aria-hidden: cannot operate on ', d, h);
                        }
                });
        };
        return (
            u(t),
            l.clear(),
            ga++,
            function () {
                s.forEach(function (f) {
                    var d = tr.get(f) - 1,
                        y = i.get(f) - 1;
                    tr.set(f, d),
                        i.set(f, y),
                        d || (Pi.has(f) || f.removeAttribute(r), Pi.delete(f)),
                        y || f.removeAttribute(n);
                }),
                    ga--,
                    ga || ((tr = new WeakMap()), (tr = new WeakMap()), (Pi = new WeakMap()), (Ni = {}));
            }
        );
    },
    Pk = function (e, t, n) {
        n === void 0 && (n = 'data-aria-hidden');
        var r = Array.from(Array.isArray(e) ? e : [e]),
            o = Rk(e);
        return o
            ? (r.push.apply(r, Array.from(o.querySelectorAll('[aria-live]'))), Ok(r, o, n, 'aria-hidden'))
            : function () {
                  return null;
              };
    },
    Rt = function () {
        return (
            (Rt =
                Object.assign ||
                function (t) {
                    for (var n, r = 1, o = arguments.length; r < o; r++) {
                        n = arguments[r];
                        for (var i in n) Object.prototype.hasOwnProperty.call(n, i) && (t[i] = n[i]);
                    }
                    return t;
                }),
            Rt.apply(this, arguments)
        );
    };
function qv(e, t) {
    var n = {};
    for (var r in e) Object.prototype.hasOwnProperty.call(e, r) && t.indexOf(r) < 0 && (n[r] = e[r]);
    if (e != null && typeof Object.getOwnPropertySymbols == 'function')
        for (var o = 0, r = Object.getOwnPropertySymbols(e); o < r.length; o++)
            t.indexOf(r[o]) < 0 && Object.prototype.propertyIsEnumerable.call(e, r[o]) && (n[r[o]] = e[r[o]]);
    return n;
}
function Nk(e, t, n) {
    if (n || arguments.length === 2)
        for (var r = 0, o = t.length, i; r < o; r++)
            (i || !(r in t)) && (i || (i = Array.prototype.slice.call(t, 0, r)), (i[r] = t[r]));
    return e.concat(i || Array.prototype.slice.call(t));
}
var ts = 'right-scroll-bar-position',
    ns = 'width-before-scroll-bar',
    Dk = 'with-scroll-bars-hidden',
    Ak = '--removed-body-scroll-bar-size';
function ma(e, t) {
    return typeof e == 'function' ? e(t) : e && (e.current = t), e;
}
function Ik(e, t) {
    var n = g.useState(function () {
        return {
            value: e,
            callback: t,
            facade: {
                get current() {
                    return n.value;
                },
                set current(r) {
                    var o = n.value;
                    o !== r && ((n.value = r), n.callback(r, o));
                },
            },
        };
    })[0];
    return (n.callback = t), n.facade;
}
var Mk = typeof window < 'u' ? g.useLayoutEffect : g.useEffect,
    _h = new WeakMap();
function Lk(e, t) {
    var n = Ik(null, function (r) {
        return e.forEach(function (o) {
            return ma(o, r);
        });
    });
    return (
        Mk(
            function () {
                var r = _h.get(n);
                if (r) {
                    var o = new Set(r),
                        i = new Set(e),
                        s = n.current;
                    o.forEach(function (l) {
                        i.has(l) || ma(l, null);
                    }),
                        i.forEach(function (l) {
                            o.has(l) || ma(l, s);
                        });
                }
                _h.set(n, e);
            },
            [e],
        ),
        n
    );
}
function Fk(e) {
    return e;
}
function jk(e, t) {
    t === void 0 && (t = Fk);
    var n = [],
        r = !1,
        o = {
            read: function () {
                if (r)
                    throw new Error(
                        'Sidecar: could not `read` from an `assigned` medium. `read` could be used only with `useMedium`.',
                    );
                return n.length ? n[n.length - 1] : e;
            },
            useMedium: function (i) {
                var s = t(i, r);
                return (
                    n.push(s),
                    function () {
                        n = n.filter(function (l) {
                            return l !== s;
                        });
                    }
                );
            },
            assignSyncMedium: function (i) {
                for (r = !0; n.length; ) {
                    var s = n;
                    (n = []), s.forEach(i);
                }
                n = {
                    push: function (l) {
                        return i(l);
                    },
                    filter: function () {
                        return n;
                    },
                };
            },
            assignMedium: function (i) {
                r = !0;
                var s = [];
                if (n.length) {
                    var l = n;
                    (n = []), l.forEach(i), (s = n);
                }
                var a = function () {
                        var u = s;
                        (s = []), u.forEach(i);
                    },
                    c = function () {
                        return Promise.resolve().then(a);
                    };
                c(),
                    (n = {
                        push: function (u) {
                            s.push(u), c();
                        },
                        filter: function (u) {
                            return (s = s.filter(u)), n;
                        },
                    });
            },
        };
    return o;
}
function zk(e) {
    e === void 0 && (e = {});
    var t = jk(null);
    return (t.options = Rt({ async: !0, ssr: !1 }, e)), t;
}
var Gv = function (e) {
    var t = e.sideCar,
        n = qv(e, ['sideCar']);
    if (!t) throw new Error('Sidecar: please provide `sideCar` property to import the right car');
    var r = t.read();
    if (!r) throw new Error('Sidecar medium not found');
    return g.createElement(r, Rt({}, n));
};
Gv.isSideCarExport = !0;
function Uk(e, t) {
    return e.useMedium(t), Gv;
}
var Kv = zk(),
    va = function () {},
    bl = g.forwardRef(function (e, t) {
        var n = g.useRef(null),
            r = g.useState({ onScrollCapture: va, onWheelCapture: va, onTouchMoveCapture: va }),
            o = r[0],
            i = r[1],
            s = e.forwardProps,
            l = e.children,
            a = e.className,
            c = e.removeScrollBar,
            u = e.enabled,
            f = e.shards,
            d = e.sideCar,
            y = e.noIsolation,
            m = e.inert,
            v = e.allowPinchZoom,
            S = e.as,
            h = S === void 0 ? 'div' : S,
            p = e.gapMode,
            w = qv(e, [
                'forwardProps',
                'children',
                'className',
                'removeScrollBar',
                'enabled',
                'shards',
                'sideCar',
                'noIsolation',
                'inert',
                'allowPinchZoom',
                'as',
                'gapMode',
            ]),
            C = d,
            T = Lk([n, t]),
            _ = Rt(Rt({}, w), o);
        return g.createElement(
            g.Fragment,
            null,
            u &&
                g.createElement(C, {
                    sideCar: Kv,
                    removeScrollBar: c,
                    shards: f,
                    noIsolation: y,
                    inert: m,
                    setCallbacks: i,
                    allowPinchZoom: !!v,
                    lockRef: n,
                    gapMode: p,
                }),
            s
                ? g.cloneElement(g.Children.only(l), Rt(Rt({}, _), { ref: T }))
                : g.createElement(h, Rt({}, _, { className: a, ref: T }), l),
        );
    });
bl.defaultProps = { enabled: !0, removeScrollBar: !0, inert: !1 };
bl.classNames = { fullWidth: ns, zeroRight: ts };
var Bk = function () {
    if (typeof __webpack_nonce__ < 'u') return __webpack_nonce__;
};
function $k() {
    if (!document) return null;
    var e = document.createElement('style');
    e.type = 'text/css';
    var t = Bk();
    return t && e.setAttribute('nonce', t), e;
}
function Hk(e, t) {
    e.styleSheet ? (e.styleSheet.cssText = t) : e.appendChild(document.createTextNode(t));
}
function Wk(e) {
    var t = document.head || document.getElementsByTagName('head')[0];
    t.appendChild(e);
}
var Vk = function () {
        var e = 0,
            t = null;
        return {
            add: function (n) {
                e == 0 && (t = $k()) && (Hk(t, n), Wk(t)), e++;
            },
            remove: function () {
                e--, !e && t && (t.parentNode && t.parentNode.removeChild(t), (t = null));
            },
        };
    },
    qk = function () {
        var e = Vk();
        return function (t, n) {
            g.useEffect(
                function () {
                    return (
                        e.add(t),
                        function () {
                            e.remove();
                        }
                    );
                },
                [t && n],
            );
        };
    },
    Yv = function () {
        var e = qk(),
            t = function (n) {
                var r = n.styles,
                    o = n.dynamic;
                return e(r, o), null;
            };
        return t;
    },
    Gk = { left: 0, top: 0, right: 0, gap: 0 },
    ya = function (e) {
        return parseInt(e || '', 10) || 0;
    },
    Kk = function (e) {
        var t = window.getComputedStyle(document.body),
            n = t[e === 'padding' ? 'paddingLeft' : 'marginLeft'],
            r = t[e === 'padding' ? 'paddingTop' : 'marginTop'],
            o = t[e === 'padding' ? 'paddingRight' : 'marginRight'];
        return [ya(n), ya(r), ya(o)];
    },
    Yk = function (e) {
        if ((e === void 0 && (e = 'margin'), typeof window > 'u')) return Gk;
        var t = Kk(e),
            n = document.documentElement.clientWidth,
            r = window.innerWidth;
        return { left: t[0], top: t[1], right: t[2], gap: Math.max(0, r - n + t[2] - t[0]) };
    },
    Xk = Yv(),
    Tr = 'data-scroll-locked',
    Qk = function (e, t, n, r) {
        var o = e.left,
            i = e.top,
            s = e.right,
            l = e.gap;
        return (
            n === void 0 && (n = 'margin'),
            `
  .`
                .concat(
                    Dk,
                    ` {
   overflow: hidden `,
                )
                .concat(
                    r,
                    `;
   padding-right: `,
                )
                .concat(l, 'px ')
                .concat(
                    r,
                    `;
  }
  body[`,
                )
                .concat(
                    Tr,
                    `] {
    overflow: hidden `,
                )
                .concat(
                    r,
                    `;
    overscroll-behavior: contain;
    `,
                )
                .concat(
                    [
                        t && 'position: relative '.concat(r, ';'),
                        n === 'margin' &&
                            `
    padding-left: `
                                .concat(
                                    o,
                                    `px;
    padding-top: `,
                                )
                                .concat(
                                    i,
                                    `px;
    padding-right: `,
                                )
                                .concat(
                                    s,
                                    `px;
    margin-left:0;
    margin-top:0;
    margin-right: `,
                                )
                                .concat(l, 'px ')
                                .concat(
                                    r,
                                    `;
    `,
                                ),
                        n === 'padding' && 'padding-right: '.concat(l, 'px ').concat(r, ';'),
                    ]
                        .filter(Boolean)
                        .join(''),
                    `
  }
  
  .`,
                )
                .concat(
                    ts,
                    ` {
    right: `,
                )
                .concat(l, 'px ')
                .concat(
                    r,
                    `;
  }
  
  .`,
                )
                .concat(
                    ns,
                    ` {
    margin-right: `,
                )
                .concat(l, 'px ')
                .concat(
                    r,
                    `;
  }
  
  .`,
                )
                .concat(ts, ' .')
                .concat(
                    ts,
                    ` {
    right: 0 `,
                )
                .concat(
                    r,
                    `;
  }
  
  .`,
                )
                .concat(ns, ' .')
                .concat(
                    ns,
                    ` {
    margin-right: 0 `,
                )
                .concat(
                    r,
                    `;
  }
  
  body[`,
                )
                .concat(
                    Tr,
                    `] {
    `,
                )
                .concat(Ak, ': ')
                .concat(
                    l,
                    `px;
  }
`,
                )
        );
    },
    Oh = function () {
        var e = parseInt(document.body.getAttribute(Tr) || '0', 10);
        return isFinite(e) ? e : 0;
    },
    Jk = function () {
        g.useEffect(function () {
            return (
                document.body.setAttribute(Tr, (Oh() + 1).toString()),
                function () {
                    var e = Oh() - 1;
                    e <= 0 ? document.body.removeAttribute(Tr) : document.body.setAttribute(Tr, e.toString());
                }
            );
        }, []);
    },
    Zk = function (e) {
        var t = e.noRelative,
            n = e.noImportant,
            r = e.gapMode,
            o = r === void 0 ? 'margin' : r;
        Jk();
        var i = g.useMemo(
            function () {
                return Yk(o);
            },
            [o],
        );
        return g.createElement(Xk, { styles: Qk(i, !t, o, n ? '' : '!important') });
    },
    Mc = !1;
if (typeof window < 'u')
    try {
        var Di = Object.defineProperty({}, 'passive', {
            get: function () {
                return (Mc = !0), !0;
            },
        });
        window.addEventListener('test', Di, Di), window.removeEventListener('test', Di, Di);
    } catch {
        Mc = !1;
    }
var nr = Mc ? { passive: !1 } : !1,
    eR = function (e) {
        return e.tagName === 'TEXTAREA';
    },
    Xv = function (e, t) {
        if (!(e instanceof Element)) return !1;
        var n = window.getComputedStyle(e);
        return n[t] !== 'hidden' && !(n.overflowY === n.overflowX && !eR(e) && n[t] === 'visible');
    },
    tR = function (e) {
        return Xv(e, 'overflowY');
    },
    nR = function (e) {
        return Xv(e, 'overflowX');
    },
    Ph = function (e, t) {
        var n = t.ownerDocument,
            r = t;
        do {
            typeof ShadowRoot < 'u' && r instanceof ShadowRoot && (r = r.host);
            var o = Qv(e, r);
            if (o) {
                var i = Jv(e, r),
                    s = i[1],
                    l = i[2];
                if (s > l) return !0;
            }
            r = r.parentNode;
        } while (r && r !== n.body);
        return !1;
    },
    rR = function (e) {
        var t = e.scrollTop,
            n = e.scrollHeight,
            r = e.clientHeight;
        return [t, n, r];
    },
    oR = function (e) {
        var t = e.scrollLeft,
            n = e.scrollWidth,
            r = e.clientWidth;
        return [t, n, r];
    },
    Qv = function (e, t) {
        return e === 'v' ? tR(t) : nR(t);
    },
    Jv = function (e, t) {
        return e === 'v' ? rR(t) : oR(t);
    },
    iR = function (e, t) {
        return e === 'h' && t === 'rtl' ? -1 : 1;
    },
    sR = function (e, t, n, r, o) {
        var i = iR(e, window.getComputedStyle(t).direction),
            s = i * r,
            l = n.target,
            a = t.contains(l),
            c = !1,
            u = s > 0,
            f = 0,
            d = 0;
        do {
            var y = Jv(e, l),
                m = y[0],
                v = y[1],
                S = y[2],
                h = v - S - i * m;
            (m || h) && Qv(e, l) && ((f += h), (d += m)), l instanceof ShadowRoot ? (l = l.host) : (l = l.parentNode);
        } while ((!a && l !== document.body) || (a && (t.contains(l) || t === l)));
        return ((u && Math.abs(f) < 1) || (!u && Math.abs(d) < 1)) && (c = !0), c;
    },
    Ai = function (e) {
        return 'changedTouches' in e ? [e.changedTouches[0].clientX, e.changedTouches[0].clientY] : [0, 0];
    },
    Nh = function (e) {
        return [e.deltaX, e.deltaY];
    },
    Dh = function (e) {
        return e && 'current' in e ? e.current : e;
    },
    lR = function (e, t) {
        return e[0] === t[0] && e[1] === t[1];
    },
    aR = function (e) {
        return `
  .block-interactivity-`
            .concat(
                e,
                ` {pointer-events: none;}
  .allow-interactivity-`,
            )
            .concat(
                e,
                ` {pointer-events: all;}
`,
            );
    },
    cR = 0,
    rr = [];
function uR(e) {
    var t = g.useRef([]),
        n = g.useRef([0, 0]),
        r = g.useRef(),
        o = g.useState(cR++)[0],
        i = g.useState(Yv)[0],
        s = g.useRef(e);
    g.useEffect(
        function () {
            s.current = e;
        },
        [e],
    ),
        g.useEffect(
            function () {
                if (e.inert) {
                    document.body.classList.add('block-interactivity-'.concat(o));
                    var v = Nk([e.lockRef.current], (e.shards || []).map(Dh), !0).filter(Boolean);
                    return (
                        v.forEach(function (S) {
                            return S.classList.add('allow-interactivity-'.concat(o));
                        }),
                        function () {
                            document.body.classList.remove('block-interactivity-'.concat(o)),
                                v.forEach(function (S) {
                                    return S.classList.remove('allow-interactivity-'.concat(o));
                                });
                        }
                    );
                }
            },
            [e.inert, e.lockRef.current, e.shards],
        );
    var l = g.useCallback(function (v, S) {
            if (('touches' in v && v.touches.length === 2) || (v.type === 'wheel' && v.ctrlKey))
                return !s.current.allowPinchZoom;
            var h = Ai(v),
                p = n.current,
                w = 'deltaX' in v ? v.deltaX : p[0] - h[0],
                C = 'deltaY' in v ? v.deltaY : p[1] - h[1],
                T,
                _ = v.target,
                b = Math.abs(w) > Math.abs(C) ? 'h' : 'v';
            if ('touches' in v && b === 'h' && _.type === 'range') return !1;
            var x = Ph(b, _);
            if (!x) return !0;
            if ((x ? (T = b) : ((T = b === 'v' ? 'h' : 'v'), (x = Ph(b, _))), !x)) return !1;
            if ((!r.current && 'changedTouches' in v && (w || C) && (r.current = T), !T)) return !0;
            var R = r.current || T;
            return sR(R, S, v, R === 'h' ? w : C);
        }, []),
        a = g.useCallback(function (v) {
            var S = v;
            if (!(!rr.length || rr[rr.length - 1] !== i)) {
                var h = 'deltaY' in S ? Nh(S) : Ai(S),
                    p = t.current.filter(function (T) {
                        return T.name === S.type && (T.target === S.target || S.target === T.shadowParent) && lR(T.delta, h);
                    })[0];
                if (p && p.should) {
                    S.cancelable && S.preventDefault();
                    return;
                }
                if (!p) {
                    var w = (s.current.shards || [])
                            .map(Dh)
                            .filter(Boolean)
                            .filter(function (T) {
                                return T.contains(S.target);
                            }),
                        C = w.length > 0 ? l(S, w[0]) : !s.current.noIsolation;
                    C && S.cancelable && S.preventDefault();
                }
            }
        }, []),
        c = g.useCallback(function (v, S, h, p) {
            var w = { name: v, delta: S, target: h, should: p, shadowParent: fR(h) };
            t.current.push(w),
                setTimeout(function () {
                    t.current = t.current.filter(function (C) {
                        return C !== w;
                    });
                }, 1);
        }, []),
        u = g.useCallback(function (v) {
            (n.current = Ai(v)), (r.current = void 0);
        }, []),
        f = g.useCallback(function (v) {
            c(v.type, Nh(v), v.target, l(v, e.lockRef.current));
        }, []),
        d = g.useCallback(function (v) {
            c(v.type, Ai(v), v.target, l(v, e.lockRef.current));
        }, []);
    g.useEffect(function () {
        return (
            rr.push(i),
            e.setCallbacks({ onScrollCapture: f, onWheelCapture: f, onTouchMoveCapture: d }),
            document.addEventListener('wheel', a, nr),
            document.addEventListener('touchmove', a, nr),
            document.addEventListener('touchstart', u, nr),
            function () {
                (rr = rr.filter(function (v) {
                    return v !== i;
                })),
                    document.removeEventListener('wheel', a, nr),
                    document.removeEventListener('touchmove', a, nr),
                    document.removeEventListener('touchstart', u, nr);
            }
        );
    }, []);
    var y = e.removeScrollBar,
        m = e.inert;
    return g.createElement(
        g.Fragment,
        null,
        m ? g.createElement(i, { styles: aR(o) }) : null,
        y ? g.createElement(Zk, { gapMode: e.gapMode }) : null,
    );
}
function fR(e) {
    for (var t = null; e !== null; ) e instanceof ShadowRoot && ((t = e.host), (e = e.host)), (e = e.parentNode);
    return t;
}
const dR = Uk(Kv, uR);
var Zv = g.forwardRef(function (e, t) {
    return g.createElement(bl, Rt({}, e, { ref: t, sideCar: dR }));
});
Zv.classNames = bl.classNames;
var Lc = ['Enter', ' '],
    hR = ['ArrowDown', 'PageUp', 'Home'],
    ey = ['ArrowUp', 'PageDown', 'End'],
    pR = [...hR, ...ey],
    gR = { ltr: [...Lc, 'ArrowRight'], rtl: [...Lc, 'ArrowLeft'] },
    mR = { ltr: ['ArrowLeft'], rtl: ['ArrowRight'] },
    si = 'Menu',
    [Yo, vR, yR] = cv(si),
    [Jn, ty] = $r(si, [yR, Rv, Uv]),
    li = Rv(),
    ny = Uv(),
    [ry, Pn] = Jn(si),
    [wR, ai] = Jn(si),
    oy = (e) => {
        const { __scopeMenu: t, open: n = !1, children: r, dir: o, onOpenChange: i, modal: s = !0 } = e,
            l = li(t),
            [a, c] = g.useState(null),
            u = g.useRef(!1),
            f = ue(i),
            d = Ku(o);
        return (
            g.useEffect(() => {
                const y = () => {
                        (u.current = !0),
                            document.addEventListener('pointerdown', m, { capture: !0, once: !0 }),
                            document.addEventListener('pointermove', m, { capture: !0, once: !0 });
                    },
                    m = () => (u.current = !1);
                return (
                    document.addEventListener('keydown', y, { capture: !0 }),
                    () => {
                        document.removeEventListener('keydown', y, { capture: !0 }),
                            document.removeEventListener('pointerdown', m, { capture: !0 }),
                            document.removeEventListener('pointermove', m, { capture: !0 });
                    }
                );
            }, []),
            E.jsx(Lv, {
                ...l,
                children: E.jsx(ry, {
                    scope: t,
                    open: n,
                    onOpenChange: f,
                    content: a,
                    onContentChange: c,
                    children: E.jsx(wR, {
                        scope: t,
                        onClose: g.useCallback(() => f(!1), [f]),
                        isUsingKeyboardRef: u,
                        dir: d,
                        modal: s,
                        children: r,
                    }),
                }),
            })
        );
    };
oy.displayName = si;
var SR = 'MenuAnchor',
    uf = g.forwardRef((e, t) => {
        const { __scopeMenu: n, ...r } = e,
            o = li(n);
        return E.jsx(uk, { ...o, ...r, ref: t });
    });
uf.displayName = SR;
var ff = 'MenuPortal',
    [ER, iy] = Jn(ff, { forceMount: void 0 }),
    sy = (e) => {
        const { __scopeMenu: t, forceMount: n, children: r, container: o } = e,
            i = Pn(ff, t);
        return E.jsx(ER, {
            scope: t,
            forceMount: n,
            children: E.jsx(Qt, { present: n || i.open, children: E.jsx(Fv, { asChild: !0, container: o, children: r }) }),
        });
    };
sy.displayName = ff;
var st = 'MenuContent',
    [xR, df] = Jn(st),
    ly = g.forwardRef((e, t) => {
        const n = iy(st, e.__scopeMenu),
            { forceMount: r = n.forceMount, ...o } = e,
            i = Pn(st, e.__scopeMenu),
            s = ai(st, e.__scopeMenu);
        return E.jsx(Yo.Provider, {
            scope: e.__scopeMenu,
            children: E.jsx(Qt, {
                present: r || i.open,
                children: E.jsx(Yo.Slot, {
                    scope: e.__scopeMenu,
                    children: s.modal ? E.jsx(CR, { ...o, ref: t }) : E.jsx(bR, { ...o, ref: t }),
                }),
            }),
        });
    }),
    CR = g.forwardRef((e, t) => {
        const n = Pn(st, e.__scopeMenu),
            r = g.useRef(null),
            o = de(t, r);
        return (
            g.useEffect(() => {
                const i = r.current;
                if (i) return Pk(i);
            }, []),
            E.jsx(hf, {
                ...e,
                ref: o,
                trapFocus: n.open,
                disableOutsidePointerEvents: n.open,
                disableOutsideScroll: !0,
                onFocusOutside: $(e.onFocusOutside, (i) => i.preventDefault(), { checkForDefaultPrevented: !1 }),
                onDismiss: () => n.onOpenChange(!1),
            })
        );
    }),
    bR = g.forwardRef((e, t) => {
        const n = Pn(st, e.__scopeMenu);
        return E.jsx(hf, {
            ...e,
            ref: t,
            trapFocus: !1,
            disableOutsidePointerEvents: !1,
            disableOutsideScroll: !1,
            onDismiss: () => n.onOpenChange(!1),
        });
    }),
    hf = g.forwardRef((e, t) => {
        const {
                __scopeMenu: n,
                loop: r = !1,
                trapFocus: o,
                onOpenAutoFocus: i,
                onCloseAutoFocus: s,
                disableOutsidePointerEvents: l,
                onEntryFocus: a,
                onEscapeKeyDown: c,
                onPointerDownOutside: u,
                onFocusOutside: f,
                onInteractOutside: d,
                onDismiss: y,
                disableOutsideScroll: m,
                ...v
            } = e,
            S = Pn(st, n),
            h = ai(st, n),
            p = li(n),
            w = ny(n),
            C = vR(n),
            [T, _] = g.useState(null),
            b = g.useRef(null),
            x = de(t, b, S.onContentChange),
            R = g.useRef(0),
            N = g.useRef(''),
            L = g.useRef(0),
            I = g.useRef(null),
            z = g.useRef('right'),
            j = g.useRef(0),
            le = m ? Zv : g.Fragment,
            W = m ? { as: qo, allowPinchZoom: !0 } : void 0,
            Q = (P) => {
                var Ae, Kr;
                const M = N.current + P,
                    F = C().filter((Je) => !Je.disabled),
                    Y = document.activeElement,
                    xt = (Ae = F.find((Je) => Je.ref.current === Y)) == null ? void 0 : Ae.textValue,
                    Be = F.map((Je) => Je.textValue),
                    Jt = LR(Be, M, xt),
                    _e = (Kr = F.find((Je) => Je.textValue === Jt)) == null ? void 0 : Kr.ref.current;
                (function Je(Yr) {
                    (N.current = Yr),
                        window.clearTimeout(R.current),
                        Yr !== '' && (R.current = window.setTimeout(() => Je(''), 1e3));
                })(M),
                    _e && setTimeout(() => _e.focus());
            };
        g.useEffect(() => () => window.clearTimeout(R.current), []), Kb();
        const O = g.useCallback((P) => {
            var F, Y;
            return (
                z.current === ((F = I.current) == null ? void 0 : F.side) && jR(P, (Y = I.current) == null ? void 0 : Y.area)
            );
        }, []);
        return E.jsx(xR, {
            scope: n,
            searchRef: N,
            onItemEnter: g.useCallback(
                (P) => {
                    O(P) && P.preventDefault();
                },
                [O],
            ),
            onItemLeave: g.useCallback(
                (P) => {
                    var M;
                    O(P) || ((M = b.current) == null || M.focus(), _(null));
                },
                [O],
            ),
            onTriggerLeave: g.useCallback(
                (P) => {
                    O(P) && P.preventDefault();
                },
                [O],
            ),
            pointerGraceTimerRef: L,
            onPointerGraceIntentChange: g.useCallback((P) => {
                I.current = P;
            }, []),
            children: E.jsx(le, {
                ...W,
                children: E.jsx(hv, {
                    asChild: !0,
                    trapped: o,
                    onMountAutoFocus: $(i, (P) => {
                        var M;
                        P.preventDefault(), (M = b.current) == null || M.focus({ preventScroll: !0 });
                    }),
                    onUnmountAutoFocus: s,
                    children: E.jsx(fv, {
                        asChild: !0,
                        disableOutsidePointerEvents: l,
                        onEscapeKeyDown: c,
                        onPointerDownOutside: u,
                        onFocusOutside: f,
                        onInteractOutside: d,
                        onDismiss: y,
                        children: E.jsx(Tk, {
                            asChild: !0,
                            ...w,
                            dir: h.dir,
                            orientation: 'vertical',
                            loop: r,
                            currentTabStopId: T,
                            onCurrentTabStopIdChange: _,
                            onEntryFocus: $(a, (P) => {
                                h.isUsingKeyboardRef.current || P.preventDefault();
                            }),
                            preventScrollOnEntryFocus: !0,
                            children: E.jsx(fk, {
                                role: 'menu',
                                'aria-orientation': 'vertical',
                                'data-state': by(S.open),
                                'data-radix-menu-content': '',
                                dir: h.dir,
                                ...p,
                                ...v,
                                ref: x,
                                style: { outline: 'none', ...v.style },
                                onKeyDown: $(v.onKeyDown, (P) => {
                                    const F = P.target.closest('[data-radix-menu-content]') === P.currentTarget,
                                        Y = P.ctrlKey || P.altKey || P.metaKey,
                                        xt = P.key.length === 1;
                                    F && (P.key === 'Tab' && P.preventDefault(), !Y && xt && Q(P.key));
                                    const Be = b.current;
                                    if (P.target !== Be || !pR.includes(P.key)) return;
                                    P.preventDefault();
                                    const _e = C()
                                        .filter((Ae) => !Ae.disabled)
                                        .map((Ae) => Ae.ref.current);
                                    ey.includes(P.key) && _e.reverse(), IR(_e);
                                }),
                                onBlur: $(e.onBlur, (P) => {
                                    P.currentTarget.contains(P.target) || (window.clearTimeout(R.current), (N.current = ''));
                                }),
                                onPointerMove: $(
                                    e.onPointerMove,
                                    Xo((P) => {
                                        const M = P.target,
                                            F = j.current !== P.clientX;
                                        if (P.currentTarget.contains(M) && F) {
                                            const Y = P.clientX > j.current ? 'right' : 'left';
                                            (z.current = Y), (j.current = P.clientX);
                                        }
                                    }),
                                ),
                            }),
                        }),
                    }),
                }),
            }),
        });
    });
ly.displayName = st;
var TR = 'MenuGroup',
    pf = g.forwardRef((e, t) => {
        const { __scopeMenu: n, ...r } = e;
        return E.jsx(he.div, { role: 'group', ...r, ref: t });
    });
pf.displayName = TR;
var kR = 'MenuLabel',
    ay = g.forwardRef((e, t) => {
        const { __scopeMenu: n, ...r } = e;
        return E.jsx(he.div, { ...r, ref: t });
    });
ay.displayName = kR;
var Bs = 'MenuItem',
    Ah = 'menu.itemSelect',
    Tl = g.forwardRef((e, t) => {
        const { disabled: n = !1, onSelect: r, ...o } = e,
            i = g.useRef(null),
            s = ai(Bs, e.__scopeMenu),
            l = df(Bs, e.__scopeMenu),
            a = de(t, i),
            c = g.useRef(!1),
            u = () => {
                const f = i.current;
                if (!n && f) {
                    const d = new CustomEvent(Ah, { bubbles: !0, cancelable: !0 });
                    f.addEventListener(Ah, (y) => (r == null ? void 0 : r(y)), { once: !0 }),
                        Um(f, d),
                        d.defaultPrevented ? (c.current = !1) : s.onClose();
                }
            };
        return E.jsx(cy, {
            ...o,
            ref: a,
            disabled: n,
            onClick: $(e.onClick, u),
            onPointerDown: (f) => {
                var d;
                (d = e.onPointerDown) == null || d.call(e, f), (c.current = !0);
            },
            onPointerUp: $(e.onPointerUp, (f) => {
                var d;
                c.current || (d = f.currentTarget) == null || d.click();
            }),
            onKeyDown: $(e.onKeyDown, (f) => {
                const d = l.searchRef.current !== '';
                n || (d && f.key === ' ') || (Lc.includes(f.key) && (f.currentTarget.click(), f.preventDefault()));
            }),
        });
    });
Tl.displayName = Bs;
var cy = g.forwardRef((e, t) => {
        const { __scopeMenu: n, disabled: r = !1, textValue: o, ...i } = e,
            s = df(Bs, n),
            l = ny(n),
            a = g.useRef(null),
            c = de(t, a),
            [u, f] = g.useState(!1),
            [d, y] = g.useState('');
        return (
            g.useEffect(() => {
                const m = a.current;
                m && y((m.textContent ?? '').trim());
            }, [i.children]),
            E.jsx(Yo.ItemSlot, {
                scope: n,
                disabled: r,
                textValue: o ?? d,
                children: E.jsx(kk, {
                    asChild: !0,
                    ...l,
                    focusable: !r,
                    children: E.jsx(he.div, {
                        role: 'menuitem',
                        'data-highlighted': u ? '' : void 0,
                        'aria-disabled': r || void 0,
                        'data-disabled': r ? '' : void 0,
                        ...i,
                        ref: c,
                        onPointerMove: $(
                            e.onPointerMove,
                            Xo((m) => {
                                r
                                    ? s.onItemLeave(m)
                                    : (s.onItemEnter(m), m.defaultPrevented || m.currentTarget.focus({ preventScroll: !0 }));
                            }),
                        ),
                        onPointerLeave: $(
                            e.onPointerLeave,
                            Xo((m) => s.onItemLeave(m)),
                        ),
                        onFocus: $(e.onFocus, () => f(!0)),
                        onBlur: $(e.onBlur, () => f(!1)),
                    }),
                }),
            })
        );
    }),
    RR = 'MenuCheckboxItem',
    uy = g.forwardRef((e, t) => {
        const { checked: n = !1, onCheckedChange: r, ...o } = e;
        return E.jsx(gy, {
            scope: e.__scopeMenu,
            checked: n,
            children: E.jsx(Tl, {
                role: 'menuitemcheckbox',
                'aria-checked': $s(n) ? 'mixed' : n,
                ...o,
                ref: t,
                'data-state': vf(n),
                onSelect: $(o.onSelect, () => (r == null ? void 0 : r($s(n) ? !0 : !n)), { checkForDefaultPrevented: !1 }),
            }),
        });
    });
uy.displayName = RR;
var fy = 'MenuRadioGroup',
    [_R, OR] = Jn(fy, { value: void 0, onValueChange: () => {} }),
    dy = g.forwardRef((e, t) => {
        const { value: n, onValueChange: r, ...o } = e,
            i = ue(r);
        return E.jsx(_R, { scope: e.__scopeMenu, value: n, onValueChange: i, children: E.jsx(pf, { ...o, ref: t }) });
    });
dy.displayName = fy;
var hy = 'MenuRadioItem',
    py = g.forwardRef((e, t) => {
        const { value: n, ...r } = e,
            o = OR(hy, e.__scopeMenu),
            i = n === o.value;
        return E.jsx(gy, {
            scope: e.__scopeMenu,
            checked: i,
            children: E.jsx(Tl, {
                role: 'menuitemradio',
                'aria-checked': i,
                ...r,
                ref: t,
                'data-state': vf(i),
                onSelect: $(
                    r.onSelect,
                    () => {
                        var s;
                        return (s = o.onValueChange) == null ? void 0 : s.call(o, n);
                    },
                    { checkForDefaultPrevented: !1 },
                ),
            }),
        });
    });
py.displayName = hy;
var gf = 'MenuItemIndicator',
    [gy, PR] = Jn(gf, { checked: !1 }),
    my = g.forwardRef((e, t) => {
        const { __scopeMenu: n, forceMount: r, ...o } = e,
            i = PR(gf, n);
        return E.jsx(Qt, {
            present: r || $s(i.checked) || i.checked === !0,
            children: E.jsx(he.span, { ...o, ref: t, 'data-state': vf(i.checked) }),
        });
    });
my.displayName = gf;
var NR = 'MenuSeparator',
    vy = g.forwardRef((e, t) => {
        const { __scopeMenu: n, ...r } = e;
        return E.jsx(he.div, { role: 'separator', 'aria-orientation': 'horizontal', ...r, ref: t });
    });
vy.displayName = NR;
var DR = 'MenuArrow',
    yy = g.forwardRef((e, t) => {
        const { __scopeMenu: n, ...r } = e,
            o = li(n);
        return E.jsx(dk, { ...o, ...r, ref: t });
    });
yy.displayName = DR;
var mf = 'MenuSub',
    [AR, wy] = Jn(mf),
    Sy = (e) => {
        const { __scopeMenu: t, children: n, open: r = !1, onOpenChange: o } = e,
            i = Pn(mf, t),
            s = li(t),
            [l, a] = g.useState(null),
            [c, u] = g.useState(null),
            f = ue(o);
        return (
            g.useEffect(() => (i.open === !1 && f(!1), () => f(!1)), [i.open, f]),
            E.jsx(Lv, {
                ...s,
                children: E.jsx(ry, {
                    scope: t,
                    open: r,
                    onOpenChange: f,
                    content: c,
                    onContentChange: u,
                    children: E.jsx(AR, {
                        scope: t,
                        contentId: Pc(),
                        triggerId: Pc(),
                        trigger: l,
                        onTriggerChange: a,
                        children: n,
                    }),
                }),
            })
        );
    };
Sy.displayName = mf;
var po = 'MenuSubTrigger',
    Ey = g.forwardRef((e, t) => {
        const n = Pn(po, e.__scopeMenu),
            r = ai(po, e.__scopeMenu),
            o = wy(po, e.__scopeMenu),
            i = df(po, e.__scopeMenu),
            s = g.useRef(null),
            { pointerGraceTimerRef: l, onPointerGraceIntentChange: a } = i,
            c = { __scopeMenu: e.__scopeMenu },
            u = g.useCallback(() => {
                s.current && window.clearTimeout(s.current), (s.current = null);
            }, []);
        return (
            g.useEffect(() => u, [u]),
            g.useEffect(() => {
                const f = l.current;
                return () => {
                    window.clearTimeout(f), a(null);
                };
            }, [l, a]),
            E.jsx(uf, {
                asChild: !0,
                ...c,
                children: E.jsx(cy, {
                    id: o.triggerId,
                    'aria-haspopup': 'menu',
                    'aria-expanded': n.open,
                    'aria-controls': o.contentId,
                    'data-state': by(n.open),
                    ...e,
                    ref: Gu(t, o.onTriggerChange),
                    onClick: (f) => {
                        var d;
                        (d = e.onClick) == null || d.call(e, f),
                            !(e.disabled || f.defaultPrevented) && (f.currentTarget.focus(), n.open || n.onOpenChange(!0));
                    },
                    onPointerMove: $(
                        e.onPointerMove,
                        Xo((f) => {
                            i.onItemEnter(f),
                                !f.defaultPrevented &&
                                    !e.disabled &&
                                    !n.open &&
                                    !s.current &&
                                    (i.onPointerGraceIntentChange(null),
                                    (s.current = window.setTimeout(() => {
                                        n.onOpenChange(!0), u();
                                    }, 100)));
                        }),
                    ),
                    onPointerLeave: $(
                        e.onPointerLeave,
                        Xo((f) => {
                            var y, m;
                            u();
                            const d = (y = n.content) == null ? void 0 : y.getBoundingClientRect();
                            if (d) {
                                const v = (m = n.content) == null ? void 0 : m.dataset.side,
                                    S = v === 'right',
                                    h = S ? -5 : 5,
                                    p = d[S ? 'left' : 'right'],
                                    w = d[S ? 'right' : 'left'];
                                i.onPointerGraceIntentChange({
                                    area: [
                                        { x: f.clientX + h, y: f.clientY },
                                        { x: p, y: d.top },
                                        { x: w, y: d.top },
                                        { x: w, y: d.bottom },
                                        { x: p, y: d.bottom },
                                    ],
                                    side: v,
                                }),
                                    window.clearTimeout(l.current),
                                    (l.current = window.setTimeout(() => i.onPointerGraceIntentChange(null), 300));
                            } else {
                                if ((i.onTriggerLeave(f), f.defaultPrevented)) return;
                                i.onPointerGraceIntentChange(null);
                            }
                        }),
                    ),
                    onKeyDown: $(e.onKeyDown, (f) => {
                        var y;
                        const d = i.searchRef.current !== '';
                        e.disabled ||
                            (d && f.key === ' ') ||
                            (gR[r.dir].includes(f.key) &&
                                (n.onOpenChange(!0), (y = n.content) == null || y.focus(), f.preventDefault()));
                    }),
                }),
            })
        );
    });
Ey.displayName = po;
var xy = 'MenuSubContent',
    Cy = g.forwardRef((e, t) => {
        const n = iy(st, e.__scopeMenu),
            { forceMount: r = n.forceMount, ...o } = e,
            i = Pn(st, e.__scopeMenu),
            s = ai(st, e.__scopeMenu),
            l = wy(xy, e.__scopeMenu),
            a = g.useRef(null),
            c = de(t, a);
        return E.jsx(Yo.Provider, {
            scope: e.__scopeMenu,
            children: E.jsx(Qt, {
                present: r || i.open,
                children: E.jsx(Yo.Slot, {
                    scope: e.__scopeMenu,
                    children: E.jsx(hf, {
                        id: l.contentId,
                        'aria-labelledby': l.triggerId,
                        ...o,
                        ref: c,
                        align: 'start',
                        side: s.dir === 'rtl' ? 'left' : 'right',
                        disableOutsidePointerEvents: !1,
                        disableOutsideScroll: !1,
                        trapFocus: !1,
                        onOpenAutoFocus: (u) => {
                            var f;
                            s.isUsingKeyboardRef.current && ((f = a.current) == null || f.focus()), u.preventDefault();
                        },
                        onCloseAutoFocus: (u) => u.preventDefault(),
                        onFocusOutside: $(e.onFocusOutside, (u) => {
                            u.target !== l.trigger && i.onOpenChange(!1);
                        }),
                        onEscapeKeyDown: $(e.onEscapeKeyDown, (u) => {
                            s.onClose(), u.preventDefault();
                        }),
                        onKeyDown: $(e.onKeyDown, (u) => {
                            var y;
                            const f = u.currentTarget.contains(u.target),
                                d = mR[s.dir].includes(u.key);
                            f && d && (i.onOpenChange(!1), (y = l.trigger) == null || y.focus(), u.preventDefault());
                        }),
                    }),
                }),
            }),
        });
    });
Cy.displayName = xy;
function by(e) {
    return e ? 'open' : 'closed';
}
function $s(e) {
    return e === 'indeterminate';
}
function vf(e) {
    return $s(e) ? 'indeterminate' : e ? 'checked' : 'unchecked';
}
function IR(e) {
    const t = document.activeElement;
    for (const n of e) if (n === t || (n.focus(), document.activeElement !== t)) return;
}
function MR(e, t) {
    return e.map((n, r) => e[(t + r) % e.length]);
}
function LR(e, t, n) {
    const o = t.length > 1 && Array.from(t).every((c) => c === t[0]) ? t[0] : t,
        i = n ? e.indexOf(n) : -1;
    let s = MR(e, Math.max(i, 0));
    o.length === 1 && (s = s.filter((c) => c !== n));
    const a = s.find((c) => c.toLowerCase().startsWith(o.toLowerCase()));
    return a !== n ? a : void 0;
}
function FR(e, t) {
    const { x: n, y: r } = e;
    let o = !1;
    for (let i = 0, s = t.length - 1; i < t.length; s = i++) {
        const l = t[i].x,
            a = t[i].y,
            c = t[s].x,
            u = t[s].y;
        a > r != u > r && n < ((c - l) * (r - a)) / (u - a) + l && (o = !o);
    }
    return o;
}
function jR(e, t) {
    if (!t) return !1;
    const n = { x: e.clientX, y: e.clientY };
    return FR(n, t);
}
function Xo(e) {
    return (t) => (t.pointerType === 'mouse' ? e(t) : void 0);
}
var zR = oy,
    UR = uf,
    BR = sy,
    $R = ly,
    HR = pf,
    WR = ay,
    VR = Tl,
    qR = uy,
    GR = dy,
    KR = py,
    YR = my,
    XR = vy,
    QR = yy,
    JR = Sy,
    ZR = Ey,
    e_ = Cy,
    yf = 'ContextMenu',
    [t_, oP] = $r(yf, [ty]),
    Re = ty(),
    [n_, Ty] = t_(yf),
    ky = (e) => {
        const { __scopeContextMenu: t, children: n, onOpenChange: r, dir: o, modal: i = !0 } = e,
            [s, l] = g.useState(!1),
            a = Re(t),
            c = ue(r),
            u = g.useCallback(
                (f) => {
                    l(f), c(f);
                },
                [c],
            );
        return E.jsx(n_, {
            scope: t,
            open: s,
            onOpenChange: u,
            modal: i,
            children: E.jsx(zR, { ...a, dir: o, open: s, onOpenChange: u, modal: i, children: n }),
        });
    };
ky.displayName = yf;
var Ry = 'ContextMenuTrigger',
    _y = g.forwardRef((e, t) => {
        const { __scopeContextMenu: n, disabled: r = !1, ...o } = e,
            i = Ty(Ry, n),
            s = Re(n),
            l = g.useRef({ x: 0, y: 0 }),
            a = g.useRef({ getBoundingClientRect: () => DOMRect.fromRect({ width: 0, height: 0, ...l.current }) }),
            c = g.useRef(0),
            u = g.useCallback(() => window.clearTimeout(c.current), []),
            f = (d) => {
                (l.current = { x: d.clientX, y: d.clientY }), i.onOpenChange(!0);
            };
        return (
            g.useEffect(() => u, [u]),
            g.useEffect(() => void (r && u()), [r, u]),
            E.jsxs(E.Fragment, {
                children: [
                    E.jsx(UR, { ...s, virtualRef: a }),
                    E.jsx(he.span, {
                        'data-state': i.open ? 'open' : 'closed',
                        'data-disabled': r ? '' : void 0,
                        ...o,
                        ref: t,
                        style: { WebkitTouchCallout: 'none', ...e.style },
                        onContextMenu: r
                            ? e.onContextMenu
                            : $(e.onContextMenu, (d) => {
                                  u(), f(d), d.preventDefault();
                              }),
                        onPointerDown: r
                            ? e.onPointerDown
                            : $(
                                  e.onPointerDown,
                                  Ii((d) => {
                                      u(), (c.current = window.setTimeout(() => f(d), 700));
                                  }),
                              ),
                        onPointerMove: r ? e.onPointerMove : $(e.onPointerMove, Ii(u)),
                        onPointerCancel: r ? e.onPointerCancel : $(e.onPointerCancel, Ii(u)),
                        onPointerUp: r ? e.onPointerUp : $(e.onPointerUp, Ii(u)),
                    }),
                ],
            })
        );
    });
_y.displayName = Ry;
var r_ = 'ContextMenuPortal',
    Oy = (e) => {
        const { __scopeContextMenu: t, ...n } = e,
            r = Re(t);
        return E.jsx(BR, { ...r, ...n });
    };
Oy.displayName = r_;
var Py = 'ContextMenuContent',
    Ny = g.forwardRef((e, t) => {
        const { __scopeContextMenu: n, ...r } = e,
            o = Ty(Py, n),
            i = Re(n),
            s = g.useRef(!1);
        return E.jsx($R, {
            ...i,
            ...r,
            ref: t,
            side: 'right',
            sideOffset: 2,
            align: 'start',
            onCloseAutoFocus: (l) => {
                var a;
                (a = e.onCloseAutoFocus) == null || a.call(e, l),
                    !l.defaultPrevented && s.current && l.preventDefault(),
                    (s.current = !1);
            },
            onInteractOutside: (l) => {
                var a;
                (a = e.onInteractOutside) == null || a.call(e, l), !l.defaultPrevented && !o.modal && (s.current = !0);
            },
            style: {
                ...e.style,
                '--radix-context-menu-content-transform-origin': 'var(--radix-popper-transform-origin)',
                '--radix-context-menu-content-available-width': 'var(--radix-popper-available-width)',
                '--radix-context-menu-content-available-height': 'var(--radix-popper-available-height)',
                '--radix-context-menu-trigger-width': 'var(--radix-popper-anchor-width)',
                '--radix-context-menu-trigger-height': 'var(--radix-popper-anchor-height)',
            },
        });
    });
Ny.displayName = Py;
var o_ = 'ContextMenuGroup',
    i_ = g.forwardRef((e, t) => {
        const { __scopeContextMenu: n, ...r } = e,
            o = Re(n);
        return E.jsx(HR, { ...o, ...r, ref: t });
    });
i_.displayName = o_;
var s_ = 'ContextMenuLabel',
    Dy = g.forwardRef((e, t) => {
        const { __scopeContextMenu: n, ...r } = e,
            o = Re(n);
        return E.jsx(WR, { ...o, ...r, ref: t });
    });
Dy.displayName = s_;
var l_ = 'ContextMenuItem',
    Ay = g.forwardRef((e, t) => {
        const { __scopeContextMenu: n, ...r } = e,
            o = Re(n);
        return E.jsx(VR, { ...o, ...r, ref: t });
    });
Ay.displayName = l_;
var a_ = 'ContextMenuCheckboxItem',
    Iy = g.forwardRef((e, t) => {
        const { __scopeContextMenu: n, ...r } = e,
            o = Re(n);
        return E.jsx(qR, { ...o, ...r, ref: t });
    });
Iy.displayName = a_;
var c_ = 'ContextMenuRadioGroup',
    u_ = g.forwardRef((e, t) => {
        const { __scopeContextMenu: n, ...r } = e,
            o = Re(n);
        return E.jsx(GR, { ...o, ...r, ref: t });
    });
u_.displayName = c_;
var f_ = 'ContextMenuRadioItem',
    My = g.forwardRef((e, t) => {
        const { __scopeContextMenu: n, ...r } = e,
            o = Re(n);
        return E.jsx(KR, { ...o, ...r, ref: t });
    });
My.displayName = f_;
var d_ = 'ContextMenuItemIndicator',
    Ly = g.forwardRef((e, t) => {
        const { __scopeContextMenu: n, ...r } = e,
            o = Re(n);
        return E.jsx(YR, { ...o, ...r, ref: t });
    });
Ly.displayName = d_;
var h_ = 'ContextMenuSeparator',
    Fy = g.forwardRef((e, t) => {
        const { __scopeContextMenu: n, ...r } = e,
            o = Re(n);
        return E.jsx(XR, { ...o, ...r, ref: t });
    });
Fy.displayName = h_;
var p_ = 'ContextMenuArrow',
    g_ = g.forwardRef((e, t) => {
        const { __scopeContextMenu: n, ...r } = e,
            o = Re(n);
        return E.jsx(QR, { ...o, ...r, ref: t });
    });
g_.displayName = p_;
var m_ = 'ContextMenuSub',
    jy = (e) => {
        const { __scopeContextMenu: t, children: n, onOpenChange: r, open: o, defaultOpen: i } = e,
            s = Re(t),
            [l, a] = jv({ prop: o, defaultProp: i, onChange: r });
        return E.jsx(JR, { ...s, open: l, onOpenChange: a, children: n });
    };
jy.displayName = m_;
var v_ = 'ContextMenuSubTrigger',
    zy = g.forwardRef((e, t) => {
        const { __scopeContextMenu: n, ...r } = e,
            o = Re(n);
        return E.jsx(ZR, { ...o, ...r, ref: t });
    });
zy.displayName = v_;
var y_ = 'ContextMenuSubContent',
    Uy = g.forwardRef((e, t) => {
        const { __scopeContextMenu: n, ...r } = e,
            o = Re(n);
        return E.jsx(e_, {
            ...o,
            ...r,
            ref: t,
            style: {
                ...e.style,
                '--radix-context-menu-content-transform-origin': 'var(--radix-popper-transform-origin)',
                '--radix-context-menu-content-available-width': 'var(--radix-popper-available-width)',
                '--radix-context-menu-content-available-height': 'var(--radix-popper-available-height)',
                '--radix-context-menu-trigger-width': 'var(--radix-popper-anchor-width)',
                '--radix-context-menu-trigger-height': 'var(--radix-popper-anchor-height)',
            },
        });
    });
Uy.displayName = y_;
function Ii(e) {
    return (t) => (t.pointerType !== 'mouse' ? e(t) : void 0);
}
var w_ = ky,
    S_ = _y,
    E_ = Oy,
    By = Ny,
    $y = Dy,
    Hy = Ay,
    Wy = Iy,
    Vy = My,
    qy = Ly,
    Gy = Fy,
    x_ = jy,
    Ky = zy,
    Yy = Uy;
const C_ = w_,
    b_ = S_,
    Mi = x_,
    go = g.forwardRef(({ className: e, inset: t, children: n, ...r }, o) =>
        E.jsxs(Ky, {
            ref: o,
            className: ct(
                'flex cursor-default select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none focus:bg-accent data-[state=open]:bg-accent',
                t && 'pl-8',
                e,
            ),
            ...r,
            children: [n, E.jsx(av, { className: 'ml-auto h-4 w-4' })],
        }),
    );
go.displayName = Ky.displayName;
const mo = g.forwardRef(({ className: e, ...t }, n) =>
    E.jsx(Yy, {
        ref: n,
        className: ct(
            'z-50 min-w-[8rem] overflow-hidden rounded-md border bg-popover p-1 text-popover-foreground shadow-md data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2',
            e,
        ),
        ...t,
    }),
);
mo.displayName = Yy.displayName;
const Xy = g.forwardRef(({ className: e, ...t }, n) =>
    E.jsx(E_, {
        children: E.jsx(By, {
            ref: n,
            className: ct(
                'z-50 min-w-[8rem] overflow-hidden rounded-md border bg-popover p-1 text-popover-foreground shadow-md animate-in fade-in-80 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2',
                e,
            ),
            ...t,
        }),
    }),
);
Xy.displayName = By.displayName;
const Ie = g.forwardRef(({ className: e, inset: t, ...n }, r) =>
    E.jsx(Hy, {
        ref: r,
        className: ct(
            'relative flex cursor-default select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none focus:bg-accent focus:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50',
            t && 'pl-8',
            e,
        ),
        ...n,
    }),
);
Ie.displayName = Hy.displayName;
const T_ = g.forwardRef(({ className: e, children: t, checked: n, ...r }, o) =>
    E.jsxs(Wy, {
        ref: o,
        className: ct(
            'relative flex cursor-default select-none items-center rounded-sm py-1.5 pl-8 pr-2 text-sm outline-none focus:bg-accent focus:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50',
            e,
        ),
        checked: n,
        ...r,
        children: [
            E.jsx('span', {
                className: 'absolute left-2 flex h-3.5 w-3.5 items-center justify-center',
                children: E.jsx(qy, { children: E.jsx(Lb, { className: 'h-4 w-4' }) }),
            }),
            t,
        ],
    }),
);
T_.displayName = Wy.displayName;
const k_ = g.forwardRef(({ className: e, children: t, ...n }, r) =>
    E.jsxs(Vy, {
        ref: r,
        className: ct(
            'relative flex cursor-default select-none items-center rounded-sm py-1.5 pl-8 pr-2 text-sm outline-none focus:bg-accent focus:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50',
            e,
        ),
        ...n,
        children: [
            E.jsx('span', {
                className: 'absolute left-2 flex h-3.5 w-3.5 items-center justify-center',
                children: E.jsx(qy, { children: E.jsx(jb, { className: 'h-2 w-2 fill-current' }) }),
            }),
            t,
        ],
    }),
);
k_.displayName = Vy.displayName;
const R_ = g.forwardRef(({ className: e, inset: t, ...n }, r) =>
    E.jsx($y, { ref: r, className: ct('px-2 py-1.5 text-sm font-semibold text-foreground', t && 'pl-8', e), ...n }),
);
R_.displayName = $y.displayName;
const rs = g.forwardRef(({ className: e, ...t }, n) =>
    E.jsx(Gy, { ref: n, className: ct('-mx-1 my-1 h-px bg-border', e), ...t }),
);
rs.displayName = Gy.displayName;
const Qy = ({ node: e, path: t, onNodeMove: n, contextMenuActions: r, level: o, expandedNodes: i, onNodeToggle: s }) => {
        const l = i.has(e.id),
            [{ isDragging: a }, c] = Ax({
                type: 'TREE_NODE',
                item: { id: e.id, type: 'TREE_NODE', node: e, path: t },
                collect: (m) => ({ isDragging: m.isDragging() }),
            }),
            [{ isOver: u }, f] = Bx({
                accept: 'TREE_NODE',
                drop: (m, v) => {
                    v.didDrop() || n(m.id, e.id);
                },
                collect: (m) => ({ isOver: m.isOver({ shallow: !0 }) }),
            }),
            d = (m) => {
                m.stopPropagation(), s(e.id);
            },
            y = () => {
                switch (e.type) {
                    case 'context':
                        return E.jsx(zb, { className: 'w-4 h-4 mr-2' });
                    case 'canvas':
                        return E.jsx(dh, { className: 'w-4 h-4 mr-2' });
                    case 'workspace':
                    case 'universe':
                        return E.jsx(dh, { className: 'w-4 h-4 mr-2' });
                    default:
                        return null;
                }
            };
        return E.jsxs('div', {
            ref: f,
            children: [
                E.jsxs(C_, {
                    children: [
                        E.jsx(b_, {
                            children: E.jsxs('div', {
                                ref: c,
                                className: ct(
                                    'flex items-center py-1 px-2 rounded-md cursor-pointer select-none',
                                    'hover:bg-gray-100',
                                    a && 'opacity-50',
                                    u && 'bg-blue-50',
                                    o > 0 && 'ml-6',
                                ),
                                style: { marginLeft: `${o * 1.5}rem` },
                                children: [
                                    e.children.length > 0 &&
                                        E.jsx('button', {
                                            onClick: d,
                                            className: 'p-1',
                                            children: l
                                                ? E.jsx(Fb, { className: 'w-4 h-4' })
                                                : E.jsx(av, { className: 'w-4 h-4' }),
                                        }),
                                    y(),
                                    E.jsx('span', { className: ct('text-sm', e.locked && 'text-gray-400'), children: e.name }),
                                ],
                            }),
                        }),
                        E.jsxs(Xy, {
                            children: [
                                E.jsx(Ie, { onClick: () => r.onCut(e.id), children: 'Cut' }),
                                E.jsx(Ie, { onClick: () => r.onCopy(e.id), children: 'Copy' }),
                                E.jsx(Ie, { onClick: () => r.onPaste(e.id), children: 'Paste' }),
                                E.jsx(Ie, { onClick: () => r.onMove(e.id), children: 'Move' }),
                                E.jsx(rs, {}),
                                E.jsxs(Mi, {
                                    children: [
                                        E.jsx(go, { children: 'Create' }),
                                        E.jsxs(mo, {
                                            children: [
                                                E.jsx(Ie, { onClick: () => r.onCreateLayer(e.id), children: 'Create Layer' }),
                                                E.jsx(Ie, { onClick: () => r.onCreateCanvas(e.id), children: 'Create Canvas' }),
                                            ],
                                        }),
                                    ],
                                }),
                                E.jsxs(Mi, {
                                    children: [
                                        E.jsx(go, { children: 'Path' }),
                                        E.jsxs(mo, {
                                            children: [
                                                E.jsx(Ie, { onClick: () => r.onInsertPath(e.id), children: 'Insert Path' }),
                                                E.jsx(Ie, { onClick: () => r.onRemovePath(e.id), children: 'Remove Path' }),
                                            ],
                                        }),
                                    ],
                                }),
                                E.jsx(rs, {}),
                                E.jsxs(Mi, {
                                    children: [
                                        E.jsx(go, { children: 'Rename' }),
                                        E.jsxs(mo, {
                                            children: [
                                                E.jsx(Ie, { onClick: () => r.onRenameLayer(e.id), children: 'Rename Layer' }),
                                                E.jsx(Ie, { onClick: () => r.onRenameCanvas(e.id), children: 'Rename Canvas' }),
                                            ],
                                        }),
                                    ],
                                }),
                                E.jsxs(Mi, {
                                    children: [
                                        E.jsx(go, { children: 'Remove' }),
                                        E.jsx(mo, {
                                            children: E.jsx(Ie, {
                                                onClick: () => r.onRemoveCanvas(e.id),
                                                children: 'Remove Canvas',
                                            }),
                                        }),
                                    ],
                                }),
                                E.jsx(rs, {}),
                                E.jsx(Ie, { onClick: () => r.onMergeUp(e.id), children: 'Merge Up' }),
                                E.jsx(Ie, { onClick: () => r.onMergeDown(e.id), children: 'Merge Down' }),
                            ],
                        }),
                    ],
                }),
                l &&
                    e.children.length > 0 &&
                    E.jsx('div', {
                        children: e.children.map((m) =>
                            E.jsx(
                                Qy,
                                {
                                    node: m,
                                    path: [...t, e.id],
                                    onNodeMove: n,
                                    contextMenuActions: r,
                                    level: o + 1,
                                    expandedNodes: i,
                                    onNodeToggle: s,
                                },
                                m.id,
                            ),
                        ),
                    }),
            ],
        });
    },
    __ = ({ tree: e, onNodeMove: t, contextMenuActions: n, expandedNodes: r, onNodeToggle: o }) =>
        E.jsx('div', {
            className: 'w-[480px] h-full border-r border-gray-200 bg-white',
            children: E.jsx(sv, {
                className: 'h-full',
                children: E.jsx('div', {
                    className: 'p-4',
                    children: E.jsx(Qy, {
                        node: e,
                        path: [],
                        onNodeMove: t,
                        contextMenuActions: n,
                        level: 0,
                        expandedNodes: r,
                        onNodeToggle: o,
                    }),
                }),
            }),
        });
class O_ {
    constructor(t = {}) {
        Lt(this, 'api');
        Lt(this, 'channel');
        const { name: n = 'config' } = t;
        (this.channel = `__electron_conf_${n}_handler__`),
            (this.api = (globalThis || window).__ELECTRON_CONF__ || (globalThis || window).electron);
    }
    get(t, n) {
        return this.api.ipcRenderer.invoke(this.channel, 'get', t, n);
    }
    set(t, n) {
        return this.api.ipcRenderer.invoke(this.channel, 'set', t, n);
    }
    has(t) {
        return this.api.ipcRenderer.invoke(this.channel, 'has', t);
    }
    reset(...t) {
        return this.api.ipcRenderer.invoke(this.channel, 'reset', t);
    }
    delete(t) {
        return this.api.ipcRenderer.invoke(this.channel, 'delete', t);
    }
    clear() {
        return this.api.ipcRenderer.invoke(this.channel, 'clear');
    }
}
const Dt = new O_(),
    Hs = 'http://localhost:8001',
    Qo = '',
    Ih = [];
let Bn = !1,
    Ye = null,
    kn = {};
const Jy = async () => {
    var e;
    if (Bn) return await Zy();
    console.log('[Config] Initializing auth token...');
    try {
        const t = await Dt.get('server'),
            n = ((e = t == null ? void 0 : t.auth) == null ? void 0 : e.token) || '';
        return (
            console.log(`[Config] Token from store: ${n ? n.substring(0, 10) + '...' : 'empty'}`),
            t && (kn.server = t),
            (Bn = !0),
            n
        );
    } catch (t) {
        return console.error('[Config] Error initializing auth token:', t), (Bn = !0), Qo;
    }
};
Ye = Jy();
const Zy = async () => {
        var e;
        Ye && !Bn && (await Ye);
        try {
            const t = await Dt.get('server');
            return ((e = t == null ? void 0 : t.auth) == null ? void 0 : e.token) || Qo;
        } catch (t) {
            return console.error('[Config] Error getting auth token:', t), Qo;
        }
    },
    P_ = () => {
        var e, t;
        return Bn
            ? ((t = (e = kn.server) == null ? void 0 : e.auth) == null ? void 0 : t.token) || Qo
            : (console.warn('[Config] getAuthTokenSync called before token initialized, returning default'), Qo);
    },
    N_ = async (e) => {
        try {
            const t = (await Dt.get('server')) || { url: Hs, auth: { type: 'token', token: '' } };
            return (t.auth.token = e), await Dt.set('server', t), (kn.server = t), (Bn = !0), !0;
        } catch (t) {
            return console.error('[Config] Error setting auth token:', t), !1;
        }
    },
    D_ = async () => {
        try {
            const e = await Dt.get('server');
            return (e == null ? void 0 : e.url) || Hs;
        } catch (e) {
            return console.error('[Config] Error getting server URL:', e), Hs;
        }
    },
    A_ = () => {
        var e;
        return ((e = kn.server) == null ? void 0 : e.url) || Hs;
    },
    I_ = async () => {
        try {
            return (await Dt.get('expandedNodes')) || Ih;
        } catch (e) {
            return console.error('[Config] Error getting expanded nodes:', e), Ih;
        }
    },
    M_ = async (e) => {
        try {
            return await Dt.set('expandedNodes', e), (kn.expandedNodes = e), !0;
        } catch (t) {
            return console.error('[Config] Error saving expanded nodes:', t), !1;
        }
    },
    L_ = async () => {
        try {
            return await Dt.clear(), (kn = {}), (Bn = !1), (Ye = Jy()), await Ye, !0;
        } catch (e) {
            return console.error('[Config] Error resetting config:', e), !1;
        }
    },
    F_ = async () => {
        try {
            const e = await Dt.get('server'),
                t = await Dt.get('expandedNodes'),
                n = {};
            return e && (n.server = e), t && (n.expandedNodes = t), (kn = n), n;
        } catch (e) {
            return console.error('[Config] Error getting all config:', e), kn;
        }
    },
    we = {
        getAuthToken: Zy,
        getAuthTokenSync: P_,
        setAuthToken: N_,
        getServerUrl: D_,
        getServerUrlSync: A_,
        resetConfig: L_,
        getExpandedNodes: I_,
        saveExpandedNodes: M_,
        getAll: F_,
    },
    nn = {
        workspaceTree: (e) => `${we.getServerUrlSync()}/rest/v2/workspaces/${e}/tree`,
        workspacePath: (e) => `${we.getServerUrlSync()}/rest/v2/workspaces/${e}/tree/path`,
        contexts: (e) => `${we.getServerUrlSync()}/rest/v2/contexts/${e}`,
        contextsList: () => `${we.getServerUrlSync()}/rest/v2/contexts`,
        layers: () => `${we.getServerUrlSync()}/rest/v2/layers`,
        layer: (e) => `${we.getServerUrlSync()}/rest/v2/layers/${e}`,
        documents: (e) => `${we.getServerUrlSync()}/rest/v2/contexts/${e}/documents`,
        document: (e, t) => `${we.getServerUrlSync()}/rest/v2/contexts/${e}/documents/${t}`,
        canvases: () => `${we.getServerUrlSync()}/rest/v2/canvases`,
        canvas: (e) => `${we.getServerUrlSync()}/rest/v2/canvases/${e}`,
    };
(async () => {
    if (Ye)
        try {
            await Ye, console.log('Auth token initialization completed for API calls');
        } catch (e) {
            console.error('Error waiting for token initialization:', e);
        }
})();
const j_ = async () => {
        Ye && (await Ye);
        const e = await we.getAuthToken();
        return (
            console.log('Using auth token for API call:', e ? `${e.substring(0, 15)}...` : 'none'),
            { Authorization: `Bearer ${e}`, 'Content-Type': 'application/json' }
        );
    },
    Nn = () => {
        const e = we.getAuthTokenSync();
        return (
            console.log('Using auth token for API call (sync):', e ? `${e.substring(0, 15)}...` : 'none'),
            { Authorization: `Bearer ${e}`, 'Content-Type': 'application/json' }
        );
    },
    At = Object.create(null);
At.open = '0';
At.close = '1';
At.ping = '2';
At.pong = '3';
At.message = '4';
At.upgrade = '5';
At.noop = '6';
const os = Object.create(null);
Object.keys(At).forEach((e) => {
    os[At[e]] = e;
});
const Fc = { type: 'error', data: 'parser error' },
    ew =
        typeof Blob == 'function' || (typeof Blob < 'u' && Object.prototype.toString.call(Blob) === '[object BlobConstructor]'),
    tw = typeof ArrayBuffer == 'function',
    nw = (e) => (typeof ArrayBuffer.isView == 'function' ? ArrayBuffer.isView(e) : e && e.buffer instanceof ArrayBuffer),
    wf = ({ type: e, data: t }, n, r) =>
        ew && t instanceof Blob
            ? n
                ? r(t)
                : Mh(t, r)
            : tw && (t instanceof ArrayBuffer || nw(t))
              ? n
                  ? r(t)
                  : Mh(new Blob([t]), r)
              : r(At[e] + (t || '')),
    Mh = (e, t) => {
        const n = new FileReader();
        return (
            (n.onload = function () {
                const r = n.result.split(',')[1];
                t('b' + (r || ''));
            }),
            n.readAsDataURL(e)
        );
    };
function Lh(e) {
    return e instanceof Uint8Array
        ? e
        : e instanceof ArrayBuffer
          ? new Uint8Array(e)
          : new Uint8Array(e.buffer, e.byteOffset, e.byteLength);
}
let wa;
function z_(e, t) {
    if (ew && e.data instanceof Blob) return e.data.arrayBuffer().then(Lh).then(t);
    if (tw && (e.data instanceof ArrayBuffer || nw(e.data))) return t(Lh(e.data));
    wf(e, !1, (n) => {
        wa || (wa = new TextEncoder()), t(wa.encode(n));
    });
}
const Fh = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/',
    vo = typeof Uint8Array > 'u' ? [] : new Uint8Array(256);
for (let e = 0; e < Fh.length; e++) vo[Fh.charCodeAt(e)] = e;
const U_ = (e) => {
        let t = e.length * 0.75,
            n = e.length,
            r,
            o = 0,
            i,
            s,
            l,
            a;
        e[e.length - 1] === '=' && (t--, e[e.length - 2] === '=' && t--);
        const c = new ArrayBuffer(t),
            u = new Uint8Array(c);
        for (r = 0; r < n; r += 4)
            (i = vo[e.charCodeAt(r)]),
                (s = vo[e.charCodeAt(r + 1)]),
                (l = vo[e.charCodeAt(r + 2)]),
                (a = vo[e.charCodeAt(r + 3)]),
                (u[o++] = (i << 2) | (s >> 4)),
                (u[o++] = ((s & 15) << 4) | (l >> 2)),
                (u[o++] = ((l & 3) << 6) | (a & 63));
        return c;
    },
    B_ = typeof ArrayBuffer == 'function',
    Sf = (e, t) => {
        if (typeof e != 'string') return { type: 'message', data: rw(e, t) };
        const n = e.charAt(0);
        return n === 'b'
            ? { type: 'message', data: $_(e.substring(1), t) }
            : os[n]
              ? e.length > 1
                  ? { type: os[n], data: e.substring(1) }
                  : { type: os[n] }
              : Fc;
    },
    $_ = (e, t) => {
        if (B_) {
            const n = U_(e);
            return rw(n, t);
        } else return { base64: !0, data: e };
    },
    rw = (e, t) => {
        switch (t) {
            case 'blob':
                return e instanceof Blob ? e : new Blob([e]);
            case 'arraybuffer':
            default:
                return e instanceof ArrayBuffer ? e : e.buffer;
        }
    },
    ow = '',
    H_ = (e, t) => {
        const n = e.length,
            r = new Array(n);
        let o = 0;
        e.forEach((i, s) => {
            wf(i, !1, (l) => {
                (r[s] = l), ++o === n && t(r.join(ow));
            });
        });
    },
    W_ = (e, t) => {
        const n = e.split(ow),
            r = [];
        for (let o = 0; o < n.length; o++) {
            const i = Sf(n[o], t);
            if ((r.push(i), i.type === 'error')) break;
        }
        return r;
    };
function V_() {
    return new TransformStream({
        transform(e, t) {
            z_(e, (n) => {
                const r = n.length;
                let o;
                if (r < 126) (o = new Uint8Array(1)), new DataView(o.buffer).setUint8(0, r);
                else if (r < 65536) {
                    o = new Uint8Array(3);
                    const i = new DataView(o.buffer);
                    i.setUint8(0, 126), i.setUint16(1, r);
                } else {
                    o = new Uint8Array(9);
                    const i = new DataView(o.buffer);
                    i.setUint8(0, 127), i.setBigUint64(1, BigInt(r));
                }
                e.data && typeof e.data != 'string' && (o[0] |= 128), t.enqueue(o), t.enqueue(n);
            });
        },
    });
}
let Sa;
function Li(e) {
    return e.reduce((t, n) => t + n.length, 0);
}
function Fi(e, t) {
    if (e[0].length === t) return e.shift();
    const n = new Uint8Array(t);
    let r = 0;
    for (let o = 0; o < t; o++) (n[o] = e[0][r++]), r === e[0].length && (e.shift(), (r = 0));
    return e.length && r < e[0].length && (e[0] = e[0].slice(r)), n;
}
function q_(e, t) {
    Sa || (Sa = new TextDecoder());
    const n = [];
    let r = 0,
        o = -1,
        i = !1;
    return new TransformStream({
        transform(s, l) {
            for (n.push(s); ; ) {
                if (r === 0) {
                    if (Li(n) < 1) break;
                    const a = Fi(n, 1);
                    (i = (a[0] & 128) === 128), (o = a[0] & 127), o < 126 ? (r = 3) : o === 126 ? (r = 1) : (r = 2);
                } else if (r === 1) {
                    if (Li(n) < 2) break;
                    const a = Fi(n, 2);
                    (o = new DataView(a.buffer, a.byteOffset, a.length).getUint16(0)), (r = 3);
                } else if (r === 2) {
                    if (Li(n) < 8) break;
                    const a = Fi(n, 8),
                        c = new DataView(a.buffer, a.byteOffset, a.length),
                        u = c.getUint32(0);
                    if (u > Math.pow(2, 21) - 1) {
                        l.enqueue(Fc);
                        break;
                    }
                    (o = u * Math.pow(2, 32) + c.getUint32(4)), (r = 3);
                } else {
                    if (Li(n) < o) break;
                    const a = Fi(n, o);
                    l.enqueue(Sf(i ? a : Sa.decode(a), t)), (r = 0);
                }
                if (o === 0 || o > e) {
                    l.enqueue(Fc);
                    break;
                }
            }
        },
    });
}
const iw = 4;
function fe(e) {
    if (e) return G_(e);
}
function G_(e) {
    for (var t in fe.prototype) e[t] = fe.prototype[t];
    return e;
}
fe.prototype.on = fe.prototype.addEventListener = function (e, t) {
    return (this._callbacks = this._callbacks || {}), (this._callbacks['$' + e] = this._callbacks['$' + e] || []).push(t), this;
};
fe.prototype.once = function (e, t) {
    function n() {
        this.off(e, n), t.apply(this, arguments);
    }
    return (n.fn = t), this.on(e, n), this;
};
fe.prototype.off =
    fe.prototype.removeListener =
    fe.prototype.removeAllListeners =
    fe.prototype.removeEventListener =
        function (e, t) {
            if (((this._callbacks = this._callbacks || {}), arguments.length == 0)) return (this._callbacks = {}), this;
            var n = this._callbacks['$' + e];
            if (!n) return this;
            if (arguments.length == 1) return delete this._callbacks['$' + e], this;
            for (var r, o = 0; o < n.length; o++)
                if (((r = n[o]), r === t || r.fn === t)) {
                    n.splice(o, 1);
                    break;
                }
            return n.length === 0 && delete this._callbacks['$' + e], this;
        };
fe.prototype.emit = function (e) {
    this._callbacks = this._callbacks || {};
    for (var t = new Array(arguments.length - 1), n = this._callbacks['$' + e], r = 1; r < arguments.length; r++)
        t[r - 1] = arguments[r];
    if (n) {
        n = n.slice(0);
        for (var r = 0, o = n.length; r < o; ++r) n[r].apply(this, t);
    }
    return this;
};
fe.prototype.emitReserved = fe.prototype.emit;
fe.prototype.listeners = function (e) {
    return (this._callbacks = this._callbacks || {}), this._callbacks['$' + e] || [];
};
fe.prototype.hasListeners = function (e) {
    return !!this.listeners(e).length;
};
const kl =
        typeof Promise == 'function' && typeof Promise.resolve == 'function'
            ? (t) => Promise.resolve().then(t)
            : (t, n) => n(t, 0),
    rt = typeof self < 'u' ? self : typeof window < 'u' ? window : Function('return this')(),
    K_ = 'arraybuffer';
function sw(e, ...t) {
    return t.reduce((n, r) => (e.hasOwnProperty(r) && (n[r] = e[r]), n), {});
}
const Y_ = rt.setTimeout,
    X_ = rt.clearTimeout;
function Rl(e, t) {
    t.useNativeTimers
        ? ((e.setTimeoutFn = Y_.bind(rt)), (e.clearTimeoutFn = X_.bind(rt)))
        : ((e.setTimeoutFn = rt.setTimeout.bind(rt)), (e.clearTimeoutFn = rt.clearTimeout.bind(rt)));
}
const Q_ = 1.33;
function J_(e) {
    return typeof e == 'string' ? Z_(e) : Math.ceil((e.byteLength || e.size) * Q_);
}
function Z_(e) {
    let t = 0,
        n = 0;
    for (let r = 0, o = e.length; r < o; r++)
        (t = e.charCodeAt(r)), t < 128 ? (n += 1) : t < 2048 ? (n += 2) : t < 55296 || t >= 57344 ? (n += 3) : (r++, (n += 4));
    return n;
}
function lw() {
    return Date.now().toString(36).substring(3) + Math.random().toString(36).substring(2, 5);
}
function eO(e) {
    let t = '';
    for (let n in e)
        e.hasOwnProperty(n) && (t.length && (t += '&'), (t += encodeURIComponent(n) + '=' + encodeURIComponent(e[n])));
    return t;
}
function tO(e) {
    let t = {},
        n = e.split('&');
    for (let r = 0, o = n.length; r < o; r++) {
        let i = n[r].split('=');
        t[decodeURIComponent(i[0])] = decodeURIComponent(i[1]);
    }
    return t;
}
class nO extends Error {
    constructor(t, n, r) {
        super(t), (this.description = n), (this.context = r), (this.type = 'TransportError');
    }
}
class Ef extends fe {
    constructor(t) {
        super(),
            (this.writable = !1),
            Rl(this, t),
            (this.opts = t),
            (this.query = t.query),
            (this.socket = t.socket),
            (this.supportsBinary = !t.forceBase64);
    }
    onError(t, n, r) {
        return super.emitReserved('error', new nO(t, n, r)), this;
    }
    open() {
        return (this.readyState = 'opening'), this.doOpen(), this;
    }
    close() {
        return (this.readyState === 'opening' || this.readyState === 'open') && (this.doClose(), this.onClose()), this;
    }
    send(t) {
        this.readyState === 'open' && this.write(t);
    }
    onOpen() {
        (this.readyState = 'open'), (this.writable = !0), super.emitReserved('open');
    }
    onData(t) {
        const n = Sf(t, this.socket.binaryType);
        this.onPacket(n);
    }
    onPacket(t) {
        super.emitReserved('packet', t);
    }
    onClose(t) {
        (this.readyState = 'closed'), super.emitReserved('close', t);
    }
    pause(t) {}
    createUri(t, n = {}) {
        return t + '://' + this._hostname() + this._port() + this.opts.path + this._query(n);
    }
    _hostname() {
        const t = this.opts.hostname;
        return t.indexOf(':') === -1 ? t : '[' + t + ']';
    }
    _port() {
        return this.opts.port &&
            ((this.opts.secure && +(this.opts.port !== 443)) || (!this.opts.secure && Number(this.opts.port) !== 80))
            ? ':' + this.opts.port
            : '';
    }
    _query(t) {
        const n = eO(t);
        return n.length ? '?' + n : '';
    }
}
class rO extends Ef {
    constructor() {
        super(...arguments), (this._polling = !1);
    }
    get name() {
        return 'polling';
    }
    doOpen() {
        this._poll();
    }
    pause(t) {
        this.readyState = 'pausing';
        const n = () => {
            (this.readyState = 'paused'), t();
        };
        if (this._polling || !this.writable) {
            let r = 0;
            this._polling &&
                (r++,
                this.once('pollComplete', function () {
                    --r || n();
                })),
                this.writable ||
                    (r++,
                    this.once('drain', function () {
                        --r || n();
                    }));
        } else n();
    }
    _poll() {
        (this._polling = !0), this.doPoll(), this.emitReserved('poll');
    }
    onData(t) {
        const n = (r) => {
            if ((this.readyState === 'opening' && r.type === 'open' && this.onOpen(), r.type === 'close'))
                return this.onClose({ description: 'transport closed by the server' }), !1;
            this.onPacket(r);
        };
        W_(t, this.socket.binaryType).forEach(n),
            this.readyState !== 'closed' &&
                ((this._polling = !1), this.emitReserved('pollComplete'), this.readyState === 'open' && this._poll());
    }
    doClose() {
        const t = () => {
            this.write([{ type: 'close' }]);
        };
        this.readyState === 'open' ? t() : this.once('open', t);
    }
    write(t) {
        (this.writable = !1),
            H_(t, (n) => {
                this.doWrite(n, () => {
                    (this.writable = !0), this.emitReserved('drain');
                });
            });
    }
    uri() {
        const t = this.opts.secure ? 'https' : 'http',
            n = this.query || {};
        return (
            this.opts.timestampRequests !== !1 && (n[this.opts.timestampParam] = lw()),
            !this.supportsBinary && !n.sid && (n.b64 = 1),
            this.createUri(t, n)
        );
    }
}
let aw = !1;
try {
    aw = typeof XMLHttpRequest < 'u' && 'withCredentials' in new XMLHttpRequest();
} catch {}
const oO = aw;
function iO() {}
class sO extends rO {
    constructor(t) {
        if ((super(t), typeof location < 'u')) {
            const n = location.protocol === 'https:';
            let r = location.port;
            r || (r = n ? '443' : '80'),
                (this.xd = (typeof location < 'u' && t.hostname !== location.hostname) || r !== t.port);
        }
    }
    doWrite(t, n) {
        const r = this.request({ method: 'POST', data: t });
        r.on('success', n),
            r.on('error', (o, i) => {
                this.onError('xhr post error', o, i);
            });
    }
    doPoll() {
        const t = this.request();
        t.on('data', this.onData.bind(this)),
            t.on('error', (n, r) => {
                this.onError('xhr poll error', n, r);
            }),
            (this.pollXhr = t);
    }
}
let kr = class is extends fe {
    constructor(t, n, r) {
        super(),
            (this.createRequest = t),
            Rl(this, r),
            (this._opts = r),
            (this._method = r.method || 'GET'),
            (this._uri = n),
            (this._data = r.data !== void 0 ? r.data : null),
            this._create();
    }
    _create() {
        var t;
        const n = sw(
            this._opts,
            'agent',
            'pfx',
            'key',
            'passphrase',
            'cert',
            'ca',
            'ciphers',
            'rejectUnauthorized',
            'autoUnref',
        );
        n.xdomain = !!this._opts.xd;
        const r = (this._xhr = this.createRequest(n));
        try {
            r.open(this._method, this._uri, !0);
            try {
                if (this._opts.extraHeaders) {
                    r.setDisableHeaderCheck && r.setDisableHeaderCheck(!0);
                    for (let o in this._opts.extraHeaders)
                        this._opts.extraHeaders.hasOwnProperty(o) && r.setRequestHeader(o, this._opts.extraHeaders[o]);
                }
            } catch {}
            if (this._method === 'POST')
                try {
                    r.setRequestHeader('Content-type', 'text/plain;charset=UTF-8');
                } catch {}
            try {
                r.setRequestHeader('Accept', '*/*');
            } catch {}
            (t = this._opts.cookieJar) === null || t === void 0 || t.addCookies(r),
                'withCredentials' in r && (r.withCredentials = this._opts.withCredentials),
                this._opts.requestTimeout && (r.timeout = this._opts.requestTimeout),
                (r.onreadystatechange = () => {
                    var o;
                    r.readyState === 3 &&
                        ((o = this._opts.cookieJar) === null ||
                            o === void 0 ||
                            o.parseCookies(r.getResponseHeader('set-cookie'))),
                        r.readyState === 4 &&
                            (r.status === 200 || r.status === 1223
                                ? this._onLoad()
                                : this.setTimeoutFn(() => {
                                      this._onError(typeof r.status == 'number' ? r.status : 0);
                                  }, 0));
                }),
                r.send(this._data);
        } catch (o) {
            this.setTimeoutFn(() => {
                this._onError(o);
            }, 0);
            return;
        }
        typeof document < 'u' && ((this._index = is.requestsCount++), (is.requests[this._index] = this));
    }
    _onError(t) {
        this.emitReserved('error', t, this._xhr), this._cleanup(!0);
    }
    _cleanup(t) {
        if (!(typeof this._xhr > 'u' || this._xhr === null)) {
            if (((this._xhr.onreadystatechange = iO), t))
                try {
                    this._xhr.abort();
                } catch {}
            typeof document < 'u' && delete is.requests[this._index], (this._xhr = null);
        }
    }
    _onLoad() {
        const t = this._xhr.responseText;
        t !== null && (this.emitReserved('data', t), this.emitReserved('success'), this._cleanup());
    }
    abort() {
        this._cleanup();
    }
};
kr.requestsCount = 0;
kr.requests = {};
if (typeof document < 'u') {
    if (typeof attachEvent == 'function') attachEvent('onunload', jh);
    else if (typeof addEventListener == 'function') {
        const e = 'onpagehide' in rt ? 'pagehide' : 'unload';
        addEventListener(e, jh, !1);
    }
}
function jh() {
    for (let e in kr.requests) kr.requests.hasOwnProperty(e) && kr.requests[e].abort();
}
const lO = (function () {
    const e = cw({ xdomain: !1 });
    return e && e.responseType !== null;
})();
class aO extends sO {
    constructor(t) {
        super(t);
        const n = t && t.forceBase64;
        this.supportsBinary = lO && !n;
    }
    request(t = {}) {
        return Object.assign(t, { xd: this.xd }, this.opts), new kr(cw, this.uri(), t);
    }
}
function cw(e) {
    const t = e.xdomain;
    try {
        if (typeof XMLHttpRequest < 'u' && (!t || oO)) return new XMLHttpRequest();
    } catch {}
    if (!t)
        try {
            return new rt[['Active'].concat('Object').join('X')]('Microsoft.XMLHTTP');
        } catch {}
}
const uw = typeof navigator < 'u' && typeof navigator.product == 'string' && navigator.product.toLowerCase() === 'reactnative';
class cO extends Ef {
    get name() {
        return 'websocket';
    }
    doOpen() {
        const t = this.uri(),
            n = this.opts.protocols,
            r = uw
                ? {}
                : sw(
                      this.opts,
                      'agent',
                      'perMessageDeflate',
                      'pfx',
                      'key',
                      'passphrase',
                      'cert',
                      'ca',
                      'ciphers',
                      'rejectUnauthorized',
                      'localAddress',
                      'protocolVersion',
                      'origin',
                      'maxPayload',
                      'family',
                      'checkServerIdentity',
                  );
        this.opts.extraHeaders && (r.headers = this.opts.extraHeaders);
        try {
            this.ws = this.createSocket(t, n, r);
        } catch (o) {
            return this.emitReserved('error', o);
        }
        (this.ws.binaryType = this.socket.binaryType), this.addEventListeners();
    }
    addEventListeners() {
        (this.ws.onopen = () => {
            this.opts.autoUnref && this.ws._socket.unref(), this.onOpen();
        }),
            (this.ws.onclose = (t) => this.onClose({ description: 'websocket connection closed', context: t })),
            (this.ws.onmessage = (t) => this.onData(t.data)),
            (this.ws.onerror = (t) => this.onError('websocket error', t));
    }
    write(t) {
        this.writable = !1;
        for (let n = 0; n < t.length; n++) {
            const r = t[n],
                o = n === t.length - 1;
            wf(r, this.supportsBinary, (i) => {
                try {
                    this.doWrite(r, i);
                } catch {}
                o &&
                    kl(() => {
                        (this.writable = !0), this.emitReserved('drain');
                    }, this.setTimeoutFn);
            });
        }
    }
    doClose() {
        typeof this.ws < 'u' && ((this.ws.onerror = () => {}), this.ws.close(), (this.ws = null));
    }
    uri() {
        const t = this.opts.secure ? 'wss' : 'ws',
            n = this.query || {};
        return (
            this.opts.timestampRequests && (n[this.opts.timestampParam] = lw()),
            this.supportsBinary || (n.b64 = 1),
            this.createUri(t, n)
        );
    }
}
const Ea = rt.WebSocket || rt.MozWebSocket;
class uO extends cO {
    createSocket(t, n, r) {
        return uw ? new Ea(t, n, r) : n ? new Ea(t, n) : new Ea(t);
    }
    doWrite(t, n) {
        this.ws.send(n);
    }
}
class fO extends Ef {
    get name() {
        return 'webtransport';
    }
    doOpen() {
        try {
            this._transport = new WebTransport(this.createUri('https'), this.opts.transportOptions[this.name]);
        } catch (t) {
            return this.emitReserved('error', t);
        }
        this._transport.closed
            .then(() => {
                this.onClose();
            })
            .catch((t) => {
                this.onError('webtransport error', t);
            }),
            this._transport.ready.then(() => {
                this._transport.createBidirectionalStream().then((t) => {
                    const n = q_(Number.MAX_SAFE_INTEGER, this.socket.binaryType),
                        r = t.readable.pipeThrough(n).getReader(),
                        o = V_();
                    o.readable.pipeTo(t.writable), (this._writer = o.writable.getWriter());
                    const i = () => {
                        r.read()
                            .then(({ done: l, value: a }) => {
                                l || (this.onPacket(a), i());
                            })
                            .catch((l) => {});
                    };
                    i();
                    const s = { type: 'open' };
                    this.query.sid && (s.data = `{"sid":"${this.query.sid}"}`), this._writer.write(s).then(() => this.onOpen());
                });
            });
    }
    write(t) {
        this.writable = !1;
        for (let n = 0; n < t.length; n++) {
            const r = t[n],
                o = n === t.length - 1;
            this._writer.write(r).then(() => {
                o &&
                    kl(() => {
                        (this.writable = !0), this.emitReserved('drain');
                    }, this.setTimeoutFn);
            });
        }
    }
    doClose() {
        var t;
        (t = this._transport) === null || t === void 0 || t.close();
    }
}
const dO = { websocket: uO, webtransport: fO, polling: aO },
    hO =
        /^(?:(?![^:@\/?#]+:[^:@\/]*@)(http|https|ws|wss):\/\/)?((?:(([^:@\/?#]*)(?::([^:@\/?#]*))?)?@)?((?:[a-f0-9]{0,4}:){2,7}[a-f0-9]{0,4}|[^:\/?#]*)(?::(\d*))?)(((\/(?:[^?#](?![^?#\/]*\.[^?#\/.]+(?:[?#]|$)))*\/?)?([^?#\/]*))(?:\?([^#]*))?(?:#(.*))?)/,
    pO = [
        'source',
        'protocol',
        'authority',
        'userInfo',
        'user',
        'password',
        'host',
        'port',
        'relative',
        'path',
        'directory',
        'file',
        'query',
        'anchor',
    ];
function jc(e) {
    if (e.length > 8e3) throw 'URI too long';
    const t = e,
        n = e.indexOf('['),
        r = e.indexOf(']');
    n != -1 && r != -1 && (e = e.substring(0, n) + e.substring(n, r).replace(/:/g, ';') + e.substring(r, e.length));
    let o = hO.exec(e || ''),
        i = {},
        s = 14;
    for (; s--; ) i[pO[s]] = o[s] || '';
    return (
        n != -1 &&
            r != -1 &&
            ((i.source = t),
            (i.host = i.host.substring(1, i.host.length - 1).replace(/;/g, ':')),
            (i.authority = i.authority.replace('[', '').replace(']', '').replace(/;/g, ':')),
            (i.ipv6uri = !0)),
        (i.pathNames = gO(i, i.path)),
        (i.queryKey = mO(i, i.query)),
        i
    );
}
function gO(e, t) {
    const n = /\/{2,9}/g,
        r = t.replace(n, '/').split('/');
    return (t.slice(0, 1) == '/' || t.length === 0) && r.splice(0, 1), t.slice(-1) == '/' && r.splice(r.length - 1, 1), r;
}
function mO(e, t) {
    const n = {};
    return (
        t.replace(/(?:^|&)([^&=]*)=?([^&]*)/g, function (r, o, i) {
            o && (n[o] = i);
        }),
        n
    );
}
const zc = typeof addEventListener == 'function' && typeof removeEventListener == 'function',
    ss = [];
zc &&
    addEventListener(
        'offline',
        () => {
            ss.forEach((e) => e());
        },
        !1,
    );
class wn extends fe {
    constructor(t, n) {
        if (
            (super(),
            (this.binaryType = K_),
            (this.writeBuffer = []),
            (this._prevBufferLen = 0),
            (this._pingInterval = -1),
            (this._pingTimeout = -1),
            (this._maxPayload = -1),
            (this._pingTimeoutTime = 1 / 0),
            t && typeof t == 'object' && ((n = t), (t = null)),
            t)
        ) {
            const r = jc(t);
            (n.hostname = r.host),
                (n.secure = r.protocol === 'https' || r.protocol === 'wss'),
                (n.port = r.port),
                r.query && (n.query = r.query);
        } else n.host && (n.hostname = jc(n.host).host);
        Rl(this, n),
            (this.secure = n.secure != null ? n.secure : typeof location < 'u' && location.protocol === 'https:'),
            n.hostname && !n.port && (n.port = this.secure ? '443' : '80'),
            (this.hostname = n.hostname || (typeof location < 'u' ? location.hostname : 'localhost')),
            (this.port = n.port || (typeof location < 'u' && location.port ? location.port : this.secure ? '443' : '80')),
            (this.transports = []),
            (this._transportsByName = {}),
            n.transports.forEach((r) => {
                const o = r.prototype.name;
                this.transports.push(o), (this._transportsByName[o] = r);
            }),
            (this.opts = Object.assign(
                {
                    path: '/engine.io',
                    agent: !1,
                    withCredentials: !1,
                    upgrade: !0,
                    timestampParam: 't',
                    rememberUpgrade: !1,
                    addTrailingSlash: !0,
                    rejectUnauthorized: !0,
                    perMessageDeflate: { threshold: 1024 },
                    transportOptions: {},
                    closeOnBeforeunload: !1,
                },
                n,
            )),
            (this.opts.path = this.opts.path.replace(/\/$/, '') + (this.opts.addTrailingSlash ? '/' : '')),
            typeof this.opts.query == 'string' && (this.opts.query = tO(this.opts.query)),
            zc &&
                (this.opts.closeOnBeforeunload &&
                    ((this._beforeunloadEventListener = () => {
                        this.transport && (this.transport.removeAllListeners(), this.transport.close());
                    }),
                    addEventListener('beforeunload', this._beforeunloadEventListener, !1)),
                this.hostname !== 'localhost' &&
                    ((this._offlineEventListener = () => {
                        this._onClose('transport close', { description: 'network connection lost' });
                    }),
                    ss.push(this._offlineEventListener))),
            this.opts.withCredentials && (this._cookieJar = void 0),
            this._open();
    }
    createTransport(t) {
        const n = Object.assign({}, this.opts.query);
        (n.EIO = iw), (n.transport = t), this.id && (n.sid = this.id);
        const r = Object.assign(
            {},
            this.opts,
            { query: n, socket: this, hostname: this.hostname, secure: this.secure, port: this.port },
            this.opts.transportOptions[t],
        );
        return new this._transportsByName[t](r);
    }
    _open() {
        if (this.transports.length === 0) {
            this.setTimeoutFn(() => {
                this.emitReserved('error', 'No transports available');
            }, 0);
            return;
        }
        const t =
            this.opts.rememberUpgrade && wn.priorWebsocketSuccess && this.transports.indexOf('websocket') !== -1
                ? 'websocket'
                : this.transports[0];
        this.readyState = 'opening';
        const n = this.createTransport(t);
        n.open(), this.setTransport(n);
    }
    setTransport(t) {
        this.transport && this.transport.removeAllListeners(),
            (this.transport = t),
            t
                .on('drain', this._onDrain.bind(this))
                .on('packet', this._onPacket.bind(this))
                .on('error', this._onError.bind(this))
                .on('close', (n) => this._onClose('transport close', n));
    }
    onOpen() {
        (this.readyState = 'open'),
            (wn.priorWebsocketSuccess = this.transport.name === 'websocket'),
            this.emitReserved('open'),
            this.flush();
    }
    _onPacket(t) {
        if (this.readyState === 'opening' || this.readyState === 'open' || this.readyState === 'closing')
            switch ((this.emitReserved('packet', t), this.emitReserved('heartbeat'), t.type)) {
                case 'open':
                    this.onHandshake(JSON.parse(t.data));
                    break;
                case 'ping':
                    this._sendPacket('pong'), this.emitReserved('ping'), this.emitReserved('pong'), this._resetPingTimeout();
                    break;
                case 'error':
                    const n = new Error('server error');
                    (n.code = t.data), this._onError(n);
                    break;
                case 'message':
                    this.emitReserved('data', t.data), this.emitReserved('message', t.data);
                    break;
            }
    }
    onHandshake(t) {
        this.emitReserved('handshake', t),
            (this.id = t.sid),
            (this.transport.query.sid = t.sid),
            (this._pingInterval = t.pingInterval),
            (this._pingTimeout = t.pingTimeout),
            (this._maxPayload = t.maxPayload),
            this.onOpen(),
            this.readyState !== 'closed' && this._resetPingTimeout();
    }
    _resetPingTimeout() {
        this.clearTimeoutFn(this._pingTimeoutTimer);
        const t = this._pingInterval + this._pingTimeout;
        (this._pingTimeoutTime = Date.now() + t),
            (this._pingTimeoutTimer = this.setTimeoutFn(() => {
                this._onClose('ping timeout');
            }, t)),
            this.opts.autoUnref && this._pingTimeoutTimer.unref();
    }
    _onDrain() {
        this.writeBuffer.splice(0, this._prevBufferLen),
            (this._prevBufferLen = 0),
            this.writeBuffer.length === 0 ? this.emitReserved('drain') : this.flush();
    }
    flush() {
        if (this.readyState !== 'closed' && this.transport.writable && !this.upgrading && this.writeBuffer.length) {
            const t = this._getWritablePackets();
            this.transport.send(t), (this._prevBufferLen = t.length), this.emitReserved('flush');
        }
    }
    _getWritablePackets() {
        if (!(this._maxPayload && this.transport.name === 'polling' && this.writeBuffer.length > 1)) return this.writeBuffer;
        let n = 1;
        for (let r = 0; r < this.writeBuffer.length; r++) {
            const o = this.writeBuffer[r].data;
            if ((o && (n += J_(o)), r > 0 && n > this._maxPayload)) return this.writeBuffer.slice(0, r);
            n += 2;
        }
        return this.writeBuffer;
    }
    _hasPingExpired() {
        if (!this._pingTimeoutTime) return !0;
        const t = Date.now() > this._pingTimeoutTime;
        return (
            t &&
                ((this._pingTimeoutTime = 0),
                kl(() => {
                    this._onClose('ping timeout');
                }, this.setTimeoutFn)),
            t
        );
    }
    write(t, n, r) {
        return this._sendPacket('message', t, n, r), this;
    }
    send(t, n, r) {
        return this._sendPacket('message', t, n, r), this;
    }
    _sendPacket(t, n, r, o) {
        if (
            (typeof n == 'function' && ((o = n), (n = void 0)),
            typeof r == 'function' && ((o = r), (r = null)),
            this.readyState === 'closing' || this.readyState === 'closed')
        )
            return;
        (r = r || {}), (r.compress = r.compress !== !1);
        const i = { type: t, data: n, options: r };
        this.emitReserved('packetCreate', i), this.writeBuffer.push(i), o && this.once('flush', o), this.flush();
    }
    close() {
        const t = () => {
                this._onClose('forced close'), this.transport.close();
            },
            n = () => {
                this.off('upgrade', n), this.off('upgradeError', n), t();
            },
            r = () => {
                this.once('upgrade', n), this.once('upgradeError', n);
            };
        return (
            (this.readyState === 'opening' || this.readyState === 'open') &&
                ((this.readyState = 'closing'),
                this.writeBuffer.length
                    ? this.once('drain', () => {
                          this.upgrading ? r() : t();
                      })
                    : this.upgrading
                      ? r()
                      : t()),
            this
        );
    }
    _onError(t) {
        if (
            ((wn.priorWebsocketSuccess = !1),
            this.opts.tryAllTransports && this.transports.length > 1 && this.readyState === 'opening')
        )
            return this.transports.shift(), this._open();
        this.emitReserved('error', t), this._onClose('transport error', t);
    }
    _onClose(t, n) {
        if (this.readyState === 'opening' || this.readyState === 'open' || this.readyState === 'closing') {
            if (
                (this.clearTimeoutFn(this._pingTimeoutTimer),
                this.transport.removeAllListeners('close'),
                this.transport.close(),
                this.transport.removeAllListeners(),
                zc &&
                    (this._beforeunloadEventListener &&
                        removeEventListener('beforeunload', this._beforeunloadEventListener, !1),
                    this._offlineEventListener))
            ) {
                const r = ss.indexOf(this._offlineEventListener);
                r !== -1 && ss.splice(r, 1);
            }
            (this.readyState = 'closed'),
                (this.id = null),
                this.emitReserved('close', t, n),
                (this.writeBuffer = []),
                (this._prevBufferLen = 0);
        }
    }
}
wn.protocol = iw;
class vO extends wn {
    constructor() {
        super(...arguments), (this._upgrades = []);
    }
    onOpen() {
        if ((super.onOpen(), this.readyState === 'open' && this.opts.upgrade))
            for (let t = 0; t < this._upgrades.length; t++) this._probe(this._upgrades[t]);
    }
    _probe(t) {
        let n = this.createTransport(t),
            r = !1;
        wn.priorWebsocketSuccess = !1;
        const o = () => {
            r ||
                (n.send([{ type: 'ping', data: 'probe' }]),
                n.once('packet', (f) => {
                    if (!r)
                        if (f.type === 'pong' && f.data === 'probe') {
                            if (((this.upgrading = !0), this.emitReserved('upgrading', n), !n)) return;
                            (wn.priorWebsocketSuccess = n.name === 'websocket'),
                                this.transport.pause(() => {
                                    r ||
                                        (this.readyState !== 'closed' &&
                                            (u(),
                                            this.setTransport(n),
                                            n.send([{ type: 'upgrade' }]),
                                            this.emitReserved('upgrade', n),
                                            (n = null),
                                            (this.upgrading = !1),
                                            this.flush()));
                                });
                        } else {
                            const d = new Error('probe error');
                            (d.transport = n.name), this.emitReserved('upgradeError', d);
                        }
                }));
        };
        function i() {
            r || ((r = !0), u(), n.close(), (n = null));
        }
        const s = (f) => {
            const d = new Error('probe error: ' + f);
            (d.transport = n.name), i(), this.emitReserved('upgradeError', d);
        };
        function l() {
            s('transport closed');
        }
        function a() {
            s('socket closed');
        }
        function c(f) {
            n && f.name !== n.name && i();
        }
        const u = () => {
            n.removeListener('open', o),
                n.removeListener('error', s),
                n.removeListener('close', l),
                this.off('close', a),
                this.off('upgrading', c);
        };
        n.once('open', o),
            n.once('error', s),
            n.once('close', l),
            this.once('close', a),
            this.once('upgrading', c),
            this._upgrades.indexOf('webtransport') !== -1 && t !== 'webtransport'
                ? this.setTimeoutFn(() => {
                      r || n.open();
                  }, 200)
                : n.open();
    }
    onHandshake(t) {
        (this._upgrades = this._filterUpgrades(t.upgrades)), super.onHandshake(t);
    }
    _filterUpgrades(t) {
        const n = [];
        for (let r = 0; r < t.length; r++) ~this.transports.indexOf(t[r]) && n.push(t[r]);
        return n;
    }
}
let yO = class extends vO {
    constructor(t, n = {}) {
        const r = typeof t == 'object' ? t : n;
        (!r.transports || (r.transports && typeof r.transports[0] == 'string')) &&
            (r.transports = (r.transports || ['polling', 'websocket', 'webtransport']).map((o) => dO[o]).filter((o) => !!o)),
            super(t, r);
    }
};
function wO(e, t = '', n) {
    let r = e;
    (n = n || (typeof location < 'u' && location)),
        e == null && (e = n.protocol + '//' + n.host),
        typeof e == 'string' &&
            (e.charAt(0) === '/' && (e.charAt(1) === '/' ? (e = n.protocol + e) : (e = n.host + e)),
            /^(https?|wss?):\/\//.test(e) || (typeof n < 'u' ? (e = n.protocol + '//' + e) : (e = 'https://' + e)),
            (r = jc(e))),
        r.port || (/^(http|ws)$/.test(r.protocol) ? (r.port = '80') : /^(http|ws)s$/.test(r.protocol) && (r.port = '443')),
        (r.path = r.path || '/');
    const i = r.host.indexOf(':') !== -1 ? '[' + r.host + ']' : r.host;
    return (
        (r.id = r.protocol + '://' + i + ':' + r.port + t),
        (r.href = r.protocol + '://' + i + (n && n.port === r.port ? '' : ':' + r.port)),
        r
    );
}
const SO = typeof ArrayBuffer == 'function',
    EO = (e) => (typeof ArrayBuffer.isView == 'function' ? ArrayBuffer.isView(e) : e.buffer instanceof ArrayBuffer),
    fw = Object.prototype.toString,
    xO = typeof Blob == 'function' || (typeof Blob < 'u' && fw.call(Blob) === '[object BlobConstructor]'),
    CO = typeof File == 'function' || (typeof File < 'u' && fw.call(File) === '[object FileConstructor]');
function xf(e) {
    return (SO && (e instanceof ArrayBuffer || EO(e))) || (xO && e instanceof Blob) || (CO && e instanceof File);
}
function ls(e, t) {
    if (!e || typeof e != 'object') return !1;
    if (Array.isArray(e)) {
        for (let n = 0, r = e.length; n < r; n++) if (ls(e[n])) return !0;
        return !1;
    }
    if (xf(e)) return !0;
    if (e.toJSON && typeof e.toJSON == 'function' && arguments.length === 1) return ls(e.toJSON(), !0);
    for (const n in e) if (Object.prototype.hasOwnProperty.call(e, n) && ls(e[n])) return !0;
    return !1;
}
function bO(e) {
    const t = [],
        n = e.data,
        r = e;
    return (r.data = Uc(n, t)), (r.attachments = t.length), { packet: r, buffers: t };
}
function Uc(e, t) {
    if (!e) return e;
    if (xf(e)) {
        const n = { _placeholder: !0, num: t.length };
        return t.push(e), n;
    } else if (Array.isArray(e)) {
        const n = new Array(e.length);
        for (let r = 0; r < e.length; r++) n[r] = Uc(e[r], t);
        return n;
    } else if (typeof e == 'object' && !(e instanceof Date)) {
        const n = {};
        for (const r in e) Object.prototype.hasOwnProperty.call(e, r) && (n[r] = Uc(e[r], t));
        return n;
    }
    return e;
}
function TO(e, t) {
    return (e.data = Bc(e.data, t)), delete e.attachments, e;
}
function Bc(e, t) {
    if (!e) return e;
    if (e && e._placeholder === !0) {
        if (typeof e.num == 'number' && e.num >= 0 && e.num < t.length) return t[e.num];
        throw new Error('illegal attachments');
    } else if (Array.isArray(e)) for (let n = 0; n < e.length; n++) e[n] = Bc(e[n], t);
    else if (typeof e == 'object') for (const n in e) Object.prototype.hasOwnProperty.call(e, n) && (e[n] = Bc(e[n], t));
    return e;
}
const kO = ['connect', 'connect_error', 'disconnect', 'disconnecting', 'newListener', 'removeListener'],
    RO = 5;
var q;
(function (e) {
    (e[(e.CONNECT = 0)] = 'CONNECT'),
        (e[(e.DISCONNECT = 1)] = 'DISCONNECT'),
        (e[(e.EVENT = 2)] = 'EVENT'),
        (e[(e.ACK = 3)] = 'ACK'),
        (e[(e.CONNECT_ERROR = 4)] = 'CONNECT_ERROR'),
        (e[(e.BINARY_EVENT = 5)] = 'BINARY_EVENT'),
        (e[(e.BINARY_ACK = 6)] = 'BINARY_ACK');
})(q || (q = {}));
class _O {
    constructor(t) {
        this.replacer = t;
    }
    encode(t) {
        return (t.type === q.EVENT || t.type === q.ACK) && ls(t)
            ? this.encodeAsBinary({
                  type: t.type === q.EVENT ? q.BINARY_EVENT : q.BINARY_ACK,
                  nsp: t.nsp,
                  data: t.data,
                  id: t.id,
              })
            : [this.encodeAsString(t)];
    }
    encodeAsString(t) {
        let n = '' + t.type;
        return (
            (t.type === q.BINARY_EVENT || t.type === q.BINARY_ACK) && (n += t.attachments + '-'),
            t.nsp && t.nsp !== '/' && (n += t.nsp + ','),
            t.id != null && (n += t.id),
            t.data != null && (n += JSON.stringify(t.data, this.replacer)),
            n
        );
    }
    encodeAsBinary(t) {
        const n = bO(t),
            r = this.encodeAsString(n.packet),
            o = n.buffers;
        return o.unshift(r), o;
    }
}
function zh(e) {
    return Object.prototype.toString.call(e) === '[object Object]';
}
class Cf extends fe {
    constructor(t) {
        super(), (this.reviver = t);
    }
    add(t) {
        let n;
        if (typeof t == 'string') {
            if (this.reconstructor) throw new Error('got plaintext data when reconstructing a packet');
            n = this.decodeString(t);
            const r = n.type === q.BINARY_EVENT;
            r || n.type === q.BINARY_ACK
                ? ((n.type = r ? q.EVENT : q.ACK),
                  (this.reconstructor = new OO(n)),
                  n.attachments === 0 && super.emitReserved('decoded', n))
                : super.emitReserved('decoded', n);
        } else if (xf(t) || t.base64)
            if (this.reconstructor)
                (n = this.reconstructor.takeBinaryData(t)),
                    n && ((this.reconstructor = null), super.emitReserved('decoded', n));
            else throw new Error('got binary data when not reconstructing a packet');
        else throw new Error('Unknown type: ' + t);
    }
    decodeString(t) {
        let n = 0;
        const r = { type: Number(t.charAt(0)) };
        if (q[r.type] === void 0) throw new Error('unknown packet type ' + r.type);
        if (r.type === q.BINARY_EVENT || r.type === q.BINARY_ACK) {
            const i = n + 1;
            for (; t.charAt(++n) !== '-' && n != t.length; );
            const s = t.substring(i, n);
            if (s != Number(s) || t.charAt(n) !== '-') throw new Error('Illegal attachments');
            r.attachments = Number(s);
        }
        if (t.charAt(n + 1) === '/') {
            const i = n + 1;
            for (; ++n && !(t.charAt(n) === ',' || n === t.length); );
            r.nsp = t.substring(i, n);
        } else r.nsp = '/';
        const o = t.charAt(n + 1);
        if (o !== '' && Number(o) == o) {
            const i = n + 1;
            for (; ++n; ) {
                const s = t.charAt(n);
                if (s == null || Number(s) != s) {
                    --n;
                    break;
                }
                if (n === t.length) break;
            }
            r.id = Number(t.substring(i, n + 1));
        }
        if (t.charAt(++n)) {
            const i = this.tryParse(t.substr(n));
            if (Cf.isPayloadValid(r.type, i)) r.data = i;
            else throw new Error('invalid payload');
        }
        return r;
    }
    tryParse(t) {
        try {
            return JSON.parse(t, this.reviver);
        } catch {
            return !1;
        }
    }
    static isPayloadValid(t, n) {
        switch (t) {
            case q.CONNECT:
                return zh(n);
            case q.DISCONNECT:
                return n === void 0;
            case q.CONNECT_ERROR:
                return typeof n == 'string' || zh(n);
            case q.EVENT:
            case q.BINARY_EVENT:
                return Array.isArray(n) && (typeof n[0] == 'number' || (typeof n[0] == 'string' && kO.indexOf(n[0]) === -1));
            case q.ACK:
            case q.BINARY_ACK:
                return Array.isArray(n);
        }
    }
    destroy() {
        this.reconstructor && (this.reconstructor.finishedReconstruction(), (this.reconstructor = null));
    }
}
class OO {
    constructor(t) {
        (this.packet = t), (this.buffers = []), (this.reconPack = t);
    }
    takeBinaryData(t) {
        if ((this.buffers.push(t), this.buffers.length === this.reconPack.attachments)) {
            const n = TO(this.reconPack, this.buffers);
            return this.finishedReconstruction(), n;
        }
        return null;
    }
    finishedReconstruction() {
        (this.reconPack = null), (this.buffers = []);
    }
}
const PO = Object.freeze(
    Object.defineProperty(
        {
            __proto__: null,
            Decoder: Cf,
            Encoder: _O,
            get PacketType() {
                return q;
            },
            protocol: RO,
        },
        Symbol.toStringTag,
        { value: 'Module' },
    ),
);
function pt(e, t, n) {
    return (
        e.on(t, n),
        function () {
            e.off(t, n);
        }
    );
}
const NO = Object.freeze({ connect: 1, connect_error: 1, disconnect: 1, disconnecting: 1, newListener: 1, removeListener: 1 });
class dw extends fe {
    constructor(t, n, r) {
        super(),
            (this.connected = !1),
            (this.recovered = !1),
            (this.receiveBuffer = []),
            (this.sendBuffer = []),
            (this._queue = []),
            (this._queueSeq = 0),
            (this.ids = 0),
            (this.acks = {}),
            (this.flags = {}),
            (this.io = t),
            (this.nsp = n),
            r && r.auth && (this.auth = r.auth),
            (this._opts = Object.assign({}, r)),
            this.io._autoConnect && this.open();
    }
    get disconnected() {
        return !this.connected;
    }
    subEvents() {
        if (this.subs) return;
        const t = this.io;
        this.subs = [
            pt(t, 'open', this.onopen.bind(this)),
            pt(t, 'packet', this.onpacket.bind(this)),
            pt(t, 'error', this.onerror.bind(this)),
            pt(t, 'close', this.onclose.bind(this)),
        ];
    }
    get active() {
        return !!this.subs;
    }
    connect() {
        return this.connected
            ? this
            : (this.subEvents(),
              this.io._reconnecting || this.io.open(),
              this.io._readyState === 'open' && this.onopen(),
              this);
    }
    open() {
        return this.connect();
    }
    send(...t) {
        return t.unshift('message'), this.emit.apply(this, t), this;
    }
    emit(t, ...n) {
        var r, o, i;
        if (NO.hasOwnProperty(t)) throw new Error('"' + t.toString() + '" is a reserved event name');
        if ((n.unshift(t), this._opts.retries && !this.flags.fromQueue && !this.flags.volatile))
            return this._addToQueue(n), this;
        const s = { type: q.EVENT, data: n };
        if (((s.options = {}), (s.options.compress = this.flags.compress !== !1), typeof n[n.length - 1] == 'function')) {
            const u = this.ids++,
                f = n.pop();
            this._registerAckCallback(u, f), (s.id = u);
        }
        const l =
                (o = (r = this.io.engine) === null || r === void 0 ? void 0 : r.transport) === null || o === void 0
                    ? void 0
                    : o.writable,
            a = this.connected && !(!((i = this.io.engine) === null || i === void 0) && i._hasPingExpired());
        return (
            (this.flags.volatile && !l) || (a ? (this.notifyOutgoingListeners(s), this.packet(s)) : this.sendBuffer.push(s)),
            (this.flags = {}),
            this
        );
    }
    _registerAckCallback(t, n) {
        var r;
        const o = (r = this.flags.timeout) !== null && r !== void 0 ? r : this._opts.ackTimeout;
        if (o === void 0) {
            this.acks[t] = n;
            return;
        }
        const i = this.io.setTimeoutFn(() => {
                delete this.acks[t];
                for (let l = 0; l < this.sendBuffer.length; l++) this.sendBuffer[l].id === t && this.sendBuffer.splice(l, 1);
                n.call(this, new Error('operation has timed out'));
            }, o),
            s = (...l) => {
                this.io.clearTimeoutFn(i), n.apply(this, l);
            };
        (s.withError = !0), (this.acks[t] = s);
    }
    emitWithAck(t, ...n) {
        return new Promise((r, o) => {
            const i = (s, l) => (s ? o(s) : r(l));
            (i.withError = !0), n.push(i), this.emit(t, ...n);
        });
    }
    _addToQueue(t) {
        let n;
        typeof t[t.length - 1] == 'function' && (n = t.pop());
        const r = {
            id: this._queueSeq++,
            tryCount: 0,
            pending: !1,
            args: t,
            flags: Object.assign({ fromQueue: !0 }, this.flags),
        };
        t.push((o, ...i) =>
            r !== this._queue[0]
                ? void 0
                : (o !== null
                      ? r.tryCount > this._opts.retries && (this._queue.shift(), n && n(o))
                      : (this._queue.shift(), n && n(null, ...i)),
                  (r.pending = !1),
                  this._drainQueue()),
        ),
            this._queue.push(r),
            this._drainQueue();
    }
    _drainQueue(t = !1) {
        if (!this.connected || this._queue.length === 0) return;
        const n = this._queue[0];
        (n.pending && !t) || ((n.pending = !0), n.tryCount++, (this.flags = n.flags), this.emit.apply(this, n.args));
    }
    packet(t) {
        (t.nsp = this.nsp), this.io._packet(t);
    }
    onopen() {
        typeof this.auth == 'function'
            ? this.auth((t) => {
                  this._sendConnectPacket(t);
              })
            : this._sendConnectPacket(this.auth);
    }
    _sendConnectPacket(t) {
        this.packet({ type: q.CONNECT, data: this._pid ? Object.assign({ pid: this._pid, offset: this._lastOffset }, t) : t });
    }
    onerror(t) {
        this.connected || this.emitReserved('connect_error', t);
    }
    onclose(t, n) {
        (this.connected = !1), delete this.id, this.emitReserved('disconnect', t, n), this._clearAcks();
    }
    _clearAcks() {
        Object.keys(this.acks).forEach((t) => {
            if (!this.sendBuffer.some((r) => String(r.id) === t)) {
                const r = this.acks[t];
                delete this.acks[t], r.withError && r.call(this, new Error('socket has been disconnected'));
            }
        });
    }
    onpacket(t) {
        if (t.nsp === this.nsp)
            switch (t.type) {
                case q.CONNECT:
                    t.data && t.data.sid
                        ? this.onconnect(t.data.sid, t.data.pid)
                        : this.emitReserved(
                              'connect_error',
                              new Error(
                                  'It seems you are trying to reach a Socket.IO server in v2.x with a v3.x client, but they are not compatible (more information here: https://socket.io/docs/v3/migrating-from-2-x-to-3-0/)',
                              ),
                          );
                    break;
                case q.EVENT:
                case q.BINARY_EVENT:
                    this.onevent(t);
                    break;
                case q.ACK:
                case q.BINARY_ACK:
                    this.onack(t);
                    break;
                case q.DISCONNECT:
                    this.ondisconnect();
                    break;
                case q.CONNECT_ERROR:
                    this.destroy();
                    const r = new Error(t.data.message);
                    (r.data = t.data.data), this.emitReserved('connect_error', r);
                    break;
            }
    }
    onevent(t) {
        const n = t.data || [];
        t.id != null && n.push(this.ack(t.id)), this.connected ? this.emitEvent(n) : this.receiveBuffer.push(Object.freeze(n));
    }
    emitEvent(t) {
        if (this._anyListeners && this._anyListeners.length) {
            const n = this._anyListeners.slice();
            for (const r of n) r.apply(this, t);
        }
        super.emit.apply(this, t),
            this._pid && t.length && typeof t[t.length - 1] == 'string' && (this._lastOffset = t[t.length - 1]);
    }
    ack(t) {
        const n = this;
        let r = !1;
        return function (...o) {
            r || ((r = !0), n.packet({ type: q.ACK, id: t, data: o }));
        };
    }
    onack(t) {
        const n = this.acks[t.id];
        typeof n == 'function' && (delete this.acks[t.id], n.withError && t.data.unshift(null), n.apply(this, t.data));
    }
    onconnect(t, n) {
        (this.id = t),
            (this.recovered = n && this._pid === n),
            (this._pid = n),
            (this.connected = !0),
            this.emitBuffered(),
            this.emitReserved('connect'),
            this._drainQueue(!0);
    }
    emitBuffered() {
        this.receiveBuffer.forEach((t) => this.emitEvent(t)),
            (this.receiveBuffer = []),
            this.sendBuffer.forEach((t) => {
                this.notifyOutgoingListeners(t), this.packet(t);
            }),
            (this.sendBuffer = []);
    }
    ondisconnect() {
        this.destroy(), this.onclose('io server disconnect');
    }
    destroy() {
        this.subs && (this.subs.forEach((t) => t()), (this.subs = void 0)), this.io._destroy(this);
    }
    disconnect() {
        return (
            this.connected && this.packet({ type: q.DISCONNECT }),
            this.destroy(),
            this.connected && this.onclose('io client disconnect'),
            this
        );
    }
    close() {
        return this.disconnect();
    }
    compress(t) {
        return (this.flags.compress = t), this;
    }
    get volatile() {
        return (this.flags.volatile = !0), this;
    }
    timeout(t) {
        return (this.flags.timeout = t), this;
    }
    onAny(t) {
        return (this._anyListeners = this._anyListeners || []), this._anyListeners.push(t), this;
    }
    prependAny(t) {
        return (this._anyListeners = this._anyListeners || []), this._anyListeners.unshift(t), this;
    }
    offAny(t) {
        if (!this._anyListeners) return this;
        if (t) {
            const n = this._anyListeners;
            for (let r = 0; r < n.length; r++) if (t === n[r]) return n.splice(r, 1), this;
        } else this._anyListeners = [];
        return this;
    }
    listenersAny() {
        return this._anyListeners || [];
    }
    onAnyOutgoing(t) {
        return (this._anyOutgoingListeners = this._anyOutgoingListeners || []), this._anyOutgoingListeners.push(t), this;
    }
    prependAnyOutgoing(t) {
        return (this._anyOutgoingListeners = this._anyOutgoingListeners || []), this._anyOutgoingListeners.unshift(t), this;
    }
    offAnyOutgoing(t) {
        if (!this._anyOutgoingListeners) return this;
        if (t) {
            const n = this._anyOutgoingListeners;
            for (let r = 0; r < n.length; r++) if (t === n[r]) return n.splice(r, 1), this;
        } else this._anyOutgoingListeners = [];
        return this;
    }
    listenersAnyOutgoing() {
        return this._anyOutgoingListeners || [];
    }
    notifyOutgoingListeners(t) {
        if (this._anyOutgoingListeners && this._anyOutgoingListeners.length) {
            const n = this._anyOutgoingListeners.slice();
            for (const r of n) r.apply(this, t.data);
        }
    }
}
function Gr(e) {
    (e = e || {}),
        (this.ms = e.min || 100),
        (this.max = e.max || 1e4),
        (this.factor = e.factor || 2),
        (this.jitter = e.jitter > 0 && e.jitter <= 1 ? e.jitter : 0),
        (this.attempts = 0);
}
Gr.prototype.duration = function () {
    var e = this.ms * Math.pow(this.factor, this.attempts++);
    if (this.jitter) {
        var t = Math.random(),
            n = Math.floor(t * this.jitter * e);
        e = Math.floor(t * 10) & 1 ? e + n : e - n;
    }
    return Math.min(e, this.max) | 0;
};
Gr.prototype.reset = function () {
    this.attempts = 0;
};
Gr.prototype.setMin = function (e) {
    this.ms = e;
};
Gr.prototype.setMax = function (e) {
    this.max = e;
};
Gr.prototype.setJitter = function (e) {
    this.jitter = e;
};
class $c extends fe {
    constructor(t, n) {
        var r;
        super(),
            (this.nsps = {}),
            (this.subs = []),
            t && typeof t == 'object' && ((n = t), (t = void 0)),
            (n = n || {}),
            (n.path = n.path || '/socket.io'),
            (this.opts = n),
            Rl(this, n),
            this.reconnection(n.reconnection !== !1),
            this.reconnectionAttempts(n.reconnectionAttempts || 1 / 0),
            this.reconnectionDelay(n.reconnectionDelay || 1e3),
            this.reconnectionDelayMax(n.reconnectionDelayMax || 5e3),
            this.randomizationFactor((r = n.randomizationFactor) !== null && r !== void 0 ? r : 0.5),
            (this.backoff = new Gr({
                min: this.reconnectionDelay(),
                max: this.reconnectionDelayMax(),
                jitter: this.randomizationFactor(),
            })),
            this.timeout(n.timeout == null ? 2e4 : n.timeout),
            (this._readyState = 'closed'),
            (this.uri = t);
        const o = n.parser || PO;
        (this.encoder = new o.Encoder()),
            (this.decoder = new o.Decoder()),
            (this._autoConnect = n.autoConnect !== !1),
            this._autoConnect && this.open();
    }
    reconnection(t) {
        return arguments.length ? ((this._reconnection = !!t), t || (this.skipReconnect = !0), this) : this._reconnection;
    }
    reconnectionAttempts(t) {
        return t === void 0 ? this._reconnectionAttempts : ((this._reconnectionAttempts = t), this);
    }
    reconnectionDelay(t) {
        var n;
        return t === void 0
            ? this._reconnectionDelay
            : ((this._reconnectionDelay = t), (n = this.backoff) === null || n === void 0 || n.setMin(t), this);
    }
    randomizationFactor(t) {
        var n;
        return t === void 0
            ? this._randomizationFactor
            : ((this._randomizationFactor = t), (n = this.backoff) === null || n === void 0 || n.setJitter(t), this);
    }
    reconnectionDelayMax(t) {
        var n;
        return t === void 0
            ? this._reconnectionDelayMax
            : ((this._reconnectionDelayMax = t), (n = this.backoff) === null || n === void 0 || n.setMax(t), this);
    }
    timeout(t) {
        return arguments.length ? ((this._timeout = t), this) : this._timeout;
    }
    maybeReconnectOnOpen() {
        !this._reconnecting && this._reconnection && this.backoff.attempts === 0 && this.reconnect();
    }
    open(t) {
        if (~this._readyState.indexOf('open')) return this;
        this.engine = new yO(this.uri, this.opts);
        const n = this.engine,
            r = this;
        (this._readyState = 'opening'), (this.skipReconnect = !1);
        const o = pt(n, 'open', function () {
                r.onopen(), t && t();
            }),
            i = (l) => {
                this.cleanup(),
                    (this._readyState = 'closed'),
                    this.emitReserved('error', l),
                    t ? t(l) : this.maybeReconnectOnOpen();
            },
            s = pt(n, 'error', i);
        if (this._timeout !== !1) {
            const l = this._timeout,
                a = this.setTimeoutFn(() => {
                    o(), i(new Error('timeout')), n.close();
                }, l);
            this.opts.autoUnref && a.unref(),
                this.subs.push(() => {
                    this.clearTimeoutFn(a);
                });
        }
        return this.subs.push(o), this.subs.push(s), this;
    }
    connect(t) {
        return this.open(t);
    }
    onopen() {
        this.cleanup(), (this._readyState = 'open'), this.emitReserved('open');
        const t = this.engine;
        this.subs.push(
            pt(t, 'ping', this.onping.bind(this)),
            pt(t, 'data', this.ondata.bind(this)),
            pt(t, 'error', this.onerror.bind(this)),
            pt(t, 'close', this.onclose.bind(this)),
            pt(this.decoder, 'decoded', this.ondecoded.bind(this)),
        );
    }
    onping() {
        this.emitReserved('ping');
    }
    ondata(t) {
        try {
            this.decoder.add(t);
        } catch (n) {
            this.onclose('parse error', n);
        }
    }
    ondecoded(t) {
        kl(() => {
            this.emitReserved('packet', t);
        }, this.setTimeoutFn);
    }
    onerror(t) {
        this.emitReserved('error', t);
    }
    socket(t, n) {
        let r = this.nsps[t];
        return r ? this._autoConnect && !r.active && r.connect() : ((r = new dw(this, t, n)), (this.nsps[t] = r)), r;
    }
    _destroy(t) {
        const n = Object.keys(this.nsps);
        for (const r of n) if (this.nsps[r].active) return;
        this._close();
    }
    _packet(t) {
        const n = this.encoder.encode(t);
        for (let r = 0; r < n.length; r++) this.engine.write(n[r], t.options);
    }
    cleanup() {
        this.subs.forEach((t) => t()), (this.subs.length = 0), this.decoder.destroy();
    }
    _close() {
        (this.skipReconnect = !0), (this._reconnecting = !1), this.onclose('forced close');
    }
    disconnect() {
        return this._close();
    }
    onclose(t, n) {
        var r;
        this.cleanup(),
            (r = this.engine) === null || r === void 0 || r.close(),
            this.backoff.reset(),
            (this._readyState = 'closed'),
            this.emitReserved('close', t, n),
            this._reconnection && !this.skipReconnect && this.reconnect();
    }
    reconnect() {
        if (this._reconnecting || this.skipReconnect) return this;
        const t = this;
        if (this.backoff.attempts >= this._reconnectionAttempts)
            this.backoff.reset(), this.emitReserved('reconnect_failed'), (this._reconnecting = !1);
        else {
            const n = this.backoff.duration();
            this._reconnecting = !0;
            const r = this.setTimeoutFn(() => {
                t.skipReconnect ||
                    (this.emitReserved('reconnect_attempt', t.backoff.attempts),
                    !t.skipReconnect &&
                        t.open((o) => {
                            o
                                ? ((t._reconnecting = !1), t.reconnect(), this.emitReserved('reconnect_error', o))
                                : t.onreconnect();
                        }));
            }, n);
            this.opts.autoUnref && r.unref(),
                this.subs.push(() => {
                    this.clearTimeoutFn(r);
                });
        }
    }
    onreconnect() {
        const t = this.backoff.attempts;
        (this._reconnecting = !1), this.backoff.reset(), this.emitReserved('reconnect', t);
    }
}
const ao = {};
function as(e, t) {
    typeof e == 'object' && ((t = e), (e = void 0)), (t = t || {});
    const n = wO(e, t.path || '/socket.io'),
        r = n.source,
        o = n.id,
        i = n.path,
        s = ao[o] && i in ao[o].nsps,
        l = t.forceNew || t['force new connection'] || t.multiplex === !1 || s;
    let a;
    return (
        l ? (a = new $c(r, t)) : (ao[o] || (ao[o] = new $c(r, t)), (a = ao[o])),
        n.query && !t.query && (t.query = n.queryKey),
        a.socket(n.path, t)
    );
}
Object.assign(as, { Manager: $c, Socket: dw, io: as, connect: as });
let DO = !1;
const AO = {},
    xa = 'http://localhost:8001',
    IO = '';
class MO {
    constructor() {
        Lt(this, 'socket', null);
        Lt(this, 'workspaceCallbacks', new Map());
        Lt(this, 'reconnecting', !1);
        Lt(this, 'pingInterval', null);
        Lt(this, 'lastUpdates', new Map());
        Lt(this, 'updateDebounceTimers', new Map());
    }
    isElectronAPIAvailable() {
        return typeof process < 'u' && process.versions && !!process.versions.electron;
    }
    async safeGetConfig() {
        try {
            return await we.getAll();
        } catch (t) {
            return console.error('Error getting config:', t), null;
        }
    }
    async safeGetAuthToken() {
        try {
            return await we.getAuthToken();
        } catch (t) {
            return console.error('Error getting auth token:', t), IO;
        }
    }
    async safeGetServerUrl() {
        try {
            return await we.getServerUrl();
        } catch (t) {
            return console.error('Error getting server URL:', t), xa;
        }
    }
    async connect() {
        return new Promise(async (t, n) => {
            var r, o, i;
            try {
                if (
                    (this.socket && this.socket.connected && this.socket.disconnect(),
                    console.log('Attempting to connect to WebSocket server'),
                    console.log('Waiting for auth token initialization to complete...'),
                    Ye)
                )
                    try {
                        console.log('Token initialization promise exists, waiting for it to resolve...'),
                            await Ye,
                            console.log('Token initialization complete');
                    } catch (u) {
                        console.error('Error waiting for token initialization:', u);
                    }
                else console.log('No token initialization promise found');
                const s = await this.safeGetConfig();
                console.log('Config structure keys:', s ? Object.keys(s).join(', ') : 'empty');
                let l = '';
                if ((o = (r = s == null ? void 0 : s.server) == null ? void 0 : r.auth) != null && o.token)
                    (l = s.server.auth.token),
                        console.log(`Found auth token in server.auth.token: ${l.substring(0, 15)}... (${l.length} chars)`);
                else {
                    console.error('No token found in server.auth.token structure!'),
                        console.log(
                            'Full config server section:',
                            JSON.stringify((s == null ? void 0 : s.server) || 'undefined'),
                        );
                    try {
                        (l = await this.safeGetAuthToken()),
                            l && console.log(`Retrieved token via getAuthToken: ${l.substring(0, 15)}...`);
                    } catch (u) {
                        console.error('Error during token fallback retrieval:', u);
                    }
                }
                l &&
                    (l.split('.').length !== 3
                        ? (console.error('Auth token does not have valid JWT format (should have 3 parts separated by dots)'),
                          console.error('This may cause authentication to fail'))
                        : console.log('Auth token has valid JWT format')),
                    l && ((AO.authToken = l), (DO = !0));
                let a = xa;
                try {
                    a = ((i = s == null ? void 0 : s.server) == null ? void 0 : i.url) || (await this.safeGetServerUrl()) || xa;
                } catch (u) {
                    console.error('Error getting server URL:', u);
                }
                console.log(`Connecting to WebSocket server at ${a}`),
                    l
                        ? (console.log(`Using auth token: ${l.substring(0, 10)}...${l.substring(l.length - 5)}`),
                          console.log('Auth token length:', l.length),
                          console.log('Auth token character at position 0:', l.charAt(0)),
                          console.log('Auth token first 5 chars:', l.substring(0, 5)))
                        : (console.error('No authentication token available, connection will likely fail'),
                          console.error('Please check your configuration file at ~/.canvas/config/canvas-electron.json')),
                    console.log('Creating socket.io client with auth token...'),
                    (this.socket = as(a, {
                        transports: ['websocket'],
                        auth: { token: l },
                        reconnection: !0,
                        reconnectionAttempts: 5,
                        reconnectionDelay: 1e3,
                        reconnectionDelayMax: 5e3,
                        timeout: 1e4,
                    })),
                    console.log('Socket.io client created with auth:', {
                        hasToken: !!l,
                        tokenLength: l ? l.length : 0,
                        transport: 'websocket',
                        authObject: l ? { token: `${l.substring(0, 10)}...${l.substring(l.length - 5)}` } : null,
                    }),
                    this.setupEventListeners(),
                    this.startPing(),
                    this.socket.on('connect', () => {
                        var u;
                        console.log(`Connected to server with socket ID: ${(u = this.socket) == null ? void 0 : u.id}`),
                            (this.reconnecting = !1),
                            t();
                    }),
                    this.socket.on('connect_error', (u) => {
                        console.error('Socket connection error:', u),
                            console.error('Socket connection error message:', u.message),
                            u.message &&
                                u.message.includes('Authentication') &&
                                console.error('Authentication error detected. Please check your token.'),
                            this.handleReconnect(n, `Failed to connect: ${u.message}`);
                    });
                const c = setTimeout(() => {
                    var u;
                    ((u = this.socket) != null && u.connected) || this.handleReconnect(n, 'Connection timeout');
                }, 1e4);
                this.socket.on('connect', () => {
                    clearTimeout(c);
                });
            } catch (s) {
                console.error('Error in socket connect:', s), n(s);
            }
        });
    }
    handleReconnect(t, n) {
        this.reconnecting ||
            ((this.reconnecting = !0), console.log('Attempting to reconnect...'), t && t(new Error(n || 'Connection failed')));
    }
    startPing() {
        this.pingInterval && clearInterval(this.pingInterval),
            (this.pingInterval = setInterval(() => {
                this.socket && this.socket.connected
                    ? (console.log('Sending ping to keep connection alive'),
                      this.socket.emit('ping', (t) => {
                          t &&
                              t.success &&
                              console.log(`Ping successful, server timestamp: ${new Date(t.timestamp).toISOString()}`);
                      }))
                    : console.log('Socket not connected, skipping ping');
            }, 3e4));
    }
    stopPing() {
        this.pingInterval && (clearInterval(this.pingInterval), (this.pingInterval = null));
    }
    setupEventListeners() {
        this.socket &&
            (this.socket.on('reconnect', (t) => {
                console.log(`Reconnected after ${t} attempts`),
                    (this.reconnecting = !1),
                    this.workspaceCallbacks.forEach((n, r) => {
                        this.emitSubscribe(r);
                    });
            }),
            this.socket.on('disconnect', (t) => {
                var n;
                console.log(`Disconnected: ${t}`), t === 'io server disconnect' && ((n = this.socket) == null || n.connect());
            }),
            this.socket.on('workspace:workspace:tree:updated', (t) => {
                const { workspaceId: n, data: r } = t;
                console.log(`Received tree update for workspace ${n}, operation: ${r.operation}`);
                const o = `${n}:${r.operation}:${r.path || ''}`,
                    i = this.lastUpdates.get(o),
                    s = Date.now();
                if (i && s - i.timestamp < 500) {
                    console.log('Detected duplicate event, skipping', {
                        operation: r.operation,
                        path: r.path,
                        timeSinceLast: s - i.timestamp,
                    });
                    return;
                }
                this.lastUpdates.set(o, { timestamp: s, operation: r.operation, path: r.path });
                const l = `${n}`;
                this.updateDebounceTimers.has(l) && clearTimeout(this.updateDebounceTimers.get(l)),
                    this.updateDebounceTimers.set(
                        l,
                        setTimeout(() => {
                            const a = this.prepareTreeForUI(r.tree);
                            this.notifyWorkspaceSubscribers(n, a), this.updateDebounceTimers.delete(l);
                        }, 100),
                    );
            }));
    }
    prepareTreeForUI(t) {
        if (!t) return t;
        const n = JSON.parse(JSON.stringify(t));
        return this.processNode(n);
    }
    processNode(t, n = '') {
        return (
            t &&
            ((t._originalId = t.id),
            t.children &&
                Array.isArray(t.children) &&
                (t.children = t.children.map((r) => this.processNode(r, n ? `${n}/${t.name}` : `/${t.name}`))),
            t)
        );
    }
    subscribeToWorkspace(t, n) {
        console.log(`Subscribing to workspace ${t}`),
            this.workspaceCallbacks.has(t) || (this.workspaceCallbacks.set(t, []), this.emitSubscribe(t));
        const r = this.workspaceCallbacks.get(t);
        r.includes(n) || r.push(n);
    }
    emitSubscribe(t) {
        if (!this.socket || !this.socket.connected) {
            console.error('Cannot subscribe to workspace - socket not connected');
            return;
        }
        console.log(`Emitting subscribe for workspace ${t}`),
            this.socket.emit('workspace:subscribe', t, (n) => {
                n && n.status === 'success'
                    ? (console.log(`Successfully subscribed to workspace ${t}`),
                      this.getWorkspaceTree(t)
                          .then((r) => {
                              this.notifyWorkspaceSubscribers(t, r);
                          })
                          .catch((r) => {
                              console.error(`Error getting initial tree for workspace ${t}:`, r);
                          }))
                    : console.error(`Failed to subscribe to workspace ${t}:`, n ? n.error : 'Unknown error');
            });
    }
    unsubscribeFromWorkspace(t, n) {
        if (!this.workspaceCallbacks.has(t)) return;
        const r = this.workspaceCallbacks.get(t);
        if (n) {
            const o = r.indexOf(n);
            o !== -1 && r.splice(o, 1);
        } else r.length = 0;
        r.length === 0 && (this.workspaceCallbacks.delete(t), this.emitUnsubscribe(t));
    }
    emitUnsubscribe(t) {
        if (!this.socket || !this.socket.connected) {
            console.log(`Socket not connected, skipping unsubscribe for workspace ${t}`);
            return;
        }
        this.socket.emit('workspace:unsubscribe', t, (n) => {
            n && n.status === 'success'
                ? console.log(`Successfully unsubscribed from workspace ${t}`)
                : console.error(`Failed to unsubscribe from workspace ${t}:`, n ? n.error : 'Unknown error');
        });
    }
    notifyWorkspaceSubscribers(t, n) {
        if (!this.workspaceCallbacks.has(t)) return;
        const r = this.workspaceCallbacks.get(t),
            o = r.length;
        console.log(`Notifying ${o} subscribers for workspace ${t}`), r.forEach((i) => i(n));
    }
    getWorkspaceTree(t) {
        return new Promise((n, r) => {
            if (!this.socket || !this.socket.connected) {
                r(new Error('Socket not connected'));
                return;
            }
            console.log(`Getting tree for workspace ${t}`),
                this.socket.emit('workspace:tree:get', t, (o) => {
                    if (o && o.status === 'success') {
                        const i = o.payload.tree;
                        console.log(`Received tree for workspace ${t}`);
                        const s = this.prepareTreeForUI(i);
                        n(s);
                    } else
                        console.error(`Failed to get tree for workspace ${t}:`, o ? o.error : 'Unknown error'),
                            r(new Error(o ? o.error : 'Failed to get workspace tree'));
                });
        });
    }
    isConnected() {
        return !!(this.socket && this.socket.connected);
    }
    disconnect() {
        this.stopPing(),
            this.socket && (console.log('Disconnecting socket'), this.socket.disconnect(), (this.socket = null)),
            this.workspaceCallbacks.clear(),
            this.updateDebounceTimers.forEach((t) => clearTimeout(t)),
            this.updateDebounceTimers.clear();
    }
}
const or = new MO(),
    LO = () => {
        const [e, t] = g.useState(null),
            [n, r] = g.useState(null),
            [o, i] = g.useState(null),
            [s, l] = g.useState(!1),
            [a, c] = g.useState('universe'),
            [u, f] = g.useState(!1),
            [d, y] = g.useState(new Set()),
            m = g.useRef(new Map()),
            v = (b) => {
                m.current.set(b.id, b), b.children.forEach((x) => v(x));
            };
        g.useEffect(() => {
            (async () => {
                try {
                    const x = await we.getExpandedNodes();
                    x && x.length > 0 && y(new Set(x));
                } catch (x) {
                    console.error('Error loading expanded nodes:', x);
                }
            })();
        }, []),
            g.useEffect(() => {
                (async () => {
                    if (d.size > 0)
                        try {
                            await we.saveExpandedNodes(Array.from(d));
                        } catch (x) {
                            console.error('Error saving expanded nodes:', x);
                        }
                })();
            }, [d]),
            g.useEffect(() => {
                const b = () => typeof process < 'u' && process.versions && !!process.versions.electron,
                    x = async (L = 5e3) =>
                        new Promise((I) => {
                            if (b()) {
                                console.log('Electron API is available immediately'), I(!0);
                                return;
                            }
                            console.log('Waiting for Electron API to become available...');
                            const z = Date.now(),
                                j = setInterval(() => {
                                    b()
                                        ? (console.log('Electron API is now available'), clearInterval(j), I(!0))
                                        : Date.now() - z > L &&
                                          (console.error('Timed out waiting for Electron API'), clearInterval(j), I(!1));
                                }, 100);
                        }),
                    R = async () => {
                        var L;
                        try {
                            if (
                                (console.log('Initializing WebSocket connection'),
                                (await x()) ||
                                    console.warn('Proceeding with socket connection even though Electron API is not available'),
                                Ye)
                            ) {
                                console.log('Waiting for auth token to be initialized...');
                                try {
                                    await Ye;
                                } catch (j) {
                                    console.error('Error waiting for token initialization:', j);
                                }
                            }
                            await or.connect(), console.log('Successfully connected to WebSocket server'), f(!0), r(null);
                            const z = 'universe';
                            or.subscribeToWorkspace(z, _), c(z), await S(z);
                        } catch (I) {
                            console.error('Socket initialization error:', I);
                            let z = 'Failed to connect to server. Check your network connection and configuration.';
                            I instanceof Error &&
                                (I.message.includes('Authentication failed') || I.message.includes('Valid user not found')
                                    ? ((z =
                                          'Authentication failed. Please check your API token in ~/.canvas/config/canvas-electron.json'),
                                      console.error('Authentication error: Your token may be missing, invalid, or expired.'),
                                      console.error(
                                          'Please check your configuration file at ~/.canvas/config/canvas-electron.json',
                                      ))
                                    : I.message.includes('undefined') &&
                                      I.message.includes('electronAPI') &&
                                      ((z = 'Electron API initialization failed. Please restart the application.'),
                                      console.error(
                                          'Electron API error: The preload script may not have initialized correctly.',
                                      ))),
                                r(z),
                                f(!1);
                            try {
                                console.log('Attempting to fetch tree via HTTP as fallback');
                                const j = 'universe';
                                c(j), await S(j);
                            } catch (j) {
                                console.error('Failed to fetch tree data via HTTP:', j),
                                    K.isAxiosError(j) && ((L = j.response) == null ? void 0 : L.status) === 401
                                        ? r('Authentication failed with both WebSocket and HTTP. Please check your API token.')
                                        : r(z);
                            }
                        }
                    };
                R();
                const N = setInterval(() => {
                    or.isConnected()
                        ? u || (console.log('WebSocket reconnected'), f(!0), r(null))
                        : u && (console.log('WebSocket disconnected, will retry connection'), f(!1), R());
                }, 1e4);
                return () => {
                    console.log('Cleaning up WebSocket connections...'), clearInterval(N), or.disconnect();
                };
            }, []),
            g.useEffect(() => {
                e && (m.current.clear(), v(e));
            }, [e]);
        const S = async (b) => {
                var x;
                try {
                    if ((l(!0), r(null), or.isConnected()))
                        try {
                            console.log('Attempting to fetch tree via WebSocket');
                            const L = await or.getWorkspaceTree(b);
                            console.log('Successfully fetched tree via WebSocket'), t(L);
                            return;
                        } catch (L) {
                            console.warn('WebSocket tree fetch failed, falling back to HTTP:', L);
                        }
                    console.log('Fetching tree via HTTP API');
                    const R = await j_(),
                        N = await K.get(nn.workspaceTree(b), { headers: R });
                    if ((console.log('HTTP Tree response:', N.data), N.data.status === 'success')) {
                        const L = N.data.payload;
                        console.log('Setting tree data from HTTP:', L), t(L);
                    } else r(N.data.message || 'Failed to fetch tree data');
                } catch (R) {
                    console.error('Error fetching tree:', R),
                        K.isAxiosError(R) && ((x = R.response) == null ? void 0 : x.status) === 401
                            ? r('Authentication failed. Please check your API token.')
                            : r(R instanceof Error ? R.message : 'Unknown error');
                } finally {
                    l(!1);
                }
            },
            h = async (b, x) => {
                try {
                    const R = m.current.get(b),
                        N = m.current.get(x);
                    if (!R || !N) return;
                    l(!0), console.log('Moving node', b, 'to', x), await S(a);
                } catch (R) {
                    console.error('Error moving node:', R), r(R instanceof Error ? R.message : 'Failed to move node');
                } finally {
                    l(!1);
                }
            },
            p = (b, x = '') => window.prompt(b, x),
            w = {
                onCut: (b) => {
                    i({ action: 'cut', nodeId: b });
                },
                onCopy: (b) => {
                    i({ action: 'copy', nodeId: b });
                },
                onPaste: async (b) => {
                    if (o)
                        try {
                            l(!0);
                            const x = m.current.get(o.nodeId),
                                R = m.current.get(b);
                            if (!x || !R) return;
                            console.log('Pasting node', o.nodeId, 'to', b, 'with action', o.action),
                                o.action === 'cut' ? i(null) : o.action,
                                await S(a);
                        } catch (x) {
                            console.error('Error pasting node:', x), r(x instanceof Error ? x.message : 'Failed to paste node');
                        } finally {
                            l(!1);
                        }
                },
                onMove: async (b) => {
                    try {
                        if (!m.current.get(b)) return;
                        const R = p('Enter destination path:', '/');
                        if (!R) return;
                        l(!0), console.log('Moving node', b, 'to path', R), await S(a);
                    } catch (x) {
                        console.error('Error moving node:', x), r(x instanceof Error ? x.message : 'Failed to move node');
                    } finally {
                        l(!1);
                    }
                },
                onMergeUp: async (b) => {
                    try {
                        if (!m.current.get(b)) return;
                        l(!0), console.log('Merging up node', b), await S(a);
                    } catch (x) {
                        console.error('Error merging up node:', x),
                            r(x instanceof Error ? x.message : 'Failed to merge up node');
                    } finally {
                        l(!1);
                    }
                },
                onMergeDown: async (b) => {
                    try {
                        if (!m.current.get(b)) return;
                        l(!0), console.log('Merging down node', b), await S(a);
                    } catch (x) {
                        console.error('Error merging down node:', x),
                            r(x instanceof Error ? x.message : 'Failed to merge down node');
                    } finally {
                        l(!1);
                    }
                },
                onCreateLayer: async (b) => {
                    try {
                        const x = m.current.get(b);
                        if (!x) return;
                        const R = p('Enter layer name:');
                        if (!R) return;
                        l(!0);
                        const N = C(x),
                            L = N === '/' ? `/${R}` : `${N}/${R}`;
                        await K.post(nn.workspacePath(a), { path: L, autoCreateLayers: !0 }, { headers: Nn() }),
                            console.log('Created layer', R, 'at path', L),
                            await S(a);
                    } catch (x) {
                        console.error('Error creating layer:', x), r(x instanceof Error ? x.message : 'Failed to create layer');
                    } finally {
                        l(!1);
                    }
                },
                onCreateCanvas: async (b) => {
                    try {
                        const x = m.current.get(b);
                        if (!x) return;
                        const R = p('Enter canvas name:');
                        if (!R) return;
                        l(!0);
                        const N = C(x),
                            L = N === '/' ? `/${R}` : `${N}/${R}`;
                        await K.post(nn.workspacePath(a), { path: L, type: 'canvas', autoCreateLayers: !0 }, { headers: Nn() }),
                            console.log('Created canvas', R, 'at path', L),
                            await S(a);
                    } catch (x) {
                        console.error('Error creating canvas:', x),
                            r(x instanceof Error ? x.message : 'Failed to create canvas');
                    } finally {
                        l(!1);
                    }
                },
                onRenameLayer: async (b) => {
                    try {
                        const x = m.current.get(b);
                        if (!x) return;
                        const R = p('Enter new layer name:', x.name);
                        if (!R || R === x.name) return;
                        l(!0),
                            await K.put(nn.layer(b), { name: R }, { headers: Nn() }),
                            console.log('Renamed layer', x.name, 'to', R),
                            await S(a);
                    } catch (x) {
                        console.error('Error renaming layer:', x), r(x instanceof Error ? x.message : 'Failed to rename layer');
                    } finally {
                        l(!1);
                    }
                },
                onRenameCanvas: async (b) => {
                    try {
                        const x = m.current.get(b);
                        if (!x) return;
                        const R = p('Enter new canvas name:', x.name);
                        if (!R || R === x.name) return;
                        l(!0),
                            await K.put(nn.canvas(b), { name: R }, { headers: Nn() }),
                            console.log('Renamed canvas', x.name, 'to', R),
                            await S(a);
                    } catch (x) {
                        console.error('Error renaming canvas:', x),
                            r(x instanceof Error ? x.message : 'Failed to rename canvas');
                    } finally {
                        l(!1);
                    }
                },
                onRemoveCanvas: async (b) => {
                    try {
                        const x = m.current.get(b);
                        if (!x || !window.confirm(`Are you sure you want to remove canvas "${x.name}"?`)) return;
                        l(!0),
                            await K.delete(nn.canvas(b), { headers: Nn() }),
                            console.log('Removed canvas', x.name),
                            await S(a);
                    } catch (x) {
                        console.error('Error removing canvas:', x),
                            r(x instanceof Error ? x.message : 'Failed to remove canvas');
                    } finally {
                        l(!1);
                    }
                },
                onInsertPath: async (b) => {
                    try {
                        if (!m.current.get(b)) return;
                        const R = p('Enter path to insert:');
                        if (!R) return;
                        l(!0),
                            await K.post(nn.workspacePath(a), { path: R, autoCreateLayers: !0 }, { headers: Nn() }),
                            console.log('Inserted path', R),
                            await S(a);
                    } catch (x) {
                        console.error('Error inserting path:', x), r(x instanceof Error ? x.message : 'Failed to insert path');
                    } finally {
                        l(!1);
                    }
                },
                onRemovePath: async (b) => {
                    try {
                        const x = m.current.get(b);
                        if (!x) return;
                        const R = C(x);
                        if (!window.confirm(`Are you sure you want to remove path "${R}"?`)) return;
                        l(!0),
                            await K.delete(nn.workspacePath(a), { headers: Nn(), data: { path: R } }),
                            console.log('Removed path', R),
                            await S(a);
                    } catch (x) {
                        console.error('Error removing path:', x), r(x instanceof Error ? x.message : 'Failed to remove path');
                    } finally {
                        l(!1);
                    }
                },
            },
            C = (b) => (b.name === '/' ? '/' : `/${b.name}`),
            T = (b) => {
                y((x) => {
                    const R = new Set(x);
                    return R.has(b) ? R.delete(b) : R.add(b), R;
                });
            },
            _ = (b) => {
                console.log('Tree update received via WebSocket:', b), t(b);
            };
        return n
            ? E.jsx('div', {
                  className: 'flex items-center justify-center h-screen',
                  children: E.jsxs('div', {
                      className: 'p-4 bg-red-50 border border-red-200 rounded-lg',
                      children: [
                          E.jsx('h2', { className: 'text-red-800 font-semibold', children: 'Error' }),
                          E.jsx('p', { className: 'text-red-600', children: n }),
                          E.jsx('button', {
                              onClick: () => S(a),
                              className: 'mt-2 px-4 py-2 bg-red-100 text-red-800 rounded hover:bg-red-200',
                              children: 'Retry',
                          }),
                      ],
                  }),
              })
            : !e || s
              ? E.jsx('div', {
                    className: 'flex items-center justify-center h-screen',
                    children: E.jsxs('div', {
                        className: 'p-4',
                        children: [
                            E.jsx('div', { className: 'animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto' }),
                            E.jsx('p', { className: 'mt-2 text-gray-600', children: 'Loading tree data...' }),
                        ],
                    }),
                })
              : E.jsx(cx, {
                    backend: tC,
                    children: E.jsxs('div', {
                        className: 'min-h-screen flex flex-col',
                        children: [
                            E.jsxs('header', {
                                className: 'bg-white border-b border-gray-200 p-4',
                                children: [
                                    E.jsx('h1', { className: 'text-xl font-semibold', children: 'Canvas' }),
                                    n && E.jsx('div', { className: 'text-red-500 mt-2', children: n }),
                                ],
                            }),
                            E.jsxs('main', {
                                className: 'flex-grow flex overflow-hidden',
                                children: [
                                    s &&
                                        E.jsx('div', {
                                            className: 'flex-1 flex items-center justify-center',
                                            children: 'Loading...',
                                        }),
                                    e &&
                                        E.jsx(__, {
                                            tree: e,
                                            onNodeMove: h,
                                            expandedNodes: d,
                                            onNodeToggle: T,
                                            contextMenuActions: w,
                                        }),
                                    E.jsx('div', {
                                        className: 'flex-1 p-4',
                                        children: E.jsx('h2', { className: 'text-lg font-medium', children: 'Canvas Content' }),
                                    }),
                                ],
                            }),
                        ],
                    }),
                });
    },
    FO = typeof process < 'u' && process.versions && !!process.versions.electron;
FO
    ? console.log('Running in Electron environment')
    : console.warn('Not running in Electron environment - some features may not work');
Ca.createRoot(document.getElementById('root')).render(E.jsx(jt.StrictMode, { children: E.jsx(LO, {}) }));
