import test from 'node:test';
import assert from 'node:assert/strict';
import {computeWindowInsets} from '../src/utils/viewport.ts';

test('full-screen iPhone content and close target stay below the native capsule',()=>{
  const r=computeWindowInsets({windowWidth:420,windowHeight:912,screenTop:0,statusBarHeight:62,safeArea:{top:62,bottom:878}}, {top:66,bottom:98,height:32,left:326});
  assert.equal(r.top,106);assert.equal(r.bottom,34);
  assert.ok(r.top>98);assert.equal(r.contentHeight+ r.top + r.bottom,912);
});
test('already-offset native navigation is not counted twice',()=>{
  const r=computeWindowInsets({windowWidth:390,windowHeight:756,screenTop:88,statusBarHeight:44,safeArea:{top:44,bottom:810}},{top:48,bottom:80,height:32,left:285});
  assert.equal(r.top,0);assert.equal(r.bottom,34);assert.equal(r.contentHeight,722);
});
test('a small Android window still leaves scrollable body space',()=>{
  const r=computeWindowInsets({windowWidth:320,windowHeight:568,statusBarHeight:24,safeArea:{top:24,bottom:568}},{top:28,bottom:60,height:32,left:222});
  assert.equal(r.top,68);assert.equal(r.bottom,0);assert.ok(r.contentHeight>400);
});
test('zero or missing capsule values use a conservative navigation fallback',()=>{
  const r=computeWindowInsets({windowWidth:390,windowHeight:844,statusBarHeight:59,safeArea:{top:59,bottom:810}},{top:0,bottom:0,height:0});
  assert.ok(r.top>=107);assert.equal(r.bottom,34);assert.ok(r.contentHeight>0);
});
test('keyboard-reduced window does not add an extra off-screen bottom inset',()=>{
  const r=computeWindowInsets({windowWidth:390,windowHeight:500,screenTop:0,statusBarHeight:59,safeArea:{top:59,bottom:810}},{top:63,bottom:95,height:32,left:290});
  assert.equal(r.bottom,0);assert.equal(r.top,103);assert.equal(r.contentHeight,397);
});
test('transient zero window dimensions and invalid safe area keep content visible',()=>{
  const r=computeWindowInsets({windowWidth:0,windowHeight:0,screenHeight:844,statusBarHeight:59,safeArea:{top:0,bottom:0}});
  assert.equal(r.height,844);assert.equal(r.bottom,0);assert.ok(r.contentHeight>600);
  assert.ok(computeWindowInsets(undefined).contentHeight>0);
});
