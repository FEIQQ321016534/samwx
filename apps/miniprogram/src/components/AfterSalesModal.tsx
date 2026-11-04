import React,{useEffect,useRef,useState} from 'react';
import Taro from '@tarojs/taro';
import {View,Text,Button,Textarea,Input} from './ui';
import {api,formatBeijingDate} from '../services/api';
export function AfterSalesModal({order,onClose}:{order:any;onClose:()=>void}) {
  const [reason,setReason]=useState(''); const [amount,setAmount]=useState(''); const [cases,setCases]=useState<any[]>([]); const [error,setError]=useState(''); const [busy,setBusy]=useState(false);const epoch=useRef(0); const lock=useRef<number|null>(null);const request=useRef({fingerprint:'',id:''});
  useEffect(()=>{const version=++epoch.current;lock.current=null;setBusy(false);request.current={fingerprint:'',id:''};setReason('');setAmount('');setCases([]);setError('');if(order)api.get(`/orders/${order.orderId}/after-sales`).then(value=>{if(epoch.current===version)setCases(value);}).catch(e=>{if(epoch.current===version)setError(e.message);});},[order?.orderId]);
  if(!order)return null;
  const available=(order.raw.paidCents-order.raw.refundedCents)/100;
  const submit=async()=>{
    const version=epoch.current;if(lock.current===version)return;const text=reason.trim();
    if(text.length<2||text.length>500){setError('请填写2至500字的售后原因');return;}
    if(amount&&!/^\d+(\.\d{1,2})?$/.test(amount)){setError('申请金额最多保留两位小数');return;}
    const cents=amount?Math.round(Number(amount)*100):undefined;
    if(cents!==undefined&&(cents<=0||cents>Math.round(available*100))){setError('申请金额不能超过当前未退金额');return;}
    lock.current=version;setBusy(true);setError('');
    const fingerprint=JSON.stringify({id:order.orderId,text,cents});if(request.current.fingerprint!==fingerprint)request.current={fingerprint,id:`service-${Date.now()}-${Math.random().toString(36).slice(2)}`};
    try {await api.post(`/orders/${order.orderId}/after-sales`,{requestId:request.current.id,reason:text,...(cents?{requestedRefundCents:cents}:{})});const updated=await api.get(`/orders/${order.orderId}/after-sales`);if(epoch.current!==version)return;setCases(updated);Taro.showToast({title:'售后申请已提交',icon:'success'});}
    catch(e:any){if(epoch.current!==version)return;setError(e.message);const updated=await api.get(`/orders/${order.orderId}/after-sales`).catch(()=>cases);if(epoch.current===version)setCases(updated);}
    finally{if(lock.current===version)lock.current=null;if(epoch.current===version)setBusy(false);}
  };
  const hasOpen=cases.some(c=>c.status==='open');
  return <View className="fixed inset-0 z-50 bg-black/60 flex items-end justify-center"><View className="w-full max-w-md bg-white rounded-t-3xl p-5 safe-bottom max-h-[90vh] overflow-y-auto space-y-3">
    <View className="flex items-center justify-between font-bold"><Text className="shrink-0">订单售后</Text><Button className="w-12 text-sm shrink-0" onClick={onClose}>关闭</Button></View>
    <View className="text-xs text-slate-500">可申请金额 ¥{available.toFixed(2)}，处理结果以商户审核为准。退款入账户余额，记录可查。</View>
    {cases.map(c=><View key={c.id} className="bg-slate-50 rounded-xl p-3 text-xs space-y-1"><View>{c.reason}</View><View className="text-[#0055A5]">{{open:'待审核',approved:'已同意',rejected:'已拒绝'}[c.status as string]||c.status}</View>{c.reviewReason&&<View>{c.reviewReason}</View>}<View className="text-slate-400">{formatBeijingDate(c.createdAt)}</View></View>)}
    {!hasOpen&&available>0&&<><Textarea className="w-full bg-slate-100 p-3 rounded-xl text-sm" maxlength={500} value={reason} onChange={(e:any)=>setReason(e.target.value)} placeholder="请说明缺货、损坏或其他售后问题"/><Input type="digit" className="bg-slate-100 p-3 rounded-xl" value={amount} onChange={(e:any)=>setAmount(e.target.value)} placeholder="申请退款金额（可不填，由商户核定）"/><Button disabled={busy} onClick={submit} className="w-full bg-[#0055A5] text-white py-3 rounded-xl">{busy?'提交中…':'提交售后申请'}</Button></>}
    {error&&<View className="text-xs text-rose-600">{error}</View>}
  </View></View>;
}
