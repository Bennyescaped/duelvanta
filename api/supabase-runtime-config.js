'use strict';

const PRODUCTION_URL='https://enifiaqsnqtbzylnfrpi.supabase.co';
const PRODUCTION_KEY='sb_publishable_pk2szDe_g7fJLUdAMEUevw_odrDmnuM';
const STAGING_URL='https://xhmjxrcskfhbovhitdej.supabase.co';

module.exports=function handler(req,res){
  if(req.method!=='GET')return res.status(405).send('method_not_allowed');
  const environment=process.env.VERCEL_ENV||'development';
  const production=environment==='production';
  const url=production?PRODUCTION_URL:process.env.SUPABASE_URL;
  const key=production?PRODUCTION_KEY:process.env.SUPABASE_PUBLISHABLE_KEY;
  res.setHeader('Content-Type','application/javascript; charset=utf-8');
  res.setHeader('Cache-Control','private, no-store, max-age=0');
  res.setHeader('X-Content-Type-Options','nosniff');
  if(!url||!key||(!production&&url.includes('enifiaqsnqtbzylnfrpi'))||(environment==='preview'&&url!==STAGING_URL)){
    return res.status(503).send("window.DV_SUPABASE=null;throw new Error('DUELVANTA preview database is not safely configured');");
  }
  return res.status(200).send(`window.DV_SUPABASE=Object.freeze(${JSON.stringify({url,key,environment})});`);
};
