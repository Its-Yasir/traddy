import { NextResponse } from "next/server";
import ccxt from "ccxt";
import type { Market, Ticker } from "ccxt";

// Opt out of caching for this API route so it fetches fresh data on every poll.
export const dynamic = "force-dynamic";
export const revalidate = 0;

interface ExchangeMarketData {
  name: string;
  markets: Record<string, Market>;
  tickers: Record<string, Ticker>;
}

export async function GET() {
  try {
    // Initialize the three exchanges as the Python script
    const binance = new ccxt.binance({ enableRateLimit: true });
    const kucoin = new ccxt.kucoin({ enableRateLimit: true });
    const bybit = new ccxt.bybit({
      enableRateLimit: true,
      options: { defaultType: "spot" },
    });

    const exchanges = [
      { name: "Binance", instance: binance },
      { name: "KuCoin", instance: kucoin },
      { name: "Bybit", instance: bybit },
    ];

    // Fetch tickers and load markets to get active status
    const marketData: ExchangeMarketData[] = await Promise.all(
      exchanges.map(async (ex): Promise<ExchangeMarketData> => {
        try {
          // Set a timeout for individual exchange fetches

          const markets = (await Promise.race([
            ex.instance.loadMarkets(),
            new Promise((_, reject) =>
              setTimeout(() => reject(new Error(`${ex.name} timeout`)), 10000),
            ),
          ])) as Record<string, Market>;
          const tickers = await ex.instance.fetchTickers();
          return { name: ex.name, markets, tickers };
        } catch (err) {
          console.error(`Error fetching from ${ex.name}:`, err);
          return { name: ex.name, markets: {}, tickers: {} };
        }
      }),
    );

    const badStatuses = [
      "DELISTED",
      "BREAK",
      "MAINTENANCE",
      "SETTLEMENT",
      "SUSPENDED",
      "CLOSE",
    ];

    const safeData: Record<
      string,
      Record<string, { price: number; volume: number }>
    > = {};
    // Initialize safeData with empty objects for all exchanges to prevent TypeErrors later
    for (const ex of exchanges) {
      safeData[ex.name] = {};
    }

    for (const ex of marketData) {
      if (!ex.tickers || Object.keys(ex.tickers).length === 0) continue;

      for (const symbol in ex.tickers) {
        const t = ex.tickers[symbol];
        const cleanSymbol = symbol.split(":")[0];
        const marketInfo = ex.markets[symbol];

        if (
          marketInfo &&
          cleanSymbol.endsWith("/USDT") &&
          t.last !== undefined &&
          t.last !== null &&
          t.last > 0
        ) {
          const isActive = marketInfo.active;
          const rawInfo = marketInfo.info || {};
          const status = String(
            rawInfo.status || rawInfo.state || "",
          ).toUpperCase();

          const hasBadStatus = badStatuses.some((word) =>
            status.includes(word),
          );

          if (isActive && !hasBadStatus) {
            safeData[ex.name][cleanSymbol] = {
              price: t.last,
              volume: t.quoteVolume || 0,
            };
          }
        }
      }
    }

    const opportunities = [];
    const exNames = exchanges.map((ex) => ex.name);

    for (let i = 0; i < exNames.length; i++) {
      for (let j = i + 1; j < exNames.length; j++) {
        const ex1 = exNames[i];
        const ex2 = exNames[j];

        // Access with defaults just in case
        const ex1Data = safeData[ex1] || {};
        const ex2Data = safeData[ex2] || {};

        const ex1Symbols = Object.keys(ex1Data);
        const ex2Symbols = Object.keys(ex2Data);

        const commonSymbols = ex1Symbols.filter((sym) =>
          ex2Symbols.includes(sym),
        );

        for (const sym of commonSymbols) {
          const d1 = ex1Data[sym];
          const d2 = ex2Data[sym];

          const p1 = d1.price;
          const p2 = d2.price;
          const v1 = d1.volume;
          const v2 = d2.volume;

          if (p1 > 0 && p2 > 0) {
            const diff = Math.abs(p1 - p2);
            const minP = Math.min(p1, p2);
            const gapPercent = (diff / minP) * 100;

            // Calculate volume difference (as "market cap difference" per user terminology)
            const volumeDiff = Math.abs(v1 - v2);

            if (
              gapPercent >= 0.7 &&
              gapPercent <= 20.0 &&
              volumeDiff > 100000
            ) {
              const buyEx = p1 < p2 ? ex1 : ex2;
              const sellEx = p1 < p2 ? ex2 : ex1;
              const lowP = p1 < p2 ? p1 : p2;
              const highP = p1 < p2 ? p2 : p1;

              opportunities.push({
                pair: sym,
                gapPercent: gapPercent,
                buyExchange: buyEx,
                lowPrice: lowP,
                sellExchange: sellEx,
                highPrice: highP,
                volumeDiff: volumeDiff,
              });
            } else if (gapPercent > 10.0) {
              // Log extreme gaps to help identify bad data or unit mismatches (e.g., SAT vs BTC)
              console.warn(
                `[Arbitrage] Extreme gap detected for ${sym}: ${gapPercent.toFixed(2)}% (Prices: ${p1} on ${ex1}, ${p2} on ${ex2})`,
              );
            }
          }
        }
      }
    }

    // Sort opportunities by highest gap percentage first, and take top 20
    opportunities.sort((a, b) => b.gapPercent - a.gapPercent);
    const topOpportunities = opportunities.slice(0, 20);

    return NextResponse.json(topOpportunities);
  } catch (error) {
    console.error("Arbitrage fetch error:", error);
    return NextResponse.json(
      { error: "Internal server error while fetching market data" },
      { status: 500 },
    );
  }
}
