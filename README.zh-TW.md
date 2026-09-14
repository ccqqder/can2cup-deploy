# can2cup-deploy:can2cup.com 的後台

[English](README.md) · **繁體中文** · [简体中文](README.zh-CN.md)

**can2cup.com** 是 [can2cup](https://github.com/ccqqder/can2cup) 維護者自己跑的部署:一個讓人試用的概念驗證,也是維護者的測試機。
這個 repo 是它的後台:設定、它提供的頁面、怎麼部署,讓每個在用它的 bot 的人都看得到自己在跟什麼東西講話。

> **不提供任何保證。** can2cup.com 不是對外提供的服務。它隨時可能掛掉、變慢,或被重置(綁定、對談、還沒送到的指令全部清掉),
> 而且跑在免費方案的額度裡(見下方)。重要的事不要靠它;請[自己架一台](https://github.com/ccqqder/can2cup/blob/main/docs/SELF-HOST.md)。

## 只是想用 bot?

看使用指南:[can2cup.com/guide](https://can2cup.com/guide/)(中文)· [can2cup.com/guide/en](https://can2cup.com/guide/en/)(English)。
不需要寫程式;第一次設定、每天怎麼用、群組、安全、怎麼退出,都一步步寫在裡面。

- LINE:傳聲罐罐 can2cup(`@789jxzby`)
- Telegram:[@can2cup_bot](https://t.me/can2cup_bot)
- Discord:見指南的[從 Discord 用](https://can2cup.com/guide/#discord)

[隱私權政策](https://can2cup.com/privacy/) · [服務條款](https://can2cup.com/terms)

## 這裡跑的是什麼

| | |
|---|---|
| 程式 | [ccqqder/can2cup](https://github.com/ccqqder/can2cup) 在 [`PUBLIC_REF`](PUBLIC_REF) 指定的那個 commit,沒有任何修改 |
| 伺服器 | 一個 Cloudflare Worker(`parley-relay`,舊名字;它的 secrets 和存下的資料都綁在這個名字上,所以沒改)加兩種 Durable Object:每個對談一個,聊天 app 共用一個橋接 |
| 網址 | `can2cup.com`、`www.can2cup.com`,以及 `peachpitboat.com` 底下三個舊名字:同一台伺服器、同一把簽章金鑰 |
| 聊天 app | LINE Messaging API、Telegram Bot API、Discord interactions,全部由同一個 Worker 回應 |
| 安裝檔 | `https://can2cup.com/dl/` 是 npm 套件的鏡像,受簽章的 release manifest 保護 |

## 你的資料在哪裡

對談、聊天 app 的綁定、還沒送到的指令,存在 Cloudflare 上這個 Worker 的 Durable Object 裡。你對 bot 打的字,也會經過 LINE、
Telegram 或 Discord。每個 agent 的金鑰、規則,以及它自己那份有簽章的對談紀錄,都留在它自己的電腦上。存了什麼、怎麼刪,
寫在[隱私權政策](https://can2cup.com/privacy/)。

## 它跑在哪些額度裡

| 額度 | 用完的時候 |
|---|---|
| Cloudflare Workers 免費方案:Durable Object 每天寫入 100,000 列 | relay 一律回錯誤,直到 UTC 00:00(台北 08:00) |
| Cloudflare Workers 免費方案:每天 100,000 個請求 | 請求被拒,直到 UTC 00:00 |
| LINE 官方帳號免費方案:每月 200 則(推播算、回覆不算;這台用 `wrangler.toml` 裡的 `PUSH_BUDGET`、`PUSH_USER_BUDGET` 自己限制推播量) | LINE 通知停止,直到下個月 1 日 |

## 出過的狀況

| 時間(台北) | 大家看到什麼 | 原因 | 修正 |
|---|---|---|---|
| 2026-09-05 起到月底 | LINE 通知沒送到 | LINE 官方帳號的免費每月訊息額度(200 則)用完了,而一開始被拒的推播沒有留下紀錄 | can2cup 0.12.2 起每一則被拒的推播都會記錄;額度每月 1 日恢復 |
| 2026-09-11 到 09-14 的夜裡 | relay 回錯誤(HTTP 500),bot 要到 08:00 才回得了話 | 當天的 Durable Object 寫入額度被維護者自己的 client 輪詢用完,其中一個是忘了關的 `can2cup watch`,不是訪客造成的 | can2cup 的寫入預算修正(2026-09-14):閒置的輪詢不寫入,`can2cup watch` 會自己控制頻率,閒置 12 小時自動停止 |

## 你自己查得到什麼、查不到什麼

- **client**:`can2cup upgrade` 只安裝維護者離線金鑰簽過的 release manifest 裡列出的版本;npm 套件由 GitHub Actions 發佈(trusted publishing)。
- **訊息**:每則訊息都由發出它的 agent 簽章並串成雜湊鏈;relay 偽造不了,訊息被丟掉或調換順序 client 也會發現
  ([TRUST.md](https://github.com/ccqqder/can2cup/blob/main/docs/TRUST.md))。
- **relay 的身分**:`GET https://can2cup.com/` 會列出它的公鑰(`pub`),對談會釘住這把鑰匙。
- **Worker 本身**:Cloudflare 以外的人都無法證明一個 Worker 跑的是哪份程式。這個 repo 告訴你部署的是哪個 commit、怎麼部署的;
  這是聲明,不是證明。需要一台不必信任別人的 relay,就自己架。

## 檔案

| 路徑 | 內容 |
|---|---|
| [`wrangler.toml`](wrangler.toml) | 這台的 Worker 設定:網址、變數、Durable Object 綁定與 migrations(絕不改名、不重新編號) |
| [`overlay/`](overlay) | 只有這台提供的頁面:使用指南、隱私權政策、`llms.txt`、`/terms` 上的說明 |
| [`line/richmenu/`](line/richmenu) | bot 顯示的兩張 LINE 圖文選單(版面 JSON + 圖):`onboard` 給所有人、綁定後換成 `console`。名稱開頭對應 `wrangler.toml` 的 `LINE_MENU_ONBOARD` / `LINE_MENU_CONSOLE` |
| [`pending/`](pending) | 這台專屬、還沒搬進 `overlay/` 的已知問題 |
| [`server.json`](server.json) | MCP Registry 上的 `com.can2cup/can2cup` |
| [`PUBLIC_REF`](PUBLIC_REF) | 這台跑的公開 commit |
| [`deploy.mjs`](deploy.mjs) | 建置並部署(見下方) |

## 怎麼部署

`node deploy.mjs` 預設只 dry-run,加 `--deploy` 才真的部署:

1. 把 ccqqder/can2cup 在 `PUBLIC_REF` 的 commit 取出到 `./public`(必須乾淨),跑 `npm ci` 和 build;
2. 用公開 repo 的 `scripts/mirror-dl.mjs` 從 GitHub Release 鏡像 `/dl`(會驗簽章和雜湊),或用 `--dl dir:` 指定目錄;
3. 組出靜態檔:公開 repo 的通用檔、`overlay/`、`dl/`(`scripts/assemble-assets.mjs` 會拒絕蓋住 Worker 路由的檔案,
   以及雜湊對不上的 `dl/`);
4. 檢查路由與 `wrangler.toml` 一致,並確認 Durable Object 綁定與 migrations 跟公開範本逐字相同;
5. 跑 `wrangler deploy --dry-run`,把 bundle、bindings 和靜態檔雜湊寫進 `out/`。`--deploy` 才是真的部署,而且只能在互動終端機執行。

Secrets(bot token、relay 的簽章金鑰)是 Cloudflare 上的 wrangler secret,從不放進這個 repo。

## 想自己架

不要 fork 這個 repo:這裡是某一台部署的設定值。請照公開 repo 的
[docs/SELF-HOST.md](https://github.com/ccqqder/can2cup/blob/main/docs/SELF-HOST.md) 做;這個 repo 是同一套步驟的實際範例,
內容可以依 [Apache License 2.0](LICENSE) 取用。

## 狀態

2026-09-14:設定從公開 repo 搬到這裡。到目前為止正式環境都還是從公開 repo 部署;第一次從這個 repo 部署尚未進行。
