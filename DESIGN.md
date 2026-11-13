---
# gstack: design-md-format=spec
name: Potato 賣家工具箱
description: 精算刊物。冷靜、精準、有一點手作溫度的財經刊物，數字是主角。
colors:
  paper: "#F6F7F4"
  surface: "#FFFFFF"
  text: "#16282B"
  text-muted: "#5C6B6E"
  line: "#DCE3E1"
  line-strong: "#B9C6C4"
  primary: "#174F56"
  primary-hover: "#0F3B41"
  primary-tint: "#E3EEEC"
  on-primary: "#FFFFFF"
  accent: "#F4A259"
  accent-tint: "#FDEAD3"
  success: "#2E7A4F"
  error: "#B8322A"
  error-tint: "#F8E3E0"
typography:
  display:
    fontFamily: Noto Serif TC
    fontWeight: 900
    fontSize: clamp(30px, 4.4vw, 46px)
    letterSpacing: 0.01em
  body:
    fontFamily: Noto Sans TC
    fontSize: 17px
    lineHeight: 1.8
  label:
    fontFamily: Noto Sans TC
    fontSize: 13px
    letterSpacing: 0.12em
  mono:
    fontFamily: JetBrains Mono
    fontFeature: tnum, zero
rounded:
  sm: 4px
  md: 6px
  lg: 10px
spacing:
  xs: 4px
  sm: 8px
  md: 16px
  lg: 24px
  xl: 40px
  2xl: 56px
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.on-primary}"
    rounded: "{rounded.md}"
  button-primary-hover:
    backgroundColor: "{colors.primary-hover}"
  input:
    borderColor: "{colors.line-strong}"
    rounded: "{rounded.sm}"
  card:
    backgroundColor: "{colors.surface}"
    rounded: "{rounded.lg}"
  nav-link:
    textColor: "{colors.text}"
---

# Potato 賣家工具箱

## Overview

**Creative North Star:** 精算刊物。像一份可信的財經刊物，標題用明體，數字用等寬字逐位對齊；橘色只出現在螢光筆和紙膠帶，接上「Potato 賣家算數」影片的手作紙張語彙。
**Product context:** 給台灣蝦皮賣家的免費計算工具（7 個）加上內容站「賣家算數」。訪客多從 Google 搜尋和 Threads／IG／FB 進來，看文章、用工具，再導到 LINE 官方帳號和 Excel 利潤健檢表。
**Mode per surface:** 首頁 Persuade；文章頁 Read；工具頁 Operate；/learn/ 列表 Read。
**Reference sites:** nerdwallet.com（文章結構：更新日期、目錄、作者）、managertoday.com.tw（台灣媒體頁首、熱門清單）。
**Key characteristics:**
- 數字比標題還大：頭條直接寫答案（「實際只給你 82.5 元」）。
- 每篇文章有「✓ 數字已驗算」、直式算式、公開的更正紀錄。
- 導覽只有三項：賣家算數、計算工具、利潤健檢表。
- 安靜的紙白底，沒有裝飾圖形。

## Colors

**Strategy:** Committed。計算機深青擁有整個頁面（連結、按鈕、重點數字），中性色都帶一點深青。
**Light or dark:** 淺色為主：賣家多在白天用手機、辦公桌前對帳。深色模式完整支援，深色時主色換成亮一點的青 #7CC6C9，維持對比。
- 橘色 `accent` 只用在螢光筆底線、紙膠帶、健檢表截圖上的膠帶。不當字色，不當按鈕。
- 紅色 `error` 只代表「虧錢／赤字」，不拿來裝飾或當警告以外的強調。
- 綠色 `success` 只用在「數字已驗算」。

## Typography

- **Noto Serif TC 900／700：** 頁面標題、區塊標題、文章卡片標題。明體帶出刊物的可信度。
- **Noto Sans TC 400／500／700：** 內文、介面文字、標籤。
- **JetBrains Mono 500／700：** 所有金額、百分比、算式、計算機輸入與結果。開 `tabular-nums` 和斜線 0，每一位數對齊。
- 全部從 Google Fonts 載入（`display=swap`），中文字型依 unicode-range 分段下載。
- 字級：大數字 76–128px；頁面標題 30–46px；區塊標題 26px；卡片標題 18–26px；內文 17px（文章 18px）；標籤 13px。

## Layout

- 最大寬度 1180px；文章內文欄 720px，桌機右側 240px「本文重點」目錄（1060px 以下隱藏）。
- 左右留白 `max(16px, env(safe-area-inset-*))`。
- 區塊之間用 1px 線分隔，不用卡片堆疊。工具目錄用有編號的清單（編號就是工具的固定編號 01–07）。
- 手機：頁首收成「選單」按鈕，所有雙欄改單欄。

## Elevation & Depth

幾乎全平面。只有兩個地方有陰影：展開的下拉選單（往下 12px 的柔和陰影）和健檢表截圖。沒有零位移的發光。

## Shapes

圓角克制：輸入框 4px、按鈕 6px、面板 10px。不要每個元素都圓。

## Components

- **頁首：** 白底、底線；左邊 Potato 頭像加字標，中間三個選單（賣家算數、計算工具有下拉），右邊「加 LINE 收費率通知」外框按鈕。下拉用 `<details>`，鍵盤可操作。
- **按鈕：** 主要按鈕深青實心；次要是文字連結加箭頭。hover 加深，focus-visible 有 2px 外框。
- **輸入框：** 等寬字、1.5px 邊框，focus 時邊框變深青加淡青光暈。
- **方案切換：** 兩格分段按鈕，選中的深青實心。
- **先講答案：** 淡青底色塊，沒有左邊色條。
- **直式算式（ledger）：** 每行「名稱｜算式｜金額」，金額靠右對齊，總計上方實線、下方雙底線。
- **數字已驗算：** 綠色勾加文字，出現在文章 byline 和頭條。
- **更正紀錄：** 文章最後，舊數字用紅色刪除線保留，標日期。
- **工具頁：** 麵包屑（計算工具 › 編號）、明體標題、一句它回答的問題；左邊輸入、右邊結果，結果的關鍵數字用大號等寬字。

## Do's and Don'ts

- Do：每個畫面上的金額都用 JetBrains Mono，而且來自 `lib/fees.js` 的公式。
- Do：標題寫答案或問題本身，數字放進標題。
- Do：結果區先放結論數字，再放明細。
- Do：橘色只當螢光筆和膠帶。
- Don't：滿版色帶的頁首、把所有工具連結攤平在頂部。
- Don't：卡片裡再放卡片、每個區塊都加陰影、彩色左邊框。
- Don't：emoji 當裝飾、漸層、發光、浮動的裝飾圖形。
- Don't：分類標籤做成浮在標題上方的膠囊。分類用一行深青小字。

## Motion

- **Approach:** minimal-functional。
- **Easing:** enter(ease-out) exit(ease-out) move(ease-in-out)
- **Duration:** micro 80ms、short 180ms（hover、下拉展開）
- **The one authored moment:** 沒有。數字變動時直接換，不做跳動動畫，讓人專心看數字。

## Decisions Log
| Date | Decision | Rationale |
|------|----------|-----------|
| 2026-11-13 | 建立設計系統「精算刊物」 | /design-consultation：使用者要專業媒體感，最想讓人記住「數字最準、算得最清楚」。研究 NerdWallet、經理人；採用外部設計提案的直式算式與公開更正紀錄；捨棄米黃帳簿紙（太接近 AI 常見的米黃＋襯線套路）。 |
| 2026-11-13 | 首頁改成刊物頭版，手續費計算機搬到 /fee/ | 工具變成網站的一部分，首頁由頭條文章和「先算一筆」帶入。 |
