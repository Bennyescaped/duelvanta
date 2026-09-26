'use strict';

const PRODUCTION_URL='https://enifiaqsnqtbzylnfrpi.supabase.co';
const STAGING_URL='https://xhmjxrcskfhbovhitdej.supabase.co';
const PRODUCTION_PUBLISHABLE_KEY='sb_publishable_pk2szDe_g7fJLUdAMEUevw_odrDmnuM';
const STAGING_PUBLISHABLE_KEY='sb_publishable_KNlm6LzvSxCaGwLc_1mPbA_-z1we46N';
const ENVIRONMENTS=new Set(['production','preview','development']);

function deploymentEnvironment(env=process.env){
  const environment=String(env.VERCEL_ENV||'development');
  if(!ENVIRONMENTS.has(environment))throw new Error('supabase_environment_unknown');
  return environment;
}

function resolveSupabaseEnvironment(env=process.env){
  const environment=deploymentEnvironment(env);
  const url=environment==='production'?PRODUCTION_URL:STAGING_URL;
  const configured=String(env.SUPABASE_URL||'').trim().replace(/\/$/,'');
  if(configured&&configured!==url)throw new Error('supabase_environment_mismatch');
  return Object.freeze({environment,url});
}

function resolveSupabaseRuntimeConfig(env=process.env){
  const {environment,url}=resolveSupabaseEnvironment(env);
  const key=environment==='production'?PRODUCTION_PUBLISHABLE_KEY:String(env.SUPABASE_PUBLISHABLE_KEY||STAGING_PUBLISHABLE_KEY).trim();
  if(!/^sb_publishable_[A-Za-z0-9_-]+$/.test(key))throw new Error('supabase_publishable_key_invalid');
  return Object.freeze({environment,url,key});
}

module.exports={PRODUCTION_URL,STAGING_URL,deploymentEnvironment,resolveSupabaseEnvironment,resolveSupabaseRuntimeConfig};
