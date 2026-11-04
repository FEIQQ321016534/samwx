import {spawn} from 'node:child_process';
import fs from 'node:fs';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
const project=path.resolve(fileURLToPath(new URL('../',import.meta.url)));
const cli=path.join(project,'node_modules/@tarojs/cli/bin/taro');
const status=await new Promise((resolve,reject)=>{
  const child=spawn(process.execPath,[cli,'build','--type','weapp'],{cwd:project,stdio:'inherit',env:{...process.env,SAM_BUILD_TARGET:'uat',TARO_APP_API_BASE_URL:'https://sam.mmailife.com/uat/api'}});
  child.on('error',reject);child.on('exit',resolve);
});
if(status!==0)process.exit(Number(status)||1);
const file=path.join(project,'dist-uat/project.config.json');
const config=JSON.parse(fs.readFileSync(file,'utf8'));
config.projectname='sam-yantai-uat';config.description='山姆邻里拼 · 线上体验测试（无真实资金）';
config.setting={...config.setting,urlCheck:true};
fs.writeFileSync(file,JSON.stringify(config,null,2)+'\n');
fs.writeFileSync(path.join(project,'dist-uat/build-info.json'),JSON.stringify({environment:'uat',apiBase:'https://sam.mmailife.com/uat/api',appid:config.appid,builtAt:new Date().toISOString(),realPayments:false},null,2)+'\n');
console.log('线上体验测试包：'+path.join(project,'dist-uat')+'；请配置合法服务器域名并通过微信开发者工具上传为体验版。');
