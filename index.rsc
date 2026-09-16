3:I["9d2e7a3b397f",[],"Children",1]
4:I["88e3a57a434a",[],"LayoutSegmentProvider",1]
5:I["9d2e7a3b397f",[],"Slot",1]
6:I["4d0c3c6797bd",[],"RedirectBoundary",1]
:HL["/list-geroya-5e/assets/index-PUiXg1AW.css","style"]
2:T6ec,
(() => {
  const nativeFetch = window.fetch.bind(window);
  window.fetch = (input, init) => {
    const raw = typeof input === "string" ? input : input instanceof Request ? input.url : String(input);
    const method = String(init?.method || (input instanceof Request ? input.method : "GET")).toUpperCase();
    let path = raw;
    try { path = new URL(raw, window.location.href).pathname; } catch {}
    if (path === "/api/account" || path.endsWith("/api/account")) {
      return Promise.resolve(new Response(JSON.stringify({ authenticated: false, cloudSyncEnabled: false }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }));
    }
    if (path === "/api/vault" || path.endsWith("/api/vault")) {
      return Promise.resolve(new Response(JSON.stringify(method === "GET"
        ? { vault: null, updatedAt: null }
        : { error: "Cloud sync is disabled in the GitHub Pages test" }), {
        status: method === "GET" ? 200 : 404,
        headers: { "content-type": "application/json" },
      }));
    }
    if (path === "/api/homebrew" || path.endsWith("/api/homebrew")) {
      return Promise.resolve(new Response(JSON.stringify(method === "GET"
        ? { library: { version: 1, elements: [] }, updatedAt: null }
        : { error: "Cloud homebrew is disabled in the GitHub Pages test" }), {
        status: method === "GET" ? 200 : 404,
        headers: { "content-type": "application/json" },
      }));
    }
    if (path.includes("/api/auth/")) {
      return Promise.resolve(new Response(JSON.stringify({ error: "Authentication is disabled in the GitHub Pages test" }), {
        status: 404,
        headers: { "content-type": "application/json" },
      }));
    }
    return nativeFetch(input, init);
  };
})();
0:{"__route":"route:/","__interceptionContext":null,"__layoutIds":["layout:/"],"__rootLayout":"/","page:/":"$L1","layout:/":[[[["$","link","css:/assets/index-PUiXg1AW.css",{"rel":"stylesheet","precedence":"vite-rsc/importer-resources","href":"/list-geroya-5e/assets/index-PUiXg1AW.css","data-rsc-css-href":"/list-geroya-5e/assets/index-PUiXg1AW.css"}],"$undefined"],["$","html",null,{"lang":"ru","children":[["$","head",null,{"children":[["$","style",null,{"children":"\n          .account-state, .account-warning, .mobile-top-menu a[href=\"/account\"] { display: none !important; }\n          .app-shell.modern-design { background: linear-gradient(rgba(246,235,203,.84), rgba(238,218,173,.88)), url('/list-geroya-5e/parchment-background.jpg') center top / cover fixed !important; }\n        "}],["$","script",null,{"dangerouslySetInnerHTML":{"__html":"$2"}}]]}],["$","body",null,{"className":"__variable_geist_0tvmz3h __variable_geist_mono_1diim1n antialiased","children":["$","$L3",null,{}]}]]}]],null],"route:/":[[["$","meta",null,{"charSet":"utf-8"}],[["$","title","0",{"children":"Лист Героя 5e 1.4 — тест GitHub Pages"}],["$","meta","1",{"name":"description","content":"Статическая тестовая версия конструктора D&D 5e 2014 без серверной авторизации и облачного сохранения."}],["$","link","2",{"rel":"shortcut icon","href":"/list-geroya-5e/favicon.svg"}],["$","link","3",{"rel":"icon","href":"/list-geroya-5e/favicon.svg"}]],[["$","meta","0",{"name":"viewport","content":"width=device-width, initial-scale=1"}]]],["$","$L4",null,{"segmentMap":{"children":[]},"children":["$","$L5",null,{"id":"layout:/","parallelSlots":"$undefined","children":["$","$L6",null,{"children":["$","$L4",null,{"segmentMap":{"children":[]},"children":["$","$L5",null,{"id":"page:/"}]}]}]}]}]],"__layoutFlags":{"layout:/":"s"},"__artifactCompatibility":{"schemaVersion":1,"graphVersion":"app-route-graph:4uhn5s1wvoptc","deploymentVersion":"fbc94da5-e948-4b9c-887c-60bac2f817a4","appElementsSchemaVersion":1,"rscPayloadSchemaVersion":1,"rootBoundaryId":"/","renderEpoch":null}}
7:I["6efdf509a785",[],"default",1]
1:["$","$L7",null,{"params":"$@8","searchParams":"$@9"}]
8:{}
9:{}
