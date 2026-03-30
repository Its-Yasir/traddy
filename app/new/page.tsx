"use client";

import { useEffect, useState, useMemo } from "react";
import useSWR from "swr";

interface GapResult {
  time: string;
  coin: string;
  gapPercent: number;
  buyMarket: string;
  buyPrice: number;
  sellMarket: string;
  sellPrice: number;
}

const fetcher = (url: string) => fetch(url).then((res) => res.json());

function CoinIcon({ symbol, className = "w-8 h-8 rounded-full" }: { symbol: string; className?: string }) {
  const [error, setError] = useState(false);
  const baseSymbol = symbol.split("/")[0].toLowerCase();
  const iconUrl = `https://coinicons-api.vercel.app/api/icon/${baseSymbol}`;

  if (error) {
    return (
      <div className={`${className} bg-neutral-800 flex items-center justify-center font-bold text-[10px] text-white uppercase`}>
        {symbol.substring(0, 3)}
      </div>
    );
  }

  return (
    <img
      src={iconUrl}
      alt={symbol}
      className={`${className} object-contain bg-neutral-900 shadow-inner`}
      onError={() => setError(true)}
    />
  );
}

export default function NewScanner() {
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
    <div className="min-h-screen bg-[#050507] text-slate-200 font-sans selection:bg-emerald-500/30">
      {/* Visual background glows */}
      <div className="fixed top-0 left-1/4 w-[500px] h-[500px] bg-emerald-500/5 blur-[120px] pointer-events-none rounded-full" />
      <div className="fixed bottom-0 right-1/4 w-[400px] h-[400px] bg-blue-500/5 blur-[100px] pointer-events-none rounded-full" />

      <main className="max-w-7xl mx-auto px-6 py-12 relative z-10">
        {/* Header */}
        <header className="flex flex-col md:flex-row md:items-end justify-between mb-16 gap-6">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <span className="px-2 py-1 bg-emerald-500/10 text-emerald-400 text-[10px] font-bold uppercase tracking-widest rounded border border-emerald-500/20">
                Live Scanner
              </span>
              <div className="flex items-center gap-1.5 px-2 py-1 bg-white/5 rounded-full border border-white/5">
                 <span className={`w-1.5 h-1.5 rounded-full ${isLoading ? 'bg-amber-400 animate-pulse' : 'bg-emerald-400'}`} />
                 <span className="text-[10px] font-medium text-slate-400">KUCOIN INTRA-ARB</span>
              </div>
            </div>
            <h1 className="text-4xl font-bold tracking-tight text-white mb-2">
              USDT / USDC <span className="text-emerald-400">Internal</span>
            </h1>
            <p className="text-slate-500 max-w-md">
              Monitoring price gaps between USDT and USDC markets on KuCoin. 
              Gaps filtered between 0.7% and 10%.
            </p>
          </div>

          <div className="flex gap-4">
            <StatCard label="Live Gaps" value={data?.length || 0} icon={
              <svg className="w-4 h-4 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
              </svg>
            } />

          </div>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Main Scanning Table */}
          <section className="lg:col-span-12 space-y-6">
            <h2 className="text-xs font-bold text-slate-500 uppercase tracking-[0.2em] flex items-center gap-2">
              <span className="w-1 h-1 bg-emerald-500 rounded-full" />
              TOP PRICE GAPS FOUND
            </h2>
            
            <div className="bg-[#0c0c0f] border border-white/5 rounded-2xl overflow-hidden glass-card">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-white/5 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                      <th className="px-6 py-4">Asset</th>
                      <th className="px-6 py-4">Gap %</th>
                      <th className="px-6 py-4">Buy At</th>
                      <th className="px-6 py-4">Sell At</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {isLoading && !data && (
                      <tr className="animate-pulse">
                        <td colSpan={4} className="px-6 py-12 text-center text-slate-500 text-sm">
                          Scanning KuCoin Tickers...
                        </td>
                      </tr>
                    )}
                    {data && data.length === 0 && (
                       <tr>
                        <td colSpan={4} className="px-6 py-12 text-center text-slate-500 text-sm">
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
                               <div className="text-[10px] text-slate-500 font-medium">Internal Pair</div>
                             </div>
                           </div>
                         </td>
                         <td className="px-6 py-4">
                           <span className={`px-2.5 py-1 rounded-md text-sm font-black border ${
                             item.gapPercent > 3 
                              ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20 shadow-[0_0_15px_rgba(16,185,129,0.1)]' 
                              : 'bg-white/5 text-slate-200 border-white/5'
                           }`}>
                             {item.gapPercent.toFixed(2)}%
                           </span>
                         </td>
                         <td className="px-6 py-4">
                           <div className="flex flex-col">
                             <span className="text-[10px] font-bold text-slate-500 mb-0.5 truncate max-w-[100px]">{item.buyMarket}</span>
                             <span className="text-sm font-mono text-emerald-400/90 font-bold">
                               ${item.buyPrice > 1 ? item.buyPrice.toLocaleString() : item.buyPrice.toFixed(6)}
                             </span>
                           </div>
                         </td>
                         <td className="px-6 py-4">
                           <div className="flex flex-col">
                             <span className="text-[10px] font-bold text-slate-500 mb-0.5 truncate max-w-[100px]">{item.sellMarket}</span>
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
          </section>


        </div>
      </main>

      <style jsx global>{`
        .glass-card {
          background: linear-gradient(135deg, rgba(20, 20, 25, 0.7) 0%, rgba(10, 10, 12, 0.8) 100%);
          backdrop-filter: blur(10px);
        }
        .custom-scrollbar::-webkit-scrollbar {
          width: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: rgba(255, 255, 255, 0.02);
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(255, 255, 255, 0.05);
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: rgba(255, 255, 255, 0.1);
        }
      `}</style>
    </div>
  );
}

function StatCard({ label, value, icon }: { label: string; value: string | number; icon: React.ReactNode }) {
  return (
    <div className="bg-[#0c0c0f] border border-white/5 rounded-xl px-5 py-4 min-w-[140px] flex flex-col justify-center glass-card relative overflow-hidden group">
      <div className="absolute top-0 right-0 p-2 opacity-50 group-hover:scale-110 transition-transform">
        {icon}
      </div>
      <div className="text-[10px] text-slate-500 font-bold uppercase tracking-wider mb-1">{label}</div>
      <div className="text-2xl font-black text-white tabular-nums tracking-tight">
        {value}
      </div>
    </div>
  );
}
