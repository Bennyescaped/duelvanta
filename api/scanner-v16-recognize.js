const {createHandler}=require('../benchmark/scanner-pilot/recognize-server.cjs');
const config=require('../benchmark/scanner-pilot/openai-scanner-public.json');
module.exports=createHandler({config});
