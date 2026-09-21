## Why

高度資料早就進到系統裡了：`parse.ts` 讀出 `<ele>`、`TrackPoint.ele` 帶著它、剖面圖畫得出那一天的最高與最低。但「這一天爬了多少」這個登山與單車使用者最先找的數字，從來沒有被算出來過。

剖面圖只回答「形狀長什麼樣」，不回答「總共爬了幾公尺」。一條來回翻兩座小丘的路線，和一條單程緩上坡，最高與最低可以完全一樣，累積爬升卻差三倍——而現在畫面上只有最高與最低。

另外有一個規格缺口要一併補：統計區塊顯示什麼內容，目前沒有任何 spec 規範。`day-grouping` 規範的是距離「怎麼算」，`track-map-view` 規範的是地圖上那行提示，兩者都不涵蓋統計區塊本身。這與 `swap-summary-and-stats` 抓到的「並排順序沒被規範」是同一類缺口。不補的話，本次新加的總爬升會落在一個同樣沒有依據的位置，下一個人可以無聲地把它拿掉。

## What Changes

- 新增每天的累積爬升與累積下降計算。使用 ±5 公尺雜訊帶的轉折點法（hysteresis，轉折需反向超過 10 公尺），而不是相鄰點正負差的直接加總——後者會把 GPS 高度雜訊全部算成爬升，一條平路的 40 公里可以「爬升」數百公尺。
- 分天摘要展開後，在高度剖面下方顯示該天的爬升與下降。
- 統計區塊在既有的「N 天 · X km」之後追加整趟總爬升。
- 圖卡新增第三顆 pill 顯示總爬升。
- 補上統計區塊顯示內容的規格（含既有的天數與總距離）。
- README 補上爬升門檻的說明，與既有的斷訊門檻（30 分鐘／5 公里）採同一種揭露方式。

已知取捨：爬升與下降放進展開區塊的左欄，需要把 `flex` 與 `max-width` 從 `.elevation-container svg` 移到一層新的欄容器上。這會動到 `swap-summary-and-stats` 留下的兩條 CSS 斷言（`tests/layout.test.ts` 的 `2.1` 與 `3.2`）。規格層的行為不變——剖面圖的 420px 上限仍然成立，只是施加在外層。理由見 design.md。

不改動：`renderElevationSvg` 的輸出（`W`、`H` 與所有座標計算原樣保留，`tests/elevationProfile.test.ts` 一行都不用改）；`.day-time-stats` 的內容與 grid 規則；分天摘要收合列的內容；斷訊切段的門檻與規則；地圖；匯出 GPX；圖卡的尺寸、風格與版面結構（只多一顆 pill）。

## Capabilities

### New Capabilities

無。累積爬升與剖面圖使用同一份輸入（`TrackPoint.ele`）、同一組段落規則、同一個資料不足判定，並顯示在同一個容器裡；拆成新能力會把「斷開處不累計」「缺高度的點怎麼處理」「資料不足的狀態」三組需求整套複製一遍。`elevation-profile` 既有的 Purpose（「讓使用者看出那一天是平路還是翻山」）本來就涵蓋這件事。

### Modified Capabilities

- `elevation-profile`: 新增每天累積爬升與下降的計算規則（門檻、分段重置、缺高度的點）、分天摘要中的呈現位置與格式，以及整趟總爬升在統計區塊與圖卡上的呈現。
- `day-grouping`: 新增「整趟統計的呈現」需求，把統計區塊該顯示天數與總距離這件事補進規格。
- `trip-card-export`: 「圖卡內容」加入總爬升，並規範沒有高度資料時的省略行為。

## Impact

- `src/core/elevation.ts`：新增 `ASCENT_THRESHOLD_M`、`computeElevationGain(day)` 與 `totalAscentM(days)`。純函式，輸入 `Day`，可直接測試。既有的 `computeElevationProfile` 不動。
- `src/state.ts`：新增 `totalAscentM` getter，與既有的 `totalKm` 同一個形狀。
- `src/ui/summary.ts`：`rowBody` 多包一層欄容器，掛上爬升區塊；`mountStats` 追加總爬升。計算不落在 UI 層。
- `src/styles/components.css`：新增 `.day-elevation-col` 與 `.day-elevation-stats`；`.elevation-container svg` 與 `.elevation-empty` 卸下已失效的 flex 屬性。
- `src/card/renderCard.ts`：`RenderOptions` 多一個總爬升欄位，`drawPill` 迴圈多一顆，`cardFontSample` 加入「爬升」兩字（字型預載的字元集不含它的話，第三顆 pill 會掉到 fallback 字型）。
- `tests/layout.test.ts`：兩條 CSS 斷言改選擇器。`tests/elevation.test.ts`、`tests/summary.test.ts`、`tests/card.test.ts` 新增案例。
- 不新增任何第三方相依套件。
