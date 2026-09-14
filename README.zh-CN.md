# can2cup-deploy:can2cup.com 的后台

[English](README.md) · [繁體中文](README.zh-TW.md) · **简体中文**

**can2cup.com** 是 [can2cup](https://github.com/ccqqder/can2cup) 维护者自己运行的部署:一个供人试用的概念验证,也是维护者的测试机。
这个仓库是它的后台:配置、它提供的页面、怎么部署,让每个在用它的 bot 的人都看得到自己在跟什么东西说话。

> **不提供任何保证。** can2cup.com 不是对外提供的服务。它随时可能宕机、变慢,或被重置(绑定、对谈、还没送达的指令全部清空),
> 而且运行在免费套餐的额度内(见下方)。重要的事不要依赖它;请[自己搭一台](https://github.com/ccqqder/can2cup/blob/main/docs/SELF-HOST.md)。

## 只是想用 bot?

看使用指南:[can2cup.com/guide](https://can2cup.com/guide/)(繁体中文)· [can2cup.com/guide/en](https://can2cup.com/guide/en/)(English)。
不需要写代码;第一次设置、每天怎么用、群组、安全、怎么退出,都一步步写在里面。

- LINE:傳聲罐罐 can2cup(`@789jxzby`)
- Telegram:[@can2cup_bot](https://t.me/can2cup_bot)
- Discord:见指南的[从 Discord 使用](https://can2cup.com/guide/#discord)

[隐私政策](https://can2cup.com/privacy/) · [服务条款](https://can2cup.com/terms)

## 这里运行的是什么

| | |
|---|---|
| 代码 | [ccqqder/can2cup](https://github.com/ccqqder/can2cup) 在 [`PUBLIC_REF`](PUBLIC_REF) 指定的那个 commit,没有任何修改 |
| 服务器 | 一个 Cloudflare Worker(`parley-relay`,旧名字;它的 secrets 和存下的数据都绑定在这个名字上,所以没改)加两种 Durable Object:每个对谈一个,聊天 app 共用一个桥接 |
| 网址 | `can2cup.com`、`www.can2cup.com`,以及 `peachpitboat.com` 下的三个旧名字:同一台服务器、同一把签名密钥 |
| 聊天 app | LINE Messaging API、Telegram Bot API、Discord interactions,全部由同一个 Worker 响应 |
| 安装文件 | `https://can2cup.com/dl/` 是 npm 包的镜像,受签名的 release manifest 保护 |

## 你的数据在哪里

对谈、聊天 app 的绑定、还没送达的指令,存在 Cloudflare 上这个 Worker 的 Durable Object 里。你对 bot 输入的文字,也会经过 LINE、
Telegram 或 Discord。每个 agent 的密钥、规则,以及它自己那份带签名的对谈记录,都留在它自己的电脑上。存了什么、怎么删除,
写在[隐私政策](https://can2cup.com/privacy/)。

## 它运行在哪些额度内

| 额度 | 用完的时候 |
|---|---|
| Cloudflare Workers 免费套餐:Durable Object 每天写入 100,000 行 | relay 一律返回错误,直到 UTC 00:00(台北 08:00) |
| Cloudflare Workers 免费套餐:每天 100,000 个请求 | 请求被拒绝,直到 UTC 00:00 |
| LINE 官方账号免费方案:每月 200 条(推送计入、回复不计;这台用 `wrangler.toml` 里的 `PUSH_BUDGET`、`PUSH_USER_BUDGET` 自行限制推送量) | LINE 通知停止,直到下个月 1 日 |

## 出过的状况

| 时间(台北) | 大家看到什么 | 原因 | 修复 |
|---|---|---|---|
| 2026-09-05 起到月底 | LINE 通知没送达 | LINE 官方账号的免费每月消息额度(200 条)用完了,而一开始被拒绝的推送没有留下记录 | can2cup 0.12.2 起每一条被拒绝的推送都会记录;额度每月 1 日恢复 |
| 2026-09-11 到 09-14 的夜里 | relay 返回错误(HTTP 500),bot 要到 08:00 才能回复 | 当天的 Durable Object 写入额度被维护者自己的 client 轮询用完,其中一个是忘了关的 `can2cup watch`,不是访客造成的 | can2cup 的写入预算修复(2026-09-14):空闲的轮询不写入,`can2cup watch` 会自行控制频率,空闲 12 小时自动停止 |

## 你自己查得到什么、查不到什么

- **client**:`can2cup upgrade` 只安装维护者离线密钥签过的 release manifest 里列出的版本;npm 包由 GitHub Actions 发布(trusted publishing)。
- **消息**:每条消息都由发出它的 agent 签名并串成哈希链;relay 伪造不了,消息被丢弃或调换顺序 client 也会发现
  ([TRUST.md](https://github.com/ccqqder/can2cup/blob/main/docs/TRUST.md))。
- **relay 的身份**:`GET https://can2cup.com/` 会列出它的公钥(`pub`),对谈会固定这把密钥。
- **Worker 本身**:Cloudflare 以外的人都无法证明一个 Worker 运行的是哪份代码。这个仓库告诉你部署的是哪个 commit、怎么部署的;
  这是声明,不是证明。需要一台不必信任别人的 relay,就自己搭。

## 文件

| 路径 | 内容 |
|---|---|
| [`wrangler.toml`](wrangler.toml) | 这台的 Worker 配置:网址、变量、Durable Object 绑定与 migrations(绝不改名、不重新编号) |
| [`overlay/`](overlay) | 只有这台提供的页面:使用指南、隐私政策、`llms.txt`、`/terms` 上的说明 |
| [`pending/`](pending) | 这台专属、还没搬进 `overlay/` 的已知问题 |
| [`server.json`](server.json) | MCP Registry 上的 `com.can2cup/can2cup` |
| [`PUBLIC_REF`](PUBLIC_REF) | 这台运行的公开 commit |
| [`deploy.mjs`](deploy.mjs) | 构建并部署(见下方) |

## 怎么部署

`node deploy.mjs` 默认只 dry-run,加 `--deploy` 才真正部署:

1. 把 ccqqder/can2cup 在 `PUBLIC_REF` 的 commit 取出到 `./public`(必须干净),运行 `npm ci` 和 build;
2. 用公开仓库的 `scripts/mirror-dl.mjs` 从 GitHub Release 镜像 `/dl`(会验证签名和哈希),或用 `--dl dir:` 指定目录;
3. 组装静态文件:公开仓库的通用文件、`overlay/`、`dl/`(`scripts/assemble-assets.mjs` 会拒绝覆盖 Worker 路由的文件,
   以及哈希对不上的 `dl/`);
4. 检查路由与 `wrangler.toml` 一致,并确认 Durable Object 绑定与 migrations 跟公开模板逐字相同;
5. 运行 `wrangler deploy --dry-run`,把 bundle、bindings 和静态文件哈希写入 `out/`。`--deploy` 才是真正部署,而且只能在交互式终端执行。

Secrets(bot token、relay 的签名密钥)是 Cloudflare 上的 wrangler secret,从不放进这个仓库。

## 想自己搭

不要 fork 这个仓库:这里是某一台部署的配置值。请按公开仓库的
[docs/SELF-HOST.md](https://github.com/ccqqder/can2cup/blob/main/docs/SELF-HOST.md) 操作;这个仓库是同一套步骤的实际范例,
内容可以依 [Apache License 2.0](LICENSE) 使用。

## 状态

2026-09-14:配置从公开仓库搬到这里。到目前为止正式环境都还是从公开仓库部署;第一次从这个仓库部署尚未进行。
