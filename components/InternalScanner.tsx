"use client";

import { useEffect, useState } from "react";
import useSWR from "swr";
import { CoinIcon, StatCard } from "./SharedUI";

interface GapResult {
  time: string;
  coin: string;
  gapPercent: number;
  buyMarket: string;
  buyPrice: number;
  sellMarket: string;
  sellPrice: number;
}

const fetcher = (url: string) => {
  console.log(`[InternalScanner] Fetching: ${url}`);
  return fetch(url).then((res) => res.json());
};

export function InternalScanner() {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const { data, error, isLoading } = useSWR<GapResult[]>("/api/kucoin-scanner", fetcher, {
    refreshInterval: 3000,
    revalidateOnFocus: true,
  });

  if (!mounted) return null;

  return (
    <>
      {/* Control Area */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-8 pb-6 border-b border-white/5 gap-4">
        <div>
          <h2 className="text-xl font-bold text-white">KuCoin Internal Arb</h2>
          <p className="text-neutral-500 text-sm">Monitoring USDT vs USDC pairs on KuCoin</p>
        </div>

        <div className="flex items-center space-x-2 bg-white/5 backdrop-blur-md px-4 py-2 rounded-full border border-white/10">
          <span className="relative flex h-3 w-3">
            <span
              className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${isLoading ? "bg-amber-400" : "bg-emerald-400"}`}
            ></span>
            <span
              className={`relative inline-flex rounded-full h-3 w-3 ${isLoading ? "bg-amber-400" : "bg-emerald-400"}`}
            ></span>
          </span>
          <span className="text-sm font-medium text-neutral-300 uppercase text-[10px] tracking-widest">
            {isLoading ? "Scanning..." : "Live"}
          </span>
        </div>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard 
          label="Live Gaps" 
          value={data?.length || 0} 
          icon={
            <svg className="w-4 h-4 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
            </svg>
          } 
        />
        <StatCard 
          label="Best Gap" 
          value={data && data.length > 0 ? `${Math.max(...data.map(d => d.gapPercent)).toFixed(2)}%` : "0.00%"} 
          textClass="text-emerald-400"
        />
      </div>

      {/* Data Table Container */}
      <div className="bg-[#0f0f13] border border-white/5 rounded-2xl shadow-2xl overflow-hidden backdrop-blur-xl relative">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-white/5 text-[10px] font-bold text-neutral-400 uppercase tracking-wider bg-white/[0.02]">
                <th className="px-6 py-4">Asset</th>
                <th className="px-6 py-4">Gap %</th>
                <th className="px-6 py-4">Buy At</th>
                <th className="px-6 py-4">Sell At</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {isLoading && !data && (
                <tr className="animate-pulse">
                  <td colSpan={4} className="px-6 py-12 text-center text-neutral-500 text-sm">
                    Scanning KuCoin Tickers...
                  </td>
                </tr>
              )}
              {data && data.length === 0 && (
                 <tr>
                  <td colSpan={4} className="px-6 py-12 text-center text-neutral-500 text-sm">
                    No significant gaps found in current scan.
                  </td>
                </tr>
              )}
              {data && data.map((item, i) => (
                <tr key={`${item.coin}-${i}`} className="group hover:bg-white/[0.02] transition-colors relative">
                   <td className="px-6 py-4">
                     <div className="flex items-center gap-3">
                       <CoinIcon symbol={item.coin} className="w-9 h-9" />
                       <div>
                         <div className="text-sm font-bold text-white tracking-wide">{item.coin}</div>
                         <div className="text-[10px] text-neutral-500 font-medium uppercase tracking-tighter">Internal</div>
                       </div>
                     </div>
                   </td>
                   <td className="px-6 py-4">
                     <span className={`px-2.5 py-1 rounded-md text-sm font-black border ${
                       item.gapPercent > 3 
                         ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20 shadow-[0_0_15px_rgba(16,185,129,0.1)]' 
                         : 'bg-white/5 text-neutral-200 border-white/5'
                     }`}>
                       {item.gapPercent.toFixed(2)}%
                     </span>
                   </td>
                   <td className="px-6 py-4">
                     <div className="flex flex-col">
                       <span className="text-[10px] font-bold text-neutral-500 mb-0.5 truncate max-w-[100px] uppercase">{item.buyMarket}</span>
                       <span className="text-sm font-mono text-emerald-400/90 font-bold">
                         ${item.buyPrice > 1 ? item.buyPrice.toLocaleString() : item.buyPrice.toFixed(6)}
                       </span>
                     </div>
                   </td>
                   <td className="px-6 py-4">
                     <div className="flex flex-col">
                       <span className="text-[10px] font-bold text-neutral-500 mb-0.5 truncate max-w-[100px] uppercase">{item.sellMarket}</span>
                       <span className="text-sm font-mono text-blue-400/90 font-bold">
                         ${item.sellPrice > 1 ? item.sellPrice.toLocaleString() : item.sellPrice.toFixed(6)}
                       </span>
                     </div>
                   </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
