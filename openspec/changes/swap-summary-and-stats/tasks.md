## 1. 版面對調

- [ ] 1.1 在 `src/styles/components.css` 把寬螢幕的 `grid-template-areas` 由 `"summary stats"` 改為 `"stats summary"`。驗證：`tests/tokens.test.ts` 風格的 CSS 文字斷言，讀取 `components.css` 並斷言包含 `"stats summary"`、不再包含 `"summary stats"`
- [ ] 1.2 把 `max-width: 800px` 內的單欄 `grid-template-areas` 順序由 `"summary" "stats"` 改為 `"stats" "summary"`。驗證：同一份 CSS 測試斷言窄螢幕字串中 `"stats"` 出現在 `"summary"` 之前，且七個區塊一個不少
- [ ] 1.3 在 `src/main.ts` 的 `#app` 樣板中，把 `area-stats` 的 `<section>` 移到 `area-summary` 之前。驗證：測試掛載樣板後，以 `compareDocumentPosition` 斷言 `statsBox` 在文件中早於 `summaryBox`，對應 `specs/visual-style/spec.md` 的「閱讀順序與視覺順序一致」情境
- [ ] 1.4 確認兩個區塊的底色未隨位置改變。驗證：斷言 `.area-summary` 仍為 `--accent-purple`、`.area-stats` 仍為 `--secondary`，`visual-style` 的「粉彩區塊內的文字」情境不受影響

## 2. 剖面圖寬度上限

- [ ] 2.1 在 `src/styles/components.css` 的 `.elevation-container svg` 加上 `max-width: 420px`，取代原本的 `max-width: 100%`。驗證：CSS 測試斷言該規則含 `max-width: 420px`，對應 `specs/elevation-profile/spec.md` 的「寬容器」情境
- [ ] 2.2 確認 `src/ui/elevationProfile.ts` 的 `W`、`H` 與所有座標計算未改動。驗證：`tests/elevationProfile.test.ts` 全數通過且未修改任何斷言
- [ ] 2.3 手動確認窄螢幕上限不生效。驗證：以 400px 視窗展開任一天，剖面圖仍撐滿容器寬度、沒有水平捲軸，對應「窄容器」情境

## 3. 展開區塊並排排版

- [ ] 3.1 在 `src/ui/summary.ts` 的 `rowBody` 為剖面圖與時間統計加上一層包覆元素，讓兩者可以並排。驗證：`tests/summary.test.ts` 展開一天後，斷言剖面 SVG 與 `.day-time-stats` 都仍存在於展開區塊內，「展開後同時顯示」情境不變
- [ ] 3.2 在 `src/styles/components.css` 以 flex-wrap 實作並排：剖面圖 `flex: 1 1 320px`、時間統計 `flex: 1 1 260px`，容器不足時自動換行成上下堆疊，不使用 media query。驗證：CSS 測試斷言兩個 flex-basis 與 `flex-wrap: wrap`，並斷言該區塊沒有引入新的 `@media`
- [ ] 3.3 確認沒有高度資料的一天仍正常排版。驗證：`tests/summary.test.ts` 既有的「沒有高度資料的一天」情境通過，說明文字與時間統計同時存在
- [ ] 3.4 確認 `.day-time-stats` 的 `repeat(auto-fit, minmax(100px, 1fr))` 未改動。驗證：CSS 測試斷言該規則原樣保留

## 4. 手動版面驗收

- [ ] 4.1 以 1280px 視窗檢查：統計在左窄欄、分天摘要在右寬欄；展開一天後剖面圖寬度停在 420px，時間統計在其右側，剖面圖右方沒有大片留白
- [ ] 4.2 以 900px 視窗檢查：仍為兩欄，展開區塊視容器寬度並排或堆疊，皆無水平捲軸
- [ ] 4.3 以 801px 視窗檢查已知取捨：分天摘要的可用寬度約 287px，剖面圖完整顯示且沒有水平捲軸（proposal.md 記載的接受範圍）
- [ ] 4.4 以 400px 視窗檢查：單欄順序為頁首、上傳、地圖、檔案、統計、分天摘要、匯出，展開後時間統計位於剖面圖下方，沒有水平捲軸
- [ ] 4.5 以 Tab 鍵從檔案列表往下走，確認焦點先進入統計區塊所在位置再進入分天摘要的日期列，沒有左右逆向跳動

## 5. 整體驗收

- [ ] 5.1 執行 `npm test`，全部通過
- [ ] 5.2 執行 `npm run build`，TypeScript 無錯誤
- [ ] 5.3 以 `tests/gpx/` 的真實 GPX 載入多天行程，逐天展開確認剖面圖與時間統計的排版在各寬度下都正常
- [ ] 5.4 執行 `openspec validate swap-summary-and-stats --strict`，通過
