'use strict';
const {createOpenAIHandler}=require('../benchmark/scanner-pilot/openai-server.cjs');
const config=require('../benchmark/scanner-pilot/openai-pilot-public.json');
module.exports=createOpenAIHandler({config});
