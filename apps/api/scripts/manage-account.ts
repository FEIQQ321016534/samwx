#!/usr/bin/env -S node --import tsx
import { createInterface } from 'node:readline/promises';
import { parseArgs } from 'node:util';
import { existsSync } from 'node:fs';
import { isAbsolute, resolve } from 'node:path';
import { Store, ApiError } from '../src/db.ts';
import { createManagementAccount, normalizeUsername, resetManagementPassword, setManagementAccountState } from '../src/security.ts';
import { readPrivateSecretFile } from '../src/security-files.ts';

const usage=`管理账号仅由持有服务器本地数据库权限的运营者创建；无默认账号或密码。

用法：npm run manage-account -- create|reset|disable|enable|unlock|list --database /绝对路径/sam-production.sqlite
可选非秘密参数：--username 账号 --role admin|merchant --merchant-id 商户ID --nickname 显示名
密码默认从TTY隐藏读取并二次确认，不支持密码命令参数或密码环境变量。
自动化可用 --password-file /绝对路径/secret-file（仅create/reset，文件由当前用户所有且权限0600）。
reset、disable、enable、unlock都会撤销该账号已有会话。账号角色不会由登录请求或密码重置修改。
`;
async function ask(question:string):Promise<string> {
  if(!process.stdin.isTTY||!process.stdout.isTTY)throw new Error('缺少交互终端；请显式提供非秘密参数，密码通过权限0600的--password-file传入');
  const rl=createInterface({input:process.stdin,output:process.stdout});
  try{return(await rl.question(question)).trim();}finally{rl.close();}
}
async function hidden(question:string):Promise<string> {
  if(!process.stdin.isTTY||!process.stdout.isTTY)throw new Error('密码必须从TTY隐藏输入；自动化请使用权限0600的--password-file');
  process.stdout.write(question);
  return new Promise((resolvePromise,reject)=>{
    let value='';const input=process.stdin;const originalRaw=input.isRaw;
    const finish=(error?:Error)=>{input.off('data',onData);input.off('error',onError);input.setRawMode(Boolean(originalRaw));input.pause();process.stdout.write('\n');if(error)reject(error);else resolvePromise(value);};
    const onError=()=>finish(new Error('密码读取失败'));
    const onData=(chunk:string|Buffer)=>{
      for(const character of chunk.toString('utf8')){
        if(character==='\u0003'||character==='\u0004'){finish(new Error('操作已取消'));return;}
        if(character==='\r'||character==='\n'){finish();return;}
        if(character==='\u007f'||character==='\b'){value=[...value].slice(0,-1).join('');continue;}
        if(character.charCodeAt(0)<32)continue;
        value+=character;
        if([...value].length>256){finish(new Error('密码不能超过256个字符'));return;}
      }
    };
    input.setEncoding('utf8');input.setRawMode(true);input.resume();input.on('data',onData);input.once('error',onError);
  });
}
function passwordFromFile(filename:string):string {
  if(!isAbsolute(filename))throw new Error('密码文件必须使用绝对路径');
  const password=readPrivateSecretFile(filename,1026).replace(/\r?\n$/,'');
  if(password.includes('\n')||password.includes('\r'))throw new Error('密码文件仅可包含一行密码');
  return password;
}
async function readPassword(filename?:string):Promise<string> {
  if(filename)return passwordFromFile(filename);
  const password=await hidden('新密码（至少15字符，输入不显示）：');
  const confirmation=await hidden('再次输入新密码：');
  if(password!==confirmation)throw new Error('两次密码不一致，未修改账号');
  return password;
}

let store:Store|undefined;
try{
  const{values,positionals}=parseArgs({allowPositionals:true,options:{database:{type:'string'},username:{type:'string'},role:{type:'string'},'merchant-id':{type:'string'},nickname:{type:'string'},'password-file':{type:'string'},help:{type:'boolean'}}});
  const command=positionals[0]??'help';
  if(values.help||command==='help'){process.stdout.write(usage);}
  else{
    if(positionals.length!==1||!['create','reset','disable','enable','unlock','list'].includes(command))throw new Error('命令无效，请运行 --help；密码不可作为命令参数传入');
    if(!values.database||!isAbsolute(values.database))throw new Error('必须通过--database显式提供数据库绝对路径');
    if(command!=='create'&&!existsSync(values.database))throw new Error('数据库文件不存在，未执行操作');
    if(values['password-file']&&!['create','reset'].includes(command))throw new Error('此命令不读取密码文件');
    if(command!=='create'&&(values.role||values['merchant-id']||values.nickname))throw new Error('修改账号状态或密码时不能改变角色、商户或显示名');
    const username=command==='list'?undefined:normalizeUsername(values.username??await ask('账号：'));
    store=new Store(resolve(values.database));
    if(command==='create'){
      const role=values.role??await ask('角色（admin或merchant）：');
      if(role!=='admin'&&role!=='merchant')throw new Error('角色只能是admin或merchant');
      const merchantId=role==='merchant'?(values['merchant-id']??await ask('绑定商户ID：')):undefined;
      if(role==='admin'&&values['merchant-id'])throw new Error('admin账号不能绑定商户');
      const output=await createManagementAccount(store,{username:username!,password:await readPassword(values['password-file']),role,merchantId,nickname:values.nickname});
      process.stdout.write(`管理账号已创建：${output.username}；角色：${output.user.role}；用户ID：${output.user.id}\n`);
    }else if(command==='reset'){
      await resetManagementPassword(store,username!,await readPassword(values['password-file']));process.stdout.write('密码已重置，原有会话已撤销。\n');
    }else if(command==='list'){
      const rows=store.db.prepare('SELECT username,user_id,role,merchant_id,disabled_at,locked_until,created_at,last_login_at FROM management_accounts ORDER BY username').all();
      process.stdout.write(JSON.stringify(rows,null,2)+'\n');
    }else{
      setManagementAccountState(store,username!,command as 'disable'|'enable'|'unlock');process.stdout.write('账号状态已更新，原有会话已撤销。\n');
    }
  }
}catch(error){
  const code=(error as {code?:string})?.code;
  const message=code?.startsWith('ERR_PARSE_ARGS')?'参数无效，请运行 --help；不得把密码放入命令参数':error instanceof ApiError||error instanceof Error?error.message:'账号操作失败';
  process.stderr.write(message+'\n');process.exitCode=1;
}finally{store?.close();}
