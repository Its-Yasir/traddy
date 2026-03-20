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

interface Opportunity {
  pair: string;
  gapPercent: number;
  buyExchange: string;
  lowPrice: number;
  sellExchange: string;
  highPrice: number;
  volumeDiff?: number;
}

const EXCHANGE_LOGOS: Record<string, string> = {
  Binance: "https://www.google.com/s2/favicons?domain=binance.com&sz=64",
  KuCoin: "https://www.google.com/s2/favicons?domain=kucoin.com&sz=64",
  Bybit: "https://www.google.com/s2/favicons?domain=bybit.com&sz=64",
};

function CoinIcon({
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

const fetcher = (url: string) =>
  fetch(url).then((res) => {
    if (!res.ok) {
      throw new Error(`API error: ${res.status}`);
    }
    return res.json();
  });

export default function Dashboard() {
  const [notificationPermission, setNotificationPermission] =
    useState<string>("default");
  const [activeNotification, setActiveNotification] =
    useState<Opportunity | null>(null);
  const [sortOrder, setSortOrder] = useState<"asc" | "desc" | "none">("none");
  const [pinnedPairs, setPinnedPairs] = useState<string[]>(() => {
    if (typeof window !== "undefined") {
      const saved = safeStorage.getItem("pinnedArbPairs");
      if (saved) {
        try {
          return JSON.parse(saved);
        } catch (e) {
          console.error("Failed to parse pinned pairs", e);
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

  // Use useSyncExternalStore to safely check if we are on the client
  // without triggering a synchronous state update in an effect.
  const isClient = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );

  // Track pairs we've already notified about to avoid spamming
  const notifiedPairs = useRef<Set<string>>(new Set());

  // Use SWR to poll every 3 seconds, but only if authenticated
  const { data, error, isLoading, isValidating } = useSWR<Opportunity[]>(
    typeof window !== "undefined" && safeStorage.getItem("traddy_password")
      ? "/api/arbitrage"
      : null,
    fetcher,
    {
      refreshInterval: 3000,
      revalidateOnFocus: true,
    },
  );

  // Request Notification Permission on mount
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

  // Play notification sound and manage title
  const triggerNotification = useCallback(
    (opp: Opportunity) => {
      // 1. Show Visual Notification
      setActiveNotification(opp);

      // 2. Play Sound
      try {
        const audio = new Audio("/mixkit-positive-notification-951.wav");
        audio.play().catch((e) => console.log("Audio play blocked:", e));
      } catch (e) {
        console.warn("Audio initialization failed:", e);
      }

      // 3. Update Title
      if (typeof document !== "undefined") {
        document.title = "NEW NOTIFICATION 🚀";
      }

      // 4. Trigger Native Notification
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

      // 5. Reset after 5 seconds
      setTimeout(() => {
        setActiveNotification(null);
        document.title = "Traddy Scanner";
      }, 5000);
    },
    [notificationPermission],
  );

  // Save configurations to safeStorage
  useEffect(() => {
    if (isClient) {
      safeStorage.setItem("pinnedArbPairs", JSON.stringify(pinnedPairs));
      safeStorage.setItem(
        "arbNotificationThreshold",
        notificationThreshold.toString(),
      );
    }
  }, [pinnedPairs, notificationThreshold, isClient]);

  // Process data for sorting and pinning
  const processedData = useMemo(() => {
    if (!data || !Array.isArray(data)) return [];

    const result = [...data];

    // Mark items with their pinning status for easier sorting
    const pinnedSet = new Set(pinnedPairs);

    result.sort((a, b) => {
      const aKey = `${a.pair}-${a.buyExchange}-${a.sellExchange}`;
      const bKey = `${b.pair}-${b.buyExchange}-${b.sellExchange}`;
      const aPinned = pinnedSet.has(aKey);
      const bPinned = pinnedSet.has(bKey);

      // 1. Pinned items always go first
      if (aPinned && !bPinned) return -1;
      if (!aPinned && bPinned) return 1;

      // 2. Sort by Gap % within their groups (pinned vs unpinned)
      if (sortOrder !== "none") {
        return sortOrder === "asc"
          ? a.gapPercent - b.gapPercent
          : b.gapPercent - a.gapPercent;
      }

      return 0; // Maintain original order if no sort
    });

    return result;
  }, [data, pinnedPairs, sortOrder]);

  // Handle Notifications when data updates
  useEffect(() => {
    if (!data || !Array.isArray(data)) return;

    if (notificationPermission !== "granted") return;

    data.forEach((opp) => {
      const oppKey = `${opp.pair}-${opp.buyExchange}-${opp.sellExchange}`;

      // Notify for any pair that meets the user's threshold
      if (opp.gapPercent >= notificationThreshold) {
        // Only notify if we haven't already notified about this exact pair recently
        if (!notifiedPairs.current.has(oppKey)) {
          console.log(
            `Triggering notification for ${oppKey}: ${opp.gapPercent}% (Threshold: ${notificationThreshold}%)`,
          );
          notifiedPairs.current.add(oppKey);
          triggerNotification(opp);
        }
      }
    });

    // Cleanup old pairs that no longer meet notifications criteria so we can notify again later if they return
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

  if (!isClient) {
    return null; // or a very basic skeleton
  }

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100 selection:bg-neutral-800">
      {/* Glow Effect Background */}
      <div className="absolute top-0 inset-x-0 h-96 bg-linear-to-b from-crypto-accent/10 to-transparent pointer-events-none" />

      {/* Visual Notification Overlay */}
      {activeNotification && (
        <div className="fixed top-6 left-1/2 -translate-x-1/2 z-50 w-full max-w-lg px-4 animate-in fade-in slide-in-from-top-4 duration-300">
          <div className="bg-[#1a1a24]/90 backdrop-blur-xl border border-crypto-accent/30 rounded-2xl shadow-[0_0_30px_rgba(16,185,129,0.2)] overflow-hidden">
            <div className="flex items-center p-5 gap-4">
              <div className="w-12 h-12 rounded-xl bg-crypto-accent/10 flex items-center justify-center">
                <CoinIcon
                  symbol={activeNotification.pair}
                  className="w-10 h-10 rounded-lg"
                />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-1">
                  <h3 className="text-white font-bold text-lg truncate flex items-center gap-2">
                    {activeNotification.pair} Optimization
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-crypto-accent/20 text-crypto-accent uppercase tracking-wider">
                      Live
                    </span>
                  </h3>
                  <span className="text-crypto-accent font-black text-xl tabular-nums">
                    +{activeNotification.gapPercent.toFixed(2)}%
                  </span>
                </div>
                <div className="flex items-center gap-2 text-neutral-400 text-sm font-medium">
                  <span className="flex items-center gap-1.5 text-white bg-white/5 px-2 py-1 rounded text-xs border border-white/5">
                    {EXCHANGE_LOGOS[activeNotification.buyExchange] && (
                      <img
                        src={EXCHANGE_LOGOS[activeNotification.buyExchange]}
                        alt=""
                        className="w-3.5 h-3.5 rounded-sm"
                      />
                    )}
                    {activeNotification.buyExchange}
                  </span>
                  <svg
                    className="w-3 h-3 text-neutral-600"
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
                  <span className="flex items-center gap-1.5 text-white bg-white/5 px-2 py-1 rounded text-xs border border-white/5">
                    {EXCHANGE_LOGOS[activeNotification.sellExchange] && (
                      <img
                        src={EXCHANGE_LOGOS[activeNotification.sellExchange]}
                        alt=""
                        className="w-3.5 h-3.5 rounded-sm"
                      />
                    )}
                    {activeNotification.sellExchange}
                  </span>
                </div>
              </div>
              <button
                onClick={() => setActiveNotification(null)}
                className="p-2 hover:bg-white/5 rounded-full transition-colors text-neutral-500 hover:text-white"
              >
                <svg
                  className="w-5 h-5"
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
              <div className="h-full bg-crypto-accent animate-shrink-width duration-5000 ease-linear" />
            </div>
          </div>
        </div>
      )}

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 relative z-10">
        {/* Header Section */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-8 pb-6 border-b border-white/5 gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight bg-clip-text text-transparent bg-linear-to-r from-white to-neutral-400">
              Traddy Scanner
            </h1>
            <p className="text-neutral-500 mt-1 text-sm font-medium">
              By Zohaib Yousaf
            </p>
          </div>

          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2 bg-white/5 backdrop-blur-md px-4 py-2 rounded-full border border-white/10">
              <label
                htmlFor="threshold"
                className="text-xs font-semibold text-neutral-400 uppercase tracking-tighter"
              >
                GAP % Alert:
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
                className="w-16 bg-transparent border-none focus:ring-0 text-sm font-bold text-crypto-accent p-0"
              />
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
              className="px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 text-white text-xs font-semibold rounded-full transition-all"
            >
              Test Alert
            </button>

            <div className="flex items-center space-x-2 bg-white/5 backdrop-blur-md px-4 py-2 rounded-full border border-white/10">
              <span className="relative flex h-3 w-3">
                <span
                  className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${isLoading ? "bg-yellow-500" : error ? "bg-red-500" : "bg-crypto-accent"}`}
                ></span>
                <span
                  className={`relative inline-flex rounded-full h-3 w-3 ${isLoading ? "bg-yellow-500" : error ? "bg-red-500" : "bg-crypto-accent"}`}
                ></span>
              </span>
              <span className="text-sm font-medium text-neutral-300">
                {isLoading
                  ? "Fetching Market Data..."
                  : error
                    ? "Connection Error"
                    : "Live Polling (3s)"}
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
            textClass="text-crypto-accent"
          />
          <StatCard label="Exchanges Scanned" value="3" />
          <StatCard
            label="Network Status"
            value={isValidating ? "Syncing..." : "Optimal"}
          />
        </div>

        {/* Data Table Container */}
        <div className="bg-[#0f0f13] border border-white/5 rounded-2xl shadow-2xl overflow-hidden backdrop-blur-xl relative">
          {/* Table Header */}
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
                    className={`w-3 h-3 ${sortOrder === "asc" ? "text-crypto-accent" : "text-neutral-600"}`}
                    fill="currentColor"
                  >
                    <path d="M7 14l5-5 5 5z" />
                  </svg>
                  <svg
                    viewBox="0 0 24 24"
                    className={`w-3 h-3 ${sortOrder === "desc" ? "text-crypto-accent" : "text-neutral-600"}`}
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

          {/* Table Body */}
          <div className="divide-y divide-white/5">
            {isLoading && (!data || !Array.isArray(data)) && (
              <div className="flex items-center justify-center py-24">
                <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-crypto-accent"></div>
              </div>
            )}

            {error && (
              <div className="py-24 text-center text-red-500 bg-red-500/5">
                <p className="font-medium">Failed to fetch arbitrage data.</p>
                <p className="text-sm opacity-80 mt-1">
                  Please try again later.
                </p>
              </div>
            )}

            {!isLoading &&
              !error &&
              Array.isArray(data) &&
              data.length === 0 && (
                <div className="py-24 text-center text-neutral-500">
                  <p>No arbitrage opportunities found.</p>
                </div>
              )}

            {processedData.map((opp, idx) => {
              const oppKey = `${opp.pair}-${opp.buyExchange}-${opp.sellExchange}`;
              const isPinned = pinnedPairs.includes(oppKey);

              return (
                <div
                  key={`${oppKey}-${idx}`}
                  className={`flex flex-col md:grid md:grid-cols-6 lg:grid-cols-8 gap-4 px-6 py-4 items-center hover:bg-white/[0.04] transition-all duration-300 border-l-2 ${isPinned ? "bg-white/[0.03] border-crypto-accent" : "border-transparent"} group`}
                >
                  {/* Mobile Mobile Layout: Top Row */}
                  <div className="flex items-center justify-between w-full md:w-auto md:col-span-2 gap-4">
                    <div className="flex items-center space-x-3">
                      <button
                        onClick={() => {
                          setPinnedPairs((prev) =>
                            isPinned
                              ? prev.filter((p) => p !== oppKey)
                              : [...prev, oppKey],
                          );
                        }}
                        className={`transition-all duration-300 ${isPinned ? "text-yellow-400 scale-110" : "text-neutral-600 hover:text-neutral-400 md:opacity-0 group-hover:opacity-100"}`}
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
                        className="w-8 h-8 md:w-9 md:h-9 rounded-full"
                      />
                      <div>
                        <div className="font-bold text-neutral-100 md:text-lg tracking-tight">
                          {opp.pair}
                        </div>
                        <div className="text-[10px] text-neutral-500 font-bold uppercase tracking-widest px-1.5 py-0.5 rounded bg-white/5 w-fit">
                          Spot
                        </div>
                      </div>
                    </div>

                    {/* Mobile Gap % Display */}
                    <div className="flex flex-col items-end md:hidden">
                      <span
                        className={`inline-block px-3 py-1.5 rounded-lg text-sm font-black border ${
                          opp.gapPercent > 3
                            ? "bg-crypto-accent/10 text-crypto-accent border-crypto-accent/20 animate-pulse-slow shadow-[0_0_20px_rgba(16,185,129,0.15)]"
                            : opp.gapPercent > 1.5
                              ? "bg-green-500/10 text-green-400 border-green-500/20"
                              : "bg-yellow-500/10 text-yellow-400 border-yellow-500/20"
                        }`}
                      >
                        {opp.gapPercent.toFixed(2)}%
                      </span>
                      {opp.volumeDiff && (
                        <span className="text-[9px] text-neutral-500 font-bold mt-1">
                          Vol Diff: ${Math.round(opp.volumeDiff / 1000)}k
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Desktop Gap % Display */}
                  <div className="hidden md:block col-span-1 text-right">
                    <span
                      className={`inline-block px-3 py-1 rounded-md text-sm font-black border transition-all duration-300 ${
                        opp.gapPercent > 3
                          ? "bg-crypto-accent/10 text-crypto-accent border-crypto-accent/20 shadow-[0_0_15px_rgba(16,185,129,0.15)] scale-105"
                          : opp.gapPercent > 1.5
                            ? "bg-green-500/10 text-green-400 border-green-500/20"
                            : "bg-yellow-500/10 text-yellow-400 border-yellow-500/20"
                      }`}
                    >
                      {opp.gapPercent.toFixed(2)}%
                    </span>
                    {opp.volumeDiff && (
                      <div className="text-[9px] text-neutral-500 font-bold mt-1 uppercase tracking-tighter">
                        Diff: ${Math.round(opp.volumeDiff / 1000)}k
                      </div>
                    )}
                  </div>

                  {/* Pricing Details */}
                  <div className="grid grid-cols-2 md:contents w-full gap-4 pt-3 md:pt-0 border-t border-white/5 md:border-none">
                    {/* Buy Details */}
                    <div className="md:col-span-2 lg:col-span-2 md:pl-4">
                      <div className="text-[10px] text-neutral-500 font-bold uppercase tracking-tighter mb-1 md:hidden">
                        Buy At
                      </div>
                      <div className="flex items-center gap-2 text-sm font-bold text-neutral-200">
                        {EXCHANGE_LOGOS[opp.buyExchange] && (
                          <img
                            src={EXCHANGE_LOGOS[opp.buyExchange]}
                            alt=""
                            className="w-5 h-5 rounded-md shadow-sm opacity-90"
                          />
                        )}
                        <span className="truncate">{opp.buyExchange}</span>
                      </div>
                      <div className="text-xs text-crypto-accent/80 font-mono mt-1 bg-crypto-accent/5 w-fit px-1.5 py-0.5 rounded border border-crypto-accent/10">
                        $
                        {opp.lowPrice < 1
                          ? opp.lowPrice.toFixed(6)
                          : opp.lowPrice.toLocaleString(undefined, {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 4,
                            })}
                      </div>
                    </div>

                    {/* Sell Details */}
                    <div className="md:col-span-1 lg:col-span-3 md:pl-4">
                      <div className="text-[10px] text-neutral-500 font-bold uppercase tracking-tighter mb-1 md:hidden">
                        Sell At
                      </div>
                      <div className="flex items-center gap-2 text-sm font-bold text-neutral-200">
                        {EXCHANGE_LOGOS[opp.sellExchange] && (
                          <img
                            src={EXCHANGE_LOGOS[opp.sellExchange]}
                            alt=""
                            className="w-5 h-5 rounded-md shadow-sm opacity-90"
                          />
                        )}
                        <span className="truncate">{opp.sellExchange}</span>
                      </div>
                      <div className="text-xs text-red-400/80 font-mono mt-1 bg-red-400/5 w-fit px-1.5 py-0.5 rounded border border-red-400/10">
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
      </main>
    </div>
  );
}

// Simple Stat Card Component
function StatCard({
  label,
  value,
  textClass = "text-white",
}: {
  label: string;
  value: string | number;
  textClass?: string;
}) {
  return (
    <div className="bg-[#0f0f13] border border-white/5 rounded-xl p-5 backdrop-blur-md relative overflow-hidden group">
      <div className="absolute inset-x-0 bottom-0 h-0.5 bg-linear-to-r from-transparent via-white/10 to-transparent group-hover:via-crypto-accent/30 transition-all duration-500" />
      <div className="text-neutral-500 text-xs font-medium tracking-wide uppercase mb-1">
        {label}
      </div>
      <div className={`text-2xl font-bold tracking-tight ${textClass}`}>
        {value}
      </div>
    </div>
  );
}
