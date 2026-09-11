(()=>{
  'use strict';
  const button=document.getElementById('scanCard');
  if(!button)return;
  button.onclick=()=>{
    const folder=typeof activeFolder==='string'&&activeFolder!=='__graded__'?activeFolder:'';
    location.assign('scanner-v16.html'+(folder?'?folder='+encodeURIComponent(folder):''));
  };
})();
