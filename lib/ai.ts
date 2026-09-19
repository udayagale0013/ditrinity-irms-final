export async function aiJson<T>(system:string,user:string):Promise<T|null>{
 const url=process.env.AI_API_URL; const key=process.env.AI_API_KEY; if(!url||!key) return null;
 const endpoint=url.includes('?')?`${url}&api-version=${process.env.AI_API_VERSION||'2024-10-21'}`:`${url}?api-version=${process.env.AI_API_VERSION||'2024-10-21'}`;
 const r=await fetch(endpoint,{method:'POST',headers:{'content-type':'application/json','api-key':key},body:JSON.stringify({messages:[{role:'system',content:system},{role:'user',content:user}],temperature:0,response_format:{type:'json_object'}})});
 if(!r.ok) throw new Error(`AI provider returned ${r.status}`); const d=await r.json(); const content=d?.choices?.[0]?.message?.content; if(!content) return null; return JSON.parse(content) as T;
}
