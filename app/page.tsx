"use client";

import { useState, useSyncExternalStore } from "react";
import { ArbitrageScanner } from "@/components/ArbitrageScanner";
import { InternalScanner } from "@/components/InternalScanner";

export default function Dashboard() {
  const [viewMode, setViewMode] = useState<"external" | "internal">("external");

  const isClient = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );

  if (!isClient) return null;

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100 selection:bg-emerald-500/30">
      {/* Glow Effect Background */}
      <div className="fixed top-0 inset-x-0 h-96 bg-linear-to-b from-emerald-500/10 to-transparent pointer-events-none" />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 relative z-10">
        {/* Main Header */}
        <div className="flex flex-col md:flex-row items-center justify-between mb-8 md:mb-12 gap-6 md:gap-8">
          <div className="text-center md:text-left">
            <h1 className="text-3xl md:text-4xl font-black tracking-tight bg-clip-text text-transparent bg-linear-to-r from-white via-white to-neutral-500">
              Zohiab Yousaf&apos;s Logic
            </h1>
            <p className="text-neutral-500 mt-1 text-[10px] md:text-sm font-medium tracking-widest uppercase">
              Multi Exchange
            </p>
          </div>

          {/* Toggle Switch */}
          <div className="flex p-1 bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl relative group w-full md:w-auto max-w-sm mx-auto md:mx-0">
            {/* Slider background for active state */}
            <div
              className={`absolute top-1 bottom-1 w-[calc(50%-4px)] bg-emerald-500/80 rounded-xl transition-all duration-500 ease-out shadow-[0_0_20px_rgba(16,185,129,0.3)] ${viewMode === "internal" ? "translate-x-full" : "translate-x-0"}`}
            />

            <button
              onClick={() => setViewMode("external")}
              className={`flex-1 relative z-10 px-3 md:px-6 py-2 md:py-2.5 rounded-xl text-[11px] md:text-sm font-bold transition-colors duration-300 flex items-center justify-center gap-1.5 md:gap-2 ${viewMode === "external" ? "text-white" : "text-neutral-400 hover:text-neutral-200"}`}
            >
              <svg
                className="w-3.5 h-3.5 md:w-4 md:h-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4"
                />
              </svg>
              <span className="truncate">External Arb</span>
            </button>

            <button
              onClick={() => setViewMode("internal")}
              className={`flex-1 relative z-10 px-3 md:px-6 py-2 md:py-2.5 rounded-xl text-[11px] md:text-sm font-bold transition-colors duration-300 flex items-center justify-center gap-1.5 md:gap-2 ${viewMode === "internal" ? "text-white" : "text-neutral-400 hover:text-neutral-200"}`}
            >
              <svg
                className="w-3.5 h-3.5 md:w-4 md:h-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M13 10V3L4 14h7v7l9-11h-7z"
                />
              </svg>
              <span className="truncate">KuCoin Internal</span>
            </button>
          </div>
        </div>

        {/* Dynamic Content - Persistent for background fetching */}
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-700 ease-out">
          <div className={viewMode === "external" ? "block" : "hidden"}>
            <ArbitrageScanner />
          </div>
          <div className={viewMode === "internal" ? "block" : "hidden"}>
            <InternalScanner />
          </div>
        </div>
      </main>
    </div>
  );
}
