'use strict';
const {createPilotHandler}=require('../benchmark/scanner-pilot/gemini-server.cjs');
const config=require('../benchmark/scanner-pilot/gemini-pilot-public.json');
module.exports=createPilotHandler({config});
