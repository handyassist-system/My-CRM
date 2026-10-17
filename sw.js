// build 1009-27（每次更新 app 都改這行，瀏覽器才會偵測到新版並顯示「有新版本可用」）
// 生活管家 Service Worker
const CACHE_NAME = 'cal-cache-v7';
const CORE = [
  './',
  './index.html',
  './inventory.html',
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
      return Promise.all(keys.filter(function(k){ return k.indexOf('cal-cache-')===0 && k!==CACHE_NAME; }).map(function(k){ return caches.delete(k); }));
    }).then(function(){ return self.clients.claim(); })
  );
});

// 抓取策略：
// - Firebase / 動態請求 → 一律走網路（不快取，確保資料即時）
// - App 靜態檔 → 網路優先，失敗時回快取（離線也打得開）
self.addEventListener('fetch', function(e){
  var url = e.request.url;
  if (e.request.method !== 'GET') return;
  if (url.indexOf('firebaseio.com') >= 0 || url.indexOf('googleapis.com') >= 0 || url.indexOf('gstatic.com') >= 0) {
    return; // 交給瀏覽器直接連網，不攔截
  }
  // 頁面本身（index.html、inventory.html）一律跳過瀏覽器快取直接向伺服器拿，
  // 不然 GitHub 的 10 分鐘快取會讓 App 內切頁（例如行事曆→庫存）拿到舊版
  var isPage = e.request.mode === 'navigate' || /\.html($|\?)/.test(url) || /\/$/.test(url.split('?')[0].split('#')[0]);
  var netReq = isPage ? fetch(e.request.url, { cache:'no-store', credentials:'same-origin' }) : fetch(e.request);
  e.respondWith(
    netReq.then(function(res){
      var copy = res.clone();
      caches.open(CACHE_NAME).then(function(c){ c.put(e.request, copy).catch(function(){}); });
      return res;
    }).catch(function(){
      return caches.match(e.request).then(function(r){ return r || caches.match('./index.html'); });
    })
  );
});

// 點通知 → 開啟/聚焦 App
self.addEventListener('notificationclick', function(e){
  e.notification.close();
  e.waitUntil(
    clients.matchAll({type:'window', includeUncontrolled:true}).then(function(list){
      for(var i=0;i<list.length;i++){ if('focus' in list[i]) return list[i].focus(); }
      if(clients.openWindow) return clients.openWindow('./index.html');
    })
  );
});

// 收到頁面指令 → 立即接管(用於「立即更新」)
self.addEventListener('message', function(e){
  if(e.data === 'SKIP_WAITING') self.skipWaiting();
});
