"use client";

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
  const { data, isLoading } = useSWR<GapResult[]>(
    "/api/kucoin-scanner",
    fetcher,
    {
      refreshInterval: 3000,
      revalidateOnFocus: true,
    },
  );

  return (
    <>
      {/* Control Area */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-8 pb-6 border-b border-white/5 gap-4">
        <div>
          <h2 className="text-xl font-bold text-white">
            Look twice, Leap once
          </h2>
          <p className="text-neutral-500 text-sm">
            Monitoring USDT vs USDC pairs on KuCoin
          </p>
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
            <svg
              className="w-4 h-4 text-emerald-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"
              />
            </svg>
          }
        />
        <StatCard
          label="Best Gap"
          value={
            data && data.length > 0
              ? `${Math.max(...data.map((d) => d.gapPercent)).toFixed(2)}%`
              : "0.00%"
          }
          textClass="text-emerald-400"
        />
      </div>

      {/* Data List Container */}
      <div className="bg-[#0f0f13] border border-white/5 rounded-2xl shadow-2xl overflow-hidden backdrop-blur-xl relative">
        {/* Header - Hidden on Mobile */}
        <div className="hidden md:grid grid-cols-6 lg:grid-cols-8 gap-4 px-6 py-4 border-b border-white/5 text-[10px] font-bold text-neutral-400 uppercase tracking-wider bg-white/[0.02]">
          <div className="col-span-2">Asset</div>
          <div className="col-span-1 text-center">Gap %</div>
          <div className="col-span-1 lg:col-span-2 pl-4">Buy At</div>
          <div className="col-span-2 lg:col-span-3 pl-4">Sell At</div>
        </div>

        <div className="divide-y divide-white/5">
          {isLoading && !data && (
            <div className="flex flex-col items-center justify-center py-24 animate-pulse">
              <div className="w-8 h-8 border-2 border-emerald-500/30 border-t-emerald-500 rounded-full animate-spin mb-4" />
              <p className="text-neutral-500 text-sm font-medium">
                Scanning KuCoin Tickers...
              </p>
            </div>
          )}

          {data && data.length === 0 && (
            <div className="py-24 text-center text-neutral-500 text-sm italic">
              No significant gaps found in current scan.
            </div>
          )}

          {data &&
            data.map((item, i) => (
              <div
                key={`${item.coin}-${i}`}
                className="flex flex-col md:grid md:grid-cols-6 lg:grid-cols-8 gap-4 px-6 py-5 md:py-4 items-center hover:bg-white/[0.02] transition-all duration-300 group relative"
              >
                {/* Asset Info */}
                <div className="flex items-center justify-between w-full md:w-auto md:col-span-2 gap-4">
                  <div className="flex items-center gap-3">
                    <CoinIcon symbol={item.coin} className="w-9 h-9" />
                    <div>
                      <div className="text-sm font-black text-white tracking-wide">
                        {item.coin}
                      </div>
                      <div className="text-[10px] text-neutral-500 font-bold uppercase tracking-tighter px-1.5 py-0.5 rounded bg-white/5 w-fit">
                        Internal
                      </div>
                    </div>
                  </div>

                  {/* Mobile-only Gap Badge */}
                  <div className="md:hidden">
                    <span
                      className={`px-2.5 py-1.5 rounded-lg text-xs font-black border ${
                        item.gapPercent > 3
                          ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20 shadow-[0_0_15px_rgba(16,185,129,0.1)]"
                          : "bg-white/5 text-neutral-200 border-white/5"
                      }`}
                    >
                      {item.gapPercent.toFixed(2)}%
                    </span>
                  </div>
                </div>

                {/* Desktop-only Gap Badge */}
                <div className="hidden md:flex items-center justify-center md:col-span-1">
                  <span
                    className={`px-2.5 py-1 rounded-md text-sm font-black border transition-all duration-300 ${
                      item.gapPercent > 3
                        ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20 shadow-[0_0_15px_rgba(16,185,129,0.1)] scale-105"
                        : "bg-white/5 text-neutral-200 border-white/5"
                    }`}
                  >
                    {item.gapPercent.toFixed(2)}%
                  </span>
                </div>

                {/* Trading Pairs Grid */}
                <div className="grid grid-cols-2 md:contents w-full gap-4 pt-4 md:pt-0 border-t border-white/5 md:border-none">
                  {/* Buy Section */}
                  <div className="md:col-span-1 lg:col-span-2 md:pl-4">
                    <div className="text-[10px] text-neutral-500 font-bold uppercase tracking-tighter mb-1.5 md:hidden">
                      Buy At
                    </div>
                    <div className="flex flex-col">
                      <span className="text-[10px] font-black text-neutral-300 mb-1 truncate max-w-[120px] uppercase bg-white/5 px-1.5 py-0.5 rounded w-fit border border-white/5">
                        {item.buyMarket}
                      </span>
                      <span className="text-sm font-mono text-emerald-400 font-bold tracking-tight">
                        $
                        {item.buyPrice > 1
                          ? item.buyPrice.toLocaleString()
                          : item.buyPrice.toFixed(6)}
                      </span>
                    </div>
                  </div>

                  {/* Sell Section */}
                  <div className="md:col-span-2 lg:col-span-3 md:pl-4">
                    <div className="text-[10px] text-neutral-500 font-bold uppercase tracking-tighter mb-1.5 md:hidden">
                      Sell At
                    </div>
                    <div className="flex flex-col">
                      <span className="text-[10px] font-black text-neutral-300 mb-1 truncate max-w-[120px] uppercase bg-white/5 px-1.5 py-0.5 rounded w-fit border border-white/5">
                        {item.sellMarket}
                      </span>
                      <span className="text-sm font-mono text-blue-400 font-bold tracking-tight">
                        $
                        {item.sellPrice > 1
                          ? item.sellPrice.toLocaleString()
                          : item.sellPrice.toFixed(6)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
        </div>
      </div>
    </>
  );
}
