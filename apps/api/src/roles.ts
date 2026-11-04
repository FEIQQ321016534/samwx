import type { Merchant, Role, User } from '../../../packages/domain/src/index.ts';
import { Store, fail, now, uid } from './db.ts';

export function grantRole(store: Store, input: {userId: string;role: Role;merchantId?:string}) {
  if(!input.userId||!['admin','merchant','customer'].includes(input.role))fail(400,'INVALID_ROLE_GRANT','须明确指定已有用户ID与有效角色');
  const user=store.require<User>('user',input.userId);
  if(user.id.startsWith('dev-')||!store.all<{id:string;userId:string}>('wechat_identity').some(i=>i.userId===user.id))fail(400,'WECHAT_IDENTITY_REQUIRED','角色授权只允许已完成真实微信登录的用户');
  if(input.role==='merchant'){
    if(!input.merchantId)fail(400,'MERCHANT_REQUIRED','商户角色必须明确提供merchantId');
    const merchant=store.require<Merchant>('merchant',input.merchantId);if(merchant.status!=='approved')fail(409,'MERCHANT_NOT_APPROVED','只能关联已审核通过的商户');
  }else if(input.merchantId)fail(400,'UNEXPECTED_MERCHANT','非商户角色不能关联merchantId');
  return store.transaction(()=>{
    const previous={role:user.role,merchantId:user.merchantId};user.role=input.role;
    if(input.role==='merchant')user.merchantId=input.merchantId;else delete user.merchantId;
    store.put('user',user);store.put('role_grant',{id:uid('role-grant'),userId:user.id,previous,role:user.role,merchantId:user.merchantId,at:now(),source:'local-cli'});
    const revoked=store.db.prepare('DELETE FROM sessions WHERE user_id=?').run(user.id).changes;
    return{user,revokedSessions:Number(revoked),message:'角色已授权，旧会话已作废，请重新微信登录'};
  });
}
