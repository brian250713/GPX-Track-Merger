## Context

目前網站只處理 GPX：`upload.ts` 只收 `.gpx` → `AppState.addFiles` 解析並快取點 → `groupByDay` → `mapView.setDays` 畫線。整個網站沒有後端，也沒有使用瀏覽器儲存空間。

這個 change 要在同一張地圖上加上照片位置圖釘，範圍只到地圖顯示（見 proposal 的 Non-goals）。

限制條件：
- 照片是隱私資料：不上傳、不保留影像，讀完位置就丟掉檔案
- visual-style spec 規定字型不能從第三方服務載入；目前底圖 style（`basemaps.ts`）沒有設定 `glyphs`，所以不能直接用 MapLibre symbol layer 顯示數字
- MapLibre 的 GeoJSON 處理在 web worker 裡進行（見 README 關於 `setWorkerUrl` 的說明），cluster 計算也在 worker 內
- 照片可能一次上百張，不能讓 UI 卡住，也不能每讀一張就重畫整個畫面

## Goals / Non-Goals

**Goals:**
- EXIF 讀取與座標驗證寫成可單獨測試的純邏輯，放在 `core/`
- 照片狀態和 GPX 狀態分開，照片不進入分天、統計與匯出的管線
- 數字圈與圖釘不需要任何新的外部請求
- 沒有照片時，初始載入的 JS 大小不因這個功能明顯增加

**Non-Goals:**
- 圖卡與 GPX 匯出中的照片、縮圖、依天上色、用軌跡推算位置、逐張移除（同 proposal）
- 讀取 PNG、WebP、RAW 等其他格式的 EXIF
- 照片去重（重複加入同一張照片就算兩張，和 GPX 目前的行為一致）

## Decisions

### D1. 資料模型：照片和 GPX 分開存

```
AppState
 ├─ files[] + pointsCache      (GPX，既有)
 │     └─▶ mergeAndSort ─▶ groupByDay ─▶ days[]
 │
 └─ photos: PhotoPin[]          (新增，不經過分天)
    photoMissingCount: number
    photoPending: { done, total } | null

PhotoPin = { id, name, lat, lon, takenAt?: string }   // takenAt = "YYYY-MM-DDTHH:mm:ss"，沒有時區
```

- `takenAt` 存成**不含時區的字串**，不存 `Date`。EXIF 的 `DateTimeOriginal` 是相機的當地時間，沒有時區資訊；存成 `Date` 會被瀏覽器當成使用者電腦的時區，之後很容易被誤換算。popup 只把這個字串格式化成 `YYYY.MM.DD HH:mm`。
- 忽略 `OffsetTimeOriginal`：這個版本只顯示時間，不做依時區分天，所以用不到。
- `File` 物件只在讀取函式的區域變數中存在，讀完就不再被參照。狀態裡沒有任何 `File`、`Blob` 或 object URL（spec「不保留照片」）。
- 匯出按鈕是否可用仍然只看 `days.length`，不看照片。

替代方案：把照片當成一種 `FileEntry` 放在 `files[]`。這樣照片會混進檔案列表，也和「不逐張列出」的決定衝突，所以不採用。

### D2. EXIF 讀取：用套件，動態載入，包在一層自己的介面後面

```
core/photoMeta.ts
  readPhotoMeta(blob): Promise<{ lat, lon, takenAt? } | null>   ← 唯一碰到 EXIF 套件的地方
  normalizeGps(lat, lon): { lat, lon } | null                    ← 純函式：範圍檢查、(0,0) 視為無效
  parseExifDateTime(s): string | undefined                       ← "2026:03:12 14:05:33" → "2026-03-12T14:05:33"
  formatTakenAt(s): string                                       ← "2026.03.12 14:05"
```

- HEIC 是 ISOBMFF 容器格式，自己寫解析的成本太高，所以用套件。候選是 `exifr` 與 `exifreader`：`exifr` 可以只讀需要的 tag、分段讀檔，但 npm 上最後發布是 2022 年；`exifreader` 有持續維護，但要確認只讀部分 tag 時的大小。**第一個任務會實際比較兩者**（打包後大小、HEIC 支援、能否只讀檔頭），結果寫回這裡。
- **Spike 1.1 結果（2026-09-15）：選定 `exifreader@^4.45.0`**。`exifr@7.1.3` 最後發布 2022-05-01（超過 4 年未維護，unpack ~1.29MB），雖支援 HEIC 且可只讀 GPS tag、分段讀檔，但維護風險高。`exifreader@4.45.0` 發布於 2026-09-10（維護自 2012 年起持續，0 dependencies，內建 TS 型別，unpack ~1.2MB），支援 JPEG/HEIC（含 GPS 與 `DateTimeOriginal`），`expanded: true` 時直接給出正負號處理好的 `gps.Latitude/Longitude`（南緯/西經為負），`length` 選項可只讀檔頭（HEIC 的 metadata box 若在檔尾則自動追加讀取），另支援 custom build（只留 JPEG+HEIC+Exif 可壓到約 9 KiB Brotli，日後可再瘦身）。注意 CVE-2026-53496（HEIC truncated box RangeError）已在 4.40.1 修復，本專案使用 4.45.0 且 `readPhotoMeta` 全面包 try/catch 回傳 `null`。用法：`import('exifreader')` 動態載入後 `ExifReader.load(arrayBuffer, { expanded: true })`，讀 `tags.gps.{Latitude,Longitude}` 與 `tags.exif.DateTimeOriginal.description`（格式 `2026:03:12 14:05:33`）。
- 只要求 GPS 與 `DateTimeOriginal` 兩組 tag，**不解碼影像**、不取內嵌縮圖。
- 用 `import()` 動態載入：第一次加入照片時才下載這個 chunk。只用 GPX 的使用者不受影響。chunk 從本站載入，不增加第三方請求。
- 其他模組只依賴 `readPhotoMeta`，之後要換套件只改這一個檔案。
- 讀檔失敗、EXIF 格式錯誤一律回傳 `null`，計入「沒有位置」，不丟例外。

### D3. 上傳分流：依副檔名分類的純函式

`classifyFile(name): 'gpx' | 'photo' | 'unsupported'`，副檔名不分大小寫：`.gpx` → gpx，`.jpg/.jpeg/.heic/.heif` → photo。

- `upload.ts` 的選擇檔案與拖放都走同一個分類；`<input accept>` 改為 `.gpx,.jpg,.jpeg,.heic,.heif`。
- 有 `unsupported` 檔案時顯示「只接受 .gpx 與 JPEG／HEIC 照片」。**注意**：現有 gpx-import spec 要求拒絕時顯示提示，但目前 `upload.ts` 只是默默過濾、沒有提示。這次一併補上。
- 用副檔名而不是 MIME type：Windows 上 HEIC 的 `file.type` 常常是空字串，副檔名比較可靠。
- `AppState` 新增 `addPhotos(files)`，保留既有的 `addFiles` 只處理 GPX；由 upload 分流後各自呼叫。

### D4. 批次讀取：限制並行數、分批更新、可以被「清除照片」中止

```
addPhotos(300 files)
  generation = ++photoGeneration
  photoPending = { done: 0, total: 300 }  → emit（摘要顯示讀取中）
  以並行數 4 讀取
    每完成 25 張或每 250ms：更新 done → emit（只更新摘要文字）
  全部完成：
    if generation !== photoGeneration → 丟棄結果（期間按了清除照片）
    photos.push(...), photoMissingCount += 缺少位置的數量
    photoPending = null → emit（地圖一次更新圖釘並重新縮放）
```

- 圖釘在整批讀完後一次加到地圖，避免讀取期間地圖一直跳動、重算 cluster。
- 用 generation 計數器處理「讀取中按了清除照片」：舊批次的結果直接丟掉，不會在清除後又冒出圖釘。
- 讀取中又加入新的一批：兩批各自完成、各自合併進 `photos`，`photoPending` 累加 `total`。

### D5. 數字圈：GeoJSON cluster 算位置，HTML Marker 畫外觀

```
source "photos"  (geojson, cluster: true)
   │  cluster 計算在 MapLibre worker
   ├─ layer "photos-hit" (circle, opacity 0)   ← 讓 source 被載入、可以查詢
   │
   └─ 'sourcedata' / 'moveend' 時
        querySourceFeatures("photos")
          → 依 cluster_id 或 photo id 去重（同一個 feature 可能出現在多個 tile）
          → 和目前畫面上的 marker 比對：新增缺少的、移除不在畫面上的、保留已存在的
          → cluster  → <button class="photo-cluster">12</button>
            單張照片 → <button class="photo-pin"></button>
```

- **為什麼用 HTML Marker**：symbol layer 顯示數字需要 `glyphs`（字型 PBF 網址）。從第三方載入違反 visual-style 的自行託管字型規定，也會多一個外部請求。自行託管 glyph PBF 則要另外產生 Fredoka 的 PBF 並處理中文字型，成本不划算。HTML 元素可以直接使用網站已載入的 Fredoka、套用既有的 clay CSS，本身也是 `<button>`，符合鍵盤焦點的要求。
- 替代方案：自己在主執行緒用 supercluster。可行，但 MapLibre 已經內建，而且 cluster 計算放在 worker 裡，不會卡住主執行緒。
- 畫面上 marker 數量受 cluster 限制，數量有上限。更新時做差異比對，不整批重建，避免閃爍和焦點遺失。
- HTML Marker 固定疊在 canvas 上方，自然在軌跡線上面（spec「顯示在軌跡線上方」）。
- source 與 layer 的建立沿用 `mapView.ts` 既有的 `syncNow` 模式：只等 style JSON 解析完成，不等圖磚載入（避免 README 提到的「圖磚卡住導致資料永遠不顯示」問題）。

### D6. 點數字圈與同一位置的多張照片

- 點數字圈：`getClusterExpansionZoom(clusterId)`，如果結果小於等於地圖可用的最大縮放層級，就 `easeTo` 到該層級並以數字圈為中心。
- `clusterMaxZoom` 設為地圖可用的最大縮放層級，讓座標完全相同的照片在最大層級時**仍然維持數字圈**，不會變成完全重疊、點不到下面那張的圖釘。MapLibre 要求 `clusterMaxZoom` 小於 source 的 `maxzoom`，實作時兩者要一起設定。
- 已經無法再放大時（展開層級超過最大值），改用 `getClusterLeaves` 取出照片，顯示依拍攝時間排序的清單 popup。清單最多列 50 張，超過時顯示「還有 N 張」。
- `prefers-reduced-motion: reduce` 時 `easeTo` 的 duration 設為 0。

### D7. Popup：純文字 DOM，套用 clay 風格

- 用 `Popup.setDOMContent`，檔名以 `textContent` 設定，**不用 `setHTML`**，避免檔名中的 HTML 被執行（spec「檔名含 HTML 字元」）。
- popup 外框套用 `--text` 邊框、圓角與硬陰影，和既有地圖控制項的樣式一致。

### D8. 圖釘與數字圈的外觀

- 共用：白底（`--bg`）、3px `--text` 邊框、小的硬陰影、`:focus-visible` 外框沿用網站既有的焦點樣式。
- 單一圖釘：小圓點（約 18px），不用軌跡色盤中的任何顏色。
- 數字圈：Fredoka 粗體數字，依張數分三級大小（<10、<100、≥100），999 以上顯示 `999+`。
- 無障礙名稱：數字圈 `aria-label="12 張照片"`；單一圖釘 `aria-label="照片 IMG_0421.jpg"`。
- 樣式寫在 `components.css`，色值使用 CSS custom properties，不寫死。

### D9. 地圖更新時機與自動縮放

- `MapView` 介面從 `setDays(days)` 改為 `setContent(days, photos)`，一次呼叫只做一次 `fitBounds`，避免軌跡和照片各縮放一次造成兩段動畫。
- 縮放範圍：所有軌跡點與所有照片座標的聯集，沿用 `computeBounds`（照片轉成 `{ lat, lon }` 一起傳入）。
- **只有在 `days` 或 `photos` 陣列真的換了才重新縮放**。目前 `main.ts` 在每次 emit 時都呼叫 `setDays`，包含輸入標題、切換圖卡風格，會把使用者手動平移的地圖拉回來。加入照片後 emit 次數變多（讀取進度），這個問題會更明顯，所以改成比對參照：狀態在內容改變時一律換成新陣列。
- 地圖提示文字：沒有軌跡也沒有照片 →「上傳 GPX 或照片開始」；只有照片 →「8 張照片」；都有 →「3 天 · 42.3 km · 8 張照片」。

### D10. 照片摘要元件

- 新增 `ui/photoSummary.ts`，放在檔案區塊內、檔案列表下方（獨立的容器，不併入 `fileList.ts`）。
- 沒加入過照片時不顯示；讀取中顯示「讀取照片中… 120／300」；完成後顯示「照片 N 張有位置 · M 張沒有位置」與「清除照片」按鈕。
- 按下「清除照片」後，按鈕會被移除，焦點移到檔案區塊容器上，和 d2be917 移除最後一個檔案時的做法一致。

## Risks / Trade-offs

- **[手機相片選擇器移除位置資訊]** iOS Safari 與 Android 13+ 的系統相片選擇器，在網頁選取照片時可能會把 GPS 拿掉，導致「全部沒有位置」。→ 實作前先做實機 spike（tasks 第 1 組）。如果確認會被移除，在「有位置為 0 張」時於照片摘要加上說明文字（這會是 spec 的補充，屆時再修改 spec）。
  - Spike 1.2（2026-09-15，文獻研究，無實機）：ExifReader 官方文件 GPS 章節與 issue #378 明確指出：`<input type="file" accept="image/*">` 會導致 Android（及部分 iOS）瀏覽器在回傳前剝離 GPS。本專案 `accept` 使用副檔名寫法（`.gpx,.jpg,.jpeg,.heic,.heif`）而非 `image/*`，可避開此陷阱。iOS「相簿」直接選取仍可能因系統隱私設定移除位置（使用者需在分享時選「保留位置」）；「檔案」App 選取一般會保留。實機（iOS Safari／Android Chrome × 相簿／檔案）驗證列為 8.1 手動驗收的一部分；若實測確認相簿路徑必去 GPS，再補 spec（0 張有位置時的說明文字）與 `accept` 寫法調整。
- **[EXIF 套件維護狀況]** `exifr` 很久沒有發布新版。→ 用 D2 的包裝層隔離；比較時把維護狀況列入考量。
- **[HEIC 的 EXIF 可能不在檔案開頭]** 有些 HEIC 的 metadata box 位置比較後面，只讀檔頭可能讀不到。→ 比較套件時用真實 iPhone HEIC 測試，必要時允許讀取較大的範圍。
- **[`querySourceFeatures` 只回傳已載入 tile 內的 feature]** 圖磚或 worker 慢的時候，數字圈可能晚一點才出現；同一個 feature 可能在多個 tile 重複出現。→ 在 `sourcedata`（source 載入完成）與 `moveend` 時都重新同步，並依 id 去重。
  - Spike 1.3（2026-09-15，程式碼驗證）：GeoJSON cluster 計算在 MapLibre worker 內（`maplibre-gl-worker.mjs`，已由 `main.ts` 經 `setWorkerUrl` 指定，track source 既有用法證明該路徑可用；cluster 用同一 worker，不需額外設定）。`photos` source 設定為 `cluster: true, clusterRadius: 50, clusterMaxZoom: 21, maxzoom: 22`（MapLibre 要求 `clusterMaxZoom < maxzoom`，source `maxzoom` 預設 18 故必須顯式設為 22；21/22 組合讓座標完全相同的照片在最大縮放仍維持數字圈，走 `getClusterLeaves` 清單 popup）。同步時機：`sourcedata`（檢查 `sourceId === 'photos' && sourceDataType === 'content'`）與 `moveend`，`querySourceFeatures('photos')` 後依 `cluster_id`／photo id 去重（跨 tile 重複）。
- **[大量照片時的讀取時間]** 300 張 HEIC 在低階手機上可能要數秒到數十秒。→ 限制並行數、顯示進度；不解碼影像，只讀 metadata。
- **[檔名可能含個人資訊]** 檔名只保留在記憶體中顯示在 popup，不離開瀏覽器，重新整理即消失。
- **[`exifr`／`exifreader` 在 jsdom 中的行為]** 測試環境可能無法完整模擬 `Blob.slice`／`arrayBuffer`。→ EXIF 套件本身用真實照片 fixture 做少量整合測試，其他邏輯（驗證、時間格式、分類、狀態）用純函式與假資料測試。

## Migration Plan

- 純前端靜態網站，推送到 `main` 後由既有的 GitHub Actions 部署，沒有資料遷移。
- 回復方式：revert 這個 change 的 commits 重新部署即可。狀態不會被保存，所以沒有相容性問題。
- 完成後更新 README 的功能說明、隱私說明與「注意事項」（HTML Marker 取代 symbol layer 的原因）。

## Open Questions

- EXIF 套件選 `exifr` 還是 `exifreader`？（tasks 1.1 決定，結果寫回 D2）
  - 已決定：`exifreader@^4.45.0`（見 D2）。
- 手機上選取照片是否會移除 GPS？iOS Safari、Android Chrome 分別是什麼結果？（tasks 1.2）
  - 文獻結論見 Risks；實機數據待 8.1 驗收時填寫。
- `clusterRadius` 與數字圈大小的實際數值，需要在畫面上用真實照片分布調整
  - 初值 `clusterRadius: 50`（MapLibre 預設），數字圈三級大小見 D8；8.1 驗收時微調。
- 如果手機確實會移除 GPS，是否要改變 `<input accept>` 的寫法（例如不列出 image MIME，讓系統改開「檔案」而不是「相簿」）來保留位置資訊？
