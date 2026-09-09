// All responses are in-memory fixtures. This file is never loaded by the real app.
(() => {
  const stamp='2026-09-09T10:00:00Z';
  const base={seller_id:'ui-seller',seller_display_name:'Local seller',tcg:'pokemon',card_name:'Display UI-Prüfung',language:'Deutsch',status:'active',listing_type:'sale',asking_price:240,shipping_method:'parcel',shipping_cost:6.99,product_kind:'sealed',sealed_category:'display',sealed_condition:'factory_sealed',stock_quantity:10,quantity_available:10,minimum_purchase_quantity:1,quantity_pricing:[{min_quantity:3,unit_price:220},{min_quantity:5,unit_price:215}],package_contents:'24 Booster je Display',updated_at:stamp,active_until:'2026-12-09T10:00:00Z'};
  const rows=[{...base,id:'ui-fixed',pricing_mode:'fixed'},{...base,id:'ui-vb',card_name:'Verhandlungsangebot UI',pricing_mode:'negotiable'}];
  const order={order_id:'ui-order',order_number:'UI-LOCAL-ONLY',seller_id:'ui-seller',buyer_id:'ui-buyer',seller_name:'Local seller',buyer_name:'Local buyer',fulfillment_group:'shipping',status:'open',has_address:false,shipping_method:'parcel',shipping_quote_status:'review_required',item_count:1,subtotal:660,separate_shipping_sum:6.99,shipping_cost:6.99,total_amount:666.99,shipping_savings:0,payment_provider:'manual_beta',payment_status:'not_required',paid_amount:0};
  const calls=[];let failNext=true, purchases=0;
  function query(table){const q={select(){return q},eq(){return q},order(){return q},or(){return q},single(){return Promise.resolve({data:{display_name:'Local buyer'},error:null})},then(done){return Promise.resolve({data:table==='market_listings'?rows:[],error:null}).then(done)}};return q}
  const db={auth:{getSession:async()=>({data:{session:{user:{id:'ui-buyer'}}}}),onAuthStateChange:()=>({}),signOut:async()=>({})},from:query,storage:{from:()=>({createSignedUrl:async()=>({data:{signedUrl:null}})})},rpc:async(name,args)=>{
    calls.push({name,args});
    if(name==='get_my_market_offers_v2')return {data:[{id:'ui-offer',listing_id:'ui-vb',seller_id:'ui-seller',buyer_id:'ui-buyer',requested_quantity:3,status:'pending',amount:600,listed_total_snapshot:660,listed_unit_price_snapshot:220,historical_price:true,listing_snapshot:{card_name:'Display UI-Prüfung',sealed_category:'display'},message:'<img src=x onerror=alert(1)>'},{id:'ui-old',seller_id:'ui-seller',buyer_id:'ui-buyer',requested_quantity:1,status:'accepted',amount:240,historical_price:false,listing_snapshot:{card_name:'Älteres Angebot'}}],error:null};
    if(name==='buy_market_listing_v2'){
      if(failNext){failNext=false;throw new Error('Lokaler simulierter Verbindungsabbruch')}
      purchases++;rows[0].quantity_available-=args.p_quantity;
      return {data:{order_id:order.order_id,quantity:args.p_quantity,item_total:660},error:null};
    }
    if(name==='get_my_market_orders')return {data:[order],error:null};
    if(name==='get_market_order_items')return {data:[{item_title:'Display UI-Prüfung',product_kind:'sealed',sealed_category:'display',quantity:3,item_amount:660,weight_grams:1800,deal_status:order.status==='completed'?'completed':'accepted'}],error:null};
    if(name==='confirm_market_order_received'){order.status='completed';order.received_at=stamp;order.completed_at=stamp;return {data:null,error:null}}
    return {data:[],error:null};
  }};
  window.supabase={createClient:()=>db};
  window.TRADE_UI_FIXTURE={rows,order,calls,get purchases(){return purchases}};
})();
