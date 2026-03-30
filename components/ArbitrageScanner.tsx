"use client";

import {
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  useMemo,
  useCallback,
} from "react";
import useSWR from "swr";
import { safeStorage } from "@/lib/storage";
import { CoinIcon, StatCard } from "./SharedUI";

interface Opportunity {
  pair: string;
  gapPercent: number;
  buyExchange: string;
  lowPrice: number;
  buyVolume?: number;
  sellExchange: string;
  highPrice: number;
  sellVolume?: number;
  volumeDiff?: number;
  marketCap?: number | null;
}

const EXCHANGE_LOGOS: Record<string, string> = {
  Binance: "https://www.google.com/s2/favicons?domain=binance.com&sz=64",
  KuCoin: "https://www.google.com/s2/favicons?domain=kucoin.com&sz=64",
  Bybit: "https://www.google.com/s2/favicons?domain=bybit.com&sz=64",
};

const fetcher = (url: string) => {
  console.log(`[ArbitrageScanner] Fetching: ${url}`);
  return fetch(url).then((res) => {
    if (!res.ok) {
      throw new Error(`API error: ${res.status}`);
    }
    return res.json();
  });
};

export function ArbitrageScanner() {
  const [notificationPermission, setNotificationPermission] =
    useState<string>("default");
  const [activeNotification, setActiveNotification] =
    useState<Opportunity | null>(null);
  const [sortOrder, setSortOrder] = useState<"asc" | "desc" | "none">("none");
  const [pinnedOpps, setPinnedOpps] = useState<Opportunity[]>(() => {
    if (typeof window !== "undefined") {
      const saved = safeStorage.getItem("pinnedArbOpps");
      if (saved) {
        try {
          return JSON.parse(saved);
        } catch (e) {
          console.error("Failed to parse pinned opportunities", e);
          return [];
        }
      }
    }
    return [];
  });

  const [notificationThreshold, setNotificationThreshold] = useState<number>(
    () => {
      if (typeof window !== "undefined") {
        const saved = safeStorage.getItem("arbNotificationThreshold");
        return saved ? parseFloat(saved) : 4;
      }
      return 4;
    },
  );

  const isClient = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );

  const notifiedPairs = useRef<Set<string>>(new Set());

  const swrKey = useMemo(() => {
    const isAuthenticated =
      typeof window !== "undefined" && safeStorage.getItem("traddy_password");
    if (!isAuthenticated) return null;

    const pinnedKeys = pinnedOpps
      .map((po) => `${po.pair}-${po.buyExchange}-${po.sellExchange}`)
      .join(",");
    return `/api/arbitrage${pinnedKeys ? `?pinned=${encodeURIComponent(pinnedKeys)}` : ""}`;
  }, [pinnedOpps]);

  const { data, error, isLoading, isValidating } = useSWR<Opportunity[]>(
    swrKey,
    fetcher,
    {
      refreshInterval: 3000,
      revalidateOnFocus: true,
    },
  );

  useEffect(() => {
    if (
      typeof window !== "undefined" &&
      "Notification" in window &&
      typeof Notification.requestPermission === "function"
    ) {
      try {
        Notification.requestPermission()
          .then((permission) => {
            setNotificationPermission(permission);
          })
          .catch((e) =>
            console.warn("Notification permission request failed:", e),
          );
      } catch (e) {
        console.warn("Notification.requestPermission threw an error:", e);
      }
    }
  }, []);

  const triggerNotification = useCallback(
    (opp: Opportunity) => {
      setActiveNotification(opp);

      try {
        const audio = new Audio("/mixkit-positive-notification-951.wav");
        audio.play().catch((e) => console.log("Audio play blocked:", e));
      } catch (e) {
        console.warn("Audio initialization failed:", e);
      }

      if (typeof document !== "undefined") {
        document.title = "NEW NOTIFICATION 🚀";
      }

      if (
        notificationPermission === "granted" &&
        typeof window !== "undefined" &&
        "Notification" in window
      ) {
        try {
          new Notification(
            `${opp.pair}: ${opp.gapPercent.toFixed(2)}% Gap! 🚀`,
            {
              body: `Buy at: ${opp.buyExchange} | Sell at: ${opp.sellExchange}\nPrice Gap: ${opp.gapPercent.toFixed(2)}%`,
            },
          );
        } catch (e) {
          console.warn("Native Notification trigger failed:", e);
        }
      }

      setTimeout(() => {
        setActiveNotification(null);
        document.title = "Traddy Scanner";
      }, 5000);
    },
    [notificationPermission],
  );

  useEffect(() => {
    if (isClient) {
      safeStorage.setItem("pinnedArbOpps", JSON.stringify(pinnedOpps));
      safeStorage.setItem(
        "arbNotificationThreshold",
        notificationThreshold.toString(),
      );
    }
  }, [pinnedOpps, notificationThreshold, isClient]);

  const processedData = useMemo(() => {
    const currentData = Array.isArray(data) ? data : [];
    const currentKeys = new Set(
      currentData.map((o) => `${o.pair}-${o.buyExchange}-${o.sellExchange}`),
    );
    const missingPinned = pinnedOpps.filter(
      (po) =>
        !currentKeys.has(`${po.pair}-${po.buyExchange}-${po.sellExchange}`),
    );
    const mergedResult = [...currentData, ...missingPinned];
    const pinnedKeys = new Set(
      pinnedOpps.map((po) => `${po.pair}-${po.buyExchange}-${po.sellExchange}`),
    );

    mergedResult.sort((a, b) => {
      const aKey = `${a.pair}-${a.buyExchange}-${a.sellExchange}`;
      const bKey = `${b.pair}-${b.buyExchange}-${b.sellExchange}`;
      const aPinned = pinnedKeys.has(aKey);
      const bPinned = pinnedKeys.has(bKey);

      if (aPinned && !bPinned) return -1;
      if (!aPinned && bPinned) return 1;

      if (sortOrder !== "none") {
        return sortOrder === "asc"
          ? a.gapPercent - b.gapPercent
          : b.gapPercent - a.gapPercent;
      }

      return 0;
    });

    return mergedResult;
  }, [data, pinnedOpps, sortOrder]);

  useEffect(() => {
    if (!data || !Array.isArray(data)) return;
    if (notificationPermission !== "granted") return;

    data.forEach((opp) => {
      const oppKey = `${opp.pair}-${opp.buyExchange}-${opp.sellExchange}`;
      if (opp.gapPercent >= notificationThreshold) {
        if (!notifiedPairs.current.has(oppKey)) {
          notifiedPairs.current.add(oppKey);
          triggerNotification(opp);
        }
      }
    });

    const currentHighGapPairs = new Set(
      data
        .filter((op) => op.gapPercent >= notificationThreshold)
        .map((op) => `${op.pair}-${op.buyExchange}-${op.sellExchange}`),
    );
    for (const key of notifiedPairs.current) {
      if (!currentHighGapPairs.has(key)) {
        notifiedPairs.current.delete(key);
      }
    }
  }, [
    data,
    notificationPermission,
    notificationThreshold,
    triggerNotification,
  ]);

  if (!isClient) return null;

  return (
    <>
      {/* Visual Notification Overlay */}
      {activeNotification && (
        <div className="fixed top-4 md:top-6 left-1/2 -translate-x-1/2 z-50 w-screen max-w-[calc(100%-32px)] md:max-w-lg animate-in fade-in slide-in-from-top-4 duration-300">
          <div className="bg-[#1a1a24]/90 backdrop-blur-xl border border-emerald-500/30 rounded-2xl shadow-[0_0_30px_rgba(16,185,129,0.2)] overflow-hidden">
            <div className="flex items-center p-3 md:p-5 gap-3 md:gap-4">
              <div className="w-10 h-10 md:w-12 md:h-12 rounded-xl bg-emerald-500/10 flex items-center justify-center shrink-0">
                <CoinIcon
                  symbol={activeNotification.pair}
                  className="w-8 h-8 md:w-10 md:h-10 rounded-lg"
                />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-0.5 md:mb-1 gap-2">
                  <h3 className="text-white font-bold text-sm md:text-lg truncate flex items-center gap-1.5 md:gap-2">
                    {activeNotification.pair}
                    <span className="hidden sm:inline text-[8px] md:text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400 uppercase tracking-wider font-black">
                      Live
                    </span>
                  </h3>
                  <span className="text-emerald-400 font-black text-base md:text-xl tabular-nums shrink-0">
                    +{activeNotification.gapPercent.toFixed(2)}%
                  </span>
                </div>
                <div className="flex items-center gap-1.5 md:gap-2 text-neutral-400 text-[10px] md:text-sm font-medium overflow-hidden">
                  <span className="flex items-center gap-1 md:gap-1.5 text-white bg-white/5 px-1.5 md:px-2 py-0.5 md:py-1 rounded text-[10px] md:text-xs border border-white/5 shrink-0">
                    {EXCHANGE_LOGOS[activeNotification.buyExchange] && (
                      <img
                        src={EXCHANGE_LOGOS[activeNotification.buyExchange]}
                        alt=""
                        className="w-3 h-3 md:w-3.5 md:h-3.5 rounded-sm"
                      />
                    )}
                    <span className="truncate max-w-[50px] md:max-w-none">
                      {activeNotification.buyExchange}
                    </span>
                  </span>
                  <svg
                    className="w-2.5 h-2.5 md:w-3 md:h-3 text-neutral-600 shrink-0"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M14 5l7 7m0 0l-7 7m7-7H3"
                    />
                  </svg>
                  <span className="flex items-center gap-1 md:gap-1.5 text-white bg-white/5 px-1.5 md:px-2 py-0.5 md:py-1 rounded text-[10px] md:text-xs border border-white/5 shrink-0">
                    {EXCHANGE_LOGOS[activeNotification.sellExchange] && (
                      <img
                        src={EXCHANGE_LOGOS[activeNotification.sellExchange]}
                        alt=""
                        className="w-3 h-3 md:w-3.5 md:h-3.5 rounded-sm"
                      />
                    )}
                    <span className="truncate max-w-[50px] md:max-w-none">
                      {activeNotification.sellExchange}
                    </span>
                  </span>
                </div>
              </div>
              <button
                onClick={() => setActiveNotification(null)}
                className="p-1.5 md:p-2 hover:bg-white/5 rounded-full transition-colors text-neutral-500 hover:text-white shrink-0"
              >
                <svg
                  className="w-4 h-4 md:w-5 md:h-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>
            <div className="h-1 bg-neutral-800 w-full overflow-hidden">
              <div className="h-full bg-emerald-500 animate-shrink-width duration-5000 ease-linear" />
            </div>
          </div>
        </div>
      )}

      {/* Control Area */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between mb-6 md:mb-8 pb-6 border-b border-white/5 gap-6 md:gap-4">
        <div>
          <h2 className="text-xl font-black text-white tracking-tight">
            Look twice, Leap once
          </h2>
          <p className="text-neutral-500 text-[11px] font-medium uppercase tracking-wider">
            Monitoring Binance, KuCoin, and Bybit
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3 md:gap-4">
          <div className="flex items-center space-x-2 bg-white/5 backdrop-blur-md px-3 md:px-4 py-1.5 md:py-2 rounded-full border border-white/10">
            <label
              htmlFor="threshold"
              className="text-[9px] md:text-xs font-black text-neutral-400 uppercase tracking-widest"
            >
              Alert:
            </label>
            <input
              id="threshold"
              type="number"
              step="0.1"
              min="0.1"
              value={notificationThreshold}
              onChange={(e) =>
                setNotificationThreshold(parseFloat(e.target.value) || 0)
              }
              className="w-12 md:w-16 bg-transparent border-none focus:ring-0 text-sm font-black text-emerald-400 p-0 text-center"
            />
            <span className="text-[10px] font-bold text-emerald-500/50">%</span>
          </div>

          <button
            onClick={() => {
              const testOpp: Opportunity = {
                pair: "BTC/USDT",
                gapPercent: 1.5,
                buyExchange: "Binance",
                lowPrice: 65000,
                sellExchange: "KuCoin",
                highPrice: 66000,
                volumeDiff: 150000,
              };
              triggerNotification(testOpp);
            }}
            className="px-3 md:px-4 py-1.5 md:py-2 bg-white/5 hover:bg-emerald-500/10 hover:text-emerald-400 border border-white/10 text-white text-[10px] md:text-xs font-black rounded-full transition-all uppercase tracking-widest"
          >
            Test
          </button>

          <div className="flex items-center space-x-2 bg-white/5 backdrop-blur-md px-3 md:px-4 py-1.5 md:py-2 rounded-full border border-white/10">
            <span className="relative flex h-2.5 w-2.5">
              <span
                className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${isLoading ? "bg-yellow-500" : error ? "bg-red-500" : "bg-emerald-400"}`}
              ></span>
              <span
                className={`relative inline-flex rounded-full h-2.5 w-2.5 ${isLoading ? "bg-yellow-500" : error ? "bg-red-500" : "bg-emerald-400"}`}
              ></span>
            </span>
            <span className="text-[10px] md:text-sm font-black text-neutral-300 uppercase tracking-tighter">
              {isLoading ? "Scan" : error ? "Err" : "Live"}
            </span>
          </div>
        </div>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard label="Total Opps" value={data?.length || 0} />
        <StatCard
          label="Best Gap"
          value={
            Array.isArray(data) && data.length > 0
              ? `${Math.max(...data.map((o) => o.gapPercent)).toFixed(2)}%`
              : "0.00%"
          }
          textClass="text-emerald-400"
        />
        <StatCard label="Exchanges Scanned" value="3" />
        <StatCard
          label="Network Status"
          value={isValidating ? "Syncing..." : "Optimal"}
        />
      </div>

      {/* Data Table Container */}
      <div className="bg-[#0f0f13] border border-white/5 rounded-2xl shadow-2xl overflow-hidden backdrop-blur-xl relative">
        <div className="hidden md:grid grid-cols-6 lg:grid-cols-8 gap-4 px-6 py-4 border-b border-white/5 text-xs font-semibold text-neutral-400 uppercase tracking-wider bg-white/[0.02]">
          <div className="col-span-2">Pair</div>
          <div className="col-span-1 text-right relative">
            <button
              onClick={() => {
                setSortOrder((prev) =>
                  prev === "none" ? "desc" : prev === "desc" ? "asc" : "none",
                );
              }}
              className="hover:text-white transition-colors flex items-center justify-end w-full space-x-1 group"
            >
              <span>Gap %</span>
              <span className="flex flex-col -space-y-1 opacity-50 group-hover:opacity-100 transition-opacity">
                <svg
                  viewBox="0 0 24 24"
                  className={`w-3 h-3 ${sortOrder === "asc" ? "text-emerald-400" : "text-neutral-600"}`}
                  fill="currentColor"
                >
                  <path d="M7 14l5-5 5 5z" />
                </svg>
                <svg
                  viewBox="0 0 24 24"
                  className={`w-3 h-3 ${sortOrder === "desc" ? "text-emerald-400" : "text-neutral-600"}`}
                  fill="currentColor"
                >
                  <path d="M7 10l5 5 5-5z" />
                </svg>
              </span>
            </button>
          </div>
          <div className="col-span-2 lg:col-span-2 pl-4">Buy At</div>
          <div className="col-span-1 lg:col-span-3 pl-4 hidden md:block">
            Sell At
          </div>
        </div>

        <div className="divide-y divide-white/5">
          {isLoading && (!data || !Array.isArray(data)) && (
            <div className="flex items-center justify-center py-24">
              <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-emerald-500"></div>
            </div>
          )}

          {error && (
            <div className="py-24 text-center text-red-500 bg-red-500/5">
              <p className="font-medium">Failed to fetch arbitrage data.</p>
            </div>
          )}

          {!isLoading && !error && Array.isArray(data) && data.length === 0 && (
            <div className="py-24 text-center text-neutral-500">
              <p>No arbitrage opportunities found.</p>
            </div>
          )}

          {processedData.map((opp, idx) => {
            const oppKey = `${opp.pair}-${opp.buyExchange}-${opp.sellExchange}`;
            const isPinned = pinnedOpps.some(
              (p) => `${p.pair}-${p.buyExchange}-${p.sellExchange}` === oppKey,
            );

            return (
              <div
                key={`${oppKey}-${idx}`}
                className={`flex flex-col md:grid md:grid-cols-6 lg:grid-cols-8 gap-4 px-6 py-5 md:py-4 items-center hover:bg-white/[0.04] transition-all duration-300 border-l-2 ${isPinned ? "bg-white/[0.03] border-emerald-500" : "border-transparent"} group relative`}
              >
                {/* Mobile Top Row: Pair & Gap */}
                <div className="flex items-center justify-between w-full md:w-auto md:col-span-2 gap-4">
                  <div className="flex items-center space-x-3">
                    <button
                      onClick={() => {
                        setPinnedOpps((prev) =>
                          isPinned
                            ? prev.filter(
                                (p) =>
                                  `${p.pair}-${p.buyExchange}-${p.sellExchange}` !==
                                  oppKey,
                              )
                            : [...prev, opp],
                        );
                      }}
                      className={`transition-all duration-300 shrink-0 ${isPinned ? "text-yellow-400 scale-110" : "text-neutral-600 hover:text-neutral-400 md:opacity-0 group-hover:opacity-100"}`}
                    >
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        viewBox="0 0 24 24"
                        fill={isPinned ? "currentColor" : "none"}
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        className="w-4 h-4"
                      >
                        <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                      </svg>
                    </button>
                    <CoinIcon
                      symbol={opp.pair}
                      className="w-9 h-9 md:w-9 md:h-9 rounded-full shrink-0"
                    />
                    <div className="min-w-0">
                      <div className="font-black text-neutral-100 text-base md:text-lg tracking-tight truncate">
                        {opp.pair}
                      </div>
                      <div className="text-[9px] text-neutral-500 font-black uppercase tracking-widest px-1.5 py-0.5 rounded bg-white/5 w-fit border border-white/5">
                        Spot
                      </div>
                    </div>
                  </div>

                  {/* Mobile-only Gap Badge */}
                  <div className="flex flex-col items-end md:hidden">
                    <span
                      className={`inline-block px-2.5 py-1.5 rounded-lg text-xs font-black border ${
                        opp.gapPercent > 3
                          ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20 shadow-[0_0_20px_rgba(16,185,129,0.15)]"
                          : opp.gapPercent > 1.5
                            ? "bg-green-500/10 text-green-400 border-green-500/20"
                            : "bg-yellow-500/10 text-yellow-400 border-yellow-500/20"
                      }`}
                    >
                      {opp.gapPercent.toFixed(2)}%
                    </span>
                  </div>
                </div>

                {/* Desktop Gap Column */}
                <div className="hidden md:block col-span-1 text-center">
                  <span
                    className={`inline-block px-3 py-1 rounded-md text-sm font-black border transition-all duration-300 ${
                      opp.gapPercent > 3
                        ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20 shadow-[0_0_15px_rgba(16,185,129,0.15)] scale-105"
                        : opp.gapPercent > 1.5
                          ? "bg-green-500/10 text-green-400 border-green-500/20"
                          : "bg-yellow-500/10 text-yellow-400 border-yellow-500/20"
                    }`}
                  >
                    {opp.gapPercent.toFixed(2)}%
                  </span>
                </div>

                {/* Trading Segment Grid */}
                <div className="grid grid-cols-2 md:contents w-full gap-4 pt-4 md:pt-0 border-t border-white/5 md:border-none">
                  {/* Buy Section */}
                  <div className="md:col-span-2 lg:col-span-2 md:pl-4">
                    <div className="text-[10px] text-neutral-500 font-black uppercase tracking-tighter mb-1.5 md:hidden">
                      Buy At
                    </div>
                    <div className="flex items-center gap-2 text-sm font-black text-neutral-200">
                      {EXCHANGE_LOGOS[opp.buyExchange] && (
                        <img
                          src={EXCHANGE_LOGOS[opp.buyExchange]}
                          alt={opp.buyExchange}
                          className="w-5 h-5 rounded-md shadow-sm opacity-90 shrink-0"
                        />
                      )}
                      <span className="truncate">{opp.buyExchange}</span>
                    </div>
                    <div className="text-xs text-emerald-400 font-mono mt-1.5 bg-emerald-400/5 w-fit px-2 py-0.5 rounded border border-emerald-500/10 font-bold">
                      $
                      {opp.lowPrice < 1
                        ? opp.lowPrice.toFixed(6)
                        : opp.lowPrice.toLocaleString(undefined, {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 4,
                          })}
                    </div>
                  </div>

                  {/* Sell Section */}
                  <div className="md:col-span-1 lg:col-span-3 md:pl-4">
                    <div className="text-[10px] text-neutral-500 font-black uppercase tracking-tighter mb-1.5 md:hidden">
                      Sell At
                    </div>
                    <div className="flex items-center gap-2 text-sm font-black text-neutral-200">
                      {EXCHANGE_LOGOS[opp.sellExchange] && (
                        <img
                          src={EXCHANGE_LOGOS[opp.sellExchange]}
                          alt={opp.sellExchange}
                          className="w-5 h-5 rounded-md shadow-sm opacity-90 shrink-0"
                        />
                      )}
                      <span className="truncate">{opp.sellExchange}</span>
                    </div>
                    <div className="text-xs text-blue-400 font-mono mt-1.5 bg-blue-400/5 w-fit px-2 py-0.5 rounded border border-blue-400/10 font-bold">
                      $
                      {opp.highPrice < 1
                        ? opp.highPrice.toFixed(6)
                        : opp.highPrice.toLocaleString(undefined, {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 4,
                          })}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
}
