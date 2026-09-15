## 1. Spike（先做，結果決定 D2 與 Open Questions）

- [x] 1.1 比較 `exifr` 與 `exifreader`：用一張有 GPS 的 JPEG 和一張 iPhone HEIC，確認兩者都能讀出 GPS 與 `DateTimeOriginal`；比較只讀這兩組 tag 時的打包大小（`vite build` 後的 chunk 大小）、是否能只讀檔頭、最後發布日期。選定一個，把結果寫回 design.md D2
- [x] 1.2 手機實測：分別在 iOS Safari 與 Android Chrome 上，從相簿與「檔案」各選一張有位置的照片，記錄能不能讀到 GPS；也試試 `accept` 屬性寫法不同時的差異。結果寫回 design.md 的 Risks 與 Open Questions，需要時提出 spec 補充
- [x] 1.3 確認 MapLibre GeoJSON cluster 在目前的 worker 設定（`setWorkerUrl`）下可以運作：做一個最小範例，用 `querySourceFeatures` 取得 cluster，並確認 `clusterMaxZoom` 與 source `maxzoom` 的限制

## 2. 核心邏輯：分類與照片 metadata

- [x] 2.1 實作 `classifyFile(name)`：`.gpx` → gpx、`.jpg/.jpeg/.heic/.heif` → photo、其他 → unsupported，副檔名不分大小寫，並撰寫測試
- [x] 2.2 實作 `normalizeGps(lat, lon)`：緯度 ±90、經度 ±180 範圍檢查，(0, 0) 視為無效，並撰寫測試（含南緯、西經）
- [x] 2.3 實作 `parseExifDateTime` 與 `formatTakenAt`：`2026:03:12 14:05:33` → `2026-03-12T14:05:33` → `2026.03.12 14:05`；空值、`0000:00:00 00:00:00` 與格式錯誤回傳 undefined，並撰寫測試
- [x] 2.4 安裝 1.1 選定的套件，實作 `core/photoMeta.ts` 的 `readPhotoMeta(blob)`：以 `import()` 動態載入套件，只讀 GPS 與 `DateTimeOriginal`，不解碼影像；任何錯誤回傳 `null`
- [x] 2.5 準備照片 fixtures 放在 `tests/fixtures/photos/`：有 GPS 的 JPEG、有 GPS 的 HEIC、沒有 GPS、南西半球、座標 (0,0)、沒有拍攝時間、損壞的檔案（只放自己產生、不含真實位置隱私的測試圖；真實照片比照 `tests/gpx/` 加入 `.gitignore`）
- [x] 2.6 用 fixtures 為 photo-pins spec「讀取照片位置與拍攝時間」與「沒有位置的照片」的 scenario 撰寫測試

## 3. 應用狀態

- [x] 3.1 在 `AppState` 新增 `photos: PhotoPin[]`、`photoMissingCount`、`photoPending`，`PhotoPin` 只含 `id, name, lat, lon, takenAt?`
- [x] 3.2 實作 `addPhotos(files)`：並行數 4、分批更新進度、整批完成後一次換成新的 `photos` 陣列並 emit（design D4）
- [x] 3.3 實作 `clearPhotos()`：清空照片、計數與進度，遞增 generation 使讀取中的批次結果被丟棄
- [x] 3.4 撰寫狀態測試：處理完成後狀態中沒有 `File`／`Blob`／object URL；分兩次加入時計數累加；讀取中清除照片後不會再出現圖釘；清除照片不影響 `files`、`days`；只有照片時 `days` 為空

## 4. 上傳分流（gpx-import）

- [x] 4.1 修改 `upload.ts`：選擇檔案與拖放都用 `classifyFile` 分流，GPX 呼叫 `addFiles`、照片呼叫 `addPhotos`；`accept` 改為 `.gpx,.jpg,.jpeg,.heic,.heif`；dropzone 的文字與 `aria-label` 改為涵蓋照片
- [x] 4.2 補上不支援副檔名的提示「只接受 .gpx 與 JPEG／HEIC 照片」（目前的程式沒有實作既有 spec 要求的提示）
- [x] 4.3 更新隱私說明文字為 gpx-import spec 的新版本
- [x] 4.4 撰寫測試：混合 GPX 與照片的分流、`.JPG` 大寫副檔名、`.png` 顯示提示、`accept` 屬性內容

## 5. 地圖：照片圖釘與數字圈（photo-pins、track-map-view）

- [x] 5.1 把 `MapView.setDays(days)` 改成 `setContent(days, photos)`，只在 `days` 或 `photos` 參照改變時重新縮放；範圍取軌跡點與照片座標的聯集
- [x] 5.2 在 `ensureLayers` 中加入 `photos` GeoJSON source（`cluster: true`，依 1.3 的結果設定 `clusterRadius`、`clusterMaxZoom`、`maxzoom`）與透明的 `photos-hit` circle layer
- [x] 5.3 實作 HTML Marker 同步：在 `sourcedata`（photos source 載入完成）與 `moveend` 時 `querySourceFeatures`，依 cluster_id／photo id 去重，差異更新 marker（新增、移除、保留），不整批重建
- [x] 5.4 數字圈與圖釘為 `<button>`，設定 `aria-label`（「12 張照片」、「照片 檔名」），Enter／空白鍵與點擊行為相同
- [x] 5.5 點數字圈：`getClusterExpansionZoom` 後 `easeTo` 放大置中；無法再放大時用 `getClusterLeaves` 顯示依拍攝時間排序的清單 popup（最多 50 張、超過顯示「還有 N 張」）；`prefers-reduced-motion` 時不做動畫
- [x] 5.6 點單一圖釘：`Popup.setDOMContent` 顯示檔名（`textContent`）與 `formatTakenAt` 的結果，沒有時間時顯示「沒有拍攝時間」
- [x] 5.7 更新 `main.ts`：訂閱時呼叫 `setContent`，地圖提示依 track-map-view spec 顯示「上傳 GPX 或照片開始」／「8 張照片」／「3 天 · 42.3 km · 8 張照片」
- [x] 5.8 撰寫測試：`setContent` 在只改標題時不重新縮放；bounds 聯集計算；popup 檔名含 HTML 字元時以純文字顯示；提示文字三種狀態

## 6. 照片摘要 UI

- [x] 6.1 新增 `ui/photoSummary.ts`，掛在檔案區塊內、檔案列表下方：沒有照片時不顯示、讀取中顯示「讀取照片中… x／y」、完成後顯示「照片 N 張有位置 · M 張沒有位置」與「清除照片」按鈕
- [x] 6.2 按下「清除照片」後，焦點移到檔案區塊容器
- [x] 6.3 為 photo-pins spec「照片摘要與清除照片」的 scenario 撰寫測試

## 7. 樣式（visual-style）

- [x] 7.1 在 `components.css` 新增 `.photo-pin`、`.photo-cluster`：白底、3px `--text` 邊框、硬陰影、Fredoka 數字、依張數三級大小、`999+`；焦點外框沿用既有樣式
- [x] 7.2 套用 clay 風格到 MapLibre popup（邊框、圓角、硬陰影、關閉按鈕的焦點樣式），並確認文字對比度符合 WCAG AA
- [x] 7.3 照片摘要的文字與「清除照片」按鈕套用既有的按鈕樣式與按壓回饋

## 8. 驗證與文件

- [x] 8.1 在開發伺服器實際操作：混合上傳 GPX 與照片、縮小看到數字圈、點數字圈放大、同一位置多張照片的清單、鍵盤操作、清除照片、只有照片時匯出按鈕停用
- [x] 8.2 網路隱私檢查：上傳 20 張照片並操作圖釘與數字圈，確認網路請求只有底圖圖磚與本站靜態資源（含動態載入的 EXIF chunk），沒有 glyphs 或第三方字型請求
- [x] 8.3 窄螢幕（400px）確認照片摘要、數字圈、popup 不造成水平捲動
- [x] 8.4 效能檢查：一次加入 300 張照片時頁面保持可操作、進度正常更新；確認只用 GPX 時初始 JS 大小沒有明顯增加
- [x] 8.5 確認匯出的 GPX 與圖卡不含照片資訊
- [x] 8.6 更新 README：功能列表、使用方式、隱私說明、注意事項（HTML Marker 取代 symbol layer 的原因、EXIF 套件動態載入）
- [x] 8.7 執行 `npm test` 與 `npm run build` 全部通過
