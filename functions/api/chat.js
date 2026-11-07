// Cloudflare Pages Function — functions/api/chat.js
// 作用:
//  1) 隐藏站长 OWNER_KEY(仅存在于服务端环境变量,绝不下发到浏览器)
//  2) 同域部署 => 浏览器不再直连 api.deepseek.com,彻底消除 CORS
//  3) 免费额度:按匿名客户端 ID 用 KV 限流(每日 FREE_TOKENS_PER_DAY)
//  4) 用户自备 Key(请求头 Authorization)时直接转发,不再受限
//
// 部署: 与 index.html 一起推到 Cloudflare Pages 即可,/api/chat 自动生效。
// 配置:
//  - 环境变量 OWNER_KEY = 你的 DeepSeek Key(wrangler pages secret put OWNER_KEY 或控制台设置)
//  - KV 绑定: 名称 QUOTA(命名空间任意),用于记录免费额度

const TARGET = 'https://api.deepseek.com/chat/completions';
const FREE_TOKENS_PER_DAY = 60000;          // 每个客户端每日免费额度(可改)
const WINDOW_MS = 24 * 60 * 60 * 1000;      // 24 小时滚动窗口

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-client-id',
  'Access-Control-Max-Age': '86400',
};

function json(body, status, extra) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS, ...(extra || {}) },
  });
}

export async function onRequestOptions() {
  return new Response(null, { status: 204, headers: CORS });
}

export async function onRequestPost({ request, env }) {
  const auth = request.headers.get('Authorization') || '';
  const userKey = auth.toLowerCase().startsWith('bearer ') ? auth.slice(7).trim() : '';

  // 用户自备 Key:直接转发,不限额度、不计费
  if (userKey) {
    return forward(request, userKey);
  }

  // 否则使用站长 Key + 免费额度
  const ownerKey = env.OWNER_KEY;
  if (!ownerKey) {
    return json({ error: 'no_owner_key', message: '本站未配置服务端密钥，请在设置中填写你自己的 API Key。' }, 500);
  }
  // 未绑定 KV:放行但无额度限制(站长需在 Pages 控制台绑定 QUOTA 命名空间)
  if (!env.QUOTA) {
    return forward(request, ownerKey);
  }

  // 优先用真实客户端 IP 限流(防刷),无可伪造的 localStorage ID 兜底
  const ip = request.headers.get('cf-connecting-ip');
  const cid = (ip || request.headers.get('x-client-id') || 'anon').slice(0, 64);
  let rec = await readQuota(env.QUOTA, cid);
  const now = Date.now();
  if (now > rec.resetAt) rec = { used: 0, resetAt: now + WINDOW_MS };

  if (rec.used >= FREE_TOKENS_PER_DAY) {
    return json({
      error: 'quota_exhausted',
      message: '免费额度已用完。请在 AI 设置中填写你自己的 DeepSeek API Key 继续使用（填入后不再受限）。',
      used: rec.used,
      limit: FREE_TOKENS_PER_DAY,
    }, 402);
  }

  const resp = await forward(request, ownerKey);
  try {
    const ct = resp.headers.get('Content-Type') || '';
    if (ct.includes('application/json')) {
      const j = await resp.clone().json();
      const add = (j.usage && j.usage.total_tokens) || Math.ceil((await resp.clone().text()).length / 4);
      rec.used += add;
      if (now > rec.resetAt) rec.resetAt = now + WINDOW_MS;
      await env.QUOTA.put('q:' + cid, JSON.stringify(rec));
    }
  } catch (e) { /* 用量记录失败不影响本次响应 */ }
  return resp;
}

async function forward(request, key) {
  const body = await request.text();
  const upstream = await fetch(TARGET, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer ' + key,
    },
    body,
  });
  const respText = await upstream.text();
  return new Response(respText, {
    status: upstream.status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });
}

async function readQuota(kv, cid) {
  const raw = await kv.get('q:' + cid);
  if (!raw) return { used: 0, resetAt: Date.now() + WINDOW_MS };
  try { return JSON.parse(raw); } catch { return { used: 0, resetAt: Date.now() + WINDOW_MS }; }
}
