// scripts/generate-feed.mjs
import Parser from 'rss-parser';
import { writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

// 获取当前文件的目录（用于正确输出 feed.json 的路径）
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// ==================== 你的 RSS 订阅列表（按需修改） ====================
const RSS_SOURCES = [
  { url: 'https://openai.com/news/rss.xml', source: 'OpenAI' },
 // { url: 'https://fetchrss.com/rss/671e6e7a8a1a5a8c0b8b4567', source: 'Anthropic' },
  { url: 'https://rss.arxiv.org/rss/cs.AI+cs.LG+stat.ML+cs.DB', source: 'arXiv' },
  { url: 'https://blog.google/technology/ai/rss/', source: 'Google AI' },
 // { url: 'https://ai.meta.com/blog/rss/', source: 'Meta AI' },
  { url: 'https://deepmind.google/blog/rss.xml', source: 'DeepMind' },
  { url: 'https://www.microsoft.com/en-us/research/blog/feed/?type=rss', source: 'Microsoft Research' },
  { url: 'https://news.apache.org/feed/', source: 'Apache' },
  { url: 'https://databricks.com/feed', source: 'Databricks' },
 // { url: 'https://www.confluent.io/blog/feed/', source: 'Confluent' },
  { url: 'https://github.blog/feed', source: 'GitHub' },
  { url: 'https://github.blog/changelog/feed/', source: 'GitHub Changelog' },
  { url: 'https://code.visualstudio.com/feed.xml', source: 'VS Code' },
];

// ==================== 带超时的 fetch ====================
async function fetchWithTimeout(url, options, timeout = 60000) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);
  try {
    const response = await fetch(url, { ...options, signal: controller.signal });
    return response;
  } finally {
    clearTimeout(id);
  }
}

// ==================== 调用 DeepSeek API 生成摘要 ====================
async function summarize(text, token, retries = 3) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const response = await fetchWithTimeout(
        'https://api.deepseek.com/v1/chat/completions',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({
  model: 'deepseek-v4-flash',
  messages: [
    { role: 'system', content: '你只能用中文回复，直接输出最终总结，不要推理过程。请把下面的技术标题总结成一句中文，不超过25字。直接给出总结，不要解释。' },
    { role: 'user', content: text }
  ],
  max_tokens: 200,
  temperature: 0.3
})
        },
        60000
      );

      if (!response.ok) {
        throw new Error(`HTTP ${response.status} ${response.statusText}`);
      }

      const data = await response.json();

      // 调试日志（可选，确认无误后可删除）
      console.log(`DEBUG 响应状态: ${response.status}`);
      console.log('DEBUG 响应体:', JSON.stringify(data, null, 2));

      if (!data.choices?.[0]?.message?.content) {
        console.error('❌ 响应中未找到 content，完整 data:', JSON.stringify(data, null, 2));
        return '摘要生成失败';
      }

      return data.choices[0].message.content.trim();
    } catch (err) {
      console.error(`摘要失败 (尝试 ${attempt}/${retries}): ${err.message} (原因: ${err.cause || '未知'})`);
      if (attempt === retries) return '摘要生成失败';
      await new Promise(r => setTimeout(r, 2000));
    }
  }
}

// ==================== 主流程 ====================
async function main() {
  const parser = new Parser({
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept': 'application/rss+xml, application/xml, text/xml, */*'
    },
    timeout: 60000
  });
  const allItems = [];

  console.log('开始抓取 RSS...');
  for (const { url, source } of RSS_SOURCES) {
    try {
      const feed = await parser.parseURL(url);
      const items = feed.items.slice(0, 3);
      for (const item of items) {
        allItems.push({
          title: item.title,
          link: item.link,
          pubDate: item.pubDate || item.isoDate,
          source,
          summary: '',
          contentSnippet: item.contentSnippet || item.content || ''
        });
      }
      console.log(`✅ ${source} 抓取成功，获得 ${items.length} 篇`);
    } catch (e) {
      console.error(`❌ 抓取 ${source} 失败: ${e.message}`);
    }
  }

  // 按发布日期倒序排列
  allItems.sort((a, b) => new Date(b.pubDate) - new Date(a.pubDate));

  const token = process.env.GH_MODELS_TOKEN;
  if (!token) {
    console.error('❌ 未设置 GH_MODELS_TOKEN 环境变量，无法生成摘要');
    const outputPath = join(__dirname, '..', 'frontend', 'public', 'feed.json');
    writeFileSync(outputPath, JSON.stringify(allItems, null, 2));
    console.log('feed.json 已生成（无 AI 摘要）');
    return;
  }

  console.log(`\n开始为 ${allItems.length} 篇文章生成 AI 摘要...`);
  for (let i = 0; i < allItems.length; i++) {
    const snippet = allItems[i].contentSnippet || allItems[i].content || '';
    const textToSummarize = allItems[i].title + (snippet ? '。摘要：' + snippet : '');
    allItems[i].summary = await summarize(textToSummarize, token);
    await new Promise(r => setTimeout(r, 800));
    console.log(`进度：${i + 1}/${allItems.length}`);
  }

  const outputPath = join(__dirname, '..', 'frontend', 'public', 'feed.json');
  writeFileSync(outputPath, JSON.stringify(allItems, null, 2));
  console.log('\n🎉 feed.json 已生成，包含 AI 摘要');
}

main().catch(err => {
  console.error('脚本运行失败:', err);
  process.exit(1);
});