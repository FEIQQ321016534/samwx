import React, { useEffect, useState } from 'react';
import Taro from '@tarojs/taro';
import { Image } from '@tarojs/components';
import { View } from './ui';
import { api } from '../services/api';

export function PrivateMedia({orderId,kind}: {orderId?:string;kind:'receipt'|'photo'}) {
  const [files,setFiles]=useState<string[]>([]);
  const [error,setError]=useState('');
  useEffect(()=>{
    let cancelled=false; setFiles([]);setError('');
    if(orderId) (async()=>{
      try {
        const media=await api.get(`/orders/${orderId}/media`);
        const paths:string[]=[];
        for(const item of media.filter((m:any)=>m.kind===kind)) { if(cancelled)return; paths.push(await api.privateImage(item.id)); }
        if(!cancelled)setFiles(paths);
      } catch {if(!cancelled)setError('凭证暂未加载成功，请重新打开查看');}
    })();
    return ()=>{cancelled=true;};
  },[orderId,kind]);
  return <View className="space-y-2">{error&&<View className="text-xs text-slate-400">{error}</View>}{files.map(src=><Image key={src} src={src} mode="widthFix" className="w-full rounded-xl" onClick={()=>Taro.previewImage({urls:files,current:src})}/> )}</View>;
}
