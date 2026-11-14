const fs=require('fs');const T=(process.env.MONDAY_API_TOKEN||'').trim();
exports.mondayClient={api:async(q,o)=>{const r=await fetch('https://api.monday.com/v2',{method:'POST',headers:{'Content-Type':'application/json',Authorization:T,'API-Version':'2026-10'},body:JSON.stringify({query:q,variables:o?.variables||{}})});return r.json();}};
