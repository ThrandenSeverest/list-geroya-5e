/** Opt-in, ES5-only on-page diagnostics for device-dependent dead touch controls.
 * Activated by ?herolist_diag=1. No account, character, or localStorage data read. */
export const touchDiagnosticsScript = String.raw`
(function () {
  if (window.location.search.indexOf('herolist_diag=1') < 0) return;
  var recent = [], faults = [], bootTime = Date.now();
  function brief(node) {
    if (!node) return 'none';
    var tag = (node.tagName || '').toLowerCase();
    if (!tag) return 'unknown';
    var cls = typeof node.className === 'string' ? node.className : '';
    return tag + (cls ? '.' + cls.trim().replace(/\\s+/g, '.').slice(0,100) : '');
  }
  function record(kind, event) {
    recent.push(kind + ' -> ' + brief(event.target));
    if (recent.length > 8) recent.shift();
  }
  function fault(value) {
    faults.push(String(value).slice(0,220));
    if (faults.length > 5) faults.shift();
  }
  ['touchstart','pointerdown','click'].forEach(function (kind) {
    document.addEventListener(kind, function (event) { record(kind,event); }, true);
  });
  window.addEventListener('error', function (event) {
    fault(event.message || ((event.target && event.target.tagName) || 'resource error'));
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
    panel.style.cssText='position:fixed;z-index:2147483647;left:4px;right:4px;bottom:4px;max-height:48vh;overflow:auto;background:#121d24;color:#fff;border:2px solid #e1a071;padding:10px;font:13px/1.4 Arial,sans-serif;box-shadow:0 0 16px #000b';
    var title=document.createElement('strong');title.textContent='Диагностика касаний HeroList';
    var detail=document.createElement('textarea');
    detail.readOnly=true;detail.style.cssText='box-sizing:border-box;width:100%;height:160px;margin-top:6px;background:#f7f7f7;color:#111;font:11px/1.3 monospace';
    detail.value=snapshot;
    var copy=document.createElement('button');copy.textContent='Скопировать отчёт';
    var update=document.createElement('button');update.textContent='Обновить показатели';
    var close=document.createElement('button');close.textContent='Скрыть диагностику';
    [copy,update,close].forEach(function(b){b.style.cssText='padding:9px;margin:4px;border:1px solid #e1a071;background:#253644;color:white'});
    copy.onclick=function(){detail.focus();detail.select();try{document.execCommand('copy');}catch(e){}};
    update.onclick=function(){detail.value=report();};
    close.onclick=function(){panel.parentNode.removeChild(panel);};
    panel.appendChild(title);panel.appendChild(detail);panel.appendChild(copy);panel.appendChild(update);panel.appendChild(close);
    document.body.appendChild(panel);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded',function(){setTimeout(mount,1600);});
  else setTimeout(mount,1600);
})();
`;
