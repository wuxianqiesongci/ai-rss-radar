import { useEffect, useState } from 'react';
import './App.css';

function App() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('./feed.json')
      .then(res => res.json())
      .then(data => {
        setItems(data);
        setLoading(false);
      })
      .catch(() => {
        setItems([]);
        setLoading(false);
      });
  }, []);

  // 每个来源的主题色
  const sourceColors = {
    'OpenAI': '#10a37f',
    'Anthropic': '#d97706',
    'arXiv': '#b31b1b',
    'Google AI': '#4285f4',
    'DeepMind': '#00bfa5',
    'Microsoft Research': '#0078d4',
    'Apache': '#d22128',
    'Databricks': '#ff6b00',
    'GitHub Blog': '#333',
    'GitHub Changelog': '#0366d6',
    'VS Code': '#007acc',
  };

  return (
    <div className="container">
      <h1>🧠 AI 前沿雷达</h1>
      <p className="subtitle">每日自动更新 · AI 一句话摘要</p>

      {loading && <p className="loading">加载中...</p>}

      <div className="grid">
        {items.map((item, i) => (
          <a
            key={i}
            href={item.link}
            target="_blank"
            className="card"
            rel="noreferrer"
          >
            <span
              className="source-tag"
              style={{ backgroundColor: sourceColors[item.source] || '#555' }}
            >
              {item.source}
            </span>
            <h3>{item.title}</h3>
            <p className="summary">{item.summary || '暂无摘要'}</p>
            <time>{new Date(item.pubDate).toLocaleDateString('zh-CN')}</time>
          </a>
        ))}
      </div>

      {!loading && items.length === 0 && (
        <p className="empty">暂无数据，请稍后再来。</p>
      )}
    </div>
  );
}

export default App;