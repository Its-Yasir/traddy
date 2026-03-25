import { NextRequest, NextResponse } from "next/server";
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

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const pinnedParam = searchParams.get("pinned") || "";
    const pinnedKeysSet = new Set(pinnedParam.split(",").filter(Boolean));

    // Initialize the three exchanges
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
          const markets = (await Promise.race([
            ex.instance.loadMarkets(),
            new Promise((_, reject) =>
              setTimeout(() => reject(new Error(`${ex.name} timeout`)), 30000),
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

    const opportunities: Opportunity[] = [];
    const exNames = exchanges.map((ex) => ex.name);

    for (let i = 0; i < exNames.length; i++) {
      for (let j = i + 1; j < exNames.length; j++) {
        const ex1 = exNames[i];
        const ex2 = exNames[j];

        const ex1Data = safeData[ex1] || {};
        const ex2Data = safeData[ex2] || {};

        const commonSymbols = Object.keys(ex1Data).filter(
          (sym) => ex2Data[sym],
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
            const volumeDiff = Math.abs(v1 - v2);

            const buyEx = p1 < p2 ? ex1 : ex2;
            const sellEx = p1 < p2 ? ex2 : ex1;
            const oppKey = `${sym}-${buyEx}-${sellEx}`;
            const isPinned = pinnedKeysSet.has(oppKey);

            // Include if it meets thresholds OR if it is pinned (to keep it live)
            if (
              (gapPercent >= 0.7 &&
                gapPercent <= 20.0 &&
                volumeDiff > 100000) ||
              isPinned
            ) {
              opportunities.push({
                pair: sym,
                gapPercent: gapPercent,
                buyExchange: buyEx,
                lowPrice: p1 < p2 ? p1 : p2,
                buyVolume: p1 < p2 ? v1 : v2,
                sellExchange: sellEx,
                highPrice: p1 < p2 ? p2 : p1,
                sellVolume: p1 < p2 ? v2 : v1,
                volumeDiff: volumeDiff,
              });
            }
          }
        }
      }
    }

    // Sort by highest gap percentage first
    opportunities.sort((a, b) => b.gapPercent - a.gapPercent);

    // Get top 20
    const top20 = opportunities.slice(0, 20);
    const top20Keys = new Set(
      top20.map((o) => `${o.pair}-${o.buyExchange}-${o.sellExchange}`),
    );

    // Add any pinned items that didn't make the top 20
    const extraPinned = opportunities.filter((o) => {
      const key = `${o.pair}-${o.buyExchange}-${o.sellExchange}`;
      return pinnedKeysSet.has(key) && !top20Keys.has(key);
    });

    const topOpportunities = [...top20, ...extraPinned];

    // Fetch Market Cap data for final list
    try {
      const cgRes = await fetch(
        "https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=250&page=1",
        { next: { revalidate: 3600 } },
      );

      if (cgRes.ok) {
        const cgData = await cgRes.json();
        const marketCapMap: Record<string, number> = {};
        cgData.forEach((coin: { symbol: string; market_cap: number }) => {
          marketCapMap[coin.symbol.toUpperCase()] = coin.market_cap;
        });

        topOpportunities.forEach((opp) => {
          const base = opp.pair.split("/")[0].toUpperCase();
          opp.marketCap = marketCapMap[base] || null;
        });
      }
    } catch (cgError) {
      console.error("CoinGecko fetch error:", cgError);
    }

    return NextResponse.json(topOpportunities);
  } catch (error) {
    console.error("Arbitrage fetch error:", error);
    return NextResponse.json(
      { error: "Internal server error while fetching market data" },
      { status: 500 },
    );
  }
}
