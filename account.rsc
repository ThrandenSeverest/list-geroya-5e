:HL["/list-geroya-5e/assets/index-CrMGHrsf.css","style"]
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
0:{"__route":"route:/account/","__interceptionContext":null,"__layoutIds":["layout:/"],"__rootLayout":"/","page:/account/":"$L1","layout:/":[[[["$","link","css:/list-geroya-5e/assets/index-CrMGHrsf.css",{"rel":"stylesheet","precedence":"vite-rsc/importer-resources","href":"/list-geroya-5e/assets/index-CrMGHrsf.css","data-rsc-css-href":"/list-geroya-5e/assets/index-CrMGHrsf.css"}],"$undefined"],["$","html",null,{"lang":"ru","children":[["$","head",null,{"children":[["$","script",null,{"dangerouslySetInnerHTML":{"__html":"$2"}}],"$L3","$L4"]}],"$L5"]}]],"$L6"],"route:/account/":"$L7","__layoutFlags":{"layout:/":"s"},"__artifactCompatibility":{"schemaVersion":1,"graphVersion":"app-route-graph:qe30xgp2gxqw","deploymentVersion":"6b8d34c7-08a3-4d27-b024-981bc939e7c4","appElementsSchemaVersion":1,"rscPayloadSchemaVersion":1,"rootBoundaryId":"/","renderEpoch":null}}
a:I["8c0f216c4604",[],"Children",1]
b:I["15c18cfaeeff",[],"LayoutSegmentProvider",1]
c:I["8c0f216c4604",[],"Slot",1]
d:I["593f344dc510",[],"RedirectBoundary",1]
8:T11ec,
(function () {
  var assetFailed = false;
  var warningPanel = null;
  function clearWarning() {
    if (warningPanel && warningPanel.parentNode) warningPanel.parentNode.removeChild(warningPanel);
    warningPanel = null;
  }
  function onBoot() {
    if (document.documentElement.getAttribute('data-herolist-hydrated') === '1') clearWarning();
  }
  // Loading large rule catalogs can take longer on low-memory devices.
  // Remove an already displayed warning immediately when React finally mounts.
  if (window.MutationObserver) {
    var observer = new MutationObserver(onBoot);
    observer.observe(document.documentElement, {attributes:true,attributeFilter:['data-herolist-hydrated']});
  }
  window.addEventListener('error', function (event) {
    var node = event.target;
    if (node && (node.tagName === 'SCRIPT' || node.tagName === 'LINK')) assetFailed = true;
  }, true);
  // Some mobile WebViews keep a native modal backdrop active even when
  // its dialog is clipped or invisible. Recover only demonstrably invisible
  // design dialogs; leave intentionally visible dialogs untouched.
  var checks = 0;
  function recoverHiddenDialog() {
    checks++;
    var modals = document.querySelectorAll('dialog.interface-settings[open]');
    for (var i=0;i<modals.length;i++) {
      var dialog = modals[i];
      var rect = dialog.getBoundingClientRect();
      var style = window.getComputedStyle(dialog);
      if (style.display === 'none' || style.visibility === 'hidden'
          || rect.width < 80 || rect.height < 40
          || rect.right <= 0 || rect.left >= window.innerWidth
          || rect.bottom <= 0 || rect.top >= window.innerHeight) {
        try {
          if (typeof dialog.close === 'function') dialog.close();
          else dialog.removeAttribute('open');
          document.documentElement.setAttribute('data-herolist-recovered-dialog', '1');
        } catch (ignore) {}
      }
    }
    if (checks < 10) window.setTimeout(recoverHiddenDialog, 1500);
  }
  window.setTimeout(recoverHiddenDialog, 1500);
  window.setTimeout(function () {
    if (document.documentElement.getAttribute('data-herolist-hydrated') === '1') { clearWarning(); return; }
    if (!document.querySelector('.character-library-layout')) return;
    // Opt-in diagnostics has its own full report. Do not cover it with this
    // fixed-position warning: users on broken phones must be able to copy it.
    if (window.location.search.indexOf('herolist_diag=1') !== -1) return;
    if (document.getElementById('herolist-boot-warning')) return;
    var panel = document.createElement('section');
    panel.id = 'herolist-boot-warning';
    panel.setAttribute('role', 'alert');
    panel.style.cssText = 'position:fixed;z-index:2147483646;left:12px;right:12px;top:12px;bottom:auto;max-width:540px;max-height:45vh;overflow:auto;margin:0 auto;padding:12px;background:#172126;color:#fff;border:2px solid #f0d39a;border-radius:8px;box-shadow:0 8px 30px #0009;font:13px/1.35 Arial,sans-serif;pointer-events:none';
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
    link.style.cssText = 'display:inline-block;padding:10px 12px;background:#f0d39a;color:#17120e;border-radius:4px;font-weight:bold;text-decoration:none;pointer-events:auto';
    var href = window.location.href.split('#')[0];
    link.href = href + (href.indexOf('?') === -1 ? '?' : '&') + 'hl_reload=' + Date.now() + window.location.hash;
    panel.appendChild(title);
    panel.appendChild(body);
    panel.appendChild(help);
    panel.appendChild(link);
    document.body.appendChild(panel);
    warningPanel = panel;
  }, 20000);
})();
3:["$","script",null,{"dangerouslySetInnerHTML":{"__html":"$8"}}]
9:T250b,
(function () {
  if (window.location.search.indexOf('herolist_diag=1') < 0) return;
  var recent = [], faults = [], resourcesFailed = [], interactions = [], bootTime = Date.now();
  var nativeTapCount = 0;
  function viewName() {
    if (document.querySelector('nav.steps')) return 'character-editor';
    if (document.querySelector('.character-library-layout')) return 'character-library';
    if (document.querySelector('.play-shell')) return 'game';
    return 'other';
  }
  function buttonName(node) {
    if (!node) return '';
    var btn = node.closest ? node.closest('button') : null;
    return btn ? (btn.getAttribute('aria-label') || btn.textContent || '').trim().replace(/\\s+/g,' ').slice(0,65) : '';
  }
  function reactHandler(node) {
    if (!node) return 'n/a';
    var keys = Object.keys(node), key, props;
    for (var i=0; i<keys.length; i++) {
      key=keys[i];
      if (key.indexOf('__reactProps') === 0) {
        props=node[key];
        return props && typeof props.onClick === 'function' ? 'present' : 'absent';
      }
    }
    return 'not-mounted';
  }
  function excerpt(url) {
    if (!url) return '';
    var parts = String(url).split('/');
    return parts.slice(-2).join('/').slice(0,130);
  }
  function brief(node) {
    if (!node) return 'none';
    var tag = (node.tagName || '').toLowerCase();
    if (!tag) return 'unknown';
    var cls = typeof node.className === 'string' ? node.className : '';
    return tag + (cls ? '.' + cls.trim().replace(/\s+/g, '.').slice(0,100) : '');
  }
  function record(kind, event) {
    var node=event.target, btn=node && node.closest ? node.closest('button') : null;
    recent.push(kind + ' -> ' + brief(node) + (btn ? ' ['+buttonName(node)+']' : ''));
    if (recent.length > 12) recent.shift();
    if (kind==='click' && btn && !btn.closest('#herolist-device-diagnostics')) {
      var before=viewName(), name=buttonName(btn), disabled=btn.disabled, handler=reactHandler(btn);
      window.setTimeout(function(){
        interactions.push(name + ': disabled='+disabled+', reactOnClick='+handler+', view='+before+' -> '+viewName());
        if(interactions.length>8) interactions.shift();
      },600);
    }
  }
  function fault(value) {
    faults.push(String(value).slice(0,220));
    if (faults.length > 5) faults.shift();
  }
  ['touchstart','pointerdown','click'].forEach(function (kind) {
    document.addEventListener(kind, function (event) { record(kind,event); }, true);
  });
  window.addEventListener('error', function (event) {
    var node = event.target;
    if (node && (node.tagName === 'SCRIPT' || node.tagName === 'LINK' || node.tagName === 'IMG')) {
      var resource = node.src || node.href || '';
      resourcesFailed.push(node.tagName + ': ' + excerpt(resource));
      if (resourcesFailed.length > 8) resourcesFailed.shift();
      return;
    }
    fault((event.message || 'script error') + ' @ ' + excerpt(event.filename || '') + ':' + (event.lineno || 0) + ':' + (event.colno || 0));
  }, true);
  window.addEventListener('unhandledrejection', function (event) {
    fault('rejection: ' + (event.reason && event.reason.message || event.reason || 'unknown'));
  });
  function hit(selector) {
    var node = document.querySelector(selector);
    if (!node) return selector + ': missing';
    var box = node.getBoundingClientRect(), style = window.getComputedStyle(node);
    var x = Math.max(0, Math.min(innerWidth - 1,box.left + box.width/2));
    var y = Math.max(0, Math.min(innerHeight - 1,box.top + box.height/2));
    var front = (box.width && box.height && y >= 0 && y < innerHeight) ? document.elementFromPoint(x,y) : null;
    return selector + ': rect=' + [box.left,box.top,box.width,box.height].map(function(x){return Math.round(x);}).join(',')
      + ', pointer=' + style.pointerEvents + ', display=' + style.display
      + ', front=' + brief(front) + ', reachable=' + !!(front && (front === node || node.contains(front)));
  }
  function report() {
    var active = [].slice.call(document.querySelectorAll('dialog[open]'));
    var cssSupports = false;
    try {cssSupports = !!(window.CSS && CSS.supports && CSS.supports('selector(:has(*))'));}catch(ignore){}
    return [
      'HeroList mobile diagnostics / '+new Date().toISOString(),
      'userAgent: '+navigator.userAgent,
      'width,height: '+innerWidth+','+innerHeight+', screen='+screen.width+'x'+screen.height,
      'DPR: '+devicePixelRatio+', maxTouchPoints: '+(navigator.maxTouchPoints||0),
      'viewport: '+(window.visualViewport ? window.visualViewport.width+'x'+window.visualViewport.height : 'unavailable'),
      'pointer: coarse='+matchMedia('(pointer: coarse)').matches+', fine='+matchMedia('(pointer: fine)').matches,
      'features: dialog='+!!(window.HTMLDialogElement && HTMLDialogElement.prototype.showModal)+', randomUUID='+!!(window.crypto && crypto.randomUUID)+', CSS-has='+cssSupports,
      'hydrated: '+document.documentElement.getAttribute('data-herolist-hydrated')+', elapsed='+Math.round((Date.now()-bootTime)/1000)+'s',
      'scripts: '+document.scripts.length+', openDialogs: '+active.map(brief).join(' / '),
      'loaded JS entries: '+(performance.getEntriesByType ? performance.getEntriesByType('resource').filter(function(x){return /\.js(\?|$)/.test(x.name);}).map(function(x){return excerpt(x.name)+' '+Math.round(x.transferSize||0)+'b';}).slice(-12).join(' | ') : 'unavailable'),
      'resource errors: '+(resourcesFailed.join(' | ')||'none'),
      'current view: '+viewName(),
      'native diagnostic taps: '+nativeTapCount,
      'React click follow-up: '+(interactions.join(' | ')||'none'),
      hit('.mobile-top-menu summary'),
      hit('.mode-signs button'),
      hit('.character-card-actions button'),
      'events: '+(recent.join(' | ')||'none'),
      'errors: '+(faults.join(' | ')||'none')
    ].join('\n');
  }
  function mount() {
    if (document.getElementById('herolist-device-diagnostics')) return;
    var snapshot = report();
    // In diagnostics mode only, close any accidentally active design modal
    // so its top-layer backdrop cannot block the report controls.
    [].forEach.call(document.querySelectorAll('dialog.interface-settings[open]'),function(d){try{d.close();}catch(e){}});
    var panel = document.createElement('section');
    panel.id = 'herolist-device-diagnostics';
    panel.style.cssText='position:fixed;z-index:2147483647;left:4px;right:4px;bottom:4px;max-height:42vh;overflow:auto;background:#121d24;color:#fff;border:2px solid #e1a071;padding:10px;font:13px/1.4 Arial,sans-serif;box-shadow:0 0 16px #000b';
    var title=document.createElement('strong');title.textContent='Диагностика запуска и касаний HeroList';
    var status=document.createElement('div');
    status.setAttribute('role','status');
    status.style.cssText='padding:7px 0;font-weight:bold;color:#e9d39a';
    status.textContent='Диагностика активна. Нажмите «Проверка», затем кнопки сайта.';
    var detail=document.createElement('textarea');
    detail.readOnly=true;
    detail.style.cssText='box-sizing:border-box;width:100%;height:125px;margin-top:6px;background:#f7f7f7;color:#111;font:11px/1.3 monospace';
    detail.value=snapshot;
    var test=document.createElement('button');test.textContent='Проверка касания';
    var copy=document.createElement('button');copy.textContent='Скопировать отчёт';
    var update=document.createElement('button');update.textContent='Обновить показатели';
    var close=document.createElement('button');close.textContent='Свернуть';
    [test,copy,update,close].forEach(function(b){b.type='button';b.style.cssText='padding:9px;margin:3px;border:1px solid #e1a071;background:#253644;color:white;min-height:44px;touch-action:manipulation'});
    var refreshCount=0;
    function updateReport(){
      detail.value=report();
      refreshCount++;
      status.textContent='Отчёт обновлён ('+refreshCount+'): '+new Date().toLocaleTimeString();
    }
    test.addEventListener('click',function(){
      nativeTapCount++;
      status.textContent='Нативные нажатия работают: '+nativeTapCount;
      detail.value=report();
    });
    update.addEventListener('click',updateReport);
    copy.addEventListener('click',function(){
      detail.value=report();
      function copied(ok){
        if(ok)status.textContent='Отчёт скопирован в буфер обмена';
        else status.textContent='Автокопирование запрещено браузером. Выделите текст отчёта вручную.';
      }
      if(navigator.clipboard && navigator.clipboard.writeText){
        navigator.clipboard.writeText(detail.value).then(function(){copied(true);},function(){copied(false);});
      }else{
        detail.focus();detail.select();
        try{copied(!!document.execCommand('copy'));}catch(e){copied(false);}
      }
    });
    close.addEventListener('click',function(){panel.style.display='none';});
    panel.appendChild(title);panel.appendChild(status);panel.appendChild(detail);
    panel.appendChild(test);panel.appendChild(update);panel.appendChild(copy);panel.appendChild(close);
    document.body.appendChild(panel);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded',function(){setTimeout(mount,1600);});
  else setTimeout(mount,1600);
})();
4:["$","script",null,{"dangerouslySetInnerHTML":{"__html":"$9"}}]
5:["$","body",null,{"className":"antialiased","children":["$","$La",null,{}]}]
6:null
7:[[["$","meta",null,{"charSet":"utf-8"}],[["$","title","0",{"children":"Лист Героя 5e — создание персонажа D&D 2014"}],["$","meta","1",{"name":"description","content":"Пошаговый конструктор персонажа D&D 5e в редакции 2014 года."}],["$","link","2",{"rel":"shortcut icon","href":"/favicon.ico"}],["$","link","3",{"rel":"icon","href":"/favicon.ico"}],["$","meta","4",{"name":"codex-preview","content":"development"}]],[["$","meta","0",{"name":"viewport","content":"width=device-width, initial-scale=1"}]]],["$","$Lb",null,{"segmentMap":{"children":["account"]},"children":["$","$Lc",null,{"id":"layout:/","parallelSlots":"$undefined","children":["$","$Ld",null,{"children":["$","$Lb",null,{"segmentMap":{"children":[]},"children":["$","$Lc",null,{"id":"page:/account/"}]}]}]}]}]]
e:I["724dcbd470a5",[],"default",1]
1:["$","$Le",null,{"params":"$@f","searchParams":"$@10"}]
f:{}
10:{}
