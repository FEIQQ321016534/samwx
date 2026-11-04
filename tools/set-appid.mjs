import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
const appid = process.argv[2];
if (!/^wx[0-9a-f]{16}$/i.test(appid || '')) {
  console.error('用法：node tools/set-appid.mjs wx开头的真实18位AppID（无需AppSecret）');
  process.exit(1);
}
const file = fileURLToPath(new URL('../apps/miniprogram/project.config.json', import.meta.url));
const config = JSON.parse(fs.readFileSync(file, 'utf8'));
config.appid = appid;
fs.writeFileSync(file, JSON.stringify(config, null, 2) + '\n');
console.log('已写入小程序 AppID；请重新运行 npm run build:miniapp。');
