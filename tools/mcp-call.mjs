/* 开发辅助：cocos-mcp-server 的最小 MCP 客户端（Streamable HTTP / JSON-RPC）。
 * 修改时间：2026-09-06 10:40:00
 * 用法：node tools/mcp-call.mjs <method> [paramsJSON]
 *   node tools/mcp-call.mjs initialize
 *   node tools/mcp-call.mjs tools/list
 *   node tools/mcp-call.mjs tools/call '{"name":"server_info","arguments":{}}'
 * 会话句柄缓存在 tools/.mcp-session，重复调用自动复用。 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const sessionFile = join(here, '.mcp-session');
const endpoint = 'http://127.0.0.1:3000/mcp';

async function rpc(body, sessionId) {
  const headers = { 'Content-Type': 'application/json', 'Accept': 'application/json, text/event-stream' };
  if (sessionId) headers['Mcp-Session-Id'] = sessionId;
  const res = await fetch(endpoint, { method: 'POST', headers, body: JSON.stringify(body) });
  const sid = res.headers.get('mcp-session-id');
  const text = await res.text();
  let data = null;
  try {
    data = JSON.parse(text);
  } catch {
    // SSE 流：取 data: 行
    const line = text.split('\n').find(l => l.startsWith('data:'));
    if (line) data = JSON.parse(line.slice(5).trim());
  }
  return { status: res.status, sid, data, text };
}

const method = process.argv[2];
const params = process.argv[3] ? JSON.parse(process.argv[3]) : undefined;
const saved = existsSync(sessionFile) ? readFileSync(sessionFile, 'utf8') : '';

if (method === 'initialize') {
  const r = await rpc({
    jsonrpc: '2.0', id: 1, method: 'initialize',
    params: {
      protocolVersion: '2025-03-26',
      capabilities: {},
      clientInfo: { name: 'dev-helper', version: '0.1.0' },
    },
  }, null);
  if (r.sid) writeFileSync(sessionFile, r.sid);
  // 发送 initialized 通知
  await rpc({ jsonrpc: '2.0', method: 'notifications/initialized' }, r.sid);
  console.log(JSON.stringify(r.data, null, 2));
} else {
  const sid = saved || null;
  const r = await rpc({ jsonrpc: '2.0', id: Date.now(), method, params }, sid);
  if (r.status === 404) console.log('SESSION_EXPIRED — 先跑 initialize');
  else console.log(JSON.stringify(r.data ?? r.text, null, 2));
}
