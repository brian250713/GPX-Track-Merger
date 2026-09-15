## 1. 專案建置

- [x] 1.1 用 Vite 建立 TypeScript（vanilla）專案，確認 `npm run dev` 與 `npm run build` 可以執行
- [x] 1.2 安裝 `maplibre-gl`、`@tmcw/togeojson`，以及開發用的 `vitest`、`jsdom`
- [x] 1.3 設定 Vitest（jsdom 環境），寫一個範例測試確認可以執行
- [x] 1.4 依 design D10 建立目錄結構（`core/`、`map/`、`card/`、`ui/`、`state.ts`、`main.ts`）
- [x] 1.5 準備測試用 GPX 樣本放在 `tests/fixtures/`：多段軌跡、無高度、部分無時間、只有 `<rte>`、只有 `<wpt>`、XML 損壞、跨午夜、含交通斷訊
- [x] 1.6 依 design D11 建立 `src/styles/tokens.css`（CSS custom properties）與 `src/styles/tokens.ts`（同一組色值、邊框、圓角、陰影數值的 TS 常數），確保兩者來自同一份定義（例如由 TS 產生 CSS，或寫一個測試比對兩邊數值）
- [x] 1.7 安裝 `@fontsource-variable/fredoka`、`@fontsource-variable/nunito`、`@fontsource-variable/chiron-goround-tc`，在 `tokens.css` 定義 D11 的字型堆疊；確認實際的 `font-family` 名稱（例如 `"Fredoka Variable"`），並確認建置後的字型檔從本站載入

## 2. 底圖與字型 Spike（先做，結果決定 D7、驗證 D11）

- [x] 2.1 做一個獨立的驗證頁面：MapLibre 載入候選底圖，畫一條假軌跡，等待 `idle` 後呼叫 `canvas.toBlob()`
- [x] 2.2 逐一測試 OSM、國土測繪中心 NLSC、MapTiler、Stadia：記錄是否支援 CORS、能否成功匯出、是否需要 API key
- [x] 2.3 查閱各服務的使用條款：是否允許在匯出圖片中使用、需要的授權標示文字
- [x] 2.4 把結果整理到 design.md 的 Open Questions 並選定底圖；確定 `exportable` 的設定值
- [x] 2.5 驗證中文字型：做一個小頁面，用 Vite 建置後確認 (1) 頁面只下載用到的 Chiron GoRound TC 片段；(2) 對一個頁面上沒出現過的標題呼叫 `document.fonts.load()` 並帶入文字後，canvas 能用正確字型畫出中文；(3) 字重 700 是真正的粗體；(4) 中英混排時 Fredoka 與中文字型的基線、大小搭配自然。有問題時寫回 design.md D11

## 3. 核心邏輯：GPX 解析（gpx-import）

- [x] 3.1 定義 `TrackPoint` 型別，以及檔案解析結果型別（成功、警告：無時間、錯誤：格式損壞或找不到軌跡）
- [x] 3.2 實作 `core/parse.ts`：GPX 文字 → 用 togeojson 轉換 → 攤平成 `TrackPoint[]`，涵蓋 `<trk>` 與 `<rte>`
- [x] 3.3 處理略過無時間的點、整個檔案無時間時回傳警告、XML 損壞與找不到軌跡時回傳錯誤
- [x] 3.4 用 fixtures 為 gpx-import spec 的解析相關 scenario 撰寫測試

## 4. 核心邏輯：分天與統計（day-grouping）

- [x] 4.1 實作 `core/geo.ts`：haversine 距離、計算邊界範圍
- [x] 4.2 實作合併、依時間排序、移除時間重複的點
- [x] 4.3 用 `Intl.DateTimeFormat` 實作「UTC 時間 + 時區 → 當地日期 `YYYY-MM-DD`」
- [x] 4.4 實作 `groupByDay`：依當地日期分組並編號 Day 1…N，跳過沒有點的日期
- [x] 4.5 實作斷訊切段：時間間隔 > 30 分鐘或距離 > 5 公里時斷開，門檻寫成具名常數
- [x] 4.6 實作每天與整趟的距離計算（不計入斷開處）
- [x] 4.7 定義 10 色色盤，依 Day 編號取色（超過 10 天時循環）；色盤從鮮豔、高飽和的顏色挑選，不可和介面粉彩色重複（D11），並在 2.4 選定的底圖上以及色盲模擬下確認可以分辨
- [x] 4.8 為 day-grouping spec 的所有 scenario 撰寫測試，包含時區換日、跨午夜、剛好等於門檻、夏令時間

## 5. 核心邏輯：GPX 匯出（gpx-export）

- [x] 5.1 實作 `core/gpxWriter.ts`：`Day[]` + 標題 → GPX 1.1 XML 字串（每天一個 `<trk>`、每段一個 `<trkseg>`）
- [x] 5.2 處理 `<time>` 輸出為 UTC ISO 8601、沒有高度時不輸出 `<ele>`、`<metadata><name>` 的跳脫字元
- [x] 5.3 實作檔名產生：`{標題或 trip}_{第一天日期}.gpx`，移除不合法字元
- [x] 5.4 為 gpx-export spec 的所有 scenario 撰寫測試；將產出的 XML 重新解析，確認結構與點數正確

## 6. 狀態管理與介面

- [x] 6.1 實作 `state.ts`：檔案列表（依檔案快取解析結果）、時區、標題、圖卡風格；任何變更都重新計算 `Day[]` 並通知畫面
- [x] 6.2 實作上傳區：檔案選擇器（multiple）與拖放，只接受 `.gpx`，可以分次加入
- [x] 6.3 實作檔案列表：顯示檔名、點數、警告或錯誤狀態、移除按鈕
- [x] 6.4 實作時區選單：列出 `Intl.supportedValuesOf('timeZone')`，預設為瀏覽器時區
- [x] 6.5 實作分天摘要：Day 編號、日期、顏色、距離（小數點後 1 位）
- [x] 6.6 實作標題輸入框、圖卡風格選擇、匯出 GPX 與下載圖卡按鈕；沒有資料時停用按鈕
- [x] 6.7 實作共用的下載工具：Blob → `<a download>` → 釋放 object URL
- [x] 6.8 實作 D11 元件樣式：`.clay-card`、`.soft-clay`、`.btn-primary`、`.btn-secondary`；按壓效果只套用在可點擊的小元件，大區塊不做 hover 位移
- [x] 6.9 實作便當盒式版面：寬螢幕多區塊並排、地圖為最大區塊、各區塊固定底色；窄螢幕排成單欄並依 visual-style spec 的順序排列，不出現水平捲動
- [x] 6.10 實作無障礙樣式：主要按鈕使用深色字（或加深綠色底色）、粉彩區塊內文字一律用 `--text`、所有可操作元件的 `:focus-visible` 樣式、`prefers-reduced-motion` 時取消位移與 transition
- [x] 6.11 在上傳區附近顯示隱私說明：「軌跡檔案不會上傳；顯示地圖時，底圖服務會得知你正在瀏覽的地區」（gpx-import 隱私說明）

## 7. 地圖顯示（track-map-view）

- [x] 7.1 實作 `map/basemaps.ts`：依 spike 結果定義底圖（style 或 raster tiles、授權標示、`exportable`）
- [x] 7.2 實作 `map/mapView.ts`：初始化 MapLibre，建立一個 GeoJSON source 和兩個 line layer：底層是較寬的 `--text` 色外框 layer，上層是依 `dayIndex` 決定顏色的軌跡 layer（D11）
- [x] 7.3 把 `Day[]` 轉成 LineString FeatureCollection（排除單點段落），資料更新時呼叫 `setData`
- [x] 7.4 資料改變時用 `fitBounds` 縮放並保留邊距；沒有資料時顯示預設範圍與上傳提示
- [x] 7.5 確認地圖上有顯示底圖授權標示
- [x] 7.6 重新設定 MapLibre 縮放按鈕與授權標示的樣式（圓角、3px 邊框、硬陰影），和網站其他按鈕一致，並確認授權文字仍清楚可讀

## 8. 圖卡匯出（trip-card-export）

- [x] 8.1 實作圖卡版面：2160×2160 canvas，包含頁首（標題、日期範圍）、地圖區域、頁尾（天數、總距離、顏色圖例、授權標示）
- [x] 8.2 實作日期範圍格式：多天 `2026.03.12 – 03.16`、單日 `2026.03.12`；跨年時顯示完整日期
- [x] 8.3 繪製文字前用 `document.fonts.load()` 明確載入圖卡用到的自帶字型（Fredoka、Nunito、Chiron GoRound TC），並帶入要繪製的文字，讓瀏覽器下載對應的中文片段；只等待 `document.fonts.ready` 不夠，因為它不會載入頁面尚未使用的字型
- [x] 8.4 實作極簡風格：Web Mercator 投影、fit bounds 並保留邊距，在 `--secondary` 淺藍背景上用每天的顏色畫線，線條帶有深色外框
- [x] 8.5 實作含底圖風格：建立離屏 MapLibre（`pixelRatio: 2`、`preserveDrawingBuffer: true`、不開互動），等待 `idle` 後把地圖 canvas 畫進圖卡，最後銷毀離屏地圖
- [x] 8.6 處理失敗情況：`toBlob` 拋出 `SecurityError`、15 秒超時，都顯示錯誤並建議改用極簡風格，不下載檔案
- [x] 8.7 底圖設定為不可匯出時，停用「含底圖」選項並顯示原因；產生圖卡期間按鈕顯示處理中且不能重複按下
- [x] 8.8 測試極簡風格的投影與日期範圍格式化（純函式部分）
- [x] 8.9 圖卡套用 D11 風格：`--bg-cream` 底色、地圖區域用 `roundRect()` 畫圓角邊框並先畫偏移矩形作為硬陰影、天數與總距離做成色塊標籤；所有色值從 `src/styles/tokens.ts` 讀取，2 倍解析度下邊框與陰影數值也加倍

## 9. 驗證與部署

- [x] 9.1 用真實的旅行 GPX（多檔、多天、含搭車斷訊）手動走一遍完整流程：上傳 → 換時區 → 看地圖 → 匯出 GPX → 下載兩種圖卡
- [ ] 9.2 把匯出的 GPX 匯入至少一個其他工具（例如 Google Earth、GPX Studio），確認分天與分段結構正確
- [x] 9.3 檢查瀏覽器網路紀錄，確認沒有任何請求包含軌跡資料（gpx-import 隱私需求），也沒有向第三方字型服務發出請求（visual-style 自行託管字型）
- [ ] 9.4 用數萬點以上的大檔測試地圖與圖卡效能，如果卡頓，記錄下來作為後續改善項目
- [x] 9.5 設定靜態網站部署（GitHub Pages 或 Cloudflare Pages），確認建置後的網站可以正常運作
- [ ] 9.6 檢查 visual-style spec：用對比度工具檢查所有文字、只用鍵盤走完整流程、開啟減少動態效果測試、在 400px 與 1280px 寬度下檢查版面；並在 Windows 與 macOS 各下載一張含中文標題的圖卡，確認字型一致
