# 简面 Jianmian Studio

> 基于大模型的模块化简历撰写与面试辅助 Web 工具

简面（Jianmian Studio）是一款零依赖、可静态部署的简历工具。用户以模块化的方式构建简历，由 DeepSeek 大模型进行针对性润色、整体压缩至一页 A4，并可生成模拟面试题与准备建议。前端为单文件 HTML，无需后端即可运行；部署时通过 Cloudflare Pages Functions 提供同源 AI 代理与免费额度配额。

## 功能特性

- 模块化简历构建：8 类可插拔模块（基本信息、教育背景、项目经历、实习经历、个人技能、个人荣誉、自我评价、人物肖像）
- 按求职岗位针对性 AI 润色：提示词中注入目标岗位，强化岗位匹配度
- 整体压缩至一页 A4：智能缩减描述，保留关键事实与量化成果
- 模拟面试与准备建议：生成高频面试题（含追问方向）、可落地的准备建议与祝福语，以卡片形式呈现
- A4 分页与 PDF 导出：自动分页、专用打印样式表，一键导出标准 A4 简历
- 主题与体验：6 套主题、历史快照、一键清空、首页开场动画
- 服务端 AI 代理：隐藏 API Key、解决浏览器 CORS、按客户端维度提供免费额度配额

## 技术架构

| 层级 | 技术 |
| --- | --- |
| 前端 | 单文件 HTML + 原生 JavaScript（零框架、零 CDN） |
| AI 代理 | Cloudflare Pages Functions |
| 配额存储 | Cloudflare KV |
| 大模型 | DeepSeek `chat/completions` API（兼容 OpenAI 格式） |

数据流：浏览器 → 同源 `/api/chat` 代理 → 服务端使用 `OWNER_KEY` 调用 DeepSeek → 回传结构化结果。用户的 API Key 仅在自行配置时直连模型，默认走站长提供的免费额度。

## 目录结构

```
jianmian/
├── index.html              单文件前端应用（核心）
├── index.sample.html       预填示例简历，打开即可查看效果
├── functions/
│   └── api/
│       └── chat.js         Cloudflare Pages 代理（隐藏 Key + 免费额度）
├── wrangler.toml           部署配置（Pages + KV 绑定）
└── README.md
```

## 本地使用

直接双击 `index.html` 用浏览器打开即可使用基础功能（模块化构建、PDF 导出、主题切换等）。

启用 AI 功能：在应用内「AI 设置」中填写你自己的 DeepSeek API Key 与 Base URL，即可使用润色、压缩与面试建议。

> 说明：首页示例图（`简历模板.jpg`）为可选素材，放入同目录即可显示，缺失时自动降级为占位文字，不影响功能。

## 部署到 Cloudflare Pages（含免费额度代理）

1. 将仓库部署到 Cloudflare Pages（构建命令留空，输出目录 `.`）。
2. 在 Pages 项目设置中添加环境变量 `OWNER_KEY`（你的 DeepSeek API Key）。
3. 创建 KV 命名空间，并在 `wrangler.toml` 中绑定为 `QUOTA`。
4. 部署完成后，访客无需填写 Key 即可使用 AI 功能（消耗站长免费额度）；额度耗尽后，应用会引导用户填写自己的 Key 直连模型。

配额与限流逻辑见 `functions/api/chat.js`，默认按客户端 IP 每日 60000 token，可在文件顶部常量中调整。

## 隐私说明

- 所有简历内容仅保存在浏览器 `localStorage`，不上传任何服务器。
- 通过代理调用时，请求体（简历文本）会发送至服务端以调用大模型，但不做任何持久化存储。
- 站长的 `OWNER_KEY` 仅存于服务端环境变量，不会下发到浏览器。

## 开源许可

本项目以 MIT 协议开源，详见 [LICENSE](./LICENSE)。

## 作者

made by lingrunlin
