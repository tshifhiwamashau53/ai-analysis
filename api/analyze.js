const SYSTEM_PROMPT = `You are ChartLens, a chart-image analysis engine. Analyze ONLY what is visibly supported by the supplied screenshot. Do not invent a current price, price scale, symbol, timeframe, liquidity level, or trade level. The most important task is calibrating the visible vertical price scale before estimating any price. If the scale or current-price marker cannot be read reliably, return null for price-dependent fields and explain why.

Read the screenshot in this order:
1. Identify the chart symbol/timeframe if visible.
2. Locate the price scale and read several visible numeric labels.
3. Locate the current-price marker/line if visible and use it as the anchor.
4. Inspect recent candles and market structure.
5. Identify visible swing highs/lows and likely buy-side/sell-side liquidity pools.
6. Produce candidate entry, stop and target levels only when the screenshot supports them.

Never use a generic assumed price. Never output a price outside the visible chart range. If evidence conflicts, choose WAIT and lower confidence. This is educational chart analysis, not a guarantee or personalized financial advice.

Return JSON only.`;

export default async function handler(req,res){
  if(req.method!=='POST') return res.status(405).json({error:'Method not allowed'});
  try{
    const {image,market,timeframe,style}=req.body||{};
    if(!image||typeof image!=='string'||!image.startsWith('data:image/')) return res.status(400).json({error:'A chart screenshot is required.'});
    if(image.length>18_000_000) return res.status(413).json({error:'Image is too large.'});
    const apiKey=process.env.OPENAI_API_KEY;
    if(!apiKey) return res.status(500).json({error:'OPENAI_API_KEY is not configured on the server.'});
    const prompt=`Analyze this chart screenshot. User hints: market=${market||'auto'}, timeframe=${timeframe||'auto'}, style=${style||'price action + liquidity'}.

Output this exact JSON shape:
{
  "symbol": "string or Unknown",
  "timeframe": "string or Unknown",
  "current_price": "string or null",
  "bias": "BUY|SELL|WAIT",
  "trend": "string",
  "confidence": 0,
  "risk_reward": "string or null",
  "entry": {"price":"string or null","reason":"string"},
  "stop_loss": {"price":"string or null","reason":"string"},
  "take_profit_1": {"price":"string or null","reason":"string"},
  "take_profit_2": {"price":"string or null","reason":"string"},
  "buy_stops": [{"price":"string","reason":"string"}],
  "sell_stops": [{"price":"string","reason":"string"}],
  "structure": [{"label":"string","detail":"string"}],
  "explanation": "string"
}
Use null when a numeric price cannot be reliably read. Keep confidence 0-100.`;
    const r=await fetch('https://api.openai.com/v1/responses',{method:'POST',headers:{'Authorization':`Bearer ${apiKey}`,'Content-Type':'application/json'},body:JSON.stringify({model:process.env.OPENAI_MODEL||'gpt-5.6-luna',input:[{role:'system',content:[{type:'input_text',text:SYSTEM_PROMPT}]},{role:'user',content:[{type:'input_text',text:prompt},{type:'input_image',image_url:image}] }],text:{format:{type:'json_object'}},max_output_tokens:1800})});
    const raw=await r.text();let data;try{data=JSON.parse(raw)}catch{data={}};
    if(!r.ok) return res.status(r.status).json({error:data?.error?.message||'Vision analysis request failed.'});
    const text=data.output?.flatMap(x=>x.content||[]).find(x=>x.type==='output_text')?.text;
    if(!text) return res.status(502).json({error:'The AI returned no analysis.'});
    let result;try{result=JSON.parse(text)}catch{return res.status(502).json({error:'The AI returned invalid JSON.'})}
    return res.status(200).json(result);
  }catch(e){return res.status(500).json({error:e.message||'Unexpected server error.'})}
}
