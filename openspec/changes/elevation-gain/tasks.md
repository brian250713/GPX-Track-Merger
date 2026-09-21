## 1. 核心計算

- [x] 1.1 在 `src/core/elevation.ts` 新增並匯出 `ASCENT_THRESHOLD_M = 5`，以及 `computeElevationGain(day): { ascentM, descentM, hasData }`，以轉折點加雜訊帶實作（高度從目前極值反向超過 `2T` 才確認轉折，並把「上一個轉折點 → 極值」完整計入；段落結尾的最後一段照樣計入）。驗證：`tests/elevation.test.ts` 斷言常數值為 5，並斷言函式對空的 `Day` 回傳 `hasData: false`
- [x] 1.2 單調爬升不被低估。驗證：100 個點、每點比前一點高 1 公尺（每步都小於門檻），斷言 `ascentM` 介於 95 與 100 之間、`descentM` 為 0，對應「小步爬升不被低估」情境
- [x] 1.3 門檻內的雜訊不累積。驗證：在 40 公尺上下以 ±4 公尺震盪，起點分別落在中間、波峰、波谷，斷言 `ascentM` 與 `descentM` 皆為 0，對應「雜訊不累積」情境
- [x] 1.4 邊界採嚴格大於。驗證：造一組每步剛好 ±5.0 公尺的點，斷言 `ascentM` 與 `descentM` 皆為 0；持平後上升恰好 10.0 公尺斷言為 0、上升 10.5 公尺斷言為 10.5，對應「恰好等於門檻」與「恰好等於雜訊帶寬度」情境
- [x] 1.5 轉折點追蹤在每個段落開頭重置。驗證：兩個段落分別在海拔 10 與 810 公尺附近、各自段內爬升 50 公尺，斷言 `ascentM` 約為 100 而非 900，對應「斷開處不計入」情境
- [x] 1.6 缺少高度的點跳過但不中斷段內累積。驗證：同一組點跑兩次，第二次把中間 10 個點的 `ele` 拿掉，斷言兩次的 `ascentM` 相同，對應「中間缺少高度的點」情境
- [x] 1.7 資料不足時回傳 `hasData: false`。驗證：「所有點都沒有 `ele`」與「只有一個點有 `ele`」兩個案例，斷言 `hasData` 為 false、`ascentM` 與 `descentM` 為 0 且皆為有限數（不是 `NaN`），判定門檻與 `computeElevationProfile` 的「可用點數 < 2」一致
- [x] 1.8 上升與下降共用同一門檻。驗證：把 1.2 的資料整個上下翻轉，斷言 `descentM` 與翻轉前的 `ascentM` 相同
- [x] 1.9 新增 `totalAscentM(days): number | null`，所有天都沒有高度資料時回傳 `null`。驗證：三天爬升 100／0／250 時斷言為 350；三天皆無高度資料時斷言為 `null`，對應「多天加總」與「全部沒有高度資料」兩個情境
- [x] 1.10 確認 `computeElevationProfile` 與 `renderElevationSvg` 未被改動。驗證：`tests/elevation.test.ts` 與 `tests/elevationProfile.test.ts` 既有斷言全數通過且一行未改

## 2. 分天摘要顯示

- [x] 2.1 在 `src/ui/summary.ts` 的 `rowBody` 把剖面 SVG（或無高度資料的說明文字）包進一層 `.day-elevation-col`，`.day-time-stats` 維持為 `.day-expanded-wrap` 的第二個子元素。驗證：`tests/summary.test.ts` 展開一天後，斷言 `.day-expanded-wrap` 恰有兩個子元素，且 SVG 位於 `.day-elevation-col` 內
- [x] 2.2 在 `.day-time-stats` 的均速之後追加爬升與下降兩項，沿用既有的 `.day-stat-item`、`.day-stat-label` 與 `.day-stat-value`，數值為整數公尺，不另設區塊。驗證：`tests/summary.test.ts` 斷言統計區塊的標籤依序為出發、抵達、總時長、行進時間、均速、爬升、下降，且 `.day-elevation-col` 內不含「爬升」，對應「展開後顯示」情境
- [x] 2.3 沒有高度資料的一天不顯示爬升數值。驗證：`tests/summary.test.ts` 新增案例，斷言該天顯示既有的說明文字、展開區塊內不含「爬升」字樣，且統計區塊只有五項，對應「不顯示 0 公尺」情境
- [x] 2.4 在 `src/styles/components.css` 新增 `.day-elevation-col { flex: 1 1 320px; max-width: 420px; min-width: 0; display: flex; flex-direction: column; }`，並把 `flex` 與 `max-width` 從 `.elevation-container svg` 與 `.elevation-empty` 卸下（SVG 保留 `width: 100%; height: auto`）。驗證：CSS 文字斷言 `.day-elevation-col` 含該三項、`.elevation-container svg` 不再含 `flex:` 與 `max-width`
- [x] 2.5 更新 `tests/layout.test.ts` 既有的兩條斷言：`2.1` 的 `max-width: 420px` 與 `3.2` 的 `flex: 1 1 320px` 改為斷言在 `.day-elevation-col` 上。驗證：兩條測試通過；同時保留原本「該段落不含 `@media`」與 `.day-time-stats` 的 `flex: 1 1 260px` 兩項斷言不變
- [x] 2.6 確認 `.day-time-stats` 的 `repeat(auto-fit, minmax(100px, 1fr))` 與 `flex: 1 1 260px` 原樣保留。驗證：`tests/layout.test.ts` 的 `3.4` 斷言通過且未修改
- [ ] 2.7 手動驗收三個寬度。驗證：1280px 下剖面圖在左、含爬升與下降的統計區塊在右；900px 下版面正常；400px 下統計區塊在剖面圖下方，頁面沒有水平捲軸——對應「與高度剖面並存」與「窄容器堆疊」兩個情境

## 3. 整趟統計

- [x] 3.1 在 `src/state.ts` 新增 `totalAscentM` getter，形狀與既有的 `totalKm` 一致。驗證：狀態測試斷言多檔案合併後的值等於 `totalAscentM(state.days)`
- [x] 3.2 `mountStats` 在天數與總距離之後追加總爬升，數值為整數公尺並附標籤。驗證：測試斷言有高度資料時統計區塊含爬升數值與標籤，對應「多天加總」情境
- [x] 3.3 所有天都沒有高度資料時整項省略。驗證：測試斷言統計區塊只有天數與總距離，不含「爬升」字樣、不含 `0`，對應「全部沒有高度資料」情境
- [x] 3.4 統計區塊 MUST NOT 顯示總下降。驗證：測試斷言統計區塊不含「下降」字樣，對應「不顯示總下降」情境
- [x] 3.5 **修正既有缺陷**：尚未上傳任何 GPX 時，`mountStats` 目前會渲染 `0 天 · 0.0 km`。改為在 `state.days.length === 0` 時顯示提示文字或不顯示數值。驗證：測試斷言空狀態下統計區塊不含 `0 天`、`0.0 km` 與 `NaN`，對應新增的「尚未上傳資料」情境。這是填補統計區塊規格缺口時才發現的既有行為，範圍很小，隨本次一併處理

## 4. 圖卡

- [x] 4.1 `RenderOptions` 新增總爬升欄位（型別允許 `null` 表示沒有高度資料），`mountControls` 從 `state.totalAscentM` 傳入。驗證：型別檢查通過（`npm run build`）
- [x] 4.2 在 `renderTripCard` 的 pill 迴圈加入第三顆「爬升 N m」，使用既有的 design token 作為底色，不新增色值。驗證：`tests/tokens.test.ts` 的 token 同步斷言仍通過；程式碼審查確認未出現字面色碼
- [x] 4.3 在 `cardFontSample` 加入「爬升」兩字。驗證：`tests/card.test.ts` 斷言 `cardFontSample('x')` 含「爬升」，對應「爬升文字使用網站自帶字型」情境
- [x] 4.4 總爬升為 `null` 時整項省略，只畫兩顆 pill。驗證：測試斷言傳入 `null` 時不會產生第三顆 pill 的文字，對應「沒有高度資料」情境
- [x] 4.5 最大位數不溢出。驗證：以 `30 天`、`1234.5 km`、`爬升 28500 m` 量測三顆 pill 加間距的總寬，斷言不超過 `CARD_SIZE - PADDING * 2`（1968px），對應「數值位數較多時不溢出」情境；量測沿用 `fitLegendDays` 那種注入 `measure` 的純函式作法，不需要真的 canvas
- [ ] 4.6 手動驗收一張實際圖卡。驗證：下載極簡與含底圖各一張，確認第三顆 pill 的字型與另外兩顆一致、沒有方框或亂碼、沒有與圖例重疊

## 5. 文件

- [x] 5.1 在 `README.md` 的功能清單補上爬升，並寫出 5 公尺門檻與它的用途（過濾 GPS 高度雜訊），比照既有的「斷訊切段：30 分鐘／5 公里」寫法。驗證：人工確認 README 提到門檻值，對應「門檻在使用說明中揭露」情境
- [x] 5.2 執行 `openspec validate elevation-gain --strict`，確認三份 spec delta 通過。驗證：指令無錯誤輸出
