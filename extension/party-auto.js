(() => {
  const inside=P=>{const map=P.SceneWorld?.map?.data;return !!map?.huyetSac||['rung_mang_xa','mach_dat_dong','dam_lay_boss'].includes(String(map?.id||''));};
  function create(){
    let partyKey='',joinedAt=null,lastAction=-Infinity,cooldownUntil=0,pendingUntil=0,leaveAttempts=0;
    const invited=new Map();
    function tick(P,active,now=Date.now()){
      const G=P.Gateway,party=G?.party,members=Array.isArray(party?.members)?party.members:[];
      if(!active){partyKey='';joinedAt=null;leaveAttempts=0;return {phase:'idle'};}
      if(inside(P)){partyKey='';joinedAt=null;leaveAttempts=0;return {phase:'inside'};}
      if(!G?.connected||!G?.ready)return {phase:'offline'};
      if(party){const key=String(party.partyId||party.id||'party');if(key!==partyKey){partyKey=key;joinedAt=now;leaveAttempts=0;}}
      else {partyKey='';joinedAt=null;leaveAttempts=0;}
      if(party&&joinedAt!==null&&now-joinedAt>=180000){
        if(now-lastAction>=5000&&leaveAttempts<3&&typeof G.partyLeave==='function'){
          lastAction=now;leaveAttempts++;const sent=G.partyLeave();if(sent)cooldownUntil=now+30000;
          return {phase:'leaving',sent:!!sent,count:members.length};
        }
        return {phase:'leaving',count:members.length};
      }
      if(now<cooldownUntil)return {phase:'cooldown'};
      if(now-lastAction<1500||now<pendingUntil)return {phase:'pending',count:members.length};
      if(!party){
        const invite=(G.partyInviteOrder||[]).map(id=>G.partyPending?.[String(id)]).find(row=>row&&(!row.expiresAt||row.expiresAt>now));
        if(invite&&typeof G.partyAnswer==='function'){
          lastAction=now;const sent=G.partyAnswer(true,invite.inviteId);if(sent)pendingUntil=now+5000;
          return {phase:'accepting',sent:!!sent,name:invite.name||'người chơi'};
        }
      }
      if(members.length>=6)return {phase:'ready',count:members.length};
      if(party&&party.leaderId!==G.selfId)return {phase:'waiting',count:members.length,remaining:Math.max(0,180000-(now-joinedAt))};
      const player=P.SceneWorld?.player;if(!player||typeof G.partyInvite!=='function')return {phase:'waiting',count:members.length};
      const ids=new Set(members.map(row=>String(row.id)));
      const range=Number(P.CONFIG?.PARTY?.INVITE_RANGE)||180;
      const target=Object.entries(G.remotes||{}).filter(([id,row])=>row&&String(id)!==String(G.selfId)&&!ids.has(String(id))&&row.state!=='down'&&row.state!=='downed'&&row.hp!==0&&Number.isFinite(row.x)&&Number.isFinite(row.y)&&Math.hypot(row.x-player.x,row.y-player.y)<=range&&now-(invited.get(id)??-Infinity)>=60000).sort((a,b)=>Math.hypot(a[1].x-player.x,a[1].y-player.y)-Math.hypot(b[1].x-player.x,b[1].y-player.y))[0];
      if(target){if(invited.size>200)for(const [id,at]of invited)if(now-at>60000)invited.delete(id);lastAction=now;invited.set(target[0],now);const sent=G.partyInvite(target[0]);return {phase:'inviting',sent:!!sent,name:target[1].name||target[0],count:members.length};}
      return {phase:'waiting',count:members.length,remaining:joinedAt===null?null:Math.max(0,180000-(now-joinedAt))};
    }
    return {tick};
  }
  window.__tienloPartyAuto={create,inside,...create()};
})();
