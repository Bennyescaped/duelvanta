// STAGING DEPLOYMENT SOURCE: owner-invite-beta-user
// Deploy only to the intended Supabase environment. Requires authenticated real DUELVANTA owner.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const cors={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type","Content-Type":"application/json"};
const reply=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:cors});
Deno.serve(async(req)=>{
  if(req.method==="OPTIONS") return new Response("ok",{headers:cors});
  if(req.method!=="POST") return reply({error:"method_not_allowed"},405);
  try{
    const url=Deno.env.get("SUPABASE_URL")!;
    const publishable=JSON.parse(Deno.env.get("SUPABASE_PUBLISHABLE_KEYS")||"{}").default||Deno.env.get("SUPABASE_ANON_KEY");
    const secret=JSON.parse(Deno.env.get("SUPABASE_SECRET_KEYS")||"{}").default||Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if(!url||!publishable||!secret) return reply({error:"server_config_missing"},500);
    const auth=req.headers.get("Authorization")||"";
    const userClient=createClient(url,publishable,{global:{headers:{Authorization:auth}},auth:{persistSession:false}});
    const {data:{user},error:userError}=await userClient.auth.getUser();
    if(userError||!user) return reply({error:"not_authenticated"},401);
    const {data:isOwner,error:ownerError}=await userClient.rpc("is_duelvanta_owner",{p_uid:user.id});
    if(ownerError||isOwner!==true) return reply({error:"owner_required"},403);
    const body=await req.json().catch(()=>({}));
    const email=String(body?.email||"").trim().toLowerCase();
    if(!/^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/.test(email)) return reply({error:"invalid_email"},400);
    const redirectTo=String(body?.redirectTo||"").trim();
    const admin=createClient(url,secret,{auth:{persistSession:false,autoRefreshToken:false}});
    const options:Record<string,unknown>={data:{duelvanta_invited:true}};
    if(redirectTo) options.redirectTo=redirectTo;
    const {data,error}=await admin.auth.admin.inviteUserByEmail(email,{...options});
    if(error) return reply({error:error.message},400);
    await admin.from("admin_audit_log").insert({actor_id:user.id,target_user_id:data.user?.id||null,action:"beta_user_invited",details:{email}});
    return reply({ok:true,user_id:data.user?.id||null});
  }catch(e){return reply({error:e instanceof Error?e.message:"invite_failed"},500)}
});
