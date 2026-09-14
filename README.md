# ChartLens AI

Screenshot-first chart analysis web app.

## What it does

- Uploads a TradingView/MT5 chart screenshot.
- Uses a vision model to inspect the chart.
- Calibrates the visible price scale before producing price-dependent output.
- Detects visible market structure and liquidity areas.
- Returns candidate entry, stop-loss and target levels when the screenshot provides enough evidence.
- Returns `WAIT`/null fields when the chart cannot be read reliably instead of inventing prices.

## Deploy

This project is designed for Vercel because the AI API key must remain server-side.

1. Import this GitHub repository into Vercel.
2. Add an environment variable named `OPENAI_API_KEY`.
3. Optionally add `OPENAI_MODEL` (default: `gpt-5.6-luna`).
4. Deploy.

Do not put the API key in `app.js`, `index.html`, or any browser-side code.

## Important

The analyzer is an image interpretation tool. Screenshot-based analysis can be wrong, especially when the price scale, current-price marker, candles, or symbol are cropped or blurry. Results are educational and should not be treated as guaranteed financial outcomes.
