const {createXimilarHandler}=require('../benchmark/scanner-pilot/ximilar-server.cjs');
const config=require('../benchmark/scanner-pilot/ximilar-pilot-public.json');
module.exports=createXimilarHandler({config});
