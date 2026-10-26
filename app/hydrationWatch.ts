/** Inline, ES5-compatible watchdog for cached HTML / missing client bundles. */
export const hydrationWatchScript = String.raw`
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
`;
