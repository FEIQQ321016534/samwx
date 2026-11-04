import fs from 'node:fs';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../',import.meta.url));
const config=JSON.parse(fs.readFileSync(root+'apps/miniprogram/project.config.json','utf8'));
const checks=[];
const check=(name,ok,detail)=>checks.push({name,status:ok?'PASS':'BLOCKED',detail});
check('正式小程序AppID',/^wx[0-9a-f]{16}$/i.test(config.appid||''),'须在微信平台申请并完成主体与类目配置');
check('微信小程序编译产物',fs.existsSync(root+'apps/miniprogram/dist/app.json'),'编译产物仅证明可打包，不替代真机与平台审核');
const runtime=fs.existsSync(root+'deploy/runtime-status.json')?JSON.parse(fs.readFileSync(root+'deploy/runtime-status.json','utf8')):{};
let apiBase=process.env.TARO_APP_API_BASE_URL||runtime.publicApiBase||'';
let https=false;try{const u=new URL(apiBase);https=u.protocol==='https:'&&!['localhost','127.0.0.1'].includes(u.hostname);}catch{}
check('正式HTTPS API域名',https,'通过TARO_APP_API_BASE_URL指定，并完成小程序request/downloadFile合法域名配置');
check('生产环境',process.env.NODE_ENV==='production','正式启动须显式NODE_ENV=production');
check('测试身份与测试资金关闭',process.env.DEV_AUTH_ENABLED!=='true'&&process.env.DEV_PAYMENTS_ENABLED!=='true','开发数据库与生产数据库必须隔离');
// These blockers describe adapters that do not yet exist or have not had an external acceptance run.
// Never mark them ready just because environment variables or placeholder credentials are present.
check('真实微信支付与多商户结算',false,'尚未实现并验证真实统一下单、支付通知、退款、账单对账、商户进件与分账/结算');
check('正式PostgreSQL迁移',false,'当前运行存储仍为SQLite；正式目标PostgreSQL的迁移、并发和恢复验收未完成');
check('腾讯云私有COS',false,'当前私有凭证保存在本地数据卷；COS适配与真实云端权限验收未完成');
check('完整构建工具链供应链审查',false,'运行分类依赖高危/严重告警已修补，但完整工具链仍有未消除的高危和严重告警，见docs/dependency-audit.md');
check('真实账号、真机与故障验收',false,'AppID、服务端HTTPS和凭据验证已就绪；真机用户登录、真实支付、云端完整恢复/负载/告警演练尚未完成');
console.log(JSON.stringify({ready:checks.every(c=>c.status==='PASS'),checks},null,2));
process.exitCode=checks.every(c=>c.status==='PASS')?0:1;
