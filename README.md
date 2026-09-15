# GPX 旅行軌跡合併

把旅行中分散在多個 GPX 檔的軌跡合併成一趟旅行，依當地日期分天，在地圖上顯示，並匯出合併後的 GPX 與可分享的圖卡。

**網站：** https://brian250713.github.io/GPX-Track-Merger/

純前端靜態網站，GPX 檔案只在瀏覽器內處理，**不會上傳到任何伺服器**。唯一的外部請求是底圖圖磚（圖磚服務會得知你正在瀏覽的地區）。

## 功能

- **上傳多個 GPX**：選擇檔案或拖放，支援 `<trk>` 與 `<rte>`；沒有時間的點會略過，無法解析的檔案會標示錯誤
- **依時區分天**：選擇時區後，依當地日期把所有軌跡點分成 Day 1…N，換時區立即重算
- **斷訊切段**：相鄰兩點間隔超過 30 分鐘或距離超過 5 公里（例如搭車、飛機）時斷開，不畫連線，也不計入距離
- **地圖顯示**：MapLibre GL + OpenStreetMap 底圖，每天一個顏色，自動縮放到軌跡範圍
- **分天摘要與統計**：每天與整趟的距離、天數
- **匯出 GPX**：GPX 1.1，每天一個 `<trk>`，每段一個 `<trkseg>`
- **下載圖卡**：2160×2160 PNG，可編輯標題，含日期範圍、天數、總距離與每天顏色圖例；有「含底圖」與「極簡」兩種風格

## 使用方式

1. 上傳一個或多個 `.gpx` 檔
2. 確認頁首的時區（預設為瀏覽器時區）
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
  core/        純函式，不依賴 DOM 或地圖（解析、分天、距離、GPX 產生）
  map/         底圖定義與 MapLibre 地圖
  card/        圖卡合成（含底圖／極簡）
  ui/          上傳、檔案列表、時區、摘要、匯出控制項
  styles/      設計 token 與元件樣式
  state.ts     應用狀態與重新計算
  main.ts      進入點
tests/         Vitest 測試與 GPX fixtures
openspec/      需求規格（specs）與已歸檔的變更紀錄
```

### 測試用的真實 GPX

可以把自己的 GPX 放在 `tests/gpx/`，`tests/repro-user-gpx.test.ts` 會自動解析並檢查每一天都有可繪製的軌跡。這個資料夾已加入 `.gitignore`（含位置紀錄，不要提交）。

### 注意事項

- MapLibre 6 的 web worker 預設從自身模組旁邊載入，經 Vite 打包後會找不到，導致 GeoJSON 軌跡不顯示。`src/main.ts` 以 `?worker&url` 匯入 worker 並呼叫 `setWorkerUrl()` 解決，升級 MapLibre 或調整建置設定時請留意。
- 國土測繪中心 NLSC 圖磚沒有 CORS 標頭，無法用於含底圖圖卡；OSM 標準圖磚可以。

## 部署

推送到 `main` 後，GitHub Actions（`.github/workflows/deploy.yml`）會建置、測試並部署到 GitHub Pages。`vite.config.ts` 使用 `base: './'`，可部署在任何子路徑。

## 授權

地圖資料 © [OpenStreetMap](https://www.openstreetmap.org/copyright) contributors。使用 OSM 圖磚請遵守其[圖磚使用政策](https://operations.osmfoundation.org/policies/tiles/)。
