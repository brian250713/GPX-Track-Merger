## Context

這是全新專案，目前沒有任何程式碼。目標是做一個純前端的旅行軌跡整理工具：使用者上傳多個 GPX，選一個時區，系統依當地日期分天，然後顯示在地圖上，並能匯出合併後的 GPX 和一張圖卡。

限制條件：
- 沒有後端，所有處理都在瀏覽器內完成，部署成靜態網站
- 軌跡屬於個人隱私資料，不能送到任何第三方服務
- 唯一的外部依賴是底圖圖磚服務

## Goals / Non-Goals

**Goals:**
- 核心邏輯（解析、分天、斷訊切段、距離、GPX 產生）寫成純函式，不依賴 DOM 或地圖，可以單獨測試
- 選擇時區後立刻重新計算並更新畫面，不需要重新上傳檔案
- 圖卡在底圖無法匯出時仍有備案可用（極簡風格）
- 底圖服務可替換，換底圖時不需要修改其他模組

**Non-Goals:**
- 分享、帳號、雲端儲存、資料保留（重新整理就清空）
- 照片整合、反向地理編碼
- 手動調整分日、編輯或刪除個別軌跡點
- 同時用兩台裝置錄製、時間重疊的軌跡去重（見 Risks）
- 多種圖卡比例

## Decisions

### D1. 技術堆疊：Vite + TypeScript，不使用 UI 框架

畫面元件很少：上傳區、檔案列表、時區選單、標題輸入框、兩個匯出按鈕、地圖。用原生 TypeScript 加一個簡單的狀態物件就足夠。

- 替代方案：React 或 Vue。元件多的時候比較好維護，但這個專案的規模用不到。之後畫面變複雜時再引入即可，核心邏輯是純函式，不受影響。
- 測試：Vitest（和 Vite 整合，設定最少）

### D2. 資料流：單向管線，時區改變時只重跑後半段

```
File[] ──parse──▶ TrackPoint[]（每個檔案一份）
                        │ 合併並依時間排序
                        ▼
                  TrackPoint[]（全部）
                        │ 時區（使用者選擇）
                        ▼ groupByDay + splitGaps
                  Day[] ── { date, color, segments: TrackPoint[][], distanceKm }
                        │
          ┌─────────────┼─────────────┐
          ▼             ▼             ▼
      地圖顯示       GPX 匯出      圖卡匯出
```

- `TrackPoint = { lat, lon, ele?, time: Date }`
- 解析結果依檔案快取。新增或移除檔案時才重新解析，改時區只重跑分天以後的步驟。

### D3. GPX 解析：`@tmcw/togeojson` 再轉成 TrackPoint

togeojson 可以處理 `<trk>`、`<rte>`、多個 segment，時間放在 `coordinateProperties.times`。解析後攤平成 TrackPoint 陣列。

- **沒有時間的點會被略過**：沒有時間就無法判斷屬於哪一天。整個檔案都沒有時間時，把該檔案標記為警告並告知使用者。
- `<rte>`（規劃路線）通常沒有時間，所以實際上會落入上述警告。
- 替代方案：自己用 DOMParser 解析。GPX 格式差異很多，現成函式庫比較可靠。

### D4. 時區：使用瀏覽器內建的 `Intl`，不引入函式庫

- 時區清單：`Intl.supportedValuesOf('timeZone')`
- 預設值：`Intl.DateTimeFormat().resolvedOptions().timeZone`（瀏覽器目前時區）
- 當地日期：用 `Intl.DateTimeFormat('en-CA', { timeZone, year, month, day })` 格式化成 `YYYY-MM-DD` 當作分組鍵。夏令時間由 Intl 自動處理。
- 替代方案：date-fns-tz 或 Luxon。功能更多，但這裡只需要「UTC 時間 → 某時區的日期」，內建就夠了。

### D5. 分天與斷訊切段規則

1. 把所有點依時間排序；時間完全相同的點只保留第一個
2. 依當地日期分組，每個日期就是一天，依日期先後編號為 Day 1…N（中間沒有軌跡的日期不會產生空白的一天）
3. 每天內依序檢查相鄰兩點：**時間間隔 > 30 分鐘，或距離 > 5 公里**，就在兩點之間斷開，開始新的 segment
4. 只有 1 個點的 segment 保留在 GPX 中，但地圖與圖卡不畫（畫不出線條）
5. 距離：用 haversine 公式，只加總同一 segment 內相鄰點的距離，**斷開處的跳躍距離不計入**
6. 門檻值寫成具名常數，方便日後調整

跨日的軌跡（例如夜間活動）會在午夜被切成兩天，這是依日期分組的必然結果，可以接受。

### D6. 地圖：MapLibre GL，一個 GeoJSON source 加上依資料決定顏色

- 所有 segment 轉成一個 `FeatureCollection<LineString>`，每個 feature 帶有 `dayIndex` 屬性
- 同一個 source 上疊兩個 line layer：底層是較寬的深色外框，上層用 `['match', ['get', 'dayIndex'], ...]` 決定顏色（外框做法見 D11）。改時區時只要呼叫 `setData`
- 顏色：固定的 10 色色盤，依 Day 順序取色，超過 10 天就循環使用；色盤使用鮮豔色，不和介面粉彩色重複（D11）
- 資料更新後，用 `fitBounds` 縮放到所有點的範圍
- 替代方案：Leaflet。比較簡單，但點數多時效能較差，截圖匯出也需要額外套件（探索階段已討論過）

### D7. 底圖：抽成可替換的設定，實際選用哪一家由 spike 決定

- 底圖定義：`{ id, name, style | rasterTiles, attribution, exportable: boolean }`
- `exportable` 由 spike 實測決定（CORS 是否允許、授權是否允許出現在匯出圖片中）
- 候選：OSM 標準圖磚、國土測繪中心 NLSC、MapTiler、Stadia
- 如果選到需要 API key 的服務，key 會出現在前端程式碼中，要使用服務商提供的網域限制功能

### D8. 圖卡：離屏地圖 + 2D canvas 合成

尺寸：邏輯尺寸 1080×1080，輸出 2 倍，也就是 **2160×2160 px**。

```
┌──────────── 2160 × 2160 ────────────┐
│ 標題 / 日期範圍          （頁首）    │
├─────────────────────────────────────┤
│                                     │
│   地圖區域                           │
│   含底圖風格：離屏 MapLibre 截圖      │
│   極簡風格：自行投影後畫線            │
│                                     │
├─────────────────────────────────────┤
│ 天數 · 總距離 · 每天顏色圖例         │
│                       底圖授權標示   │
└─────────────────────────────────────┘
```

**含底圖風格：**
1. 建立一個不顯示在畫面上、固定尺寸的 div，建立新的 MapLibre 實例：`pixelRatio: 2`、`preserveDrawingBuffer: true`、不開互動、關閉內建的 attribution 控制項
2. 載入同樣的底圖與軌跡圖層，`fitBounds` 並加上邊距，等待 `idle` 事件（圖磚載入完成）
3. 用 `drawImage` 把地圖 canvas 畫到圖卡 canvas 上，再畫頁首、頁尾文字和授權標示
4. `canvas.toBlob()`，並用 `<a download>` 觸發下載，完成後銷毀離屏地圖
5. 如果 `toBlob` 拋出 `SecurityError`（canvas 被跨網域圖磚汙染），或等待 `idle` 超時，就顯示錯誤訊息並建議改用極簡風格

**極簡風格：**
- 不載入任何圖磚，自行把經緯度用 Web Mercator 投影到地圖區域，fit bounds 並保留邊距，用 2D canvas 畫線
- 不需要授權標示，也不會有 CORS 問題

**文字：**
- 繪製前用 `document.fonts.load()` 明確載入圖卡用到的字型（`document.fonts.ready` 不會載入頁面尚未使用的字型）；使用網站自帶的標題字型與中文字型，不依賴系統字型，確保中文標題在不同作業系統上顯示一致（見 D11）

- 替代方案：用 html2canvas 截取整個 DOM。它處理 WebGL canvas 和 CSS transform 的效果不穩定，排除。

### D9. GPX 匯出：用 DOM API 產生 XML

- 用 `document.implementation.createDocument` 建立 GPX 1.1 文件，再用 `XMLSerializer` 輸出，由瀏覽器處理跳脫字元，不手動拼接字串
- 結構：
  ```xml
  <gpx version="1.1" creator="GPX Track Merger" xmlns="http://www.topografix.com/GPX/1/1">
    <metadata><name>{標題}</name><time>{匯出時間}</time></metadata>
    <trk><name>Day 1 (2026-03-12)</name>
      <trkseg><trkpt lat lon><ele/><time/></trkpt>…</trkseg>
      <trkseg>…</trkseg>
    </trk>
    <trk><name>Day 2 (2026-03-13)</name>…</trk>
  </gpx>
  ```
- `<time>` 一律輸出 UTC ISO 8601；沒有高度資料的點不輸出 `<ele>`
- 檔名：`{標題或 trip}_{第一天日期}.gpx`，並移除檔名中不合法的字元

### D10. 模組劃分

```
src/
  core/            純函式，不碰 DOM，Vitest 測試
    parse.ts       GPX 文字 → TrackPoint[]
    grouping.ts    TrackPoint[] + 時區 → Day[]
    geo.ts         haversine、邊界範圍、Web Mercator 投影
    gpxWriter.ts   Day[] + 標題 → GPX XML 字串
  map/
    basemaps.ts    底圖定義
    mapView.ts     MapLibre 初始化與更新
  card/
    renderCard.ts  圖卡合成（兩種風格）
  ui/              上傳、檔案列表、時區、標題、按鈕
  state.ts         狀態與重新計算
  main.ts
```

`gpxWriter` 雖然用到 `DOMParser` 和 `XMLSerializer`，但在 Vitest 的 jsdom 環境中可以測試，所以仍放在 core。

### D11. 視覺風格：Claymorphism + Vibrant & Block-based

參考 UI UX Pro Max 的 Claymorphism 與 Vibrant & Block-based 風格，以及示範頁 https://uupm.cc/demo/educational-platform 。示範頁實際採用的是「圓角黏土外形 + Neo-brutalism 硬陰影」的混合風格，而不是柔和的模糊陰影。本專案採用示範頁的做法。

**Design tokens（取自示範頁 `.edu-platform` 的 CSS）：**

```css
--text:          #2d3748   /* 內文、邊框、硬陰影共用 */
--text-muted:    #64748b
--bg:            #ffffff
--bg-cream:      #fff9f5   /* 頁面底色 */
--primary:       #fdbcb4   /* 蜜桃 */
--secondary:     #add8e6   /* 淺藍 */
--accent-purple: #e6e6fa   /* 淡紫 */
--accent-mint:   #98ff98   /* 薄荷 */
--cta:           #22c55e
```

| 元件 | 樣式 |
|---|---|
| 卡片 `.clay-card` | `border: 3px solid var(--text)`、`border-radius: 24px`、`box-shadow: 6px 6px 0 var(--text), inset 0 -4px 0 #0000001a` |
| 次要卡片 `.soft-clay` | 無邊框、`border-radius: 24px`、`box-shadow: 0 8px 30px #00000014, inset 0 -4px 0 #0000000d` |
| 按鈕 `.btn-primary` / `.btn-secondary` | `border: 3px solid var(--text)`、`border-radius: 16px`、`box-shadow: 4px 4px 0 var(--text)`、字重 700；hover 時陰影縮為 `2px 2px`，並 `translate(2px, 2px)`，`transition: .15s` |
| 字型 | 標題 Fredoka、內文 Nunito，中文一律用 Chiron GoRound TC（見下方） |
| 間距 | 區塊間距 48px 以上，統計數字等重點資訊使用 32px 以上的大字 |

**版面：便當盒式排版**

```
┌─ bg-cream ────────────────────────────────────────────────┐
│ ╭─ 頁首：標誌 · 標題輸入框 · 時區選單 ─────────────────╮  │
│ ╰────────────────────────────────────────────────────╯▀ │
│ ╭─ 上傳區（蜜桃）─╮ ╭─ 地圖（最大的方塊）─────────────╮  │
│ ╰───────────────╯▀ │                                 │▌ │
│ ╭─ 檔案列表（白）─╮ │                                 │▌ │
│ ╰───────────────╯▀ ╰─────────────────────────────────╯▀ │
│ ╭─ 分天摘要（淡紫）╮ ╭─ 統計（淺藍）╮ ╭─ 匯出（薄荷）─╮  │
│ ╰───────────────╯▀ ╰─────────────╯▀ ╰──────────────╯▀ │
└───────────────────────────────────────────────────────────┘
```

- 窄螢幕（手機）時全部排成一欄，順序為：頁首 → 上傳區 → 地圖 → 檔案列表 → 分天摘要 → 統計 → 匯出
- 各區塊依功能固定使用一種粉彩底色，不隨資料改變

**兩層色彩系統：介面用粉彩，資料用鮮豔色**

粉彩色疊在底圖上幾乎看不見，不能拿來畫軌跡。因此把顏色分成兩層：

```
介面表面（卡片、區塊底色）  → Claymorphism 粉彩 token
資料（每天的軌跡色、圖例點） → Vibrant 鮮豔色的 10 色色盤（D6）
```

- D6 的 10 色色盤從鮮豔、高飽和的顏色中挑選，不使用 Vibrant 風格原本的螢光色（例如 `#39FF14`），因為螢光色和粉彩介面放在一起太刺眼。實際色值在實作 4.7 時決定，要能在選定底圖上和色盲模擬下分辨
- 地圖上的軌跡畫成兩層 line layer：底層是較粗的 `--text` 深色外框（casing），上層是當天的顏色。深色外框和卡片的 3px 邊框是同一種視覺語言，在任何底圖上都看得清楚，也讓色盲使用者多一層辨識線索
- 圖卡上的軌跡使用相同的外框畫法，確保和地圖一致

**無障礙**

- 示範頁的綠色按鈕是白字配 `#22c55e`，對比度約 2.3:1，不符合 WCAG AA 的 4.5:1。本專案的主要按鈕改用深色字 `--text` 配 `#22c55e`（約 5.2:1），或白字配較深的 `#15803d`（約 5.0:1）
- `--text-muted` 在白色與 `--bg-cream` 上約 4.6:1，勉強及格；但在淺藍或淡紫底色上只有約 3:1–3.8:1。**粉彩色區塊內的文字一律使用 `--text`**，`--text-muted` 只能用在白色或奶油色底上
- 可操作元件要有明顯的 `:focus-visible` 樣式，例如 3px `--text` 外框加上位移
- 遵守 `prefers-reduced-motion`：開啟時取消 hover 位移和 transition

**互動手感的使用範圍**

- 「按下去」的效果（陰影縮小並位移）只套用在按鈕、檔案移除鈕等可點擊的小元件
- 地圖、檔案列表等大區塊只保留靜態硬陰影，不做 hover 位移，避免滑鼠經過時整張地圖跟著抖動
- MapLibre 內建的縮放按鈕與授權標示要重新套樣式（圓角、3px 邊框、硬陰影），和其他元件保持一致

**字型與中文**

Fredoka 和 Nunito 都沒有中文字符。如果不另外指定中文字型，中文會退回系統字型，匯出的圖卡在不同作業系統上就會長得不一樣。

- **中文字型：Chiron GoRound TC**（圓體，OFL-1.1 授權）。它是 200–900 的可變字重，標題可以用真正的粗體，不必靠瀏覽器用演算法描粗
  - 替代方案：jf「粉圓」（Huninn）。外觀和 Fredoka 最像，但只有 400 一種字重。Claymorphism 的標題需要粗體，描粗後的圓體容易糊掉，所以排除
- **字型堆疊**：拉丁字母和數字交給 Fredoka／Nunito，Fredoka／Nunito 沒有的中文字，瀏覽器會逐字改用中文字型；canvas 的 `ctx.font` 也支援同樣的堆疊寫法
  ```css
  --font-heading: "Fredoka Variable", "Chiron GoRound TC Variable", sans-serif;
  --font-body:    "Nunito Variable", "Chiron GoRound TC Variable", sans-serif;
  ```
- **用 Fontsource 自行託管**：`@fontsource-variable/fredoka`、`@fontsource-variable/nunito`、`@fontsource-variable/chiron-goround-tc`，隨網站的靜態檔案一起部署
  - 中文字型和 Google Fonts 一樣切成約一百片，每片用 `unicode-range` 標註範圍、大小約數十 KB，瀏覽器只下載頁面用到的字所在的片段，不需要自己做 subset，也不必延後到產生圖卡時才載入
  - 圖卡要畫的標題是使用者當下輸入的，頁面上不一定已經出現過這些字，所以要用 `document.fonts.load('700 96px "Chiron GoRound TC Variable"', 標題)` 帶入文字，讓瀏覽器下載對應的片段
  - 字型不會汙染 canvas，跨網域字型本來就不會讓 `toBlob()` 拋出 `SecurityError`；選擇自行託管不是為了這個原因
- 替代方案：Google Fonts CDN。字型切片和下載量與 Fontsource 相同，但在中國大陸連不到，旅行地在當地時字型會退回系統字型；而且瀏覽器現在依網站分開快取，CDN 也沒有跨網站共用快取的好處。自行託管在設定上多一步，但沒有這些缺點
- 注意：選擇自行託管主要是為了可用性，而不是隱私。字型請求最多透露 IP 和標題中有哪些字，洩漏的資訊遠少於底圖圖磚（見 Risks）
- 付費網路字型服務（justfont、Adobe Fonts 等）常依頁面上已有的文字做子集化，或需要載入 JS kit；使用者當下輸入的標題和 canvas 繪字能不能正確取得字符，沒有驗證過，所以不採用

**圖卡套用同一套風格（補充 D8）**

圖卡是唯一會被分享到網站外的產出，所以也套用這套風格：

```
┌──────── 2160×2160 · 底色 --bg-cream ────────┐
│  標題（標題字型）                               │
│  日期範圍                                     │
│ ╭────────────────────────────────────────╮  │
│ │ 地圖區：邊框 6px + 圓角 48px              │▌ │  ← 2 倍解析度下，
│ │ 含底圖：地圖截圖；極簡：淺藍底色 + 軌跡     │▌ │    邊框與陰影數值也加倍
│ ╰────────────────────────────────────────╯▀ │
│  ╭ 5 天 ╮  ╭ 42.3 km ╮   ● Day1 ● Day2 …    │  ← 統計做成 pill 色塊
│                              底圖授權標示     │
└─────────────────────────────────────────────┘
```

- 圓角用 canvas 的 `roundRect()`；硬陰影先在偏移位置畫一個 `--text` 色的圓角矩形，再畫上層內容
- 極簡風格的地圖區使用 `--secondary` 淺藍底色，讓它不只是備案，也能單獨使用

**樣式實作方式：純 CSS + custom properties**

- token 集中在一個 CSS 檔（例如 `src/styles/tokens.css`），元件 class（`.clay-card`、`.soft-clay`、`.btn-primary`、`.btn-secondary`）放在另一個檔案
- 圖卡的 canvas 繪製需要同一組色值，所以把 token 同時匯出成 TypeScript 常數（例如 `src/styles/tokens.ts`），CSS 與 canvas 共用同一份來源，避免兩邊色值不同步
- 替代方案：Tailwind CSS（示範頁使用 Tailwind v4）。原子化 class 很方便，但本專案元件不到十個，而且 D1 決定不用 UI 框架，只為了樣式多加一套建置設定不划算

## Risks / Trade-offs

- **[候選底圖都不支援 CORS 或不允許匯出]** → 極簡風格一定能用；spike 列在任務最前面，底圖在實作地圖功能之前就先確定
- **[圖磚遲遲載不完，`idle` 一直沒觸發]** → 設定超時（例如 15 秒），超時後顯示錯誤並建議改用極簡風格
- **[大量軌跡點（數十萬點）造成畫面卡頓]** → MapLibre 用 WebGL 繪製，可以承受；如果實測仍會卡，再加上顯示用的簡化（Douglas-Peucker），匯出的 GPX 則保留原始點。第一版先不做
- **[同時用手機和手錶錄製，時間重疊]** → 依時間排序後，軌跡會在兩條路線之間來回跳動。第一版不處理，列為已知限制
- **[時區選錯導致分天錯誤]** → 地圖圖例和檔案列表會顯示每天的日期與點數，使用者可以立刻發現不對並換時區
- **[GPS 漂移造成距離偏高]** → 第一版不做平滑處理，接受誤差
- **[超過 10 天時顏色重複]** → 圖例上有標示 Day 編號，接受
- **[API key 暴露在前端]** → 使用服務商的網域限制；優先選擇不需要 key 的底圖
- **[底圖圖磚請求會透露使用者正在看的地區]** → 圖磚網址中的 z/x/y 對應地圖範圍，地圖縮放到軌跡時，圖磚服務商就能得知軌跡的大致地區（加上使用者的 IP）。軌跡座標本身仍然不會送出，但這和「軌跡資料不離開瀏覽器」的直覺不完全相同。處理方式：在頁面上用一句話說明「軌跡檔案不會上傳；顯示地圖時，底圖服務會得知你正在瀏覽的地區」；極簡風格的圖卡不發出任何圖磚請求。第一版不做「不載入底圖」的模式

## Migration Plan

新專案，不需要遷移。部署方式：`vite build` 產出靜態檔案，上傳到 GitHub Pages 或 Cloudflare Pages。回滾就是重新部署前一個版本。

## Open Questions

- ~~最終使用哪一家底圖？是否要讓使用者在多個底圖之間切換？（由 spike 結果決定）~~ → **已決定（spike 2.1–2.4, 2026-09-14）**：預設使用 OSM 標準圖磚（`tile.openstreetmap.org`，有 CORS header、可 canvas 匯出、免 key，授權 `© OpenStreetMap contributors`，需遵守 tile usage policy）。NLSC 標記為 `exportable: false`（圖磚無 CORS，匯出會 `SecurityError`）。MapTiler／Stadia 皆需 API key（前端暴露，需設網域限制），保留為日後選配。第一版不做底圖切換 UI。實作見 `src/map/basemaps.ts`。
- ~~圖卡的視覺風格細節（配色、字級），等第一版做出來再調整~~ → 已由 D11 決定整體風格；字級等細節仍在第一版做出來後微調
- ~~10 色軌跡色盤的實際色值~~ → **已決定（4.7）**：`src/styles/tokens.ts` 的 `TRACK_COLORS`（紅 `#E53935`、藍 `#1E88E5`、深青 `#00897B`、橘 `#FB8C00`、紫 `#8E24AA`、亮青 `#00ACC1`、桃紅 `#D81B60`、綠 `#43A047`、靛 `#5C6BC0`、棕 `#6D4C41`），皆為鮮豔高飽和色，與介面粉彩色（蜜桃／淺藍／淡紫／薄荷）無重複；地圖與圖卡另有 `--text` 深色外框輔助辨識。仍建議在實機上跑一次色盲模擬確認（見 9.6）。
- 字型 spike（2.5）結果：Fontsource 三個套件的實際 `font-family` 為 `"Fredoka Variable"`、`"Nunito Variable"`、`"Chiron GoRound TC Variable"`（與 D11 一致）；`vite build` 確認中文字型以 unicode-range 切片輸出、隨站託管（`dist/assets/chiron-goround-tc-*.woff2`），無 Google Fonts 請求；圖卡繪製前以 `document.fonts.load(..., 標題文字)` 載入對應片段（`src/card/renderCard.ts`）。
