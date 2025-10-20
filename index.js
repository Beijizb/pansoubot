/**
 * PanSou Telegram Bot for Cloudflare Workers
 * 网盘资源搜索机器人
 */

// 日志存储（在 Cloudflare Workers 中，我们使用 KV 存储或简单的内存存储）
let logs = [];

/**
 * 添加日志
 */
function addLog(level, message, data = null) {
  const timestamp = new Date().toISOString();
  const logEntry = {
    timestamp,
    level,
    message,
    data: data ? JSON.stringify(data) : null
  };
  
  logs.push(logEntry);
  
  // 保持最近 100 条日志
  if (logs.length > 100) {
    logs = logs.slice(-100);
  }
  
  // 同时输出到控制台
  console.log(`[${timestamp}] ${level}: ${message}`, data || '');
}

/**
 * 获取日志
 */
function getLogs(limit = 20) {
  return logs.slice(-limit);
}

/**
 * 清空日志
 */
function clearLogs() {
  logs = [];
}

/**
 * 处理 Telegram Webhook 请求
 */
async function handleTelegramWebhook(request, env) {
  try {
    addLog('INFO', '收到 Telegram webhook 请求');
    const update = await request.json();
    addLog('DEBUG', '解析 webhook 数据', { messageType: update.message ? 'message' : update.callback_query ? 'callback_query' : 'unknown' });
    
    // 处理消息
    if (update.message) {
      await handleMessage(update.message, env);
    }
    
    // 处理回调查询
    if (update.callback_query) {
      await handleCallbackQuery(update.callback_query, env);
    }
    
    addLog('INFO', 'Webhook 处理完成');
    return new Response('OK', { status: 200 });
  } catch (error) {
    addLog('ERROR', '处理 Telegram webhook 错误', { error: error.message, stack: error.stack });
    console.error('处理 Telegram webhook 错误:', error);
    return new Response('Error', { status: 500 });
  }
}

/**
 * 处理消息
 */
async function handleMessage(message, env) {
  const chatId = message.chat.id;
  const text = message.text;
  const messageId = message.message_id;
  
  addLog('INFO', '处理消息', { chatId, text: text?.substring(0, 50), messageId });
  
  // 忽略旧消息
  if (message.date < Date.now() / 1000 - 300) {
    addLog('DEBUG', '忽略旧消息', { messageDate: new Date(message.date * 1000).toISOString() });
    return;
  }
  
  // 处理命令
  if (text && text.startsWith('/')) {
    addLog('INFO', '处理命令', { command: text.split(' ')[0] });
    await handleCommand(chatId, text, messageId, env);
  } else if (text) {
    // 处理搜索查询
    addLog('INFO', '处理搜索查询', { query: text });
    await handleSearch(chatId, text, messageId, env);
  }
}

/**
 * 处理命令
 */
async function handleCommand(chatId, text, messageId, env) {
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
        `• /status - 查看机器人状态\n` +
        `• /logs - 查看最近日志\n` +
        `• /clearlogs - 清空日志\n\n` +
        `开始搜索吧！🚀`, 
        messageId, env
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
        `• /status - 机器人状态\n` +
        `• /logs - 查看最近日志\n` +
        `• /clearlogs - 清空日志\n\n` +
        `*搜索示例：*\n` +
        `• 电影名称\n` +
        `• 软件名称\n` +
        `• 学习资料\n\n` +
        `*新功能：*\n` +
        `• 🔘 内联按钮选择网盘类型\n` +
        `• 📄 分页浏览搜索结果\n` +
        `• 🔄 一键刷新搜索\n` +
        `• 📊 实时日志监控\n\n` +
        `*支持的网盘类型：*\n` +
        `• 百度网盘、阿里云盘、夸克网盘\n` +
        `• 天翼云盘、115网盘、PikPak\n` +
        `• 迅雷网盘、磁力链接等\n\n` +
        `支持搜索各种网盘资源！`, 
        messageId, env
      );
      break;
      
    case '/search':
      const searchQuery = text.replace('/search', '').trim();
      if (searchQuery) {
        await performSearch(chatId, searchQuery, messageId, env);
      } else {
        await sendMessage(chatId, '请提供搜索关键词，例如：/search 电影名称', messageId, env);
      }
      break;
      
    case '/s':
      const shortSearchQuery = text.replace('/s', '').trim();
      if (shortSearchQuery) {
        await performSearch(chatId, shortSearchQuery, messageId, env);
      } else {
        await sendMessage(chatId, '请提供搜索关键词，例如：/s 电影名称', messageId, env);
      }
      break;
      
    case '/status':
      try {
        addLog('INFO', '检查机器人状态');
        
        // 检查环境变量
        const hasToken = env.TELEGRAM_BOT_TOKEN && env.TELEGRAM_BOT_TOKEN !== 'YOUR_BOT_TOKEN';
        const hasApiUrl = env.PANSOU_API_URL && env.PANSOU_API_URL !== 'PANSOUAPIURL';
        const apiUrl = env.PANSOU_API_URL || 'https://find.966001.xyz';
        
        addLog('DEBUG', '环境变量检查', { 
          hasToken, 
          hasApiUrl, 
          tokenLength: env.TELEGRAM_BOT_TOKEN?.length || 0,
          apiUrl: env.PANSOU_API_URL || 'default'
        });
        
        // 检查 PanSou API 健康状态
        const healthResponse = await fetch(`${apiUrl}/api/health`);
        const healthData = await healthResponse.json();
        
        addLog('INFO', 'API 健康检查成功', { status: healthData.status });
        
        let statusText = `🤖 *机器人状态*\n\n`;
        statusText += `✅ 运行正常\n`;
        statusText += `🔗 API: ${apiUrl}\n`;
        
        if (!hasToken) {
          statusText += `⚠️ Bot Token: 未设置或无效\n`;
        } else {
          statusText += `✅ Bot Token: 已设置\n`;
        }
        
        if (!hasApiUrl) {
          statusText += `⚠️ API URL: 使用默认值\n`;
        } else {
          statusText += `✅ API URL: 已设置\n`;
        }
        
        statusText += `📊 插件数量: ${healthData.plugin_count || '未知'}\n`;
        statusText += `📺 频道数量: ${healthData.channels_count || '未知'}\n`;
        statusText += `🔐 认证状态: ${healthData.auth_enabled ? '已启用' : '未启用'}\n`;
        statusText += `⏰ 时间: ${new Date().toLocaleString('zh-CN')}\n\n`;
        
        if (!hasToken || !hasApiUrl) {
          statusText += `⚠️ *环境变量未正确设置*\n`;
          statusText += `请在 Cloudflare Workers 控制台设置环境变量\n`;
        } else {
          statusText += `准备为您搜索资源！`;
        }
        
        await sendMessage(chatId, statusText, messageId, env);
      } catch (error) {
        addLog('ERROR', 'API 健康检查失败', { error: error.message });
        const apiUrl = env.PANSOU_API_URL || 'https://find.966001.xyz';
        await sendMessage(chatId, 
          `🤖 *机器人状态*\n\n` +
          `✅ 运行正常\n` +
          `❌ API 连接异常\n` +
          `🔗 API: ${apiUrl}\n` +
          `⏰ 时间: ${new Date().toLocaleString('zh-CN')}\n\n` +
          `请稍后重试或联系管理员`, 
          messageId, env
        );
      }
      break;
      
    case '/logs':
      try {
        const recentLogs = getLogs(10);
        let logText = `📋 *最近日志 (${recentLogs.length}条)*\n\n`;
        
        if (recentLogs.length === 0) {
          logText += '暂无日志记录';
        } else {
          recentLogs.forEach((log, index) => {
            const time = new Date(log.timestamp).toLocaleString('zh-CN');
            const level = log.level === 'ERROR' ? '❌' : log.level === 'WARN' ? '⚠️' : log.level === 'INFO' ? 'ℹ️' : '🔍';
            logText += `${index + 1}. ${level} [${time}]\n`;
            logText += `   ${log.message}\n`;
            if (log.data) {
              logText += `   📄 ${log.data}\n`;
            }
            logText += '\n';
          });
        }
        
        await sendMessage(chatId, logText, messageId, env);
      } catch (error) {
        addLog('ERROR', '获取日志失败', { error: error.message });
        await sendMessage(chatId, '❌ 获取日志失败', messageId, env);
      }
      break;
      
    case '/clearlogs':
      try {
        clearLogs();
        addLog('INFO', '日志已清空');
        await sendMessage(chatId, '✅ 日志已清空', messageId, env);
      } catch (error) {
        addLog('ERROR', '清空日志失败', { error: error.message });
        await sendMessage(chatId, '❌ 清空日志失败', messageId, env);
      }
      break;
      
    case '/test':
      try {
        const testQuery = '测试';
        addLog('INFO', '开始测试搜索', { query: testQuery });
        
        const testResults = await callPanSouAPI(testQuery, {}, env);
        addLog('DEBUG', '测试搜索结果', { 
          hasResults: !!(testResults.merged_by_type || testResults.results),
          resultKeys: Object.keys(testResults),
          total: testResults.total,
          mergedByTypeKeys: testResults.merged_by_type ? Object.keys(testResults.merged_by_type) : 'none',
          resultsLength: testResults.results ? testResults.results.length : 'none'
        });
        
        let testText = `🧪 *API 测试结果*\n\n`;
        testText += `🔗 API: ${env.PANSOU_API_URL || 'https://find.966001.xyz'}\n`;
        testText += `📊 响应键: ${Object.keys(testResults).join(', ')}\n`;
        testText += `📈 总数: ${testResults.total || '未知'}\n`;
        testText += `📁 类型数: ${testResults.merged_by_type ? Object.keys(testResults.merged_by_type).length : '无'}\n`;
        testText += `📋 结果数: ${testResults.results ? testResults.results.length : '无'}\n\n`;
        
        if (testResults.merged_by_type) {
          testText += `*按类型分组:*\n`;
          Object.keys(testResults.merged_by_type).forEach(type => {
            testText += `• ${getTypeDisplayName(type)}: ${testResults.merged_by_type[type].length}个\n`;
          });
        }
        
        if (testResults.results && testResults.results.length > 0) {
          testText += `\n*前3个结果:*\n`;
          testResults.results.slice(0, 3).forEach((item, index) => {
            testText += `${index + 1}. ${item.title || item.note || '无标题'}\n`;
          });
        }
        
        await sendMessage(chatId, testText, messageId, env);
      } catch (error) {
        addLog('ERROR', '测试搜索失败', { error: error.message });
        await sendMessage(chatId, `❌ 测试失败: ${error.message}`, messageId, env);
      }
      break;
      
    default:
      await sendMessage(chatId, '未知命令，请使用 /help 查看可用命令', messageId, env);
  }
}

/**
 * 处理搜索查询
 */
async function handleSearch(chatId, query, messageId, env) {
  if (query.length < 2) {
    await sendMessage(chatId, '搜索关键词太短，请至少输入2个字符', messageId, env);
    return;
  }
  
  await performSearch(chatId, query, messageId, env);
}

/**
 * 执行搜索
 */
async function performSearch(chatId, query, messageId, env) {
  try {
    addLog('INFO', '开始搜索', { query, chatId });
    
    // 发送搜索中消息
    const searchingMsg = await sendMessage(chatId, `🔍 正在搜索 "${query}"...`, messageId, env);
    
    // 调用 PanSou API
    addLog('DEBUG', '调用 PanSou API', { query });
    const searchResults = await callPanSouAPI(query, {}, env);
    
    if (searchResults && (searchResults.merged_by_type || searchResults.results)) {
      const resultCount = searchResults.merged_by_type ? 
        Object.keys(searchResults.merged_by_type).length : 
        (searchResults.results ? searchResults.results.length : 0);
      
      addLog('INFO', '搜索成功', { query, resultCount, hasMergedByType: !!searchResults.merged_by_type, hasResults: !!searchResults.results });
      await sendSearchResultsWithButtons(chatId, query, searchResults, searchingMsg.message_id, env);
    } else {
      addLog('WARN', '搜索无结果', { query, searchResults: searchResults ? Object.keys(searchResults) : 'null' });
      await editMessage(chatId, searchingMsg.message_id, 
        `❌ 搜索 "${query}" 未找到结果\n\n请尝试其他关键词或检查拼写。`, env);
    }
  } catch (error) {
    addLog('ERROR', '搜索失败', { query, error: error.message, stack: error.stack });
    console.error('搜索错误:', error);
    await sendMessage(chatId, 
      `❌ 搜索时发生错误，请稍后重试\n\n错误信息: ${error.message}`, 
      messageId, env
    );
  }
}

/**
 * 调用 PanSou API
 */
async function callPanSouAPI(query, options = {}, env) {
  const apiUrl = env.PANSOU_API_URL || 'https://find.966001.xyz';
  addLog('DEBUG', '准备调用 PanSou API', { apiUrl, query });
  
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
  
  addLog('DEBUG', 'API 请求参数', requestBody);
  
  const response = await fetch(`${apiUrl}/api/search`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'User-Agent': 'PanSou-TG-Bot/1.0'
    },
    body: JSON.stringify(requestBody)
  });
  
  addLog('DEBUG', 'API 响应状态', { status: response.status, statusText: response.statusText });
  
  if (!response.ok) {
    const errorText = await response.text();
    addLog('ERROR', 'API 请求失败', { status: response.status, errorText });
    
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
  
  const result = await response.json();
  addLog('DEBUG', 'API 响应成功', { 
    code: result.code,
    message: result.message,
    hasData: !!result.data,
    hasResults: !!(result.data && result.data.merged_by_type), 
    total: result.data ? result.data.total : result.total,
    hasResultsArray: !!(result.data && result.data.results) || !!result.results,
    resultKeys: Object.keys(result),
    dataKeys: result.data ? Object.keys(result.data) : 'none',
    mergedByTypeKeys: result.data && result.data.merged_by_type ? Object.keys(result.data.merged_by_type) : (result.merged_by_type ? Object.keys(result.merged_by_type) : 'none')
  });
  
  // 处理新的 API 响应格式
  if (result.code === 0 && result.data) {
    return result.data;
  }
  
  return result;
}

/**
 * 发送搜索结果
 */
async function sendSearchResults(chatId, query, results, messageId, env) {
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
  
  await editMessage(chatId, messageId, responseText, env);
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
async function handleCallbackQuery(callbackQuery, env) {
  const chatId = callbackQuery.message.chat.id;
  const messageId = callbackQuery.message.message_id;
  const data = callbackQuery.data;
  
  addLog('INFO', '处理回调查询', { data, chatId });
  
  try {
    // 解析回调数据
    const [action, ...params] = data.split(':');
    
    switch (action) {
      case 'search':
        await handleSearchCallback(chatId, messageId, params, env);
        break;
      case 'type':
        await handleTypeCallback(chatId, messageId, params, env);
        break;
      case 'page':
        await handlePageCallback(chatId, messageId, params, env);
        break;
      case 'refresh':
        await handleRefreshCallback(chatId, messageId, params, env);
        break;
      default:
        addLog('WARN', '未知的回调操作', { action, data });
        await answerCallbackQuery(callbackQuery.id, '未知操作', env);
    }
  } catch (error) {
    addLog('ERROR', '处理回调查询失败', { error: error.message, data });
    await answerCallbackQuery(callbackQuery.id, '处理失败', env);
  }
}

/**
 * 处理搜索回调
 */
async function handleSearchCallback(chatId, messageId, params, env) {
  const [query, type, page] = params;
  addLog('INFO', '处理搜索回调', { query, type, page });
  
  try {
    const searchResults = await callPanSouAPI(query, { cloud_types: type ? [type] : null }, env);
    await sendSearchResultsWithButtons(chatId, query, searchResults, messageId, env, type, parseInt(page) || 1);
  } catch (error) {
    addLog('ERROR', '搜索回调失败', { error: error.message, query, type });
    await editMessage(chatId, messageId, `❌ 搜索失败: ${error.message}`, env);
  }
}

/**
 * 处理类型选择回调
 */
async function handleTypeCallback(chatId, messageId, params, env) {
  const [query, type, page] = params;
  addLog('INFO', '处理类型选择回调', { query, type, page });
  
  try {
    const searchResults = await callPanSouAPI(query, { cloud_types: [type] }, env);
    await sendSearchResultsWithButtons(chatId, query, searchResults, messageId, env, type, parseInt(page) || 1);
  } catch (error) {
    addLog('ERROR', '类型选择回调失败', { error: error.message, query, type });
    await editMessage(chatId, messageId, `❌ 筛选失败: ${error.message}`, env);
  }
}

/**
 * 处理翻页回调
 */
async function handlePageCallback(chatId, messageId, params, env) {
  const [query, type, page] = params;
  addLog('INFO', '处理翻页回调', { query, type, page: parseInt(page) });
  
  try {
    const searchResults = await callPanSouAPI(query, { cloud_types: type ? [type] : null }, env);
    await sendSearchResultsWithButtons(chatId, query, searchResults, messageId, env, type, parseInt(page));
  } catch (error) {
    addLog('ERROR', '翻页回调失败', { error: error.message, query, type, page });
    await editMessage(chatId, messageId, `❌ 翻页失败: ${error.message}`, env);
  }
}

/**
 * 处理刷新回调
 */
async function handleRefreshCallback(chatId, messageId, params, env) {
  const [query, type] = params;
  addLog('INFO', '处理刷新回调', { query, type });
  
  try {
    const searchResults = await callPanSouAPI(query, { 
      cloud_types: type ? [type] : null,
      refresh: true 
    }, env);
    await sendSearchResultsWithButtons(chatId, query, searchResults, messageId, env, type, 1);
  } catch (error) {
    addLog('ERROR', '刷新回调失败', { error: error.message, query, type });
    await editMessage(chatId, messageId, `❌ 刷新失败: ${error.message}`, env);
  }
}

/**
 * 发送带按钮的搜索结果
 */
async function sendSearchResultsWithButtons(chatId, query, results, messageId, env, selectedType = null, currentPage = 1) {
  const { merged_by_type, total, results: resultsArray } = results;
  const itemsPerPage = 5;
  
  addLog('DEBUG', '处理搜索结果', { 
    hasMergedByType: !!merged_by_type, 
    hasResultsArray: !!resultsArray,
    total,
    selectedType,
    currentPage
  });
  
  let availableTypes = [];
  let allItems = [];
  
  // 处理不同的 API 响应格式
  if (merged_by_type) {
    // 标准格式：按类型分组
    availableTypes = Object.keys(merged_by_type).filter(type => 
      merged_by_type[type] && merged_by_type[type].length > 0
    );
    
    const displayTypes = selectedType ? [selectedType] : availableTypes;
    
    // 收集所有要显示的项目
    for (const type of displayTypes) {
      if (merged_by_type[type] && merged_by_type[type].length > 0) {
        const items = merged_by_type[type].map((resource, index) => ({
          ...resource,
          type,
          originalIndex: index
        }));
        allItems = allItems.concat(items);
      }
    }
  } else if (resultsArray && resultsArray.length > 0) {
    // 备用格式：直接结果数组
    addLog('DEBUG', '使用结果数组格式', { resultCount: resultsArray.length });
    
    // 从结果中提取类型信息
    const typeMap = {};
    resultsArray.forEach((item, index) => {
      const type = item.cloud_type || 'other';
      if (!typeMap[type]) {
        typeMap[type] = [];
      }
      typeMap[type].push({
        ...item,
        type,
        originalIndex: index
      });
    });
    
    availableTypes = Object.keys(typeMap);
    const displayTypes = selectedType ? [selectedType] : availableTypes;
    
    for (const type of displayTypes) {
      if (typeMap[type] && typeMap[type].length > 0) {
        allItems = allItems.concat(typeMap[type]);
      }
    }
  }
  
  let responseText = `🔍 *搜索结果: "${query}"*\n`;
  if (selectedType) {
    responseText += `📁 类型: ${getTypeDisplayName(selectedType)}\n`;
  }
  responseText += `📊 总计: ${total || allItems.length || '未知'} 个结果\n\n`;
  
  // 分页
  const totalPages = Math.ceil(allItems.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const pageItems = allItems.slice(startIndex, endIndex);
  
  let totalResults = 0; // 初始化 totalResults 变量
  
  // 显示当前页的项目
  if (pageItems.length > 0) {
    pageItems.forEach((item, index) => {
      const globalIndex = startIndex + index + 1;
      const title = item.title || item.note || '未知标题';
      const displayTitle = title.length > 40 ? title.substring(0, 37) + '...' : title;
      
      responseText += `${globalIndex}. ${displayTitle}\n`;
      
      if (item.password) {
        responseText += `   🔑 密码: \`${item.password}\`\n`;
      }
      
      if (item.datetime) {
        const date = new Date(item.datetime);
        const formattedDate = date.toLocaleString('zh-CN', {
          month: '2-digit',
          day: '2-digit',
          hour: '2-digit',
          minute: '2-digit'
        });
        responseText += `   📅 ${formattedDate}\n`;
      }
      
      if (item.source) {
        responseText += `   🔗 来源: ${item.source}\n`;
      }
      
      if (item.url) {
        const shortUrl = item.url.length > 35 ? 
          item.url.substring(0, 32) + '...' : item.url;
        responseText += `   🔗 ${shortUrl}\n`;
      }
      
      responseText += '\n';
      totalResults++;
    });
    
    if (totalPages > 1) {
      responseText += `📄 第 ${currentPage}/${totalPages} 页\n`;
    }
  } else {
    responseText += '❌ 未找到相关资源';
  }
  
  // 创建内联键盘
  const keyboard = createSearchKeyboard(query, availableTypes, selectedType, currentPage, totalPages);
  
  // 发送或编辑消息
  if (messageId) {
    await editMessageWithKeyboard(chatId, messageId, responseText, keyboard, env);
  } else {
    await sendMessageWithKeyboard(chatId, responseText, keyboard, env);
  }
}

/**
 * 创建搜索键盘
 */
function createSearchKeyboard(query, availableTypes, selectedType, currentPage, totalPages) {
  const keyboard = [];
  
  // 类型选择按钮（第一行）
  if (availableTypes.length > 1) {
    const typeButtons = [];
    availableTypes.slice(0, 3).forEach(type => {
      const isSelected = selectedType === type;
      typeButtons.push({
        text: `${isSelected ? '✅' : ''}${getTypeDisplayName(type)}`,
        callback_data: `type:${query}:${type}:${currentPage}`
      });
    });
    keyboard.push(typeButtons);
    
    // 如果类型超过3个，添加更多按钮
    if (availableTypes.length > 3) {
      const moreTypeButtons = [];
      availableTypes.slice(3, 6).forEach(type => {
        const isSelected = selectedType === type;
        moreTypeButtons.push({
          text: `${isSelected ? '✅' : ''}${getTypeDisplayName(type)}`,
          callback_data: `type:${query}:${type}:${currentPage}`
        });
      });
      keyboard.push(moreTypeButtons);
    }
    
    // 全部类型按钮
    keyboard.push([{
      text: selectedType ? '🔄 显示全部' : '✅ 全部类型',
      callback_data: `search:${query}::${currentPage}`
    }]);
  }
  
  // 翻页按钮
  if (totalPages > 1) {
    const pageButtons = [];
    
    if (currentPage > 1) {
      pageButtons.push({
        text: '⬅️ 上一页',
        callback_data: `page:${query}:${selectedType || ''}:${currentPage - 1}`
      });
    }
    
    pageButtons.push({
      text: `${currentPage}/${totalPages}`,
      callback_data: 'noop'
    });
    
    if (currentPage < totalPages) {
      pageButtons.push({
        text: '下一页 ➡️',
        callback_data: `page:${query}:${selectedType || ''}:${currentPage + 1}`
      });
    }
    
    keyboard.push(pageButtons);
  }
  
  // 操作按钮
  const actionButtons = [];
  actionButtons.push({
    text: '🔄 刷新',
    callback_data: `refresh:${query}:${selectedType || ''}`
  });
  
  if (selectedType) {
    actionButtons.push({
      text: '🔍 重新搜索',
      callback_data: `search:${query}::1`
    });
  }
  
  keyboard.push(actionButtons);
  
  return keyboard;
}

/**
 * 发送消息
 */
async function sendMessage(chatId, text, replyToMessageId = null, env) {
  const payload = {
    chat_id: chatId,
    text: text,
    parse_mode: 'Markdown',
    disable_web_page_preview: true
  };
  
  if (replyToMessageId) {
    payload.reply_to_message_id = replyToMessageId;
  }
  
  const response = await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
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
 * 发送带键盘的消息
 */
async function sendMessageWithKeyboard(chatId, text, keyboard, env) {
  const payload = {
    chat_id: chatId,
    text: text,
    parse_mode: 'Markdown',
    disable_web_page_preview: true,
    reply_markup: {
      inline_keyboard: keyboard
    }
  };
  
  const response = await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  });
  
  if (!response.ok) {
    throw new Error(`发送带键盘消息失败: ${response.status}`);
  }
  
  return await response.json();
}

/**
 * 编辑消息
 */
async function editMessage(chatId, messageId, text, env) {
  const payload = {
    chat_id: chatId,
    message_id: messageId,
    text: text,
    parse_mode: 'Markdown',
    disable_web_page_preview: true
  };
  
  const response = await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/editMessageText`, {
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
 * 编辑带键盘的消息
 */
async function editMessageWithKeyboard(chatId, messageId, text, keyboard, env) {
  const payload = {
    chat_id: chatId,
    message_id: messageId,
    text: text,
    parse_mode: 'Markdown',
    disable_web_page_preview: true,
    reply_markup: {
      inline_keyboard: keyboard
    }
  };
  
  const response = await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/editMessageText`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  });
  
  if (!response.ok) {
    console.error('编辑带键盘消息失败:', response.status);
  }
  
  return await response.json();
}

/**
 * 回答回调查询
 */
async function answerCallbackQuery(callbackQueryId, text, env) {
  const payload = {
    callback_query_id: callbackQueryId,
    text: text
  };
  
  const response = await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/answerCallbackQuery`, {
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
 * 处理日志查看页面
 */
async function handleLogsPage(env) {
  const recentLogs = getLogs(50);
  
  let html = `
<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>PanSou Bot 日志</title>
    <style>
        body { font-family: 'Consolas', 'Monaco', monospace; margin: 20px; background: #f5f5f5; }
        .container { max-width: 1200px; margin: 0 auto; background: white; padding: 20px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
        .header { border-bottom: 2px solid #007bff; padding-bottom: 10px; margin-bottom: 20px; }
        .log-entry { margin-bottom: 15px; padding: 10px; border-left: 4px solid #ddd; background: #f9f9f9; }
        .log-entry.error { border-left-color: #dc3545; background: #f8d7da; }
        .log-entry.warn { border-left-color: #ffc107; background: #fff3cd; }
        .log-entry.info { border-left-color: #007bff; background: #d1ecf1; }
        .log-entry.debug { border-left-color: #6c757d; background: #e2e3e5; }
        .log-time { color: #666; font-size: 0.9em; }
        .log-level { font-weight: bold; margin-right: 10px; }
        .log-message { margin: 5px 0; }
        .log-data { background: #f8f9fa; padding: 8px; border-radius: 4px; font-size: 0.9em; margin-top: 5px; }
        .refresh-btn { background: #007bff; color: white; padding: 10px 20px; border: none; border-radius: 4px; cursor: pointer; margin-bottom: 20px; }
        .refresh-btn:hover { background: #0056b3; }
        .stats { display: flex; gap: 20px; margin-bottom: 20px; }
        .stat-box { background: #e9ecef; padding: 15px; border-radius: 4px; text-align: center; }
        .stat-number { font-size: 24px; font-weight: bold; color: #007bff; }
        .stat-label { font-size: 14px; color: #666; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🔍 PanSou Bot 日志监控</h1>
            <p>实时查看机器人运行状态和错误信息</p>
        </div>
        
        <button class="refresh-btn" onclick="location.reload()">🔄 刷新日志</button>
        
        <div class="stats">
            <div class="stat-box">
                <div class="stat-number">${recentLogs.length}</div>
                <div class="stat-label">总日志数</div>
            </div>
            <div class="stat-box">
                <div class="stat-number">${recentLogs.filter(log => log.level === 'ERROR').length}</div>
                <div class="stat-label">错误数</div>
            </div>
            <div class="stat-box">
                <div class="stat-number">${recentLogs.filter(log => log.level === 'WARN').length}</div>
                <div class="stat-label">警告数</div>
            </div>
            <div class="stat-box">
                <div class="stat-number">${recentLogs.filter(log => log.level === 'INFO').length}</div>
                <div class="stat-label">信息数</div>
            </div>
        </div>
        
        <div class="logs">
`;

  if (recentLogs.length === 0) {
    html += '<p>暂无日志记录</p>';
  } else {
    recentLogs.reverse().forEach((log) => {
      const time = new Date(log.timestamp).toLocaleString('zh-CN');
      const levelClass = log.level.toLowerCase();
      const levelIcon = log.level === 'ERROR' ? '❌' : log.level === 'WARN' ? '⚠️' : log.level === 'INFO' ? 'ℹ️' : '🔍';
      
      html += `
        <div class="log-entry ${levelClass}">
            <div class="log-time">${time}</div>
            <div class="log-message">
                <span class="log-level">${levelIcon} ${log.level}</span>
                ${log.message}
            </div>
            ${log.data ? `<div class="log-data">${log.data}</div>` : ''}
        </div>
      `;
    });
  }
  
  html += `
        </div>
    </div>
    
    <script>
        // 自动刷新页面（每30秒）
        setTimeout(() => location.reload(), 30000);
    </script>
</body>
</html>
  `;
  
  return new Response(html, {
    headers: { 'Content-Type': 'text/html; charset=utf-8' }
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
    
    // 日志查看页面
    if (path === '/logs' || path === '/admin') {
      return handleLogsPage(env);
    }
    
    // Telegram Webhook
    if (path === '/webhook' || path === '/') {
      if (request.method === 'POST') {
        return handleTelegramWebhook(request, env);
      } else {
        return new Response('PanSou Telegram Bot is running!', { status: 200 });
      }
    }
    
    // 404
    return new Response('Not Found', { status: 404 });
  }
};
