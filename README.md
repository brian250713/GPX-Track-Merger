# GPX 旅行軌跡合併

把旅行中分散在多個 GPX 檔的軌跡合併成一趟旅行，依當地日期分天，在地圖上顯示，並匯出合併後的 GPX 與可分享的圖卡。

**網站：** https://brian250713.github.io/GPX-Track-Merger/

純前端靜態網站，GPX 檔案與照片只在瀏覽器內處理，**不會上傳到任何伺服器**。照片只讀取位置與拍攝時間、不會保留（不存檔、不產生縮圖、重新整理即消失）。唯一的外部請求是底圖圖磚（圖磚服務會得知你正在瀏覽的地區）。

## 功能

- **上傳多個 GPX**：選擇檔案或拖放，支援 `<trk>` 與 `<rte>`；沒有時間的點會略過，無法解析的檔案會標示錯誤
- **照片位置圖釘**：同一個上傳區也接受 JPEG（`.jpg`／`.jpeg`）與 HEIC（`.heic`／`.heif`）照片，在瀏覽器內讀取 EXIF 的 GPS 與拍攝時間後顯示為地圖圖釘；照片密集時合併成數字圈，點數字圈放大、點圖釘顯示檔名與拍攝時間；沒有位置的照片只計數、不顯示；檔案區塊可一鍵清除照片（不影響軌跡）
- **依時區分天**：選擇時區後，依當地日期把所有軌跡點分成 Day 1…N，換時區立即重算
- **斷訊切段**：相鄰兩點間隔超過 30 分鐘或距離超過 5 公里（例如搭車、飛機）時斷開，不畫連線，也不計入距離
- **地圖顯示**：MapLibre GL + OpenStreetMap 底圖，每天一個顏色，自動縮放到涵蓋軌跡與照片圖釘的範圍
- **分天摘要與統計**：每天與整趟的距離、天數；點開任一天可展開該天的高度剖面（里程–高度曲線，標出最高與最低高度），斷訊切段處不連線，該天沒有高度資料時顯示說明文字
- **匯出 GPX**：GPX 1.1，每天一個 `<trk>`，每段一個 `<trkseg>`
- **下載圖卡**：2160×2160 PNG，可編輯標題，含日期範圍、天數、總距離與每天顏色圖例（標籤為該天的月/日，例如 `3/12`）；有「含底圖」與「極簡」兩種風格

## 使用方式

1. 上傳一個或多個 `.gpx` 檔（可同時拖放 JPEG／HEIC 照片顯示拍攝位置）
2. 確認頁首的時區（預設為瀏覽器時區；照片的拍攝時間顯示相機當地時間，不受時區影響）
3. 在地圖與分天摘要確認結果，可移除不需要的檔案
4. 輸入標題，按「匯出 GPX」或「下載圖卡」

## 開發

需要 Node.js 22 以上。

```bash
npm install
```

```bash
npm run dev
```

```bash
npm test
```

```bash
npm run build
```

| 指令 | 說明 |
|---|---|
| `npm run dev` | 啟動 Vite 開發伺服器 |
| `npm test` | 執行 Vitest 測試（jsdom） |
| `npm run build` | 型別檢查並建置到 `dist/` |
| `npm run preview` | 預覽建置結果 |

### 專案結構

```
src/
  core/        純函式，不依賴 DOM 或地圖（解析、分天、距離、高度剖面、GPX 產生）
  map/         底圖定義與 MapLibre 地圖
  card/        圖卡合成（含底圖／極簡）
  ui/          上傳、檔案列表、時區、摘要與高度剖面圖、匯出控制項
  styles/      設計 token 與元件樣式
  state.ts     應用狀態與重新計算
  main.ts      進入點
tests/         Vitest 測試與 GPX fixtures
openspec/      需求規格（specs）與已歸檔的變更紀錄
```

### 測試用的真實 GPX

可以把自己的 GPX 放在 `tests/gpx/`，`tests/repro-user-gpx.test.ts` 會自動解析並檢查每一天都有可繪製的軌跡。這個資料夾已加入 `.gitignore`（含位置紀錄，不要提交）。

### 測試用的真實照片

可以把自己的照片放在 `tests/photos/`（已加入 `.gitignore`，不要提交），用開發伺服器實際上傳驗證 GPS 讀取、數字圈與 popup。`tests/fixtures/photos/` 內的合成測試圖不含真實位置，可提交。

### 注意事項

- MapLibre 6 的 web worker 預設從自身模組旁邊載入，經 Vite 打包後會找不到，導致 GeoJSON 軌跡不顯示。`src/main.ts` 以 `?worker&url` 匯入 worker 並呼叫 `setWorkerUrl()` 解決，升級 MapLibre 或調整建置設定時請留意。
- 國土測繪中心 NLSC 圖磚沒有 CORS 標頭，無法用於含底圖圖卡；OSM 標準圖磚可以。
- 照片圖釘與數字圈使用 HTML Marker（`<button>`）而非 symbol layer：symbol layer 顯示數字需要外部地圖字型（glyphs），會違反自行託管字型的規定並增加外部請求；HTML 元素可直接使用網站字型與 clay 樣式，且天然支援鍵盤焦點。數字圈的合併計算仍由 MapLibre GeoJSON cluster 在 worker 內完成（`cluster: true`，`clusterMaxZoom: 21`／source `maxzoom: 22`）。
- EXIF 讀取使用 `exifreader`（`import()` 動態載入，只在第一次加入照片時下載該 chunk；只用 GPX 的使用者不受影響）。選型理由：持續維護（`exifr` 自 2022 年後未發布）、支援 JPEG／HEIC、內建型別。注意 `<input accept>` 必須使用副檔名寫法而非 `image/*`，否則部分手機瀏覽器會在回傳前剝離照片 GPS。
- 手機瀏覽器從系統相簿選取照片時，可能因隱私設定移除位置資訊（需在分享時選擇保留位置）；從「檔案」App 選取一般會保留。若全部照片都沒有位置，請先確認這一點。

## 部署

推送到 `main` 後，GitHub Actions（`.github/workflows/deploy.yml`）會建置、測試並部署到 GitHub Pages。`vite.config.ts` 使用 `base: './'`，可部署在任何子路徑。

## 授權

地圖資料 © [OpenStreetMap](https://www.openstreetmap.org/copyright) contributors。使用 OSM 圖磚請遵守其[圖磚使用政策](https://operations.osmfoundation.org/policies/tiles/)。
