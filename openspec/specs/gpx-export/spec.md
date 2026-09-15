# gpx-export Specification

## Purpose
把分好天的結果匯出成一個 GPX 1.1 檔（每天一個 <trk>、每段一個 <trkseg>）並下載。
## Requirements
### Requirement: 匯出合併 GPX
系統 SHALL 在至少有一天的資料時，讓使用者下載一個符合 GPX 1.1 規格的檔案，內容是目前的分天結果。檔案 SHALL 完全在瀏覽器內產生。

#### Scenario: 下載檔案
- **WHEN** 分天結果共 3 天，使用者按下「匯出 GPX」
- **THEN** 瀏覽器下載一個 `.gpx` 檔案，且可以用 GPX 1.1 schema 驗證通過

#### Scenario: 沒有資料
- **WHEN** 沒有任何可用的軌跡點
- **THEN** 「匯出 GPX」按鈕為停用狀態

### Requirement: 每天一個 trk、每段一個 trkseg
匯出的 GPX SHALL 讓每一天對應一個 `<trk>`，依 Day 順序排列；每個 `<trk>` 內，每個段落對應一個 `<trkseg>`，依時間順序排列。

#### Scenario: 結構對應
- **WHEN** Day 1（2026-03-12）有 2 段，Day 2（2026-03-13）有 1 段
- **THEN** GPX 包含 2 個 `<trk>`；第一個 `<trk>` 的 `<name>` 為 `Day 1 (2026-03-12)`，內含 2 個 `<trkseg>`；第二個 `<trk>` 的 `<name>` 為 `Day 2 (2026-03-13)`，內含 1 個 `<trkseg>`

#### Scenario: 保留單點段落
- **WHEN** 某天有一個只含 1 個點的段落
- **THEN** 匯出的 GPX 仍包含這個只有 1 個 `<trkpt>` 的 `<trkseg>`

### Requirement: 軌跡點內容
每個 `<trkpt>` SHALL 包含 `lat`、`lon` 屬性，以及 UTC ISO 8601 格式的 `<time>`；原始點有高度時 SHALL 包含 `<ele>`，沒有高度時 MUST NOT 輸出 `<ele>`。

#### Scenario: 時間一律為 UTC
- **WHEN** 使用者選擇的時區為 `Asia/Tokyo`，某點的原始時間為 `2026-03-12T01:00:00Z`
- **THEN** 該點輸出 `<time>2026-03-12T01:00:00.000Z</time>`，不受所選時區影響

#### Scenario: 沒有高度
- **WHEN** 某點沒有高度資料
- **THEN** 該 `<trkpt>` 內沒有 `<ele>` 元素

### Requirement: 中繼資料與檔名
匯出的 GPX SHALL 在 `<metadata>` 中以使用者輸入的標題作為 `<name>`。下載檔名 SHALL 為 `{標題}_{第一天日期}.gpx`，標題為空時使用 `trip`，並移除檔名中不合法的字元。

#### Scenario: 有標題
- **WHEN** 標題為 `京都・大阪 5 日`，第一天是 `2026-03-12`
- **THEN** `<metadata><name>` 為 `京都・大阪 5 日`，檔名為 `京都・大阪 5 日_2026-03-12.gpx`

#### Scenario: 標題含特殊字元
- **WHEN** 標題為 `A/B <test>`
- **THEN** GPX 內的 `<name>` 正確跳脫特殊字元，檔名中不含 `/`、`<`、`>`

#### Scenario: 沒有標題
- **WHEN** 標題為空，第一天是 `2026-03-12`
- **THEN** 檔名為 `trip_2026-03-12.gpx`

