import { _ as AppElementsWire, a as navigateClientSide, b as stripBasePath, f as resolveRelativeHref, g as isDangerousScheme, h as withBasePath, i as getPrefetchedUrls, l as createRscRequestHeaders, m as toSameOriginAppPath, o as prefetchRscResponse, p as toBrowserNavigationHref, r as getMountedSlotsHeader, t as getCurrentInterceptionContext, u as createRscRequestUrl, v as VINEXT_MOUNTED_SLOTS_HEADER, y as hasBasePath } from "../index.js";
import { a as getDomainLocaleUrl, i as addLocalePrefix, n as appendSearchParamsToUrl, r as urlQueryToSearchParams } from "./query-BY3w5gxH.js";
import React, { createContext, forwardRef, useCallback, useEffect, useRef, useState } from "react";
import { Fragment as Fragment$1, jsx, jsxs } from "react/jsx-runtime";
//#region ../../../3ec381cc8d1e/herolist/export-1.1.2-python-sqlite/node_modules/vinext/dist/routing/utils.js
var PATH_DELIMITER_REGEX = /([/#?\\]|%(2f|23|3f|5c))/gi;
function encodePathDelimiters(segment) {
	return segment.replace(PATH_DELIMITER_REGEX, (char) => encodeURIComponent(char));
}
/**
* Decode a filesystem or URL path segment while preserving encoded path delimiters.
* Mirrors Next.js segment-wise decoding so "%5F" becomes "_" but "%2F" stays "%2F".
*/
function decodeRouteSegment(segment) {
	try {
		return encodePathDelimiters(decodeURIComponent(segment));
	} catch {
		return segment;
	}
}
/**
* Normalize a pathname for route matching by decoding each segment independently.
* This prevents encoded slashes from turning into real path separators.
*/
function normalizePathnameForRouteMatch(pathname) {
	return pathname.split("/").map((segment) => decodeRouteSegment(segment)).join("/");
}
function decodeMatchedParam(value) {
	try {
		return decodeURIComponent(value);
	} catch {
		return value;
	}
}
/**
* Decode captured route params with `decodeURIComponent`, mirroring Next.js
* route-matcher.ts:25-27. Mutates the params object in place. Catch-all
* arrays are decoded element-wise. Malformed escapes are preserved (the
* strict normalization layer rejects them at the request boundary).
*/
function decodeMatchedParams(params) {
	for (const key of Object.keys(params)) {
		const value = params[key];
		if (Array.isArray(value)) params[key] = value.map(decodeMatchedParam);
		else params[key] = decodeMatchedParam(value);
	}
}
//#endregion
//#region ../../../3ec381cc8d1e/herolist/export-1.1.2-python-sqlite/node_modules/vinext/dist/routing/route-trie.js
function createNode() {
	return {
		staticChildren: /* @__PURE__ */ new Map(),
		dynamicChild: null,
		catchAllChild: null,
		optionalCatchAllChild: null,
		route: null
	};
}
/**
* Build a trie from pre-sorted routes.
*
* Routes must have a `patternParts` property (string[] of URL segments).
* Pattern segment conventions:
*   - `:name`  — dynamic segment
*   - `:name+` — catch-all (1+ segments)
*   - `:name*` — optional catch-all (0+ segments)
*   - anything else — static segment
*
* First route to claim a terminal position wins (routes are pre-sorted
* by precedence, so insertion order preserves correct priority).
*/
function buildRouteTrie(routes) {
	const root = createNode();
	for (const route of routes) {
		const parts = route.patternParts;
		if (parts.length === 0) {
			if (root.route === null) root.route = route;
			continue;
		}
		let node = root;
		for (let i = 0; i < parts.length; i++) {
			const part = parts[i];
			if (part.endsWith("+") && part.startsWith(":")) {
				if (i !== parts.length - 1) break;
				const paramName = part.slice(1, -1);
				if (node.catchAllChild === null) node.catchAllChild = {
					paramName,
					route
				};
				break;
			}
			if (part.endsWith("*") && part.startsWith(":")) {
				if (i !== parts.length - 1) break;
				const paramName = part.slice(1, -1);
				if (node.optionalCatchAllChild === null) node.optionalCatchAllChild = {
					paramName,
					route
				};
				break;
			}
			if (part.startsWith(":")) {
				const paramName = part.slice(1);
				if (node.dynamicChild === null) node.dynamicChild = {
					paramName,
					node: createNode()
				};
				node = node.dynamicChild.node;
				if (i === parts.length - 1) {
					if (node.route === null) node.route = route;
				}
				continue;
			}
			let child = node.staticChildren.get(part);
			if (!child) {
				child = createNode();
				node.staticChildren.set(part, child);
			}
			node = child;
			if (i === parts.length - 1) {
				if (node.route === null) node.route = route;
			}
		}
	}
	return root;
}
/**
* Match a URL against the trie.
*
* Returns decoded param values — `decodeURIComponent` is applied to
* individual param entries so that `%2F` → `/`, `%23` → `#`, etc.
* Segment boundaries (the original `/` splits) are preserved by the
* upstream normalization layer; this step only decodes the captured
* param strings the caller sees.
*
* Mirrors Next.js route-matcher.ts:25-27.
*
* @param root - Trie root built by `buildRouteTrie`
* @param urlParts - Pre-split URL segments (no empty strings)
* @returns Match result with route and extracted params, or null
*/
function trieMatch(root, urlParts) {
	const result = match(root, urlParts, 0);
	if (result) decodeMatchedParams(result.params);
	return result;
}
function createParams() {
	return Object.create(null);
}
function match(node, urlParts, index) {
	if (index === urlParts.length) {
		if (node.route !== null) return {
			route: node.route,
			params: createParams()
		};
		if (node.optionalCatchAllChild !== null) return {
			route: node.optionalCatchAllChild.route,
			params: createParams()
		};
		return null;
	}
	const segment = urlParts[index];
	const staticChild = node.staticChildren.get(segment);
	if (staticChild) {
		const result = match(staticChild, urlParts, index + 1);
		if (result !== null) return result;
	}
	if (node.dynamicChild !== null) {
		const result = match(node.dynamicChild.node, urlParts, index + 1);
		if (result !== null) {
			result.params[node.dynamicChild.paramName] = segment;
			return result;
		}
	}
	if (node.catchAllChild !== null) {
		const remaining = urlParts.slice(index);
		const params = createParams();
		params[node.catchAllChild.paramName] = remaining;
		return {
			route: node.catchAllChild.route,
			params
		};
	}
	if (node.optionalCatchAllChild !== null) {
		const remaining = urlParts.slice(index);
		const params = createParams();
		params[node.optionalCatchAllChild.paramName] = remaining;
		return {
			route: node.optionalCatchAllChild.route,
			params
		};
	}
	return null;
}
//#endregion
//#region ../../../3ec381cc8d1e/herolist/export-1.1.2-python-sqlite/node_modules/vinext/dist/routing/route-matching.js
/**
* Shared route-match preamble used by both Pages Router and App Router.
*
* Both routers normalize URLs and call `trieMatch` with nearly-identical
* preamble: strip query, trailing-slash normalize, run
* `normalizePathnameForRouteMatch`, split into url parts, then look up via a
* per-routes-array trie cache. This module factors that out so each router
* just calls `matchRouteWithTrie(url, routes)`.
*/
function createRouteTrieCache() {
	return /* @__PURE__ */ new WeakMap();
}
function getOrBuildTrie(cache, routes) {
	let trie = cache.get(routes);
	if (!trie) {
		trie = buildRouteTrie(routes);
		cache.set(routes, trie);
	}
	return trie;
}
/**
* Match a URL path against a list of routes via the shared preamble:
*   1. strip query string
*   2. trailing-slash normalize (preserving root "/")
*   3. run `normalizePathnameForRouteMatch`
*   4. split into url parts and look up via the (cached) trie
*
* Generic over the route shape; both Pages `Route` and App `AppRoute`
* satisfy `{ patternParts: string[] }`.
*/
function matchRouteWithTrie(url, routes, cache) {
	const pathname = url.split("?")[0];
	let normalizedUrl = pathname === "/" ? "/" : pathname.replace(/\/$/, "");
	normalizedUrl = normalizePathnameForRouteMatch(normalizedUrl);
	const urlParts = normalizedUrl.split("/").filter(Boolean);
	return trieMatch(getOrBuildTrie(cache, routes), urlParts);
}
//#endregion
//#region ../../../3ec381cc8d1e/herolist/export-1.1.2-python-sqlite/node_modules/vinext/dist/shims/i18n-context.js
var _getI18nContext = () => {
	if (globalThis.__VINEXT_DEFAULT_LOCALE__ == null && globalThis.__VINEXT_LOCALE__ == null) return null;
	return {
		locale: globalThis.__VINEXT_LOCALE__,
		locales: globalThis.__VINEXT_LOCALES__,
		defaultLocale: globalThis.__VINEXT_DEFAULT_LOCALE__,
		domainLocales: globalThis.__VINEXT_DOMAIN_LOCALES__,
		hostname: globalThis.__VINEXT_HOSTNAME__
	};
};
function getI18nContext() {
	return _getI18nContext();
}
//#endregion
//#region ../../../3ec381cc8d1e/herolist/export-1.1.2-python-sqlite/node_modules/vinext/dist/shims/link-prefetch.js
function canLinkPrefetch(input) {
	return input.nodeEnv === "production" && input.prefetch !== false && !input.isDangerous;
}
/**
* Normalize absolute and protocol-relative Link hrefs to app-relative paths
* that are eligible for prefetching. Non-absolute relative hrefs are returned
* unchanged; callers must resolve them against the current browser URL before
* constructing a concrete fetch target.
*/
function getLinkPrefetchHref(input) {
	const { href, basePath, currentOrigin } = input;
	if (!isAbsoluteOrProtocolRelative(href)) return href;
	if (currentOrigin === void 0) return null;
	try {
		const current = new URL(currentOrigin);
		const parsed = href.startsWith("//") ? new URL(href, current.origin) : new URL(href);
		if (parsed.origin !== current.origin) return null;
		if (!basePath) return parsed.pathname + parsed.search + parsed.hash;
		if (!hasBasePath(parsed.pathname, basePath)) return null;
		return stripBasePath(parsed.pathname, basePath) + parsed.search + parsed.hash;
	} catch {
		return null;
	}
}
function isAbsoluteOrProtocolRelative(href) {
	return href.startsWith("http://") || href.startsWith("https://") || href.startsWith("//");
}
//#endregion
//#region ../../../3ec381cc8d1e/herolist/export-1.1.2-python-sqlite/node_modules/vinext/dist/shims/link.js
/**
* next/link shim
*
* Renders an <a> tag with client-side navigation support.
* On click, prevents full page reload and triggers client-side
* page swap via the router's navigation system.
*/
var LinkStatusContext = createContext({ pending: false });
/** basePath from next.config.js, injected by the plugin at build time */
var __basePath = "";
var linkPrefetchRouteTrieCache = createRouteTrieCache();
function resolveHref(href) {
	if (typeof href === "string") return href;
	let url = href.pathname ?? "/";
	if (href.query) {
		const params = urlQueryToSearchParams(href.query);
		url = appendSearchParamsToUrl(url, params);
	}
	return url;
}
function resolveLinkPrefetchMode(prefetchProp, isDangerous) {
	if (isDangerous || prefetchProp === false) return "disabled";
	if (prefetchProp === true) return "full";
	return "auto";
}
function toSameOriginRouteHref(href) {
	if (typeof window === "undefined") return null;
	let url;
	try {
		url = new URL(href, window.location.href);
	} catch {
		return null;
	}
	if (url.origin !== window.location.origin) return null;
	return `${stripBasePath(url.pathname, __basePath)}${url.search}`;
}
function canAutoPrefetchFullAppRoute(href) {
	if (typeof window === "undefined") return false;
	const routes = window.__VINEXT_LINK_PREFETCH_ROUTES__;
	if (!routes) return false;
	const routeHref = toSameOriginRouteHref(href);
	if (routeHref === null) return false;
	const match = matchRouteWithTrie(routeHref, routes, linkPrefetchRouteTrieCache);
	if (!match) return false;
	return !match.route.isDynamic;
}
/**
* Prefetch a URL for faster navigation.
*
* For App Router (RSC): fetches the .rsc payload in the background and
* stores it in an in-memory cache for instant use during navigation.
* For Pages Router: injects a <link rel="prefetch"> for the page module.
*
* Uses `requestIdleCallback` (or `setTimeout` fallback) to avoid blocking
* the main thread during initial page load.
*/
function prefetchUrl(href, mode, priority = "low") {
	if (typeof window === "undefined") return;
	const prefetchHref = getLinkPrefetchHref({
		href,
		basePath: __basePath,
		currentOrigin: window.location.origin
	});
	if (prefetchHref == null) return;
	const fullHref = toBrowserNavigationHref(prefetchHref, window.location.href, __basePath);
	(window.requestIdleCallback ?? ((fn) => setTimeout(fn, 100)))(() => {
		(async () => {
			if (typeof window.__VINEXT_RSC_NAVIGATE__ === "function") {
				if (mode === "auto" && !canAutoPrefetchFullAppRoute(prefetchHref)) return;
				const interceptionContext = getCurrentInterceptionContext();
				const mountedSlotsHeader = getMountedSlotsHeader();
				const headers = createRscRequestHeaders({ interceptionContext });
				if (mountedSlotsHeader) headers.set(VINEXT_MOUNTED_SLOTS_HEADER, mountedSlotsHeader);
				const rscUrl = await createRscRequestUrl(fullHref, headers);
				const cacheKey = AppElementsWire.encodeCacheKey(rscUrl, interceptionContext);
				const prefetched = getPrefetchedUrls();
				if (prefetched.has(cacheKey)) return;
				prefetched.add(cacheKey);
				prefetchRscResponse(rscUrl, fetch(rscUrl, {
					headers,
					credentials: "include",
					priority,
					purpose: "prefetch"
				}), interceptionContext, mountedSlotsHeader);
			} else if (window.__NEXT_DATA__?.__vinext?.pageModuleUrl) {
				const link = document.createElement("link");
				link.rel = "prefetch";
				link.href = fullHref;
				link.as = "document";
				document.head.appendChild(link);
			}
		})().catch((error) => {
			console.error("[vinext] RSC prefetch setup error:", error);
		});
	});
}
/**
* Shared IntersectionObserver for viewport-based prefetching.
* All Link elements use the same observer to minimize resource usage.
*/
var sharedObserver = null;
var observerCallbacks = /* @__PURE__ */ new WeakMap();
function getSharedObserver() {
	if (typeof window === "undefined" || typeof IntersectionObserver === "undefined") return null;
	if (sharedObserver) return sharedObserver;
	sharedObserver = new IntersectionObserver((entries) => {
		for (const entry of entries) if (entry.isIntersecting) {
			const callback = observerCallbacks.get(entry.target);
			if (callback) {
				callback();
				sharedObserver?.unobserve(entry.target);
				observerCallbacks.delete(entry.target);
			}
		}
	}, { rootMargin: "250px" });
	return sharedObserver;
}
function getDefaultLocale() {
	if (typeof window !== "undefined") return window.__VINEXT_DEFAULT_LOCALE__;
	return getI18nContext()?.defaultLocale;
}
function getDomainLocales() {
	if (typeof window !== "undefined") return window.__NEXT_DATA__?.domainLocales;
	return getI18nContext()?.domainLocales;
}
function getCurrentHostname() {
	if (typeof window !== "undefined") return window.location.hostname;
	return getI18nContext()?.hostname;
}
function getDomainLocaleHref(href, locale) {
	return getDomainLocaleUrl(href, locale, {
		basePath: __basePath,
		currentHostname: getCurrentHostname(),
		domainItems: getDomainLocales()
	});
}
/**
* Apply locale prefix to a URL path based on the locale prop.
* - locale="fr" → prepend /fr (unless it already has a locale prefix)
* - locale={false} → use the href as-is (no locale prefix, link to default)
* - locale=undefined → use current locale (href as-is in most cases)
*/
function applyLocaleToHref(href, locale) {
	if (locale === false) return href;
	if (locale === void 0) return href;
	if (href.startsWith("http://") || href.startsWith("https://") || href.startsWith("//")) return href;
	const domainLocaleHref = getDomainLocaleHref(href, locale);
	if (domainLocaleHref) return domainLocaleHref;
	return addLocalePrefix(href, locale, getDefaultLocale() ?? "");
}
var Link = forwardRef(function Link({ href, as, replace = false, prefetch: prefetchProp, scroll = true, children, onClick, onMouseEnter, onTouchStart, onNavigate, ...rest }, forwardedRef) {
	const { locale, ...restWithoutLocale } = rest;
	const resolvedHref = as ?? resolveHref(href);
	const isDangerous = typeof resolvedHref === "string" && isDangerousScheme(resolvedHref);
	const localizedHref = applyLocaleToHref(isDangerous ? "/" : resolvedHref, locale);
	const fullHref = withBasePath(localizedHref, __basePath);
	const [pending, setPending] = useState(false);
	const mountedRef = useRef(true);
	useEffect(() => {
		mountedRef.current = true;
		return () => {
			mountedRef.current = false;
		};
	}, []);
	const internalRef = useRef(null);
	const prefetchMode = resolveLinkPrefetchMode(prefetchProp, isDangerous);
	const shouldPrefetch = canLinkPrefetch({
		nodeEnv: "production",
		prefetch: prefetchProp,
		isDangerous
	});
	const setRefs = useCallback((node) => {
		internalRef.current = node;
		if (typeof forwardedRef === "function") forwardedRef(node);
		else if (forwardedRef) forwardedRef.current = node;
	}, [forwardedRef]);
	useEffect(() => {
		if (!shouldPrefetch || typeof window === "undefined") return;
		const node = internalRef.current;
		if (!node) return;
		const hrefToPrefetch = getLinkPrefetchHref({
			href: localizedHref,
			basePath: __basePath,
			currentOrigin: window.location.origin
		});
		if (hrefToPrefetch == null) return;
		const observer = getSharedObserver();
		if (!observer) return;
		observerCallbacks.set(node, () => prefetchUrl(hrefToPrefetch, prefetchMode, "low"));
		observer.observe(node);
		return () => {
			observer.unobserve(node);
			observerCallbacks.delete(node);
		};
	}, [
		shouldPrefetch,
		prefetchMode,
		localizedHref
	]);
	const prefetchOnIntent = useCallback(() => {
		if (!shouldPrefetch) return;
		prefetchUrl(localizedHref, prefetchMode, "high");
	}, [
		shouldPrefetch,
		prefetchMode,
		localizedHref
	]);
	const handleMouseEnter = useCallback((e) => {
		onMouseEnter?.(e);
		prefetchOnIntent();
	}, [onMouseEnter, prefetchOnIntent]);
	const handleTouchStart = useCallback((e) => {
		onTouchStart?.(e);
		prefetchOnIntent();
	}, [onTouchStart, prefetchOnIntent]);
	const handleClick = async (e) => {
		if (onClick) onClick(e);
		if (e.defaultPrevented) return;
		if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
		if (e.currentTarget.target && e.currentTarget.target !== "_self") return;
		let navigateHref = localizedHref;
		if (resolvedHref.startsWith("http://") || resolvedHref.startsWith("https://") || resolvedHref.startsWith("//")) {
			const localPath = toSameOriginAppPath(resolvedHref, __basePath);
			if (localPath == null) return;
			navigateHref = localPath;
		}
		e.preventDefault();
		const absoluteHref = resolveRelativeHref(navigateHref, window.location.href, __basePath);
		const absoluteFullHref = toBrowserNavigationHref(navigateHref, window.location.href, __basePath);
		if (onNavigate) try {
			const navUrl = new URL(absoluteFullHref, window.location.origin);
			let prevented = false;
			const navEvent = {
				url: navUrl,
				preventDefault() {
					prevented = true;
				},
				get defaultPrevented() {
					return prevented;
				}
			};
			onNavigate(navEvent);
			if (navEvent.defaultPrevented) return;
		} catch {}
		if (typeof window.__VINEXT_RSC_NAVIGATE__ === "function") {
			setPending(true);
			React.startTransition(() => {
				navigateClientSide(navigateHref, replace ? "replace" : "push", scroll, true).finally(() => {
					if (mountedRef.current) setPending(false);
				});
			});
			return;
		} else try {
			const Router = (await import("./router-CyTIpLPh.js")).default;
			if (replace) await Router.replace(absoluteHref, void 0, { scroll });
			else await Router.push(absoluteHref, void 0, { scroll });
		} catch {
			if (replace) window.history.replaceState({}, "", absoluteFullHref);
			else window.history.pushState({}, "", absoluteFullHref);
			window.dispatchEvent(new PopStateEvent("popstate"));
		}
	};
	const { passHref: _p, ...anchorProps } = restWithoutLocale;
	const linkStatusValue = React.useMemo(() => ({ pending }), [pending]);
	if (isDangerous) return /* @__PURE__ */ jsx("a", {
		...anchorProps,
		onMouseEnter: handleMouseEnter,
		onTouchStart: handleTouchStart,
		children
	});
	return /* @__PURE__ */ jsx(LinkStatusContext.Provider, {
		value: linkStatusValue,
		children: /* @__PURE__ */ jsx("a", {
			ref: setRefs,
			href: fullHref,
			onClick: (event) => {
				handleClick(event);
			},
			onMouseEnter: handleMouseEnter,
			onTouchStart: handleTouchStart,
			...anchorProps,
			children
		})
	});
});
//#endregion
//#region app/account/page.tsx
function AccountPage() {
	const [account, setAccount] = useState(null);
	const [mode, setMode] = useState("login");
	const [email, setEmail] = useState("");
	const [password, setPassword] = useState("");
	const [message, setMessage] = useState("");
	const [busy, setBusy] = useState(false);
	const [resetToken, setResetToken] = useState("");
	const [messengerLink, setMessengerLink] = useState("");
	useEffect(() => {
		const params = new URLSearchParams(location.search);
		const token = params.get("reset_token") || "";
		queueMicrotask(() => {
			if (token) {
				setResetToken(token);
				setMode("reset");
			}
			if (params.get("verified") === "success") setMessage("Почта подтверждена.");
			if (params.get("verified") === "invalid") setMessage("Ссылка подтверждения недействительна или устарела.");
		});
		fetch("/api/account", { cache: "no-store" }).then((response) => response.json()).then(setAccount).catch(() => setAccount({ authenticated: false }));
	}, []);
	async function submit(event) {
		event.preventDefault();
		setBusy(true);
		setMessage("");
		const endpoint = mode === "register" ? "register" : mode === "forgot" ? "forgot-password" : mode === "reset" ? "reset-password" : "login";
		const body = mode === "forgot" ? { email } : mode === "reset" ? {
			token: resetToken,
			password
		} : {
			email,
			password
		};
		try {
			const response = await fetch(`/api/auth/${endpoint}`, {
				method: "POST",
				headers: { "content-type": "application/json" },
				body: JSON.stringify(body)
			});
			const result = await response.json();
			if (!response.ok) throw new Error(result.error || "Не удалось выполнить запрос");
			if (mode === "forgot") setMessage("Если аккаунт существует, письмо со ссылкой отправлено.");
			else if (mode === "reset") {
				setMessage("Пароль изменён. Теперь войдите снова.");
				setMode("login");
				setPassword("");
			} else location.href = "/";
		} catch (error) {
			setMessage(error instanceof Error ? error.message : "Произошла ошибка");
		} finally {
			setBusy(false);
		}
	}
	async function logout() {
		await fetch("/api/auth/logout", { method: "POST" });
		location.href = "/";
	}
	async function loginTelegram() {
		setBusy(true);
		setMessage("");
		setMessengerLink("");
		try {
			const startResponse = await fetch("/api/auth/external/start", {
				method: "POST",
				headers: { "content-type": "application/json" },
				body: JSON.stringify({ platform: "telegram" })
			});
			const started = await startResponse.json();
			if (!startResponse.ok || !started.code || !started.deep_link) throw new Error(started.error || "Не удалось начать вход через Telegram");
			setMessengerLink(started.deep_link);
			window.open(started.deep_link, "_blank", "noopener,noreferrer");
			const deadline = Date.now() + 6e5;
			while (Date.now() < deadline) {
				await new Promise((resolve) => setTimeout(resolve, 2500));
				const status = await (await fetch(`/api/auth/external/status?code=${encodeURIComponent(started.code)}&platform_name=telegram`, { cache: "no-store" })).json();
				if (status.status === "expired") throw new Error("Код истёк. Начните вход заново.");
				if (status.status === "confirmed" && status.token) {
					if (!(await fetch("/api/auth/external/complete", {
						method: "POST",
						headers: { "content-type": "application/json" },
						body: JSON.stringify({ token: status.token })
					})).ok) throw new Error("Не удалось создать сессию HeroList");
					location.href = "/";
					return;
				}
			}
			throw new Error("Время ожидания подтверждения истекло");
		} catch (error) {
			setMessage(error instanceof Error ? error.message : "Ошибка входа через Telegram");
		} finally {
			setBusy(false);
		}
	}
	async function resendVerification() {
		const response = await fetch("/api/auth/resend-verification", { method: "POST" });
		const result = await response.json();
		setMessage(response.ok ? "Письмо отправлено." : result.error || "Не удалось отправить письмо.");
	}
	return /* @__PURE__ */ jsxs("main", {
		className: "auth-shell modern-design",
		children: [/* @__PURE__ */ jsx(Link, {
			className: "auth-back",
			href: "/",
			children: "← Вернуться к персонажам"
		}), /* @__PURE__ */ jsxs("section", {
			className: "auth-card",
			children: [
				/* @__PURE__ */ jsx("p", {
					className: "eyebrow",
					children: "Лист Героя 5e · аккаунт"
				}),
				/* @__PURE__ */ jsx("h1", { children: account?.authenticated ? "Ваш аккаунт" : mode === "register" ? "Создать аккаунт" : mode === "forgot" ? "Забыли пароль?" : mode === "reset" ? "Новый пароль" : "Войти" }),
				account?.authenticated ? /* @__PURE__ */ jsxs("div", {
					className: "auth-profile",
					children: [
						/* @__PURE__ */ jsxs("p", { children: [
							/* @__PURE__ */ jsx("b", { children: "Почта:" }),
							" ",
							account.email
						] }),
						/* @__PURE__ */ jsxs("p", { children: [
							/* @__PURE__ */ jsx("b", { children: "Подтверждение:" }),
							" ",
							!account.authConfig?.emailVerificationEnabled ? "сейчас не требуется" : account.emailVerified ? "подтверждена" : "не подтверждена"
						] }),
						/* @__PURE__ */ jsx("p", { children: "Персонажи объединяются с локальной коллекцией и синхронизируются между устройствами." }),
						account.authConfig?.emailVerificationEnabled && !account.emailVerified && /* @__PURE__ */ jsx("button", {
							onClick: resendVerification,
							children: "Отправить подтверждение повторно"
						}),
						/* @__PURE__ */ jsx("button", {
							onClick: logout,
							children: "Выйти"
						})
					]
				}) : /* @__PURE__ */ jsxs(Fragment$1, { children: [
					/* @__PURE__ */ jsx("button", {
						type: "button",
						className: "primary-action",
						disabled: busy,
						onClick: loginTelegram,
						children: "Войти через Telegram"
					}),
					messengerLink && /* @__PURE__ */ jsx("p", { children: /* @__PURE__ */ jsx("a", {
						href: messengerLink,
						target: "_blank",
						rel: "noopener noreferrer",
						children: "Открыть Telegram и подтвердить вход"
					}) }),
					/* @__PURE__ */ jsxs("form", {
						onSubmit: submit,
						children: [
							mode !== "reset" && /* @__PURE__ */ jsxs("label", { children: ["Почта", /* @__PURE__ */ jsx("input", {
								type: "email",
								autoComplete: "email",
								required: true,
								value: email,
								onChange: (event) => setEmail(event.target.value)
							})] }),
							mode !== "forgot" && /* @__PURE__ */ jsxs("label", { children: [
								"Пароль",
								/* @__PURE__ */ jsx("input", {
									type: "password",
									minLength: 10,
									maxLength: 128,
									autoComplete: mode === "register" ? "new-password" : "current-password",
									required: true,
									value: password,
									onChange: (event) => setPassword(event.target.value)
								}),
								/* @__PURE__ */ jsx("small", { children: "Не менее 10 символов. Пароль хранится только как защищённый хэш." })
							] }),
							/* @__PURE__ */ jsx("button", {
								className: "primary-action",
								disabled: busy,
								children: busy ? "Подождите…" : mode === "register" ? "Зарегистрироваться" : mode === "forgot" ? "Отправить ссылку" : mode === "reset" ? "Сменить пароль" : "Войти"
							})
						]
					}),
					/* @__PURE__ */ jsxs("nav", {
						className: "auth-switches",
						children: [
							mode !== "login" && /* @__PURE__ */ jsx("button", {
								onClick: () => setMode("login"),
								children: "Уже есть аккаунт"
							}),
							mode !== "register" && /* @__PURE__ */ jsx("button", {
								onClick: () => setMode("register"),
								children: "Создать аккаунт"
							}),
							mode !== "forgot" && /* @__PURE__ */ jsx("button", {
								onClick: () => setMode("forgot"),
								children: "Забыли пароль?"
							})
						]
					})
				] }),
				message && /* @__PURE__ */ jsx("p", {
					className: "auth-message",
					children: message
				})
			]
		})]
	});
}
//#endregion
export { AccountPage as default };
