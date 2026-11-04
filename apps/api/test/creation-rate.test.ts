import test from 'node:test';
import assert from 'node:assert/strict';
import {createApp} from '../src/app.ts';
test('one customer cannot flood empty groups by changing network IP',async t=>{
  const ctx=await createApp({databasePath:':memory:',environment:'test',devAuthEnabled:true,devPaymentsEnabled:true});t.after(()=>ctx.app.close());
  const token=(await ctx.app.inject({method:'POST',url:'/api/auth/dev-login',payload:{role:'customer',customerKey:'spam-test'}})).json().data.token;
  const request=()=>ctx.app.inject({method:'POST',url:'/api/groups',headers:{authorization:`Bearer ${token}`,'x-forwarded-for':`192.0.2.${Math.ceil(Math.random()*200)}`},payload:{productId:'sam-p1',optionId:'split-half',batchId:'batch-laochen-demo',communityId:'community-yangguang'}});
  for(let i=0;i<10;i++)assert.equal((await request()).statusCode,200);
  const denied=await request();assert.equal(denied.statusCode,429);assert.equal(denied.json().error.code,'CREATION_RATE_LIMIT');assert.ok(denied.headers['retry-after']);
});
