#!/usr/bin/env node
import { pathToFileURL } from 'node:url';
import { argumentsFor } from './backup-common.mjs';
export async function main(argv = process.argv.slice(2)) {
  const args = argumentsFor(argv), base = String(args.url || process.env.API_BASE_URL || 'http://127.0.0.1:8787/api').replace(/\/+$/, '');
  const request = async path => { const response = await fetch(base + path, { signal: AbortSignal.timeout(5000) }); if (!response.ok) throw new Error(`${path} HTTP ${response.status}`); const body = await response.json(); return body.data ?? body; };
  const [health, config] = await Promise.all([request('/health'), request('/config')]);
  if (!health.ok) throw new Error('健康接口未返回ok');
  if (args.production && (config.devAuthEnabled || config.devPaymentsEnabled)) throw new Error('生产检查失败：开发登录或开发支付仍在开启');
  console.log(JSON.stringify({ ok: true, url: base, developmentAuth: !!config.devAuthEnabled, developmentPayments: !!config.devPaymentsEnabled, managementAuth: !!config.managementAuthEnabled, wechatLoginConfigured: !!config.wechatLoginConfigured, wechatPayConfigured: !!config.wechatPayConfigured }));
}
if (import.meta.url === pathToFileURL(process.argv[1] || '').href) main().catch(error => { console.error(`健康检查失败：${error.message}`); process.exitCode = 1; });
