# 香港機場水牌 · 使用說明 / Hong Kong Airport Display — User Guide

`airport-display-manual-foldout-A4.pdf` — 一份 PDF，兩張 A4。
One PDF, two A4 sheets.

網上版 / Online edition: <https://wedsamuel1230.github.io/airport-sign-flash-station/manual/>
（同一份內容，連「規格」同 Wi-Fi／背景圖片設定，另加機側按鈕位置圖）

## 中文

* 一張 A4 摺三次 → 成品 105 × 74.25mm，放得入 **130 × 90mm** 的盒。
* PDF 第 1–2 頁＝中文摺頁（16 頁）；第 3–4 頁＝英文摺頁（16 頁）。
* 打印：A4 **雙面**、**長邊翻頁**、**100% 實際尺寸**（不要 Fit to page）。
* 摺法：右半摺向左 1 次；下半摺向上 2 次。中文封面會喺最外面。
* 字級：中文 11.7pt／英文 11.1pt（大字版）。
* 內容：快速上手 4 步、螢幕內容說明、控制台、維護與復原、常見問題（8 條）、支援。
  為咗放大字級，「規格」同「背景圖片 · Wi-Fi · 登入設定」冇收錄喺卡上。
* 建議 70–80g 紙（8 層疊起），出貨前先試印一張。

驗證：`python3 tools/verify-outputs.py` 會斷言本摺頁 4 頁 A4（頁 1–2 中文、
頁 3–4 英文），以及 `archive/` 內舊版摺頁的頁數與尺寸；`tools/build-all.sh`
最後會自動執行。

## English

* One A4 sheet, folded three times → 105 × 74.25 mm; fits a **130 × 90 mm** box.
* PDF pages 1–2 = Chinese edition (16 pages); pages 3–4 = English edition (16 pages).
* Print A4, **double-sided**, **flip on long edge**, **100% scale** (no “fit to page”).
* Fold: right half over left once, then bottom half up twice. The Chinese cover
  ends up on the outside.
* Body size: 11.7 pt Chinese / 11.1 pt English (large-print edition).
* Contents: quick start, what the screen shows, console, maintenance and
  recovery, FAQ, support. The specifications table and the optional
  background-image / Wi-Fi / login section are not on the card — dropping them
  is what pays for the larger type.
* 70–80 g paper recommended (eight layers); run one test copy first.

---

裝置：香港機場水牌（ESP32-S3，firmware 1.1.2）· 重新刷機：
<https://github.com/wedsamuel1230/airport-sign-flash-station>
