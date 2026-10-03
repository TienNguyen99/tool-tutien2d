await (window.__leonReady||Promise.resolve());
const icon=name=>{const template=document.createElement('template');template.innerHTML=leonIcons[name]||leonIcons.sparkles;const svg=template.content.firstElementChild;svg.classList.add('leon-icon');svg.setAttribute('aria-hidden','true');svg.setAttribute('focusable','false');return svg;};
const bindings=[['.install-download','download'],['.install-brand','shield'],['.install-header .chip','arrow-left'],['.install-steps .chip','external-link'],['.install-link','download'],['a[href="quest-line.html"]','scroll-text'],['a[href="patch-notes.html"]','scroll-text'],['#returnGame','external-link'],['#startQuestAuto','play'],['#startFarmAuto','swords'],['#stopGameAuto','square'],['#backgroundRun','monitor'],['.log-actions [data-action="pause"]','pause'],['.log-actions [data-action="copy"]','copy'],['.log-actions [data-action="clear"]','square'],['.control-rail>details>summary','settings'],['.log-heading strong','scroll-text'],['.brand-mark','shield'],['.control-avatar','shield'],['.control-vital:has(#controlHp)>span','heart'],['.control-vital:has(#controlSp)>span','sparkles'],['.control-vital:has(#controlQuest)>span','scroll-text'],['.control-vital:has(#controlTarget)>span','target']];
function decorate(){
  for(const [selector,name] of bindings)for(const el of document.querySelectorAll(selector)){
    if(el.querySelector('.leon-icon'))continue;
    let label=el.textContent.replace(/^[仙✦▶⚔■✓↩←▣]+\s*/u,'').trim();if(selector==='.brand-mark'||selector==='.control-avatar')label='';
    el.replaceChildren(icon(name),document.createTextNode(label));
  }
  for(const [id,color] of [['controlHp','hp'],['controlSp','sp']]){
    const value=document.getElementById(id);if(!value)continue;const cell=value.closest('.control-vital');cell.classList.add('vital-'+color);
    let bar=cell.querySelector('.vital-meter');if(!bar){bar=document.createElement('div');bar.className='vital-meter';bar.innerHTML='<i></i>';bar.setAttribute('role','progressbar');bar.setAttribute('aria-label',color==='hp'?'Khí huyết':'Thần thức');cell.append(bar);}
    const parts=value.textContent.split('/').map(v=>Number(v.replace(/[^\d.]/g,'')));const known=parts.length===2&&parts[1]>0;const percent=known?Math.max(0,Math.min(100,parts[0]/parts[1]*100)):0;
    bar.firstElementChild.style.width=percent+'%';bar.setAttribute('aria-valuemin','0');bar.setAttribute('aria-valuemax','100');if(known)bar.setAttribute('aria-valuenow',String(Math.round(percent)));else bar.removeAttribute('aria-valuenow');cell.classList.toggle('vital-danger',color==='hp'&&known&&percent<=30);
  }
  const heading=document.querySelector('#auto>.view-head h2');if(heading&&heading.textContent!=='Điều khiển game')heading.textContent='Điều khiển game';
}
let queued=false;const observe=new MutationObserver(()=>{if(queued)return;queued=true;requestAnimationFrame(()=>{queued=false;decorate();});});
decorate();observe.observe(document.body,{childList:true,subtree:true});
