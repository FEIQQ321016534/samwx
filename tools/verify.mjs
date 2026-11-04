import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../',import.meta.url));
const run=(command,args)=>new Promise((resolve,reject)=>{
  const child=spawn(command,args,{cwd:root,stdio:'inherit'});
  child.on('error',reject);child.on('exit',code=>code===0?resolve():reject(new Error(`${command} ${args.join(' ')} failed (${code})`)));
});
await run('npm',['--prefix','apps/api','run','typecheck']);
await run('npm',['--prefix','apps/api','test']);
await run(process.execPath,['--test','tools/backup-restore.test.mjs']);
await run('npm',['--prefix','apps/admin','run','build']);
await run('npm',['--prefix','apps/miniprogram','run','typecheck']);
await run('npm',['--prefix','apps/miniprogram','run','test:layout']);
await run('npm',['--prefix','apps/miniprogram','run','build:weapp']);
await run('npm',['--prefix','apps/miniprogram','run','build:h5']);
console.log('本地回归验证通过。此结果不替代 release:check 和真实微信/云端上线验收。');
