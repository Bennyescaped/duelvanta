// Creates a short-lived, exact-photo OpenAI pilot from the existing private card bundle plus two slab photos.
// The output bundle contains private photos and must stay outside Git.
import {createHash,generateKeyPairSync,sign} from 'node:crypto';
import {readFile,writeFile} from 'node:fs/promises';
import {dirname,resolve} from 'node:path';
import {mkdir} from 'node:fs/promises';
import openai from './openai-server.cjs';

const [sourceBundle,psaPhoto,rgsPhoto,privateBundle,publicConfig]=process.argv.slice(2);
if(!publicConfig)throw Error('Usage: node prepare-openai-pilot.mjs SOURCE_BUNDLE PSA_PHOTO RGS_PHOTO PRIVATE_BUNDLE PUBLIC_CONFIG');
const source=JSON.parse(await readFile(sourceBundle,'utf8'));
if(source.schema!=='duelvanta.signed-photo-pilot.v1'||!Array.isArray(source.photos)||source.photos.length!==16)throw Error('Expected the verified sixteen-photo source bundle.');
const wanted=new Set(['P01-B','P02-B','P03-B','P04-B','O01-B','O02-B','O03-B','O04-B']);
const selected=source.photos.filter(photo=>wanted.has(photo.photoId)).map(photo=>({photoId:photo.photoId,tcg:JSON.parse(photo.ticket).tcg,image:Buffer.from(photo.imageBase64,'base64')}));
selected.push({photoId:'S01-PSA-SANJI',tcg:'one_piece',image:await readFile(psaPhoto)},{photoId:'S02-RGS-FLAREON',tcg:'pokemon',image:await readFile(rgsPhoto)});
if(selected.length!==10||new Set(selected.map(x=>x.photoId)).size!==10)throw Error('The ten-photo selection is incomplete.');
for(const photo of selected)if(photo.image.length<4||photo.image.length>1600000||photo.image[0]!==255||photo.image[1]!==216||photo.image[2]!==255)throw Error(`Invalid JPEG: ${photo.photoId}`);
const dataset=`openai-v16-${new Date().toISOString().slice(0,10)}`,expiresAt=new Date(Date.now()+4*60*60*1000).toISOString();
const {publicKey,privateKey}=generateKeyPairSync('ed25519'),photos={};
const bundlePhotos=selected.map(photo=>{const sha256=createHash('sha256').update(photo.image).digest('hex');photos[sha256]=photo.tcg;const ticket=JSON.stringify({dataset,model:openai.MODEL,expiresAt,sha256,tcg:photo.tcg});return{photoId:photo.photoId,ticket,signature:sign(null,Buffer.from(ticket),privateKey).toString('base64url'),imageBase64:photo.image.toString('base64')}});
await mkdir(dirname(resolve(privateBundle)),{recursive:true});
await writeFile(privateBundle,JSON.stringify({schema:'duelvanta.signed-photo-pilot.v1',photos:bundlePhotos}),{mode:0o600,flag:'wx'});
await writeFile(publicConfig,JSON.stringify({enabled:true,dataset,expiresAt,publicKey:publicKey.export({type:'spki',format:'pem'}),photos},null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({dataset,model:openai.MODEL,expiresAt,photos:bundlePhotos.map(x=>x.photoId),privateBundle,publicConfig},null,2));
