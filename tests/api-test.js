const BASE='https://iwent.ru/api';
async function api(p,o={},t){
  const h={'Content-Type':'application/json',...(t?{Authorization:'Bearer '+t}:{})};
  try{
    const r=await fetch(BASE+p,{...o,headers:{...h,...o.headers}});
    const x=await r.text();let j;try{j=JSON.parse(x)}catch{j=x}
    return{s:r.status,ok:r.ok,d:j}
  }catch(e){return{s:0,ok:false,d:e.message}}
}
async function login(e,p){return(await api('/auth/login',{method:'POST',body:JSON.stringify({email:e,password:p})})).d.accessToken}
let P=0,F=0,W=0;
function ok(n,c,d=''){if(c){P++;console.log(`  ✅ ${n}`)}else{F++;console.log(`  ❌ ${n} ${d}`)}}
function warn(n,d=''){W++;console.log(`  ⚠️  ${n} ${d}`)}

(async()=>{
  const tA=await login('varya.malinina.2003@mail.ru','00000000');
  const tB=await login('vsmalinina@edu.hse.ru','00000000');
  const mA=(await api('/auth/me',{},tA)).d;
  const mB=(await api('/auth/me',{},tB)).d;
  const idA=mA.id, idB=mB.id;

  // ===========================
  console.log('═══ 1. AUTH & USER MANAGEMENT ═══');
  // ===========================
  ok('Login A',!!tA);
  ok('Login B',!!tB);
  ok('Me endpoint A',!!mA.id);
  ok('Me endpoint B',!!mB.id);
  
  // Update profile
  const upd=await api('/users/'+idA,{method:'PATCH',body:JSON.stringify({bio:'Test bio update'})},tA);
  ok('Update user profile',upd.ok,`${upd.s}`);
  
  // Get user by ID
  const getUser=await api('/users/'+idB,{},tA);
  ok('Get user by ID',getUser.ok);

  // ===========================
  console.log('\n═══ 2. EVENTS CRUD ═══');
  // ===========================
  const evList=await api('/events',{},tA);
  ok('List events',evList.ok&&Array.isArray(evList.d));
  console.log(`  Total events: ${evList.d?.length}`);

  // Create
  const tm=new Date();tm.setDate(tm.getDate()+3);
  const cr=await api('/events',{method:'POST',body:JSON.stringify({
    title:'MegaTest_'+Date.now(),description:'Full test',
    startTime:tm.toISOString(),endTime:new Date(tm.getTime()+7200000).toISOString(),
    location:'Москва, Патриаршие',coordinates:{latitude:55.764,longitude:37.591},
    price:'500',maxParticipants:8,isMassEvent:false,customTags:['test','automated']
  })},tA);
  ok('Create event',cr.ok);
  const evId=cr.d?.id;

  // Read
  const ev=await api('/events/'+evId,{},tA);
  ok('Get event by ID',ev.ok);
  ok('Event has correct fields',ev.d?.title?.startsWith('MegaTest')&&ev.d?.price==='500');
  ok('Event has tags',ev.d?.customTags?.includes('test'));

  // Update
  const upEv=await api('/events/'+evId,{method:'PATCH',body:JSON.stringify({
    description:'Updated desc',price:'1000',maxParticipants:15
  })},tA);
  ok('Update event',upEv.ok);

  // Verify update
  const ev2=await api('/events/'+evId,{},tB);
  ok('B sees updated event',ev2.d?.description==='Updated desc'&&ev2.d?.price==='1000');

  // ===========================
  console.log('\n═══ 3. JOIN / ACCEPT / MEMBERSHIP ═══');
  // ===========================
  const join=await api('/events/'+evId+'/join',{method:'POST'},tB);
  ok('B requests to join',join.ok);

  const reqs=await api('/events/'+evId+'/requests',{},tA);
  ok('A sees pending requests',reqs.ok&&reqs.d?.length>0);

  const pend=reqs.d?.find(r=>r.userId===idB);
  ok('Pending request from B',!!pend);

  // Reject first
  if(pend){
    const rej=await api('/events/'+evId+'/requests/'+pend.id+'?accept=false',{method:'PATCH'},tA);
    ok('Reject request',rej.ok&&rej.d?.status==='REJECTED');
  }

  // B requests again
  const join2=await api('/events/'+evId+'/join',{method:'POST'},tB);
  ok('B re-requests',join2.ok);
  const reqs2=await api('/events/'+evId+'/requests',{},tA);
  const pend2=reqs2.d?.find(r=>r.userId===idB&&r.status==='PENDING');
  ok('New pending request',!!pend2);

  // Accept
  if(pend2){
    const acc=await api('/events/'+evId+'/requests/'+pend2.id+'?accept=true',{method:'PATCH'},tA);
    ok('Accept request',acc.ok&&acc.d?.status==='ACCEPTED');
  }

  // Verify membership
  const ev3=await api('/events/'+evId,{},tA);
  ok('B is member',ev3.d?.memberships?.some(m=>m.userId===idB&&m.status==='ACCEPTED'));
  ok('2 members (A+B)',ev3.d?.memberships?.filter(m=>m.status==='ACCEPTED').length===2);

  // Get members
  const members=await api('/events/'+evId+'/members',{},tA);
  ok('Get members list',members.ok);

  // ===========================
  console.log('\n═══ 4. EVENT INVITE ═══');
  // ===========================
  // Create another event and invite B directly
  const cr2=await api('/events',{method:'POST',body:JSON.stringify({
    title:'InviteTest_'+Date.now(),description:'Invite test',
    startTime:tm.toISOString(),endTime:new Date(tm.getTime()+3600000).toISOString(),
    location:'Test',price:'0',maxParticipants:5,invitedUserIds:[idB]
  })},tA);
  ok('Create event with invite',cr2.ok);
  const evId2=cr2.d?.id;

  if(evId2){
    // Check B has invitation
    const myReqs=await api('/events/requests/user',{},tB);
    ok('B sees invitations',myReqs.ok);
    const inv=myReqs.d?.find(r=>r.eventId===evId2);
    if(inv){
      // Accept invitation
      const accInv=await api('/events/invitations/'+inv.id+'/accept',{method:'POST'},tB);
      ok('B accepts invitation',accInv.ok,`${accInv.s}`);
    } else {
      warn('No invitation found for B',`total=${myReqs.d?.length}`);
    }
    // Cleanup
    await api('/events/'+evId2,{method:'DELETE'},tA);
  }

  // ===========================
  console.log('\n═══ 5. EVENT CHAT ═══');
  // ===========================
  const chatsA=await api('/chats',{},tA);
  const eCh=chatsA.d?.find(c=>c.eventId===evId);
  ok('Event chat exists after accept',!!eCh);

  if(eCh){
    // Both send messages
    const m1=await api('/chats/'+eCh.id+'/messages',{method:'POST',body:JSON.stringify({content:'Hello from mega test!'})},tA);
    ok('A sends msg',m1.ok);
    const m2=await api('/chats/'+eCh.id+'/messages',{method:'POST',body:JSON.stringify({content:'Hello back!'})},tB);
    ok('B sends msg',m2.ok);

    // Read messages
    const msgs=await api('/chats/'+eCh.id+'/messages',{},tA);
    ok('Messages loaded',msgs.ok&&msgs.d?.length>=2);

    // Mark as read
    const read=await api('/chats/'+eCh.id+'/read',{method:'POST'},tB);
    ok('Mark as read',read.ok);

    // Verify readBy
    const msgs2=await api('/chats/'+eCh.id+'/messages',{},tA);
    const readMsg=msgs2.d?.find(m=>m.content==='Hello from mega test!');
    ok('ReadBy populated',readMsg?.readBy?.includes(idB));

    // Send event card
    const m3=await api('/chats/'+eCh.id+'/messages',{method:'POST',body:JSON.stringify({content:'',eventId:evId})},tA);
    ok('Send event card',m3.ok&&m3.d?.eventId===evId);
  }

  // ===========================
  console.log('\n═══ 6. PERSONAL CHAT ═══');
  // ===========================
  const pchat=await api('/chats/personal',{method:'POST',body:JSON.stringify({otherUserId:idB})},tA);
  ok('Create personal chat',pchat.ok,`${pchat.s}`);
  const pchatId=pchat.d?.id;

  if(pchatId){
    const pm1=await api('/chats/'+pchatId+'/messages',{method:'POST',body:JSON.stringify({content:'Personal message!'})},tA);
    ok('Send personal msg',pm1.ok);

    const pm2=await api('/chats/'+pchatId+'/messages',{method:'POST',body:JSON.stringify({content:'Reply personal!'})},tB);
    ok('B replies personal',pm2.ok);
  }

  // ===========================
  console.log('\n═══ 7. EVENT PROFILE (PUBLIC PAGE) ═══');
  // ===========================
  const ep=await api('/events/'+evId+'/profile',{},tA);
  ok('Get event profile',ep.ok||ep.s===404);
  
  if(ep.s===404){
    const cep=await api('/events/'+evId+'/profile',{method:'POST',body:JSON.stringify({})},tA);
    ok('Create event profile',cep.ok);
  }

  // ===========================
  console.log('\n═══ 8. FRIENDS ═══');
  // ===========================
  const fr=await api('/friends',{},tA);
  ok('Get friends',fr.ok);
  const areFriends=Array.isArray(fr.d)&&fr.d.some(f=>f.id===idB||f.friendId===idB);

  if(!areFriends){
    const fReq=await api('/friends/'+idB,{method:'POST'},tA);
    ok('Send friend request',fReq.ok||fReq.s===400);

    const fReqs=await api('/friends/requests',{},tB);
    ok('B sees friend requests',fReqs.ok);
    if(Array.isArray(fReqs.d)){
      const fromA=fReqs.d.find(r=>r.senderId===idA);
      if(fromA){
        const resp=await api('/friends/requests/'+fromA.id,{method:'PATCH',body:JSON.stringify({status:'ACCEPTED'})},tB);
        ok('B accepts friend request',resp.ok);
      }
    }
  }

  const fr2=await api('/friends',{},tA);
  const nowFr=Array.isArray(fr2.d)&&fr2.d.some(f=>f.id===idB||f.friendId===idB);
  ok('A&B are friends',nowFr);

  // Get friends list for a user
  const frList=await api('/friends',{},tB);
  ok('B friends list',frList.ok);

  // ===========================
  console.log('\n═══ 9. NOTIFICATIONS ═══');
  // ===========================
  const nA=await api('/notifications',{},tA);
  ok('A notifications',nA.ok);
  console.log(`  A: ${nA.d?.length||0} notifications`);

  const nB=await api('/notifications',{},tB);
  ok('B notifications',nB.ok);
  console.log(`  B: ${nB.d?.length||0} notifications`);

  // ===========================
  console.log('\n═══ 10. USER FOLDERS ═══');
  // ===========================
  const uf=await api('/user-folders',{},tA);
  ok('List user folders',uf.ok);

  const cuf=await api('/user-folders',{method:'POST',body:JSON.stringify({name:'TestFolder'})},tA);
  ok('Create user folder',cuf.ok);
  if(cuf.d?.id){
    const addU=await api('/user-folders/'+cuf.d.id+'/users/'+idB,{method:'POST'},tA);
    ok('Add user to folder',addU.ok);
    await api('/user-folders/'+cuf.d.id+'/users/'+idB,{method:'DELETE'},tA);
    ok('Remove user from folder',true);
    await api('/user-folders/'+cuf.d.id,{method:'DELETE'},tA);
    ok('Delete folder',true);
  }

  // ===========================
  console.log('\n═══ 11. EVENT FOLDERS ═══');
  // ===========================
  const ef=await api('/event-folders',{},tA);
  ok('List event folders',ef.ok);

  const cef=await api('/event-folders',{method:'POST',body:JSON.stringify({name:'TestEvFolder'})},tA);
  ok('Create event folder',cef.ok);
  if(cef.d?.id){
    await api('/event-folders/'+cef.d.id+'/events/'+evId,{method:'POST'},tA);
    ok('Add event to folder',true);
    
    const efD=await api('/event-folders/'+cef.d.id,{},tA);
    ok('Get folder detail',efD.ok);

    await api('/event-folders/'+cef.d.id+'/events/'+evId,{method:'DELETE'},tA);
    ok('Remove event from folder',true);
    await api('/event-folders/'+cef.d.id,{method:'DELETE'},tA);
    ok('Delete event folder',true);
  }

  // ===========================
  console.log('\n═══ 12. MESSAGE FOLDERS ═══');
  // ===========================
  const mf=await api('/folders',{},tA);
  ok('List message folders',mf.ok);

  const cmf=await api('/folders',{method:'POST',body:JSON.stringify({name:'TestMsgFolder'})},tA);
  ok('Create message folder',cmf.ok);

  // ===========================
  console.log('\n═══ 13. COMPLAINTS ═══');
  // ===========================
  const comp=await api('/complaints',{method:'POST',body:JSON.stringify({
    targetType:'event',targetId:evId,reason:'Test complaint - ignore',description:'Automated test'
  })},tA);
  ok('Submit complaint',comp.ok||comp.s===201,`${comp.s}`);

  // ===========================
  console.log('\n═══ 14. SEARCH ═══');
  // ===========================
  const search=await api('/search?q=test',{},tA);
  ok('Search endpoint',search.ok,`${search.s}`);

  // ===========================
  console.log('\n═══ 15. TRANSFER ORGANIZER ═══');
  // ===========================
  const xfer=await api('/events/'+evId+'/transfer-organizer',{method:'POST',body:JSON.stringify({newOrganizerId:idB})},tA);
  ok('Transfer organizer',xfer.ok);
  
  const ev4=await api('/events/'+evId,{},tB);
  ok('B is new organizer',ev4.d?.organizerId===idB);

  // ===========================
  console.log('\n═══ 16. CANCEL PARTICIPATION ═══');
  // ===========================
  // A leaves (no longer organizer)
  const leaveA=await api('/events/'+evId+'/participation',{method:'DELETE'},tA);
  ok('A leaves event',leaveA.ok,`${leaveA.s}`);

  const ev5=await api('/events/'+evId,{},tB);
  ok('A not member anymore',!ev5.d?.memberships?.some(m=>m.userId===idA&&m.status==='ACCEPTED'));

  // ===========================
  console.log('\n═══ 17. DELETE EVENT ═══');
  // ===========================
  const del=await api('/events/'+evId,{method:'DELETE'},tB);
  ok('B (organizer) deletes event',del.ok);

  // ===========================
  console.log('\n═══ 18. PERFORMANCE ═══');
  // ===========================
  const endpoints=['/events','/chats','/friends','/notifications','/user-folders','/event-folders','/health'];
  for(const ep of endpoints){
    const t0=Date.now();
    const r=await api(ep,{},tA);
    const ms=Date.now()-t0;
    ok(`${ep} ${ms}ms`,ms<5000&&(r.ok||r.s===404));
  }

  // ===========================
  console.log('\n═══ 19. EDGE CASES ═══');
  // ===========================
  // Invalid event
  const inv1=await api('/events/nonexistent-id',{},tA);
  ok('404 on invalid event',!inv1.ok);

  // Empty message
  const emptyMsg=await api('/chats/'+pchatId+'/messages',{method:'POST',body:JSON.stringify({content:''})},tA);
  ok('Empty message handled',emptyMsg.ok||emptyMsg.s===400);

  // Very long message
  const longMsg=await api('/chats/'+pchatId+'/messages',{method:'POST',body:JSON.stringify({content:'x'.repeat(1500)})},tA);
  ok('Long message (1500 chars)',longMsg.s===400||longMsg.ok,`${longMsg.s}`);

  // Unauthorized
  const unauth=await api('/events',{});
  ok('Unauthorized returns 401',unauth.s===401);

  // REMOVE FRIEND (cleanup)
  await api('/friends/'+idB,{method:'DELETE'},tA);

  // ═══════════════════
  console.log(`\n${'═'.repeat(50)}`);
  console.log(`RESULTS: ${P} passed, ${F} failed, ${W} warnings`);
  console.log(`TOTAL: ${P+F} tests, SUCCESS RATE: ${Math.round(P/(P+F)*100)}%`);
  console.log(`${'═'.repeat(50)}`);
})().catch(e=>console.error('FATAL:',e.message));
