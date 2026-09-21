import { createClient } from "npm:@supabase/supabase-js@2";
import { AccessToken, RoomServiceClient } from "npm:livekit-server-sdk@2";

const corsHeaders = {
 "access-control-allow-origin": "https://duelvantav5vision-git-marketplace-ux-v1-bennyescaped-3783.vercel.app",
 "access-control-allow-methods": "POST, OPTIONS",
 "access-control-allow-headers": "authorization, content-type",
};
const json=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{...corsHeaders,"content-type":"application/json","cache-control":"no-store","x-content-type-options":"nosniff"}});
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const required=(name:string)=>{const v=Deno.env.get(name);if(!v)throw new Error("server_not_configured");return v;};
const httpsUrl=(value:string)=>value.replace(/^wss:/,"https:").replace(/^ws:/,"http:");

Deno.serve(async(req)=>{
 if(req.method==="OPTIONS")return new Response(null,{status:204,headers:corsHeaders});
 if(req.method!=="POST")return json({error:"method_not_allowed"},405);
 try{
  const auth=req.headers.get("authorization");if(!auth?.startsWith("Bearer "))return json({error:"not_authenticated"},401);
  const body=await req.json().catch(()=>null),action=body?.action,matchId=body?.match_id,tabId=body?.tab_id;
  if(!uuid.test(matchId||"")||!["viewer","publisher"].includes(action))return json({error:"invalid_request"},400);
  if(action==="viewer"&&!uuid.test(tabId||""))return json({error:"invalid_request"},400);
  const sbUrl=required("SUPABASE_URL"),anon=required("SUPABASE_ANON_KEY");
  const db=createClient(sbUrl,anon,{global:{headers:{Authorization:auth}},auth:{persistSession:false,autoRefreshToken:false}});
  const rpc=action==="viewer"
    ?await db.rpc("reserve_battle_spectator_media_viewer",{p_match_id:matchId,p_tab_id:tabId})
    :await db.rpc("get_battle_spectator_media_publisher_admission",{p_match_id:matchId});
  if(rpc.error||!rpc.data?.epoch)return json({error:"media_not_authorized"},403);
  const lkUrl=required("LIVEKIT_URL"),key=required("LIVEKIT_API_KEY"),secret=required("LIVEKIT_API_SECRET");
  const role=action==="viewer"?"viewer":rpc.data.publisher_role;
  const identity=`dv:${matchId}:${rpc.data.epoch}:${role}:${crypto.randomUUID()}`;
  const token=new AccessToken(key,secret,{identity,ttl:"45s",metadata:JSON.stringify({match_id:matchId,epoch:rpc.data.epoch,role})});
  token.addGrant({roomJoin:true,room:`dv-${matchId}-${rpc.data.epoch}`,canSubscribe:action==="viewer",canPublish:action==="publisher",canPublishData:false,canUpdateOwnMetadata:false,canPublishSources:action==="publisher"?["camera","microphone"]:[]});
  return json({url:lkUrl,token:await token.toJwt(),role,epoch:rpc.data.epoch,expires_in:45});
 }catch(e){console.error("spectator-media-broker",e instanceof Error?e.message:"error");return json({error:"media_broker_unavailable"},503);}
});