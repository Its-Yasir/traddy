import { NextResponse } from "next/server";
import ccxt from "ccxt";

// Opt out of caching for this API route so it fetches fresh data on every poll.
export const dynamic = "force-dynamic";
export const revalidate = 0;

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
    const marketData = await Promise.all(
      exchanges.map(async (ex) => {
        const markets = await ex.instance.loadMarkets();
        const tickers = await ex.instance.fetchTickers();
        return { name: ex.name, markets, tickers };
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

    const safeData: Record<string, Record<string, number>> = {};

    for (const ex of marketData) {
      safeData[ex.name] = {};
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
            safeData[ex.name][cleanSymbol] = t.last;
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

        const ex1Symbols = Object.keys(safeData[ex1]);
        const ex2Symbols = Object.keys(safeData[ex2]);

        const commonSymbols = ex1Symbols.filter((sym) =>
          ex2Symbols.includes(sym),
        );

        for (const sym of commonSymbols) {
          const p1 = safeData[ex1][sym];
          const p2 = safeData[ex2][sym];

          if (p1 > 0 && p2 > 0) {
            const diff = Math.abs(p1 - p2);
            const minP = Math.min(p1, p2);
            const gapPercent = (diff / minP) * 100;

            if (gapPercent >= 0.7 && gapPercent <= 10.0) {
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
              });
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
