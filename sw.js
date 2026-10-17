// build 1009-86（每次更新 app 都改這行，瀏覽器才會偵測到新版並顯示「有新版本可用」）
// 客戶管理 Service Worker（智在生活 Standard：與其他 App 同一套）
// 每次改這支 sw.js 本身時，把版本號 +1，舊快取才會被清掉
const CACHE_NAME = 'crm-cache-v2';
const CORE = [
  './',
  './index.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png'
];

// 安裝：預快取核心檔案
self.addEventListener('install', function(e){
  e.waitUntil(
    caches.open(CACHE_NAME).then(function(c){ return c.addAll(CORE).catch(function(){}); })
  );
});

// 啟用：清掉舊快取
self.addEventListener('activate', function(e){
  e.waitUntil(
    caches.keys().then(function(keys){
      // 只清自己這個 App 的舊快取（同網站的其他 App 也有快取，不能一起刪）
      return Promise.all(keys.filter(function(k){ return k.indexOf('crm-cache-')===0 && k!==CACHE_NAME; }).map(function(k){ return caches.delete(k); }));
    }).then(function(){ return self.clients.claim(); })
  );
});

// 抓取策略：
// - Firebase / Google 服務 → 一律走網路（不攔截，確保登入與資料即時）
// - App 靜態檔 → 網路優先，失敗時回快取（有網路永遠是最新版）
self.addEventListener('fetch', function(e){
  var url = e.request.url;
  if (e.request.method !== 'GET') return;
  if (url.indexOf('firebaseio.com') >= 0 || url.indexOf('googleapis.com') >= 0 || url.indexOf('gstatic.com') >= 0 || url.indexOf('firebaseapp.com') >= 0) {
    return;
  }
  // 頁面本身一律跳過瀏覽器快取直接向伺服器拿，避免 GitHub 的 10 分鐘快取讓人拿到舊版
  var isPage = e.request.mode === 'navigate' || /\.html($|\?)/.test(url) || /\/$/.test(url.split('?')[0].split('#')[0]);
  var netReq = isPage ? fetch(e.request.url, { cache:'no-store', credentials:'same-origin' }) : fetch(e.request);
  e.respondWith(
    netReq.then(function(res){
      if (res && res.ok) {
        var copy = res.clone();
        caches.open(CACHE_NAME).then(function(c){ c.put(e.request, copy).catch(function(){}); });
      }
      return res;
    }).catch(function(){
      return caches.match(e.request).then(function(r){ return r || caches.match('./index.html'); });
    })
  );
});

// 收到頁面指令 → 立即接管（「立即更新」按鈕用）
self.addEventListener('message', function(e){
  if (e.data === 'SKIP_WAITING') self.skipWaiting();
});
