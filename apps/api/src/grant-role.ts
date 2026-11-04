import { parseArgs } from 'node:util';
import { resolve } from 'node:path';
import { existsSync } from 'node:fs';
import type { Role } from '../../../packages/domain/src/index.ts';
import { Store } from './db.ts';
import { grantRole } from './roles.ts';

let store: Store | undefined;
try {
  const {values}=parseArgs({options:{database:{type:'string'},'user-id':{type:'string'},role:{type:'string'},'merchant-id':{type:'string'},help:{type:'boolean'}}});
  if(values.help){process.stdout.write('用法: npm run grant-role -- --database /绝对路径/sam-production.sqlite --user-id wechat-用户ID --role admin|merchant|customer [--merchant-id 已审核商户ID]\n');}
  else {
    if(!values.database||!values['user-id']||!values.role)throw new Error('必须显式提供 --database、--user-id、--role；运行 --help 查看说明');
    const databasePath=resolve(values.database);if(!existsSync(databasePath))throw new Error('数据库文件不存在；请提供已有数据库的准确路径');
    store=new Store(databasePath);const output=grantRole(store,{userId:values['user-id'],role:values.role as Role,merchantId:values['merchant-id']});process.stdout.write(`${JSON.stringify(output,null,2)}\n`);
  }
}catch(error){process.stderr.write(`${error instanceof Error?error.message:'角色授权失败'}\n`);process.exitCode=1;}
finally{store?.close();}
