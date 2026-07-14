(function(){
  'use strict';
  var endpoint='https://api.ailatest.org/analytics/pageview';
  function getId(key,storage){try{var value=storage.getItem(key);if(!value){value=crypto.randomUUID?crypto.randomUUID():Date.now()+'-'+Math.random().toString(36).slice(2);storage.setItem(key,value)}return value}catch(_){return ''}}
  var url=new URL(location.href);['token','state','code','access_token','id_token'].forEach(function(key){url.searchParams.delete(key)});
  var payload={event_type:'page_view',event_ts:Math.floor(Date.now()/1000),site:'major',hostname:location.hostname,path:url.pathname+(url.search?url.search.slice(0,180):''),referrer:document.referrer||'',visitor_id:getId('ailatest.analytics.visitor',localStorage),session_id:getId('ailatest.analytics.session',sessionStorage),client_timezone:Intl.DateTimeFormat().resolvedOptions().timeZone||'',client_language:navigator.language||'',screen_resolution:(screen.width||0)+'x'+(screen.height||0),page_title:document.title||''};
  var body=JSON.stringify(payload);try{if(navigator.sendBeacon&&navigator.sendBeacon(endpoint,new Blob([body],{type:'application/json'})))return}catch(_){}fetch(endpoint,{method:'POST',headers:{'content-type':'application/json'},body:body,keepalive:true}).catch(function(){});
})();
