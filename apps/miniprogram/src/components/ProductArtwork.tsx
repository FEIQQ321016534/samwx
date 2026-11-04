// Reference artwork rasterized by tools/generate-assets.mjs for WeChat Image.
import React from 'react';
import { Image, Text, View } from '@tarojs/components';

interface ProductArtworkProps {
  type: 'bakery' | 'meat' | 'drink' | 'snack' | 'grocery' | 'fresh';
  name: string;
  className?: string;
  aspectRatio?: '4:3' | '16:9' | '1:1';
}

const artwork = {
  bakery: '/assets/artwork/bakery.png',
  meat: '/assets/artwork/meat.png',
  drink: '/assets/artwork/drink.png',
  snack: '/assets/artwork/bulk.png',
  grocery: '/assets/artwork/bulk.png',
  fresh: '/assets/artwork/bulk.png',
};
const backgrounds = {
  bakery: 'bg-gradient-to-br from-amber-50 via-amber-100/60 to-orange-100/80',
  meat: 'bg-gradient-to-br from-rose-50 via-red-100/50 to-stone-200',
  drink: 'bg-gradient-to-br from-emerald-50 via-teal-100/50 to-green-100/70',
  snack: 'bg-gradient-to-br from-blue-50 via-indigo-50/60 to-slate-100',
  grocery: 'bg-gradient-to-br from-blue-50 via-indigo-50/60 to-slate-100',
  fresh: 'bg-gradient-to-br from-blue-50 via-indigo-50/60 to-slate-100',
};

export const ProductArtwork: React.FC<ProductArtworkProps> = ({ type, name, className = '', aspectRatio = '4:3' }) => (
  <View className={'relative w-full overflow-hidden select-none ' + className} style={{ paddingTop: aspectRatio === '16:9' ? '56.25%' : aspectRatio === '1:1' ? '100%' : '75%' }}>
    <View className={'absolute inset-0 ' + backgrounds[type]}>
      <Image className="w-full h-full opacity-90" src={artwork[type]} mode="aspectFit" aria-label={name} />
    </View>
    <View className="absolute bottom-2 left-2 z-10 flex items-center gap-1.5 bg-black/40 backdrop-blur-md px-2 py-0.5 rounded text-[0.625rem] text-white/95 font-medium tracking-tight">
      <View className="w-1.5 h-1.5 rounded-full bg-blue-400" />
      <Text>Sam's Club 直采保真</Text>
    </View>
  </View>
);
