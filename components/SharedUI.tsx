"use client";

import { useState } from "react";

export function CoinIcon({
  symbol,
  className = "w-8 h-8 rounded-full",
}: {
  symbol: string;
  className?: string;
}) {
  const [error, setError] = useState(false);
  const baseSymbol = symbol.split("/")[0].toLowerCase();
  const iconUrl = `https://coinicons-api.vercel.app/api/icon/${baseSymbol}`;

  if (error) {
    return (
      <div
        className={`${className} bg-linear-to-tr from-neutral-800 to-neutral-700 flex items-center justify-center font-bold text-[10px] text-white shadow-inner uppercase`}
      >
        {symbol.split("/")[0].substring(0, 3)}
      </div>
    );
  }

  return (
    <img
      src={iconUrl}
      alt={symbol}
      className={`${className} object-contain bg-neutral-800/50 p-0.5`}
      onError={() => setError(true)}
    />
  );
}

export function StatCard({
  label,
  value,
  textClass = "text-white",
  icon,
}: {
  label: string;
  value: string | number;
  textClass?: string;
  icon?: React.ReactNode;
}) {
  return (
    <div className="bg-[#0f0f13] border border-white/5 rounded-xl p-5 backdrop-blur-md relative overflow-hidden group">
      {icon && (
        <div className="absolute top-0 right-0 p-2 opacity-50 group-hover:scale-110 transition-transform">
          {icon}
        </div>
      )}
      <div className="absolute inset-x-0 bottom-0 h-0.5 bg-linear-to-r from-transparent via-white/10 to-transparent group-hover:via-emerald-500/30 transition-all duration-500" />
      <div className="text-neutral-500 text-xs font-medium tracking-wide uppercase mb-1">
        {label}
      </div>
      <div className={`text-2xl font-bold tracking-tight ${textClass}`}>
        {value}
      </div>
    </div>
  );
}
