const { app, BrowserWindow, dialog, ipcMain, protocol, Menu, shell } = require('electron');
const path = require('node:path');
const fs = require('node:fs/promises');

protocol.registerSchemesAsPrivileged([
  { scheme: 'herolist', privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true } },
]);
let mainWindow;
let splashWindow;
const site = path.join(__dirname, 'site');
const mime = { '.html':'text/html', '.js':'text/javascript', '.css':'text/css', '.json':'application/json', '.svg':'image/svg+xml', '.png':'image/png', '.jpg':'image/jpeg', '.jpeg':'image/jpeg', '.ico':'image/x-icon', '.woff2':'font/woff2', '.webp':'image/webp', '.txt':'text/plain' };

function resourcePath(url) {
  const { pathname } = new URL(url);
  let request = decodeURIComponent(pathname);
  if (!request || request.endsWith('/')) request += 'index.html';
  const target = path.resolve(site, '.' + request);
  if (target !== site && !target.startsWith(site + path.sep)) return null;
  return target;
}
async function asset(url) {
  let target = resourcePath(url);
  if (!target) return new Response('Forbidden', {status:403});
  try {
    const stats = await fs.stat(target).catch(() => null);
    if (stats?.isDirectory()) target = path.join(target, 'index.html');
    const bytes = await fs.readFile(target);
    return new Response(bytes, {headers:{ 'Content-Type': mime[path.extname(target).toLowerCase()] || 'application/octet-stream', 'Cache-Control':'no-store' }});
  } catch { return new Response('Not found', {status:404}); }
}
async function save(name, base64, filters) {
  const result = await dialog.showSaveDialog(mainWindow, { defaultPath: path.basename(name || 'HeroList.json'), filters });
  if (result.canceled || !result.filePath) return { canceled:true };
  await fs.writeFile(result.filePath, Buffer.from(base64,'base64'));
  return { saved:true };
}
app.whenReady().then(async () => {
  // Electron localStorage belongs to the persistent userData profile, not the portable EXE.
  // Give users an OS-native way to inspect and back up that directory.
  Menu.setApplicationMenu(Menu.buildFromTemplate([
    { label:'HeroList', submenu:[
      { label:'Открыть папку сохранений', click:() => {
        void shell.openPath(app.getPath('userData')).then(result => {
          if (result) dialog.showErrorBox('Не удалось открыть папку', result);
        });
      }},
      { type:'separator' },
      { role:'quit', label:'Выход' },
    ]},
    { label:'Правка', submenu:[{role:'undo'},{role:'redo'},{type:'separator'},{role:'cut'},{role:'copy'},{role:'paste'},{role:'selectAll'}]},
    { label:'Вид', submenu:[{role:'reload'},{role:'togglefullscreen'}]},
  ]));
  protocol.handle('herolist', request => asset(request.url));
  ipcMain.handle('herolist:save', async (_event, {name, mime, base64}) => {
    const extension = path.extname(name || '').replace(/^\./, '') || 'json';
    return save(name, base64, [{name: mime || 'File', extensions:[extension]}]);
  });
  ipcMain.handle('herolist:pdf', async (_event, {name}) => {
    const pdf = await mainWindow.webContents.printToPDF({ printBackground:true, preferCSSPageSize:true });
    return save(name || 'HeroList.pdf', pdf.toString('base64'), [{name:'PDF', extensions:['pdf']}]);
  });
  splashWindow = new BrowserWindow({
    width:960,height:540,frame:false,resizable:false,center:true,show:false,
    backgroundColor:'#061a35',icon:path.join(__dirname,'icon.ico'),
    webPreferences:{contextIsolation:true,nodeIntegration:false,sandbox:true}
  });
  splashWindow.once('ready-to-show',()=>{if(splashWindow&&!splashWindow.isDestroyed())splashWindow.show();});
  splashWindow.loadFile(path.join(__dirname,'splash.html')).catch(console.error);
  mainWindow = new BrowserWindow({
    width:1440,height:940,minWidth:960,minHeight:640,
    show:false,backgroundColor:'#061a35',icon:path.join(__dirname,'icon.ico'),
    webPreferences:{ preload:path.join(__dirname,'preload.cjs'), sandbox:false, contextIsolation:true, nodeIntegration:false, webSecurity:true }
  });
  const showMain=()=>{
    if(mainWindow&&!mainWindow.isDestroyed())mainWindow.show();
    if(splashWindow&&!splashWindow.isDestroyed())splashWindow.close();
    splashWindow=null;
  };
  mainWindow.once('ready-to-show',showMain);
  mainWindow.webContents.on('did-fail-load',(_e,code,msg)=>{if(code!==-3){console.error(msg);showMain();}});
  await mainWindow.loadURL('herolist://app/').catch(e=>{console.error(e);showMain();});
  mainWindow.webContents.setWindowOpenHandler(({url}) => {
    if (url.startsWith('herolist://app/')) mainWindow.loadURL(url);
    return {action:'deny'};
  });
  mainWindow.webContents.on('will-navigate', (event, url) => {
    if (!url.startsWith('herolist://app/')) event.preventDefault();
  });
});
app.on('window-all-closed', () => app.quit());
