import { createHash } from 'node:crypto';
import type { User } from '../../../packages/domain/src/index.ts';
import { Store, fail, now } from './db.ts';
import { readPrivateSecretFile } from './security-files.ts';

export interface WechatCredentials { appId: string; appSecret: string }
export function wechatCredentials(): WechatCredentials | undefined {
  const appId=process.env.WECHAT_APP_ID?.trim();let appSecret=process.env.WECHAT_APP_SECRET?.trim();
  const secretFile=process.env.WECHAT_APP_SECRET_FILE;
  if(secretFile){
    appSecret=readPrivateSecretFile(secretFile,4096).trim();
  }
  return appId&&appSecret?{appId,appSecret}:undefined;
}
// Official server-only code2Session endpoint; never forward session_key to a caller.
export async function loginWithWechat(store: Store, code: string, fetcher: typeof fetch = fetch): Promise<User> {
  const credentials=wechatCredentials();if(!credentials)fail(503,'AUTH_NOT_CONFIGURED','微信登录尚未配置AppID和AppSecret');
  const url=new URL('https://api.weixin.qq.com/sns/jscode2session');
  url.search=new URLSearchParams({appid:credentials.appId,secret:credentials.appSecret,js_code:code,grant_type:'authorization_code'}).toString();
  let body: Record<string,unknown>;
  try { const response=await fetcher(url,{signal:AbortSignal.timeout(10_000),redirect:'error'});if(!response.ok)fail(503,'WECHAT_AUTH_UNAVAILABLE','微信登录服务暂时不可用');body=await response.json() as Record<string,unknown>; }
  catch { fail(503,'WECHAT_AUTH_UNAVAILABLE','微信登录服务暂时不可用，请稍后重试'); }
  if(!body||typeof body!=='object'||Array.isArray(body))fail(503,'WECHAT_AUTH_INVALID_RESPONSE','微信登录服务返回异常');
  if(body.errcode&&body.errcode!==0){
    if(body.errcode===40029||body.errcode===40163)fail(401,'LOGIN_CODE_INVALID','微信登录凭证无效或已使用，请重新登录');
    if(body.errcode===40226)fail(403,'WECHAT_LOGIN_BLOCKED','微信暂未允许该账号登录');
    if(body.errcode===45011)fail(429,'WECHAT_AUTH_RATE_LIMITED','微信登录调用过于频繁，请稍后重试');
    fail(503,'WECHAT_AUTH_REJECTED','微信登录未成功，请检查服务端配置');
  }
  if(typeof body.openid!=='string'||!body.openid||body.openid.length>200||typeof body.session_key!=='string'||!body.session_key)fail(503,'WECHAT_AUTH_INVALID_RESPONSE','微信登录服务返回异常');
  const identityId=createHash('sha256').update(`${credentials.appId}:${body.openid}`).digest('hex');
  const mapping=store.get<{id:string;userId:string}>('wechat_identity',identityId);
  const existingUser=(userId:string)=>{const user=store.require<User>('user',userId);if(user.role!=='customer')fail(403,'CUSTOMER_IDENTITY_REQUIRED','微信身份仅用于顾客登录，管理请使用独立管理账号');return user;};
  if(mapping)return existingUser(mapping.userId);
  return store.transaction(()=>{const concurrent=store.get<{id:string;userId:string}>('wechat_identity',identityId);if(concurrent)return existingUser(concurrent.userId);const user:User={id:`wechat-${identityId.slice(0,32)}`,nickname:'微信拼友',role:'customer'};store.put('user',user);store.put('wechat_identity',{id:identityId,userId:user.id,appId:credentials.appId,openid:body.openid,createdAt:now()});return user;});
}
