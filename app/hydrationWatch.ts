/** Inline, ES5-compatible watchdog for cached HTML / missing client bundles. */
export const hydrationWatchScript = String.raw`
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
`;
