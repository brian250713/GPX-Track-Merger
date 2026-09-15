# visual-style Specification

## Purpose
網站共用的設計 token、便當盒式版面與窄螢幕單欄排版、文字對比度、按壓回饋、鍵盤焦點與減少動態效果、地圖控制項樣式、自行託管字型。
## Requirements
### Requirement: 共用的設計 token
系統 SHALL 以一份設計 token 定義所有介面色值、邊框、圓角與陰影（design D11），網頁樣式與圖卡的 canvas 繪製 MUST 使用同一份定義，不可在兩處分別寫死色值。

#### Scenario: 卡片樣式
- **WHEN** 頁面上顯示任一個主要區塊（上傳區、檔案列表、地圖、分天摘要、統計、匯出）
- **THEN** 區塊有 3px `--text` 色邊框、24px 圓角，以及向右下偏移 6px、不模糊的 `--text` 色硬陰影

#### Scenario: 按鈕樣式
- **WHEN** 頁面上顯示主要或次要按鈕
- **THEN** 按鈕有 3px `--text` 色邊框、16px 圓角，以及向右下偏移 4px 的硬陰影

### Requirement: 便當盒式版面
系統 SHALL 在寬螢幕上以多個區塊並排的方式排版，地圖是面積最大的區塊；每個區塊依功能固定使用一種底色。在窄螢幕上 SHALL 排成單欄，且頁面 MUST NOT 出現水平捲動。

#### Scenario: 寬螢幕
- **WHEN** 使用者以寬度 1280px 的視窗開啟網站
- **THEN** 上傳區與檔案列表位於地圖旁邊，分天摘要與統計區塊並排在下方，匯出區塊在最下方獨佔一整排，地圖是面積最大的區塊

#### Scenario: 窄螢幕
- **WHEN** 使用者以寬度 400px 的視窗開啟網站
- **THEN** 所有區塊排成一欄，順序為頁首、上傳區、地圖、檔案列表、分天摘要、統計、匯出，且頁面沒有水平捲軸

### Requirement: 文字對比度
所有一般文字與其背景的對比度 SHALL 至少 4.5:1（WCAG AA）。位於粉彩底色區塊內的文字 MUST 使用 `--text`；`--text-muted` 只能用在白色或 `--bg-cream` 底色上。

#### Scenario: 主要按鈕
- **WHEN** 頁面上顯示使用 `--cta` 綠色底色的主要按鈕
- **THEN** 按鈕文字與底色的對比度至少 4.5:1

#### Scenario: 粉彩區塊內的文字
- **WHEN** 分天摘要區塊使用淡紫底色，統計區塊使用淺藍底色
- **THEN** 區塊內所有文字都使用 `--text`，對比度至少 4.5:1

### Requirement: 按壓回饋只用在可點擊元件
可點擊的小元件（按鈕、檔案移除鈕、風格選項）SHALL 在滑鼠移上時縮小硬陰影並往右下位移，呈現按下去的效果。大區塊（地圖、檔案列表等）MUST NOT 在滑鼠移上時位移。

#### Scenario: 滑鼠移到按鈕上
- **WHEN** 使用者把滑鼠移到「匯出 GPX」按鈕上
- **THEN** 按鈕的硬陰影從 4px 縮為 2px，按鈕往右下位移 2px

#### Scenario: 滑鼠移到地圖上
- **WHEN** 使用者把滑鼠移到地圖區塊上
- **THEN** 地圖區塊的位置與陰影都不改變

### Requirement: 鍵盤操作與動態效果偏好
所有可操作元件 SHALL 在取得鍵盤焦點時顯示清楚的焦點樣式。使用者在作業系統開啟「減少動態效果」時，系統 SHALL 取消 hover 位移與 transition 動畫。

#### Scenario: 鍵盤焦點
- **WHEN** 使用者只用 Tab 鍵在頁面中移動
- **THEN** 每個取得焦點的按鈕、輸入框、選單與檔案移除鈕都有明顯可見的焦點外框

#### Scenario: 減少動態效果
- **WHEN** 使用者的系統設定 `prefers-reduced-motion: reduce`，並把滑鼠移到按鈕上
- **THEN** 按鈕沒有位移動畫

### Requirement: 地圖控制項套用相同風格
地圖內建的縮放按鈕與授權標示 SHALL 套用與網站相同的圓角、邊框與硬陰影樣式，並維持可讀性。

#### Scenario: 縮放按鈕
- **WHEN** 地圖載入完成
- **THEN** 縮放按鈕有 `--text` 色邊框、圓角與硬陰影，和頁面上的其他按鈕一致

### Requirement: 自行託管字型
系統 SHALL 把標題字型（Fredoka）、內文字型（Nunito）與中文字型（Chiron GoRound TC）隨網站的靜態檔案一起部署，MUST NOT 從第三方字型服務載入字型。網頁與圖卡中的中文 SHALL 使用 Chiron GoRound TC 顯示。

#### Scenario: 字型從本站載入
- **WHEN** 網站部署完成後，使用者開啟網站並下載圖卡
- **THEN** 所有字型檔都從網站本身的網域載入，網路請求中沒有 Google Fonts 等第三方字型服務

#### Scenario: 中文使用指定字型
- **WHEN** 使用者輸入標題 `京都・大阪 5 日`
- **THEN** 網頁與圖卡上的中文字使用 Chiron GoRound TC，英文字母和數字使用 Fredoka

#### Scenario: 中文粗體標題
- **WHEN** 標題以粗體（字重 700）顯示中文
- **THEN** 使用 Chiron GoRound TC 本身的 700 字重，而不是由瀏覽器從一般字重合成的假粗體

#### Scenario: 只下載用到的字
- **WHEN** 使用者開啟網站，頁面上只出現少量中文字
- **THEN** 瀏覽器只下載包含這些字的中文字型片段，不下載整套中文字型

