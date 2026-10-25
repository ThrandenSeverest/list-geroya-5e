:HL["/list-geroya-5e/assets/index-B4p9_DY-.css","style"]
2:T102b,
(() => {
  const VAULT_KEY = "list-geroya-character-vault-v1";
  const VAULT_BACKUP_KEY = "list-geroya-character-vault-v1-safe-backup";
  const LEGACY_KEY = "dark-codex-character";
  const LEGACY_BACKUP_KEY = "dark-codex-character-safe-backup";
  const RELOAD_GUARD_KEY = "herolist-storage-guard-reload-v1";

  const parseObject = raw => {
    if (!raw) return null;
    try {
      const value = JSON.parse(raw);
      return value && typeof value === "object" && !Array.isArray(value) ? value : null;
    } catch {
      return null;
    }
  };

  const parseVault = raw => {
    const value = parseObject(raw);
    return value && Array.isArray(value.slots) ? value : null;
  };

  const slotIds = raw => {
    const value = parseVault(raw);
    if (!value) return null;
    return value.slots
      .map(slot => slot && typeof slot.id === "string" ? slot.id : "")
      .filter(Boolean);
  };

  const hasCharacters = raw => {
    const ids = slotIds(raw);
    return Array.isArray(ids) && ids.length > 0;
  };

  const preservesSnapshot = (candidateRaw, snapshotRaw) => {
    const candidateIds = slotIds(candidateRaw);
    const snapshotIds = slotIds(snapshotRaw);
    if (!candidateIds || !snapshotIds || snapshotIds.length === 0) return false;
    const current = new Set(candidateIds);
    return snapshotIds.every(id => current.has(id));
  };

  const looksLikeCharacter = raw => {
    const value = parseObject(raw);
    if (!value) return false;
    return typeof value.name === "string"
      || typeof value.race === "string"
      || typeof value.className === "string"
      || typeof value.schemaVersion === "number"
      || (value.abilities && typeof value.abilities === "object");
  };

  try {
    let currentVault = localStorage.getItem(VAULT_KEY);
    const safeBackup = localStorage.getItem(VAULT_BACKUP_KEY);

    // Capture the exact pre-upgrade Vault before React or migrations can touch it.
    if (hasCharacters(currentVault)) {
      localStorage.setItem(VAULT_BACKUP_KEY, currentVault);
    } else if (!parseVault(currentVault) && hasCharacters(safeBackup)) {
      // Missing/corrupted primary storage may be restored immediately. A valid
      // deliberately empty Vault remains authoritative and is not resurrected.
      localStorage.setItem(VAULT_KEY, safeBackup);
      currentVault = safeBackup;
    }

    const legacyCharacter = localStorage.getItem(LEGACY_KEY);
    const legacyBackup = localStorage.getItem(LEGACY_BACKUP_KEY);
    if (looksLikeCharacter(legacyCharacter)) {
      localStorage.setItem(LEGACY_BACKUP_KEY, legacyCharacter);
    } else if (!legacyCharacter && looksLikeCharacter(legacyBackup)) {
      localStorage.setItem(LEGACY_KEY, legacyBackup);
    }

    const bootSnapshot = hasCharacters(currentVault) ? currentVault : null;
    if (!bootSnapshot) return;

    // The normal application may update character contents on boot, but it
    // must never replace/remove the slots that existed before the upgrade.
    const verifyAfterBoot = () => {
      const afterBoot = localStorage.getItem(VAULT_KEY);
      if (preservesSnapshot(afterBoot, bootSnapshot)) {
        localStorage.setItem(VAULT_BACKUP_KEY, afterBoot);
        sessionStorage.removeItem(RELOAD_GUARD_KEY);
        return;
      }

      localStorage.setItem(VAULT_KEY, bootSnapshot);
      localStorage.setItem(VAULT_BACKUP_KEY, bootSnapshot);

      // One automatic retry lets the app start again from the restored data,
      // while the session flag prevents an endless reload loop if old data is
      // genuinely incompatible with a future schema.
      if (sessionStorage.getItem(RELOAD_GUARD_KEY) !== "1") {
        sessionStorage.setItem(RELOAD_GUARD_KEY, "1");
        window.location.reload();
      }
    };

    const armVerification = () => window.setTimeout(verifyAfterBoot, 1200);
    if (document.readyState === "complete") armVerification();
    else window.addEventListener("load", armVerification, { once: true });
  } catch {
    // Storage can be unavailable in hardened/private browser contexts. Never
    // block the application merely because the safety layer cannot run.
  }
})();
0:{"__route":"route:/adventure/","__interceptionContext":null,"__layoutIds":["layout:/"],"__rootLayout":"/","page:/adventure/":"$L1","layout:/":[[[["$","link","css:/list-geroya-5e/assets/index-B4p9_DY-.css",{"rel":"stylesheet","precedence":"vite-rsc/importer-resources","href":"/list-geroya-5e/assets/index-B4p9_DY-.css","data-rsc-css-href":"/list-geroya-5e/assets/index-B4p9_DY-.css"}],"$undefined"],["$","html",null,{"lang":"ru","children":[["$","head",null,{"children":[["$","script",null,{"dangerouslySetInnerHTML":{"__html":"$2"}}],"$L3"]}],"$L4"]}]],"$L5"],"route:/adventure/":"$L6","__layoutFlags":{"layout:/":"s"},"__artifactCompatibility":{"schemaVersion":1,"graphVersion":"app-route-graph:1abw5icr9h1sc","deploymentVersion":"6c093a98-0eb1-41ce-a9b3-7523627ccd7f","appElementsSchemaVersion":1,"rscPayloadSchemaVersion":1,"rootBoundaryId":"/","renderEpoch":null}}
8:I["8c0f216c4604",[],"Children",1]
9:I["15c18cfaeeff",[],"LayoutSegmentProvider",1]
a:I["8c0f216c4604",[],"Slot",1]
b:I["593f344dc510",[],"RedirectBoundary",1]
7:T974,
(function () {
  var assetFailed = false;
  window.addEventListener('error', function (event) {
    var node = event.target;
    if (node && (node.tagName === 'SCRIPT' || node.tagName === 'LINK')) assetFailed = true;
  }, true);
  window.setTimeout(function () {
    if (document.documentElement.getAttribute('data-herolist-hydrated') === '1') return;
    if (!document.querySelector('.character-library-layout')) return;
    if (document.getElementById('herolist-boot-warning')) return;
    var panel = document.createElement('section');
    panel.id = 'herolist-boot-warning';
    panel.setAttribute('role', 'alert');
    panel.style.cssText = 'position:fixed;z-index:2147483647;left:12px;right:12px;bottom:12px;max-width:540px;margin:0 auto;padding:16px;background:#172126;color:#fff;border:2px solid #f0d39a;border-radius:8px;box-shadow:0 8px 30px #0009;font:15px/1.5 Arial,sans-serif';
    var title = document.createElement('strong');
    title.textContent = 'HeroList: интерфейс не запустился';
    var body = document.createElement('p');
    body.style.cssText = 'margin:8px 0';
    body.textContent = assetFailed
      ? 'Не загрузились файлы приложения. Старый кеш страницы может ссылаться на удалённые скрипты.'
      : 'Кнопка меню ☰ может работать без JavaScript, но действия с героями требуют загрузки приложения. Возможно, браузер устарел или загрузка прервалась.';
    var help = document.createElement('p');
    help.style.cssText = 'margin:8px 0';
    help.textContent = 'Перезагрузка не удалит сохранённых персонажей.';
    var link = document.createElement('a');
    link.textContent = 'Перезагрузить сайт без старого HTML';
    link.style.cssText = 'display:inline-block;padding:10px 12px;background:#f0d39a;color:#17120e;border-radius:4px;font-weight:bold;text-decoration:none';
    var href = window.location.href.split('#')[0];
    link.href = href + (href.indexOf('?') === -1 ? '?' : '&') + 'hl_reload=' + Date.now() + window.location.hash;
    panel.appendChild(title);
    panel.appendChild(body);
    panel.appendChild(help);
    panel.appendChild(link);
    document.body.appendChild(panel);
  }, 8000);
})();
3:["$","script",null,{"dangerouslySetInnerHTML":{"__html":"$7"}}]
4:["$","body",null,{"className":"antialiased","children":["$","$L8",null,{}]}]
5:null
6:[[["$","meta",null,{"charSet":"utf-8"}],[["$","title","0",{"children":"Таверна и приключения — Лист Героя 5e"}],["$","meta","1",{"name":"description","content":"Игровой помощник D&D: персонажи, заклинания, инвентарь и броски кубов."}],["$","link","2",{"rel":"shortcut icon","href":"/favicon.ico"}],["$","link","3",{"rel":"icon","href":"/favicon.ico"}],["$","meta","4",{"name":"codex-preview","content":"development"}]],[["$","meta","0",{"name":"viewport","content":"width=device-width, initial-scale=1"}]]],["$","$L9",null,{"segmentMap":{"children":["adventure"]},"children":["$","$La",null,{"id":"layout:/","parallelSlots":"$undefined","children":["$","$Lb",null,{"children":["$","$L9",null,{"segmentMap":{"children":[]},"children":["$","$La",null,{"id":"page:/adventure/"}]}]}]}]}]]
c:I["6efdf509a785",[],"AdventureApp",1]
1:["$","$Lc",null,{}]
