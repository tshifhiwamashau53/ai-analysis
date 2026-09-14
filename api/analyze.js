const SYSTEM_PROMPT = `You are ChartLens, a chart-image analysis engine. Analyze only what is visibly supported by the supplied screenshot. Do not invent a current price, price scale, symbol, timeframe, liquidity level, or trade level.

First calibrate the visible vertical price scale. Read several visible numeric labels and locate the current-price marker if present. Treat the screenshot's visible price scale as authoritative. Never output a numeric price outside the visible scale. If the scale or current-price marker cannot be read reliably, return null for price-dependent fields and use WAIT.

Then inspect recent candles, swing highs/lows, market structure, and visible liquidity. Return educational analysis only, with uncertainty clearly represented. Do not claim guaranteed outcomes or personalized financial advice. Return JSON only.`;

export default async function handler(req,res){
  res.setHeader('Cache-Control','no-store');
  if(req.method!=='POST') return res.status(405).json({error:'Method not allowed'});
  try{
    const {image,market,timeframe,style}=req.body||{};
    if(!image||typeof image!=='string'||!/^data:image\/(png|jpeg|webp);base64,/i.test(image)) return res.status(400).json({error:'A PNG, JPG or WebP chart screenshot is required.'});
    if(image.length>18_000_000) return res.status(413).json({error:'Image is too large. Use a screenshot under 12 MB.'});
    const apiKey=process.env.OPENAI_API_KEY;
    if(!apiKey) return res.status(500).json({error:'OPENAI_API_KEY is not configured on the server.'});
    const prompt=`Analyze this chart screenshot. User hints: market=${market||'auto'}, timeframe=${timeframe||'auto'}, style=${style||'price action + liquidity'}.

Return exactly this JSON shape:
{
  "symbol":"string or Unknown",
  "timeframe":"string or Unknown",
  "current_price":"string or null",
  "bias":"BUY|SELL|WAIT",
  "trend":"string",
  "confidence":0,
  "risk_reward":"string or null",
  "entry":{"price":"string or null","reason":"string"},
  "stop_loss":{"price":"string or null","reason":"string"},
  "take_profit_1":{"price":"string or null","reason":"string"},
  "take_profit_2":{"price":"string or null","reason":"string"},
  "buy_stops":[{"price":"string","reason":"string"}],
  "sell_stops":[{"price":"string","reason":"string"}],
  "structure":[{"label":"string","detail":"string"}],
  "explanation":"string"
}
Use null when a numeric price cannot be reliably read. Keep confidence from 0 to 100. Do not invent prices.`;
    const model=process.env.OPENAI_MODEL||'gpt-5.6-luna';
    const r=await fetch('https://api.openai.com/v1/responses',{method:'POST',headers:{Authorization:`Bearer ${apiKey}`,'Content-Type':'application/json'},body:JSON.stringify({model,input:[{role:'system',content:[{type:'input_text',text:SYSTEM_PROMPT}]},{role:'user',content:[{type:'input_text',text:prompt},{type:'input_image',image_url:image}]}],text:{format:{type:'json_object'}},max_output_tokens:1800})});
    const raw=await r.text();let data=null;try{data=JSON.parse(raw)}catch{}
    if(!r.ok) return res.status(r.status).json({error:data?.error?.message||`AI request failed with status ${r.status}.`});
    const text=data?.output?.flatMap(x=>x.content||[]).find(x=>x.type==='output_text')?.text;
    if(!text) return res.status(502).json({error:'The AI returned no analysis.'});
    let result;try{result=JSON.parse(text)}catch{return res.status(502).json({error:'The AI returned invalid JSON.'})}
    return res.status(200).json(result);
  }catch(e){return res.status(500).json({error:e?.message||'Unexpected server error.'})}
}
