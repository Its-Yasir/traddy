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

interface Opportunity {
  pair: string;
  gapPercent: number;
  buyExchange: string;
  lowPrice: number;
  sellExchange: string;
  highPrice: number;
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
      const saved = localStorage.getItem("pinnedArbPairs");
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
        const saved = localStorage.getItem("arbNotificationThreshold");
        return saved ? parseFloat(saved) : 1.2;
      }
      return 1.2;
    },
  );

  const [notifiablePairs, setNotifiablePairs] = useState<string[]>(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("notifiableArbPairs");
      if (saved) {
        try {
          return JSON.parse(saved);
        } catch (e) {
          console.error("Failed to parse notifiable pairs", e);
          return [];
        }
      }
    }
    return [];
  });

  // Use useSyncExternalStore to safely check if we are on the client
  // without triggering a synchronous state update in an effect.
  const isClient = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );

  // Track pairs we've already notified about to avoid spamming
  const notifiedPairs = useRef<Set<string>>(new Set());

  // Use SWR to poll every 3 seconds
  const { data, error, isLoading, isValidating } = useSWR<Opportunity[]>(
    "/api/arbitrage",
    fetcher,
    {
      refreshInterval: 3000,
      revalidateOnFocus: true,
    },
  );

  // Request Notification Permission on mount
  useEffect(() => {
    if ("Notification" in window) {
      Notification.requestPermission().then((permission) => {
        setNotificationPermission(permission);
      });
    }
  }, []);

  // Play notification sound and manage title
  const triggerNotification = useCallback(
    (opp: Opportunity) => {
      // 1. Show Visual Notification
      setActiveNotification(opp);

      // 2. Play Sound
      const audio = new Audio("/mixkit-positive-notification-951.wav");
      audio.play().catch((e) => console.error("Audio playback failed:", e));

      // 3. Update Title
      document.title = "NEW NOTIFICATION 🚀";

      // 4. Trigger Native Notification
      if (notificationPermission === "granted") {
        new Notification(`${opp.pair}: ${opp.gapPercent.toFixed(2)}% Gap! 🚀`, {
          body: `Buy at: ${opp.buyExchange} | Sell at: ${opp.sellExchange}\nPrice Gap: ${opp.gapPercent.toFixed(2)}%`,
        });
      }

      // 5. Reset after 5 seconds
      setTimeout(() => {
        setActiveNotification(null);
        document.title = "Traddy Scanner";
      }, 5000);
    },
    [notificationPermission],
  );

  // Save configurations to localStorage
  useEffect(() => {
    if (isClient) {
      localStorage.setItem("pinnedArbPairs", JSON.stringify(pinnedPairs));
      localStorage.setItem(
        "arbNotificationThreshold",
        notificationThreshold.toString(),
      );
      localStorage.setItem(
        "notifiableArbPairs",
        JSON.stringify(notifiablePairs),
      );
    }
  }, [pinnedPairs, notificationThreshold, notifiablePairs, isClient]);

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

      // Check if this pair is toggled for notifications and meets the user's threshold
      const isNotifiable = notifiablePairs.includes(oppKey);

      if (isNotifiable && opp.gapPercent >= notificationThreshold) {
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
        .filter((op) => {
          const key = `${op.pair}-${op.buyExchange}-${op.sellExchange}`;
          return (
            notifiablePairs.includes(key) &&
            op.gapPercent >= notificationThreshold
          );
        })
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
    notifiablePairs,
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
              <div className="w-12 h-12 rounded-xl bg-crypto-accent/20 flex items-center justify-center animate-pulse">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="w-6 h-6 text-crypto-accent"
                >
                  <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
                  <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
                </svg>
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
                  <span className="text-white bg-white/5 px-2 py-0.5 rounded text-xs border border-white/5">
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
                  <span className="text-white bg-white/5 px-2 py-0.5 rounded text-xs border border-white/5">
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
              Real-time Spot Arbitrage Dashboard
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
          <div className="grid grid-cols-6 lg:grid-cols-8 gap-4 px-6 py-4 border-b border-white/5 text-xs font-semibold text-neutral-400 uppercase tracking-wider bg-white/2">
            <div className="col-span-2">Pair</div>
            <div className="col-span-1 text-right relative">
              <button
                onClick={() => {
                  setSortOrder((prev) =>
                    prev === "none" ? "desc" : prev === "desc" ? "asc" : "none",
                  );
                }}
                className="hover:text-white transition-colors flex items-center justify-end w-full space-x-1"
              >
                <span>Gap %</span>
                <span className="flex flex-col -space-y-1">
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
            <div className="col-span-1 lg:col-span-2 pl-4 hidden md:block">
              Sell At
            </div>
            <div className="col-span-1 text-right hidden lg:block">Action</div>
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
                  className={`grid grid-cols-6 lg:grid-cols-8 gap-4 px-6 py-4 items-center hover:bg-white/2 transition-colors group ${isPinned ? "bg-white/3 border-l-2 border-crypto-accent" : ""}`}
                >
                  {/* Pair Name */}
                  <div className="col-span-2 flex items-center space-x-3">
                    <button
                      onClick={() => {
                        setPinnedPairs((prev) =>
                          isPinned
                            ? prev.filter((p) => p !== oppKey)
                            : [...prev, oppKey],
                        );
                      }}
                      className={`transition-all duration-300 ${isPinned ? "text-yellow-400 scale-110" : "text-neutral-600 hover:text-neutral-400 opacity-0 group-hover:opacity-100"}`}
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
                    <div className="w-8 h-8 rounded-full bg-linear-to-tr from-neutral-800 to-neutral-700 flex items-center justify-center font-bold text-xs text-white shadow-inner">
                      {opp.pair.split("/")[0].substring(0, 3)}
                    </div>
                    <div>
                      <div className="font-semibold text-neutral-200">
                        {opp.pair}
                      </div>
                      <div className="text-xs text-neutral-500 font-mono">
                        Spot
                      </div>
                    </div>
                  </div>

                  {/* Gap Percent */}
                  <div className="col-span-1 text-right">
                    <span
                      className={`inline-block px-2.5 py-1 rounded-md text-sm font-bold backdrop-blur-sm ${
                        opp.gapPercent > 3
                          ? "bg-crypto-accent/10 text-crypto-accent shadow-[0_0_10px_rgba(16,185,129,0.2)]"
                          : opp.gapPercent > 1.5
                            ? "bg-green-500/10 text-green-400"
                            : "bg-yellow-500/10 text-yellow-400"
                      }`}
                    >
                      {opp.gapPercent.toFixed(2)}%
                    </span>
                  </div>

                  {/* Buy Details */}
                  <div className="col-span-2 lg:col-span-2 pl-4">
                    <div className="text-sm font-medium text-neutral-300">
                      {opp.buyExchange}
                    </div>
                    <div className="text-xs text-neutral-500 font-mono mt-0.5">
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
                  <div className="col-span-1 lg:col-span-2 pl-4 hidden md:block">
                    <div className="text-sm font-medium text-neutral-300">
                      {opp.sellExchange}
                    </div>
                    <div className="text-xs text-neutral-500 font-mono mt-0.5">
                      $
                      {opp.highPrice < 1
                        ? opp.highPrice.toFixed(6)
                        : opp.highPrice.toLocaleString(undefined, {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 4,
                          })}
                    </div>
                  </div>

                  {/* Action */}
                  <div className="col-span-1 text-right flex items-center justify-end space-x-2">
                    <button
                      onClick={() => {
                        setNotifiablePairs((prev) =>
                          notifiablePairs.includes(oppKey)
                            ? prev.filter((p) => p !== oppKey)
                            : [...prev, oppKey],
                        );
                      }}
                      className={`p-2 rounded-lg transition-all duration-300 ${
                        notifiablePairs.includes(oppKey)
                          ? "text-crypto-accent bg-crypto-accent/10 shadow-[0_0_10px_rgba(16,185,129,0.2)]"
                          : "text-neutral-600 hover:text-neutral-400 bg-white/5 hover:bg-white/10 opacity-0 group-hover:opacity-100"
                      }`}
                    >
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        viewBox="0 0 24 24"
                        fill={
                          notifiablePairs.includes(oppKey)
                            ? "currentColor"
                            : "none"
                        }
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        className="w-4 h-4"
                      >
                        <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
                        <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
                      </svg>
                    </button>
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
