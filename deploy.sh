#!/bin/bash

# PanSou Telegram Bot 部署脚本

echo "🚀 开始部署 PanSou Telegram Bot..."

# 检查是否安装了 wrangler
if ! command -v wrangler &> /dev/null; then
    echo "❌ 错误: 未找到 wrangler CLI"
    echo "请先安装: npm install -g wrangler"
    exit 1
fi

# 检查环境变量
if [ -z "$TELEGRAM_BOT_TOKEN" ]; then
    echo "❌ 错误: 未设置 TELEGRAM_BOT_TOKEN 环境变量"
    echo "请设置: export TELEGRAM_BOT_TOKEN='your_bot_token'"
    exit 1
fi

if [ -z "$PANSOU_API_URL" ]; then
    echo "⚠️  警告: 未设置 PANSOU_API_URL，将使用默认值"
    export PANSOU_API_URL="https://api.pansou.com"
fi

echo "📦 安装依赖..."
npm install

echo "🔧 配置环境变量..."
wrangler secret put TELEGRAM_BOT_TOKEN
wrangler secret put PANSOU_API_URL

echo "🚀 部署到 Cloudflare Workers..."
wrangler deploy

echo "✅ 部署完成！"
echo ""
echo "📋 下一步："
echo "1. 在 Cloudflare Workers 控制台设置环境变量"
echo "2. 设置 Telegram Webhook:"
echo "   curl -X POST \"https://api.telegram.org/bot\$TELEGRAM_BOT_TOKEN/setWebhook\" \\"
echo "        -H \"Content-Type: application/json\" \\"
echo "        -d '{\"url\": \"https://your-worker.your-subdomain.workers.dev/webhook\"}'"
echo ""
echo "🎉 机器人已准备就绪！"
