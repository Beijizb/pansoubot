/**
 * PanSou Telegram Bot for Cloudflare Workers
 * 网盘资源搜索机器人
 */

// 环境变量
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || 'YOUR_BOT_TOKEN';
const PANSOU_API_URL = process.env.PANSOU_API_URL || 'https://api.pansou.com';

/**
 * 处理 Telegram Webhook 请求
 */
async function handleTelegramWebhook(request) {
  try {
    const update = await request.json();
    
    // 处理消息
    if (update.message) {
      await handleMessage(update.message);
    }
    
    // 处理回调查询
    if (update.callback_query) {
      await handleCallbackQuery(update.callback_query);
    }
    
    return new Response('OK', { status: 200 });
  } catch (error) {
    console.error('处理 Telegram webhook 错误:', error);
    return new Response('Error', { status: 500 });
  }
}

/**
 * 处理消息
 */
async function handleMessage(message) {
  const chatId = message.chat.id;
  const text = message.text;
  const messageId = message.message_id;
  
  // 忽略旧消息
  if (message.date < Date.now() / 1000 - 300) {
    return;
  }
  
  // 处理命令
  if (text && text.startsWith('/')) {
    await handleCommand(chatId, text, messageId);
  } else if (text) {
    // 处理搜索查询
    await handleSearch(chatId, text, messageId);
  }
}

/**
 * 处理命令
 */
async function handleCommand(chatId, text, messageId) {
  const command = text.split(' ')[0].toLowerCase();
  
  switch (command) {
    case '/start':
      await sendMessage(chatId, 
        `🔍 *PanSou 网盘搜索机器人*\n\n` +
        `欢迎使用！我可以帮您搜索各种网盘资源。\n\n` +
        `*使用方法：*\n` +
        `• 直接发送关键词进行搜索\n` +
        `• /help - 查看帮助信息\n` +
        `• /search <关键词> - 搜索资源\n` +
        `• /s <关键词> - 快捷搜索\n` +
        `• /status - 查看机器人状态\n\n` +
        `开始搜索吧！🚀`, 
        messageId
      );
      break;
      
    case '/help':
      await sendMessage(chatId, 
        `📖 *帮助信息*\n\n` +
        `*搜索命令：*\n` +
        `• 直接发送关键词\n` +
        `• /search <关键词>\n` +
        `• /s <关键词> (快捷搜索)\n\n` +
        `*其他命令：*\n` +
        `• /start - 开始使用\n` +
        `• /help - 显示此帮助\n` +
        `• /status - 机器人状态\n\n` +
        `*搜索示例：*\n` +
        `• 电影名称\n` +
        `• 软件名称\n` +
        `• 学习资料\n\n` +
        `*支持的网盘类型：*\n` +
        `• 百度网盘、阿里云盘、夸克网盘\n` +
        `• 天翼云盘、115网盘、PikPak\n` +
        `• 迅雷网盘、磁力链接等\n\n` +
        `支持搜索各种网盘资源！`, 
        messageId
      );
      break;
      
    case '/search':
      const searchQuery = text.replace('/search', '').trim();
      if (searchQuery) {
        await performSearch(chatId, searchQuery, messageId);
      } else {
        await sendMessage(chatId, '请提供搜索关键词，例如：/search 电影名称', messageId);
      }
      break;
      
    case '/s':
      const shortSearchQuery = text.replace('/s', '').trim();
      if (shortSearchQuery) {
        await performSearch(chatId, shortSearchQuery, messageId);
      } else {
        await sendMessage(chatId, '请提供搜索关键词，例如：/s 电影名称', messageId);
      }
      break;
      
    case '/status':
      try {
        // 检查 PanSou API 健康状态
        const healthResponse = await fetch(`${PANSOU_API_URL}/api/health`);
        const healthData = await healthResponse.json();
        
        await sendMessage(chatId, 
          `🤖 *机器人状态*\n\n` +
          `✅ 运行正常\n` +
          `🔗 API: ${PANSOU_API_URL}\n` +
          `📊 插件数量: ${healthData.plugin_count || '未知'}\n` +
          `📺 频道数量: ${healthData.channels_count || '未知'}\n` +
          `🔐 认证状态: ${healthData.auth_enabled ? '已启用' : '未启用'}\n` +
          `⏰ 时间: ${new Date().toLocaleString('zh-CN')}\n\n` +
          `准备为您搜索资源！`, 
          messageId
        );
      } catch (error) {
        await sendMessage(chatId, 
          `🤖 *机器人状态*\n\n` +
          `✅ 运行正常\n` +
          `❌ API 连接异常\n` +
          `🔗 API: ${PANSOU_API_URL}\n` +
          `⏰ 时间: ${new Date().toLocaleString('zh-CN')}\n\n` +
          `请稍后重试或联系管理员`, 
          messageId
        );
      }
      break;
      
    default:
      await sendMessage(chatId, '未知命令，请使用 /help 查看可用命令', messageId);
  }
}

/**
 * 处理搜索查询
 */
async function handleSearch(chatId, query, messageId) {
  if (query.length < 2) {
    await sendMessage(chatId, '搜索关键词太短，请至少输入2个字符', messageId);
    return;
  }
  
  await performSearch(chatId, query, messageId);
}

/**
 * 执行搜索
 */
async function performSearch(chatId, query, messageId) {
  try {
    // 发送搜索中消息
    const searchingMsg = await sendMessage(chatId, `🔍 正在搜索 "${query}"...`, messageId);
    
    // 调用 PanSou API
    const searchResults = await callPanSouAPI(query);
    
    if (searchResults && searchResults.merged_by_type) {
      await sendSearchResults(chatId, query, searchResults, searchingMsg.message_id);
    } else {
      await editMessage(chatId, searchingMsg.message_id, 
        `❌ 搜索 "${query}" 未找到结果\n\n请尝试其他关键词或检查拼写。`);
    }
  } catch (error) {
    console.error('搜索错误:', error);
    await sendMessage(chatId, 
      `❌ 搜索时发生错误，请稍后重试\n\n错误信息: ${error.message}`, 
      messageId
    );
  }
}

/**
 * 调用 PanSou API
 */
async function callPanSouAPI(query, options = {}) {
  const requestBody = {
    kw: query,
    res: options.res || 'merge',
    src: options.src || 'all',
    refresh: options.refresh || false,
    conc: options.conc || null, // 并发搜索数量
    channels: options.channels || null, // 搜索频道列表
    plugins: options.plugins || null, // 指定插件列表
    cloud_types: options.cloud_types || null, // 指定网盘类型
    ext: options.ext || null // 扩展参数
  };
  
  // 移除 null 值
  Object.keys(requestBody).forEach(key => {
    if (requestBody[key] === null) {
      delete requestBody[key];
    }
  });
  
  const response = await fetch(`${PANSOU_API_URL}/api/search`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'User-Agent': 'PanSou-TG-Bot/1.0'
    },
    body: JSON.stringify(requestBody)
  });
  
  if (!response.ok) {
    const errorText = await response.text();
    let errorMessage = `API 请求失败: ${response.status}`;
    
    try {
      const errorData = JSON.parse(errorText);
      if (errorData.message) {
        errorMessage = errorData.message;
      } else if (errorData.error) {
        errorMessage = errorData.error;
      }
    } catch (e) {
      // 如果解析失败，使用原始错误文本
      if (errorText) {
        errorMessage = errorText;
      }
    }
    
    throw new Error(errorMessage);
  }
  
  return await response.json();
}

/**
 * 发送搜索结果
 */
async function sendSearchResults(chatId, query, results, messageId) {
  const { merged_by_type, total } = results;
  let responseText = `🔍 *搜索结果: "${query}"*\n`;
  
  if (total !== undefined) {
    responseText += `📊 总计: ${total} 个结果\n\n`;
  } else {
    responseText += '\n';
  }
  
  let totalResults = 0;
  const maxResults = 8; // 限制每个类型显示结果数量
  
  // 遍历不同类型的资源
  for (const [type, resources] of Object.entries(merged_by_type)) {
    if (resources && resources.length > 0) {
      responseText += `📁 *${getTypeDisplayName(type)}* (${resources.length}个结果)\n`;
      
      const displayCount = Math.min(resources.length, maxResults);
      for (let i = 0; i < displayCount; i++) {
        const resource = resources[i];
        const title = resource.title || resource.note || '未知标题';
        
        // 限制标题长度
        const displayTitle = title.length > 50 ? title.substring(0, 47) + '...' : title;
        responseText += `\n${i + 1}. ${displayTitle}\n`;
        
        if (resource.password) {
          responseText += `   🔑 密码: \`${resource.password}\`\n`;
        }
        
        if (resource.datetime) {
          const date = new Date(resource.datetime);
          const formattedDate = date.toLocaleString('zh-CN', {
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit'
          });
          responseText += `   📅 ${formattedDate}\n`;
        }
        
        if (resource.source) {
          responseText += `   🔗 来源: ${resource.source}\n`;
        }
        
        if (resource.url) {
          // 缩短链接显示
          const shortUrl = resource.url.length > 40 ? 
            resource.url.substring(0, 37) + '...' : resource.url;
          responseText += `   🔗 ${shortUrl}\n`;
        }
        
        totalResults++;
      }
      
      if (resources.length > maxResults) {
        responseText += `\n   ... 还有 ${resources.length - maxResults} 个结果\n`;
      }
      
      responseText += '\n';
    }
  }
  
  if (totalResults === 0) {
    responseText += '❌ 未找到相关资源\n\n';
    responseText += '💡 *搜索建议：*\n';
    responseText += '• 尝试使用更简单的关键词\n';
    responseText += '• 检查拼写是否正确\n';
    responseText += '• 尝试使用英文关键词\n';
    responseText += '• 使用 /help 查看帮助';
  } else {
    responseText += `✅ 共显示 ${totalResults} 个相关资源`;
  }
  
  // 如果消息太长，分割发送
  if (responseText.length > 4000) {
    responseText = responseText.substring(0, 3900) + '\n\n... (结果过长，已截断)';
  }
  
  await editMessage(chatId, messageId, responseText);
}

/**
 * 获取类型显示名称
 */
function getTypeDisplayName(type) {
  const typeMap = {
    'baidu': '百度网盘',
    'aliyun': '阿里云盘',
    'quark': '夸克网盘',
    'tianyi': '天翼云盘',
    'uc': 'UC网盘',
    'mobile': '移动云盘',
    '115': '115网盘',
    'pikpak': 'PikPak',
    'xunlei': '迅雷网盘',
    '123': '123网盘',
    'magnet': '磁力链接',
    'ed2k': '电驴链接',
    'onedrive': 'OneDrive',
    'google': 'Google Drive',
    'other': '其他网盘'
  };
  return typeMap[type] || type;
}

/**
 * 处理回调查询
 */
async function handleCallbackQuery(callbackQuery) {
  const chatId = callbackQuery.message.chat.id;
  const messageId = callbackQuery.message.message_id;
  const data = callbackQuery.data;
  
  // 回答回调查询
  await answerCallbackQuery(callbackQuery.id, '处理中...');
  
  // 这里可以添加更多回调查询处理逻辑
}

/**
 * 发送消息
 */
async function sendMessage(chatId, text, replyToMessageId = null) {
  const payload = {
    chat_id: chatId,
    text: text,
    parse_mode: 'Markdown',
    disable_web_page_preview: true
  };
  
  if (replyToMessageId) {
    payload.reply_to_message_id = replyToMessageId;
  }
  
  const response = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  });
  
  if (!response.ok) {
    throw new Error(`发送消息失败: ${response.status}`);
  }
  
  return await response.json();
}

/**
 * 编辑消息
 */
async function editMessage(chatId, messageId, text) {
  const payload = {
    chat_id: chatId,
    message_id: messageId,
    text: text,
    parse_mode: 'Markdown',
    disable_web_page_preview: true
  };
  
  const response = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/editMessageText`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  });
  
  if (!response.ok) {
    console.error('编辑消息失败:', response.status);
  }
  
  return await response.json();
}

/**
 * 回答回调查询
 */
async function answerCallbackQuery(callbackQueryId, text) {
  const payload = {
    callback_query_id: callbackQueryId,
    text: text
  };
  
  const response = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/answerCallbackQuery`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  });
  
  return await response.json();
}

/**
 * 健康检查
 */
async function handleHealthCheck() {
  return new Response(JSON.stringify({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    service: 'PanSou Telegram Bot'
  }), {
    headers: { 'Content-Type': 'application/json' }
  });
}

/**
 * 主处理函数
 */
export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const path = url.pathname;
    
    // 健康检查
    if (path === '/health' || path === '/api/health') {
      return handleHealthCheck();
    }
    
    // Telegram Webhook
    if (path === '/webhook' || path === '/') {
      if (request.method === 'POST') {
        return handleTelegramWebhook(request);
      } else {
        return new Response('PanSou Telegram Bot is running!', { status: 200 });
      }
    }
    
    // 404
    return new Response('Not Found', { status: 404 });
  }
};
