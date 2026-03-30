import { NextRequest, NextResponse } from "next/server";
import ccxt from "ccxt";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(request: NextRequest) {
  try {
    // KuCoin API Setup with provided credentials
    const kucoin = new ccxt.kucoin({
      apiKey: "69b198dc0e8f470001a703e5",
      secret: "3c0022ee-6623-4160-a4c2-90da08fe4d0f",
      password: "0000000",
      enableRateLimit: true,
    });

    // Fetch all tickers from KuCoin
    const tickers = await kucoin.fetchTickers();

    const usdtPairs: Record<string, number> = {};
    const usdcPairs: Record<string, number> = {};

    // Organize tickers into USDT and USDC pairs
    for (const [symbol, data] of Object.entries(tickers)) {
      if (symbol.includes("/USDT")) {
        const base = symbol.split("/")[0];
        if (data.last !== undefined && data.last !== null) {
          usdtPairs[base] = data.last;
        }
      } else if (symbol.includes("/USDC")) {
        const base = symbol.split("/")[0];
        if (data.last !== undefined && data.last !== null) {
          usdcPairs[base] = data.last;
        }
      }
    }

    // Find common coins between USDT and USDC markets
    const commonCoins = Object.keys(usdtPairs).filter((coin) => !!usdcPairs[coin]);
    const results = [];

    const currentTime = new Date().toISOString();

    for (const coin of commonCoins) {
      const uPrice = usdtPairs[coin];
      const cPrice = usdcPairs[coin];

      if (uPrice > 0 && cPrice > 0) {
        const diff = Math.abs(uPrice - cPrice);
        const minP = Math.min(uPrice, cPrice);
        const gapPercent = (diff / minP) * 100;

        // Gap filter: 0.70% to 10%
        if (gapPercent >= 0.7 && gapPercent <= 10.0) {
          const buyIn = uPrice < cPrice ? "USDT" : "USDC";
          const sellIn = uPrice < cPrice ? "USDC" : "USDT";

          results.push({
            time: currentTime,
            coin: coin,
            gapPercent: Number(gapPercent.toFixed(2)),
            buyMarket: `${coin}/${buyIn}`,
            buyPrice: Math.min(uPrice, cPrice),
            sellMarket: `${coin}/${sellIn}`,
            sellPrice: Math.max(uPrice, cPrice),
          });
        }
      }
    }

    // Sort by highest gap first
    results.sort((a, b) => b.gapPercent - a.gapPercent);

    return NextResponse.json(results);
  } catch (error) {
    console.error("KuCoin Scanner API error:", error);
    return NextResponse.json(
      { error: "Failed to scan KuCoin market data" },
      { status: 500 }
    );
  }
}
