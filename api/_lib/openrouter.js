/* OpenRouter chat completions.
   OPENROUTER_API_KEY   required
   OPENROUTER_MODELS    optional, comma separated model ids tried in order. Default: z-ai/glm-5.2:free
   OPENROUTER_FALLBACK  optional, "1" to also try every ":free" model OpenRouter lists with tool support (cached 1h)

   Tool calls work two ways, picked per model:
   - native: the model supports the OpenAI `tools` parameter.
   - text:   the model does not (e.g. z-ai/glm-5.2:free). Tools are described in the system prompt and the
             model writes each call as a fenced ```tool block holding {"name", "arguments"}. The reply is parsed
             into the same tool_calls shape, so the caller never sees the difference.
   Callers always pass and receive OpenAI-style messages (assistant.tool_calls, role:'tool' results). */
import { cacheGet, cacheSet } from './store.js';

const DEFAULT_MODELS = ['z-ai/glm-5.2:free'];

export function configuredModels() {
  const env = (process.env.OPENROUTER_MODELS || '').split(',').map(s => s.trim()).filter(Boolean);
  return env.length ? env : DEFAULT_MODELS;
}

async function discoveredModels() {
  if (!/^(1|true|yes)$/i.test(process.env.OPENROUTER_FALLBACK || '')) return [];
  const cached = await cacheGet('openrouter:free_tool_models');
  if (cached) return cached;
  let out = [];
  try {
    const r = await fetch('https://openrouter.ai/api/v1/models', { signal: AbortSignal.timeout(8000) });
    if (r.ok) {
      const list = ((await r.json()).data || []).filter(m => /:free$/.test(m.id) && Array.isArray(m.supported_parameters) && m.supported_parameters.includes('tools'));
      list.sort((a, b) => (b.context_length || 0) - (a.context_length || 0));
      out = list.map(m => m.id).slice(0, 12);
    }
  } catch { /* offline: just use the configured list */ }
  await cacheSet('openrouter:free_tool_models', out, 3600);
  return out;
}

export async function modelList() {
  const env = configuredModels();
  const found = await discoveredModels();
  return env.concat(found.filter(m => !env.includes(m)));
}

/* ---------- Text-mode tool protocol ---------- */
function toolPrompt(tools) {
  return '\n\nTOOLS\nYou can call these tools. To call one, write a fenced block exactly like this, one block per call, anywhere in your reply:\n```tool\n{"name": "tool_name", "arguments": { ... }}\n```\n' +
    'After your tool blocks, stop and wait: the results come back in the next message, then you continue. Do not invent results. Text outside the blocks is shown to the admin, so keep it short.\n\n' +
    tools.map(t => { const f = t.function || t; return `- ${f.name}: ${f.description}\n  arguments schema: ${JSON.stringify(f.parameters || { type: 'object', properties: {} })}`; }).join('\n');
}
function toTextMessages(messages, tools) {
  const out = [];
  for (const m of messages) {
    if (m.role === 'system') { out.push({ role: 'system', content: m.content + toolPrompt(tools) }); continue; }
    if (m.role === 'assistant') {
      const calls = (m.tool_calls || []).map(c => '```tool\n' + JSON.stringify({ name: c.function.name, arguments: safeParse(c.function.arguments) }) + '\n```').join('\n');
      out.push({ role: 'assistant', content: [m.content || '', calls].filter(Boolean).join('\n\n') });
      continue;
    }
    if (m.role === 'tool') {
      const last = out[out.length - 1];
      const line = 'Result of ' + (m.name || 'tool') + ':\n' + m.content;
      if (last && last.role === 'user' && last._tool) last.content += '\n\n' + line; else out.push({ role: 'user', content: line, _tool: true });
      continue;
    }
    out.push({ role: m.role, content: m.content });
  }
  return out.map(({ _tool, ...m }) => m);
}
const safeParse = s => { try { return typeof s === 'string' ? JSON.parse(s || '{}') : (s || {}); } catch { return {}; } };

/* Pull ```tool blocks (or <tool_call> tags) out of a text reply → { content, tool_calls } */
export function parseTextTools(text) {
  const calls = [];
  const re = /```(?:tool|json)?\s*\n?([\s\S]*?)```|<tool_call>([\s\S]*?)<\/tool_call>/g;
  const content = String(text || '').replace(re, (whole, fenced, tagged) => {
    const raw = (fenced != null ? fenced : tagged || '').trim();
    let v; try { v = JSON.parse(raw); } catch { return whole; } /* not JSON: leave it in the text */
    const list = Array.isArray(v) ? v : [v];
    let took = 0;
    for (const o of list) {
      if (!o || typeof o !== 'object') continue;
      const name = o.name || o.tool || o.function; if (!name || typeof name !== 'string') continue;
      const args = o.arguments != null ? o.arguments : (o.args != null ? o.args : (o.parameters != null ? o.parameters : {}));
      calls.push({ id: 'txt_' + Date.now().toString(36) + '_' + calls.length, type: 'function', function: { name, arguments: JSON.stringify(typeof args === 'string' ? safeParse(args) : args) } });
      took++;
    }
    return took ? '' : whole;
  }).replace(/\n{3,}/g, '\n\n').trim();
  return { content, tool_calls: calls };
}

/* ---------- Completion ---------- */
async function callModel(key, model, messages, tools, mode, opts) {
  const body = { model, messages, temperature: 0.3, max_tokens: 1800 };
  if (mode === 'native' && tools && tools.length) { body.tools = tools; body.tool_choice = 'auto'; }
  if (mode === 'text') body.messages = toTextMessages(messages, tools);
  const r = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + key, 'Content-Type': 'application/json', 'HTTP-Referer': opts.referer || 'https://aleksk9.com', 'X-Title': 'AleksK9 admin' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(opts.timeoutMs || 28000)
  });
  const res = await r.json().catch(() => ({}));
  if (!r.ok || res.error) {
    const err = res.error || {};
    const raw = err.metadata && (err.metadata.raw || err.metadata.provider_name) ? ' [' + [err.metadata.provider_name, typeof err.metadata.raw === 'string' ? err.metadata.raw.slice(0, 200) : JSON.stringify(err.metadata.raw || '').slice(0, 200)].filter(Boolean).join(': ') + ']' : '';
    const e = new Error((err.message || ('HTTP ' + r.status)) + raw); e.status = err.code || r.status; throw e;
  }
  const msg = res.choices && res.choices[0] && res.choices[0].message;
  if (!msg) throw new Error('empty reply');
  if (mode === 'text') { const p = parseTextTools(msg.content); return { role: 'assistant', content: p.content, tool_calls: p.tool_calls }; }
  return msg;
}
/* Auth and billing problems are not worth a second attempt; anything else on a native-tools call is retried in text mode,
   because free providers answer a `tools` request with all sorts of errors, not just "no tool support". */
const retryInText = e => ![401, 402, 403].includes(Number(e.status)) && e.name !== 'TimeoutError';

/* One completion. Tries each model until one answers. Returns { model, mode, message }. Throws when every model fails. */
export async function complete(messages, tools, opts = {}) {
  const key = process.env.OPENROUTER_API_KEY;
  if (!key) { const e = new Error('OPENROUTER_API_KEY is not set in Vercel'); e.status = 500; throw e; }
  const models = opts.models || await modelList();
  const errors = [];
  for (const model of models) {
    let mode = (await cacheGet('openrouter:mode:' + model)) || 'native';
    try {
      let message;
      try { message = await callModel(key, model, messages, tools, mode, opts); }
      catch (e) {
        if (mode !== 'native' || !retryInText(e)) throw e;
        mode = 'text';
        message = await callModel(key, model, messages, tools, mode, opts); /* throws the text-mode error if that fails too */
        await cacheSet('openrouter:mode:' + model, 'text', 3600 * 12); /* text worked where native did not: remember it */
      }
      return { model, mode, message };
    } catch (e) {
      errors.push(model + ': ' + (e.name === 'TimeoutError' ? 'timed out' : e.message));
    }
  }
  const e = new Error('The AI model did not answer. ' + errors.slice(0, 4).join(' | ')); e.status = 502; throw e;
}
