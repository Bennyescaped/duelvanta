import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const cors={
  'Access-Control-Allow-Origin':'https://duelvanta.de',
  'Access-Control-Allow-Headers':'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods':'POST, OPTIONS'
}
const json=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{...cors,'Content-Type':'application/json'}})
Deno.serve(async(req)=>{
  if(req.method==='OPTIONS') return new Response('ok',{headers:cors})
  if(req.method!=='POST') return json({error:'Method not allowed'},405)
  try{
    const { item_id }=await req.json()
    if(!item_id) return json({error:'Missing item_id'},400)
    const db=createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,{auth:{persistSession:false,autoRefreshToken:false}})
    const {data:item,error}=await db.from('collection_items').select('id,user_id,folder_id,image_path').eq('id',item_id).single()
    if(error||!item?.image_path) return json({url:null},404)
    const {data:profile}=await db.from('profiles').select('collection_visibility,account_status,data_processing_restricted_at').eq('id',item.user_id).single()
    if(!profile||profile.data_processing_restricted_at!=null||profile.account_status==='suspended'||profile.account_status==='deleted') return json({url:null},404)
    let visible=profile.collection_visibility==='public'
    if(profile.collection_visibility==='custom'&&item.folder_id){
      const {data:folder}=await db.from('collection_folders').select('is_public').eq('id',item.folder_id).eq('user_id',item.user_id).single()
      visible=folder?.is_public===true
    }
    if(!visible) return json({url:null},404)
    const {data:currentProfile,error:profileError}=await db.from('profiles').select('data_processing_restricted_at').eq('id',item.user_id).single()
    if(profileError||!currentProfile||currentProfile.data_processing_restricted_at!=null) return json({url:null},404)
    const {data:signed,error:signErr}=await db.storage.from('collection-cards').createSignedUrl(item.image_path,900)
    if(signErr||!signed?.signedUrl) return json({url:null},404)
    const {data:finalProfile,error:finalError}=await db.from('profiles').select('data_processing_restricted_at').eq('id',item.user_id).single()
    if(finalError||!finalProfile||finalProfile.data_processing_restricted_at!=null) return json({url:null},404)
    return new Response(JSON.stringify({url:signed.signedUrl}),{headers:{...cors,'Content-Type':'application/json','Cache-Control':'private, max-age=600'}})
  }catch(e){console.error(e);return json({error:'Bad request'},400)}
})
