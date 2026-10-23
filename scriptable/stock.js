/*
 * 日本株チェッカー - Scriptable Widget
 * Version 1.0
 *
 * 株価・前日比・騰落率を表示
 * Yahoo Finance 非公式APIを使用
 * 前回取得データのキャッシュ対応
 *
 * 注意:
 * iOSの仕様により更新間隔は保証されません。
 */

const CONFIG = {
 title: "日本株チェッカー",
 appURL: "https://ducat595.github.io/stock_app/",
 refreshMinutes: 15,
 widgetToken: "", // 旧方式との互換用。新規セットアップでは Keychain に保存される
 syncURL: "https://stock-app-api-ducat595.onrender.com/api/widget/favorites",

 // 表示する銘柄（仮登録）
 stocks: []
};

const fm = FileManager.local();
const TOKEN_KEYCHAIN_KEY = "jp_stock_widget_token_v1";
const cachePath = fm.joinPath(
 fm.documentsDirectory(),
 "japan_stock_widget_cache.json"
);

const C = {
 bg: new Color("#101827"),
 card: new Color("#1B293B"),
 white: new Color("#FFFFFF"),
 muted: new Color("#9AAEC5"),
 green: new Color("#4ADE80"),
 red: new Color("#FB7185"),
 yellow: new Color("#FACC15")
};

function fmt(n, digits = 2) {
 if (n === null || n === undefined || !isFinite(n)) {
  return "--";
 }
 return Number(n).toLocaleString("ja-JP", {
  minimumFractionDigits: 0,
  maximumFractionDigits: digits
 });
}

function loadCache() {
 try {
  if (fm.fileExists(cachePath)) {
   return JSON.parse(fm.readString(cachePath));
  }
 } catch (e) {
  console.log("Cache read error: " + e);
 }
 return {};
}

function saveCache(data) {
 try {
  fm.writeString(cachePath, JSON.stringify(data));
 } catch (e) {
  console.log("Cache write error: " + e);
 }
}

async function fetchStock(stock) {
 const symbol = stock.code + ".T";
 const url =
  "https://query1.finance.yahoo.com/v8/finance/chart/" +
  encodeURIComponent(symbol) +
  "?interval=1m&range=1d";

 const req = new Request(url);
 req.timeoutInterval = 10;
 req.headers = {
  "User-Agent": "Mozilla/5.0",
  "Accept": "application/json"
 };

 const json = await req.loadJSON();

 if (json.chart && json.chart.error) {
  throw new Error(JSON.stringify(json.chart.error));
 }

 const result = json.chart?.result?.[0];
 const meta = result?.meta;

 if (!meta) {
  throw new Error("株価データがありません: " + stock.code);
 }

 const price = Number(meta.regularMarketPrice);
 const previousClose = Number(
  meta.chartPreviousClose ?? meta.previousClose
 );

 if (!isFinite(price) || !isFinite(previousClose)) {
  throw new Error("株価が不正です: " + stock.code);
 }

 const change = price - previousClose;
 const percent = previousClose !== 0
  ? change / previousClose * 100
  : 0;

 return {
  code: stock.code,
  name: stock.name,
  price: price,
  change: change,
  percent: percent,
  updatedAt: new Date().toISOString(),
  cached: false
 };
}
async function loadFavorites() {
 const path = fm.joinPath(fm.documentsDirectory(), "stock_favorites.json");
 let list = null;
 const token = await acceptPairingCode() || (Keychain.contains(TOKEN_KEYCHAIN_KEY)
  ? Keychain.get(TOKEN_KEYCHAIN_KEY) : CONFIG.widgetToken);
 if (/^[a-f0-9]{64}$/.test(token)) {
  try {
   const req = new Request(CONFIG.syncURL);
   req.timeoutInterval = 12;
   req.headers = {"X-Widget-Token": token};
   const json = await req.loadJSON();
   if (!Array.isArray(json.favorites)) throw new Error("favorites missing");
   list = json.favorites;
   fm.writeString(path, JSON.stringify({favorites: list}));
  } catch(e) {
   console.log("Widget favorites sync failed; using local cache: " + e);
  }
 }
 if (!list && fm.fileExists(path)) {
  const saved = JSON.parse(fm.readString(path));
  list = Array.isArray(saved) ? saved : saved.favorites;
 }
 if (!Array.isArray(list)) {
  throw new Error("お気に入り未同期です。Webアプリの同期キーを設定してください");
 }
 return list.filter(s => s && s.code).map(s => ({
  code: String(s.code), name: String(s.name || s.code)
 }));
}

async function acceptPairingCode() {
 const code = String(args.queryParameters?.pair || "");
 if (!/^[A-Za-z0-9_-]{32,128}$/.test(code)) return null;
 const req = new Request(CONFIG.syncURL.replace("/favorites", "/pairings/exchange"));
 req.method = "POST";
 req.timeoutInterval = 12;
 req.headers = {"Content-Type": "application/json"};
 req.body = JSON.stringify({code: code});
 try {
  const json = await req.loadJSON();
  if (!/^[a-f0-9]{64}$/.test(json.token || "")) throw new Error("invalid pairing response");
  Keychain.set(TOKEN_KEYCHAIN_KEY, json.token);
  return json.token;
 } catch (e) {
  console.log("Widget pairing failed: " + e);
  return null;
 }
}
async function getStocks() {
 const cache = loadCache();
 const results = [];

 for (const stock of await loadFavorites()) {
  try {
   const data = await fetchStock(stock);
   results.push(data);
   cache[stock.code] = data;
  } catch (e) {
   console.log(stock.code + ": " + e);

   if (cache[stock.code]) {
    results.push({
     ...cache[stock.code],
     cached: true
    });
   } else {
    results.push({
     ...stock,
     price: null,
     change: null,
     percent: null,
     updatedAt: null,
     cached: true
    });
   }
  }
 }

 saveCache(cache);
 return results;
}

function addText(stack, value, size, color, bold = false) {
 const t = stack.addText(String(value));
 t.font = bold
  ? Font.boldSystemFont(size)
  : Font.systemFont(size);
 t.textColor = color;
 t.lineLimit = 1;
 t.minimumScaleFactor = 0.65;
 return t;
}

function addStockRow(widget, stock) {
 const row = widget.addStack();
 row.layoutHorizontally();
 row.centerAlignContent();
 row.backgroundColor = C.card;
 row.cornerRadius = 9;
 row.setPadding(8, 10, 8, 10);

 const left = row.addStack();
 left.layoutVertically();

 addText(left, stock.name, 11, C.white, true);
 left.addSpacer(2);
 addText(left, stock.code, 9, C.muted);

 row.addSpacer();

 const right = row.addStack();
 right.layoutVertically();

 const price = stock.price === null
  ? "---"
  : fmt(stock.price) + "円";

 const priceText = addText(
  right, price, 14, C.white, true
 );
 priceText.rightAlignText();

 right.addSpacer(2);

 let changeText = "---";
 let changeColor = C.muted;

 if (stock.change !== null) {
  const sign = stock.change > 0 ? "+" : "";
  changeText =
   sign + fmt(stock.change) + "円 (" +
   sign + fmt(stock.percent) + "%)";

  changeColor = stock.change > 0
   ? C.green
   : stock.change < 0
    ? C.red
    : C.muted;
 }

 const changeLabel = addText(
  right, changeText, 10, changeColor, true
 );
 changeLabel.rightAlignText();

 if (stock.cached) {
  addText(right, "前回取得値", 8, C.yellow);
 }
}

async function createWidget() {
 const widget = new ListWidget();
 widget.backgroundColor = C.bg;
 widget.setPadding(12, 12, 12, 12);
 widget.url = CONFIG.appURL;

 const header = widget.addStack();
 header.layoutHorizontally();
 header.centerAlignContent();

 addText(
  header,
  "📈 " + CONFIG.title,
  14,
  C.white,
  true
 );

 header.addSpacer();

 addText(header, "★", 14, C.yellow);

 widget.addSpacer(5);

 const stocks = await getStocks();

 const family = config.widgetFamily || "medium";
 const maxRows = family === "small"
  ? 2
  : family === "large"
   ? 8
   : 4;

 for (const stock of stocks.slice(0, maxRows)) {
  addStockRow(widget, stock);
  widget.addSpacer(4);
 }

 widget.addSpacer();

 const footer = widget.addStack();
 footer.layoutHorizontally();

 const now = new Date();
 const time = now.toLocaleTimeString("ja-JP", {
  hour: "2-digit",
  minute: "2-digit"
 });

 addText(
  footer,
  "確認 " + time,
  9,
  C.muted
 );

 footer.addSpacer();

 addText(
  footer,
  "タップしてアプリを開く ›",
  9,
  C.muted
 );

 widget.refreshAfterDate = new Date(
  Date.now() + CONFIG.refreshMinutes * 60000
 );

 return widget;
}

const widget = await createWidget();

if (config.runsInWidget) {
 Script.setWidget(widget);
} else {
 await widget.presentMedium();
}

Script.complete();
