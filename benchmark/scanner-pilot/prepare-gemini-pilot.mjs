// Run locally. Never commit the output bundle: it contains private photographs and short-lived grants.
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {resolve,dirname} from 'node:path';
import {generateKeyPairSync,sign,createHash} from 'node:crypto';
const [manifestFile,photosDir,bundleFile,configFile]=process.argv.slice(2);
if(!configFile)throw Error('Usage: node prepare-gemini-pilot.mjs PRIVATE_MANIFEST PHOTOS_DIR PRIVATE_BUNDLE PUBLIC_CONFIG');
const manifest=JSON.parse(await readFile(manifestFile,'utf8'));
const source=[];
for(const card of manifest.cards)for(const shot of card.shots){
  const image=await readFile(resolve(photosDir,shot.file));
  const hash=createHash('sha256').update(image).digest('hex');
  if(hash!==shot.sha256||image.length>1600000||!['pokemon','one_piece'].includes(card.tcg))throw Error('Fixture mismatch: '+shot.id);
  source.push({photoId:shot.id,imageBase64:image.toString('base64'),sha256:hash,tcg:card.tcg});
}
if(source.length!==16||new Set(source.map(s=>s.sha256)).size!==16)throw Error('Exactly 16 distinct authorized originals required.');
const model='gemini-3.5-flash-lite',dataset='duelvanta-16-photos-20260910-v1';
const expiresAt=new Date(Date.now()+2*60*60*1000).toISOString();
const {publicKey,privateKey}=generateKeyPairSync('ed25519');
const photos=source.map(p=>{
  const ticket=JSON.stringify({dataset,model,expiresAt,sha256:p.sha256,tcg:p.tcg});
  return {photoId:p.photoId,ticket,signature:sign(null,Buffer.from(ticket),privateKey).toString('base64url'),imageBase64:p.imageBase64};
});
await mkdir(dirname(resolve(bundleFile)),{recursive:true});
await writeFile(bundleFile,JSON.stringify({schema:'duelvanta.signed-photo-pilot.v1',photos}),{mode:0o600,flag:'wx'});
await writeFile(configFile,JSON.stringify({enabled:true,dataset,expiresAt,publicKey:publicKey.export({type:'spki',format:'pem'}),photos:Object.fromEntries(source.map(p=>[p.sha256,p.tcg]))},null,2)+'\n');
console.log(JSON.stringify({photos:16,model,expiresAt,privateImagesCommitted:false}));
