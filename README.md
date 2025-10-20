# PanSou Telegram Bot

一个基于 PanSou API 的 Telegram 网盘资源搜索机器人，可部署到 Cloudflare Workers。

## 功能特性

- 🔍 强大的网盘资源搜索
- 📱 友好的 Telegram 界面
- ⚡ 基于 Cloudflare Workers 的快速响应
- 🌐 支持多种网盘类型（百度网盘、阿里云盘、夸克网盘、天翼云盘、115网盘、PikPak、迅雷网盘、磁力链接等）
- 📊 智能结果分类和格式化显示
- 🔑 自动显示提取码/密码
- 📅 显示资源发布时间
- 🔗 显示数据来源（TG频道或插件）

## 部署步骤

### 1. 准备工作

1. 注册 [Cloudflare](https://cloudflare.com) 账户
2. 安装 [Wrangler CLI](https://developers.cloudflare.com/workers/wrangler/install-and-update/)
3. 创建 Telegram Bot：
   - 联系 [@BotFather](https://t.me/botfather)
   - 使用 `/newbot` 命令创建新机器人
   - 获取 Bot Token

### 2. 配置环境变量

在 Cloudflare Workers 控制台中设置以下环境变量：

```
TELEGRAM_BOT_TOKEN = "你的机器人Token"
PANSOU_API_URL = "https://find.966001.xyz"
```

### 3. 部署到 Cloudflare Workers

```bash
# 安装依赖
npm install

# 登录 Cloudflare
wrangler login

# 部署
npm run deploy
```

### 4. 设置 Webhook

部署完成后，设置 Telegram Webhook：

```bash
curl -X POST "https://api.telegram.org/bot<YOUR_BOT_TOKEN>/setWebhook" \
     -H "Content-Type: application/json" \
     -d '{"url": "https://your-worker.your-subdomain.workers.dev/webhook"}'
```

## 使用方法

### 基本命令

- `/start` - 开始使用机器人
- `/help` - 查看帮助信息
- `/search <关键词>` - 搜索资源
- `/s <关键词>` - 快捷搜索
- `/status` - 查看机器人状态

### 搜索功能

- 直接发送关键词进行搜索
- 支持搜索各种网盘资源
- 自动分类显示结果
- 显示资源大小、时间、来源等信息

## 项目结构

```
├── src/
│   └── index.js          # 主程序文件
├── package.json          # 项目配置
├── wrangler.toml         # Cloudflare Workers 配置
└── README.md            # 说明文档
```

## 技术栈

- **Cloudflare Workers** - 无服务器运行环境
- **Telegram Bot API** - 机器人接口
- **PanSou API** - 网盘搜索服务
- **JavaScript** - 编程语言

## 配置说明

### 环境变量

| 变量名 | 描述 | 必需 |
|--------|------|------|
| `TELEGRAM_BOT_TOKEN` | Telegram 机器人 Token | 是 |
| `PANSOU_API_URL` | PanSou API 地址 | 是 |

### PanSou API 参数

机器人支持以下 PanSou API 参数：

- `kw` - 搜索关键词（必需）
- `res` - 结果类型（默认：merge）
- `src` - 数据来源（默认：all）
- `refresh` - 强制刷新（默认：false）
- `conc` - 并发搜索数量
- `channels` - 搜索的频道列表
- `plugins` - 指定搜索的插件列表
- `cloud_types` - 指定返回的网盘类型列表
- `ext` - 扩展参数

### 支持的网盘类型

- 百度网盘 (baidu)
- 阿里云盘 (aliyun)
- 夸克网盘 (quark)
- 天翼云盘 (tianyi)
- UC网盘 (uc)
- 移动云盘 (mobile)
- 115网盘 (115)
- PikPak (pikpak)
- 迅雷网盘 (xunlei)
- 123网盘 (123)
- 磁力链接 (magnet)
- 电驴链接 (ed2k)

## 开发

### 本地开发

```bash
# 安装依赖
npm install

# 本地开发
npm run dev
```

### 调试

使用 Cloudflare Workers 控制台的实时日志功能进行调试。

## 注意事项

1. 确保 Bot Token 安全，不要泄露
2. 遵守 Telegram 和 PanSou API 的使用条款
3. 建议设置适当的速率限制
4. 定期更新依赖包

## 许可证

MIT License

## 支持

如有问题，请提交 Issue 或联系开发者。
