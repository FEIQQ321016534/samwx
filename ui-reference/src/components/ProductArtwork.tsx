/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';

interface ProductArtworkProps {
  type: 'bakery' | 'meat' | 'drink' | 'snack' | 'grocery' | 'fresh';
  name: string;
  className?: string;
  aspectRatio?: '4:3' | '16:9' | '1:1';
}

export const ProductArtwork: React.FC<ProductArtworkProps> = ({
  type,
  name,
  className = '',
  aspectRatio = '4:3',
}) => {
  const aspectClass =
    aspectRatio === '16:9' ? 'aspect-video' : aspectRatio === '1:1' ? 'aspect-square' : 'aspect-[4/3]';

  return (
    <div
      className={`relative w-full overflow-hidden select-none flex items-center justify-center ${aspectClass} ${className}`}
      data-testid="product-artwork"
    >
      {/* Background with luxury gradient mesh */}
      {type === 'bakery' && (
        <div className="absolute inset-0 bg-gradient-to-br from-amber-50 via-amber-100/60 to-orange-100/80">
          <svg className="w-full h-full opacity-90" viewBox="0 0 400 300" fill="none">
            {/* Table surface subtle shadow */}
            <ellipse cx="200" cy="240" rx="160" ry="25" fill="#e5d5be" opacity="0.6" />
            {/* Clear bakery dome packaging silhouette */}
            <rect x="60" y="55" width="280" height="175" rx="18" fill="#ffffff" fillOpacity="0.45" stroke="#d4bda4" strokeWidth="2" />
            <path d="M70 65 L330 65" stroke="#ffffff" strokeWidth="3" strokeLinecap="round" strokeOpacity="0.8" />
            
            {/* Swiss rolls / Pastry slices illustration */}
            <g transform="translate(110, 95)">
              {/* Roll 1 (Golden cream) */}
              <circle cx="50" cy="55" r="42" fill="#FBBF24" stroke="#D97706" strokeWidth="3" />
              <circle cx="50" cy="55" r="28" fill="#FFFBEB" stroke="#FDE68A" strokeWidth="2" />
              <path d="M45 42 Q62 48 55 68 Q45 78 38 65 Q35 52 48 50" fill="none" stroke="#B45309" strokeWidth="4" strokeLinecap="round" />
              
              {/* Roll 2 (Earl Grey Tea Roll) */}
              <circle cx="130" cy="55" r="42" fill="#78350F" stroke="#451A03" strokeWidth="3" />
              <circle cx="130" cy="55" r="28" fill="#FEF3C7" stroke="#FDE68A" strokeWidth="2" />
              <path d="M125 42 Q142 48 135 68 Q125 78 118 65 Q115 52 128 50" fill="none" stroke="#78350F" strokeWidth="4" strokeLinecap="round" />
            </g>

            {/* Sam's Bakery Stamp */}
            <rect x="230" y="70" width="95" height="24" rx="4" fill="#0055A5" />
            <text x="277" y="86" fill="#ffffff" fontSize="10" fontWeight="bold" textAnchor="middle" letterSpacing="1">
              MEMBER'S MARK
            </text>
          </svg>
        </div>
      )}

      {type === 'meat' && (
        <div className="absolute inset-0 bg-gradient-to-br from-rose-50 via-red-100/50 to-stone-200">
          <svg className="w-full h-full opacity-90" viewBox="0 0 400 300" fill="none">
            {/* Black slate serving board */}
            <rect x="50" y="60" width="300" height="175" rx="12" fill="#1C1917" stroke="#44403C" strokeWidth="2" />
            <rect x="55" y="65" width="290" height="165" rx="8" fill="#292524" />
            
            {/* Premium Ribeye Steaks with marbling */}
            <g transform="translate(90, 85)">
              <path
                d="M15 45 C15 20, 60 15, 110 25 C160 35, 195 20, 205 50 C215 80, 185 115, 130 115 C75 115, 15 95, 15 45 Z"
                fill="#991B1B"
                stroke="#7F1D1D"
                strokeWidth="3"
              />
              {/* Fat cap & marbling streaks */}
              <path d="M30 35 Q85 30 145 35 Q190 32 198 48" stroke="#FEE2E2" strokeWidth="6" strokeLinecap="round" opacity="0.85" />
              <path d="M60 55 Q100 65 140 55" stroke="#FEE2E2" strokeWidth="2.5" strokeLinecap="round" opacity="0.75" />
              <path d="M80 80 Q120 75 160 85" stroke="#FEE2E2" strokeWidth="2.5" strokeLinecap="round" opacity="0.75" />
              <path d="M45 75 Q75 85 95 80" stroke="#FEE2E2" strokeWidth="2" strokeLinecap="round" opacity="0.6" />
              
              {/* Fresh Rosemary & salt flakes */}
              <path d="M30 100 Q65 110 100 102" stroke="#15803D" strokeWidth="3" strokeLinecap="round" />
              <circle cx="70" cy="50" r="2" fill="#ffffff" />
              <circle cx="120" cy="65" r="2.5" fill="#ffffff" />
              <circle cx="150" cy="45" r="2" fill="#ffffff" />
            </g>

            <rect x="230" y="75" width="100" height="22" rx="4" fill="#0055A5" />
            <text x="280" y="90" fill="#ffffff" fontSize="9" fontWeight="bold" textAnchor="middle" letterSpacing="0.8">
              AUSTRALIAN GRAIN-FED
            </text>
          </svg>
        </div>
      )}

      {type === 'drink' && (
        <div className="absolute inset-0 bg-gradient-to-br from-emerald-50 via-teal-100/50 to-green-100/70">
          <svg className="w-full h-full opacity-90" viewBox="0 0 400 300" fill="none">
            <ellipse cx="200" cy="245" rx="130" ry="18" fill="#cbd5e1" opacity="0.5" />
            
            {/* Two Calamansi Lime Juice Bottles */}
            <g transform="translate(130, 45)">
              {/* Bottle 1 */}
              <rect x="25" y="60" width="55" height="135" rx="10" fill="#22C55E" fillOpacity="0.85" stroke="#16A34A" strokeWidth="2" />
              <rect x="38" y="35" width="28" height="28" rx="4" fill="#86EFAC" stroke="#16A34A" strokeWidth="1.5" />
              <rect x="34" y="22" width="36" height="15" rx="3" fill="#15803D" />
              {/* Label */}
              <rect x="28" y="95" width="49" height="55" rx="4" fill="#ffffff" fillOpacity="0.95" />
              <circle cx="52" cy="118" r="14" fill="#84CC16" />
              <text x="52" y="140" fill="#14532D" fontSize="7" fontWeight="bold" textAnchor="middle">1000ml NFC</text>

              {/* Bottle 2 */}
              <rect x="90" y="60" width="55" height="135" rx="10" fill="#22C55E" fillOpacity="0.85" stroke="#16A34A" strokeWidth="2" />
              <rect x="103" y="35" width="28" height="28" rx="4" fill="#86EFAC" stroke="#16A34A" strokeWidth="1.5" />
              <rect x="99" y="22" width="36" height="15" rx="3" fill="#15803D" />
              {/* Label */}
              <rect x="93" y="95" width="49" height="55" rx="4" fill="#ffffff" fillOpacity="0.95" />
              <circle cx="117" cy="118" r="14" fill="#84CC16" />
              <text x="117" y="140" fill="#14532D" fontSize="7" fontWeight="bold" textAnchor="middle">1000ml NFC</text>
            </g>

            {/* Fresh Lime slice on side */}
            <circle cx="105" cy="220" r="24" fill="#84CC16" stroke="#4D7C0F" strokeWidth="2" />
            <circle cx="105" cy="220" r="18" fill="#BEF264" stroke="#65A30D" strokeWidth="1.5" />
            <path d="M105 202 L105 238 M87 220 L123 220 M92 207 L118 233 M92 233 L118 207" stroke="#4D7C0F" strokeWidth="1.5" />
          </svg>
        </div>
      )}

      {(type === 'snack' || type === 'grocery' || type === 'fresh') && (
        <div className="absolute inset-0 bg-gradient-to-br from-blue-50 via-indigo-50/60 to-slate-100">
          <svg className="w-full h-full opacity-90" viewBox="0 0 400 300" fill="none">
            <ellipse cx="200" cy="235" rx="120" ry="18" fill="#cbd5e1" opacity="0.6" />
            {/* Wholesale Container Barrel / Box */}
            <rect x="125" y="70" width="150" height="155" rx="16" fill="#F8FAFC" stroke="#64748B" strokeWidth="3" />
            <rect x="115" y="55" width="170" height="22" rx="6" fill="#0055A5" />
            <rect x="135" y="115" width="130" height="75" rx="8" fill="#EFF6FF" stroke="#93C5FD" strokeWidth="1.5" />
            
            {/* Member's Mark Emblem */}
            <circle cx="200" cy="145" r="22" fill="#0055A5" />
            <path d="M192 145 L198 151 L209 140" stroke="#ffffff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
            <text x="200" y="178" fill="#1E3A8A" fontSize="9" fontWeight="bold" textAnchor="middle" letterSpacing="0.5">
              BULK VALUE PACK
            </text>
          </svg>
        </div>
      )}

      {/* Subtle bottom brand badge */}
      <div className="absolute bottom-2 left-2 z-10 flex items-center gap-1.5 bg-black/40 backdrop-blur-md px-2 py-0.5 rounded text-[10px] text-white/95 font-medium tracking-tight">
        <span className="w-1.5 h-1.5 rounded-full bg-blue-400"></span>
        <span>Sam's Club 直采保真</span>
      </div>
    </div>
  );
};
