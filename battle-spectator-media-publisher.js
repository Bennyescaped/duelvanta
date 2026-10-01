/* Spectator Media V1 publisher adapter. Original tracks belong to player P2P. */
(()=>{
'use strict';
let room=null,lastKey='',busy=false;
async function close(){
  const r=room;room=null;lastKey='';
  try{await r?.disconnect(false);}catch{}
}
async function broker(matchId){
  const {data:{session}}=await db.auth.getSession();
  if(!session?.access_token)throw Error('no_session');
  const res=await fetch(window.DV_SUPABASE.url+'/functions/v1/battle-spectator-media-broker',{
    method:'POST',headers:{Authorization:'Bearer '+session.access_token,'Content-Type':'application/json'},
    body:JSON.stringify({action:'publisher',match_id:matchId})
  });
  if(!res.ok)throw Error('media_closed');
  return res.json();
}
async function publish(r,track){
  await r.localParticipant.publishTrack(track,{
    source:track.kind==='video'?LivekitClient.Track.Source.Camera:LivekitClient.Track.Source.Microphone,
    simulcast:false
  });
}
async function tick(){
  if(busy)return;busy=true;
  try{
    if(typeof currentMatch==='undefined'||!currentMatch||typeof user==='undefined'||!user||
      ![currentMatch.host_id,currentMatch.guest_id].includes(user.id)||
      !['waiting','ready','live'].includes(currentMatch.status)||typeof stream==='undefined'||!stream?.active){
      await close();return;
    }
    const key=currentMatch.id+':'+user.id;
    if(room&&lastKey===key){
      const r=room;
      const live=stream.getTracks().filter(t=>t.readyState==='live'&&t.enabled!==false);
      const published=new Set();
      for(const pub of r.localParticipant.trackPublications.values()){
        const t=pub.track?.mediaStreamTrack;
        if(t&&live.includes(t))published.add(t);
        else if(pub.track)await r.localParticipant.unpublishTrack(pub.track,false);
      }
      for(const track of live){
        if(room!==r)return;
        if(!published.has(track))await publish(r,track);
      }
      return;
    }
    const access=await broker(currentMatch.id);
    if(!window.LivekitClient?.Room)throw Error('sdk_missing');
    await close();
    // This option also protects original tracks on server RemoveParticipant.
    const r=new LivekitClient.Room({adaptiveStream:false,dynacast:true,stopLocalTrackOnUnpublish:false});
    r.on(LivekitClient.RoomEvent.Disconnected,()=>{
      if(room===r){room=null;lastKey='';}
    });
    // Own the room before async setup so partial failures can dispose of it.
    room=r;lastKey=key;
    await r.connect(access.url,access.token);
    for(const track of stream?.getTracks()||[]){
      if(room!==r)return;
      if(track.readyState!=='live'||track.enabled===false)continue;
      await publish(r,track);
    }
  }catch{await close();}finally{busy=false;}
}
window.addEventListener('pagehide',()=>void close());
setInterval(()=>void tick(),5000);void tick();
})();
