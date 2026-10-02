import { state, persist } from './state.js';
export function initSettings(onChange) {
  const root = document.querySelector('#safetySettings');
  const groups = [
    ['Khi chết', [['reviveInPlace','Tự hồi sinh tại chỗ rồi tiếp tục auto']]],
    ['AI · quest và hội thoại', [['aiPlanner','Hỏi AI server khi chưa biết chọn gì'],
      ['visionDialogs','Gửi ảnh hội thoại cho AI cục bộ (bấm icon extension trên tab game để cấp quyền)']]],
    ['Hồi máu · thiền Q', [
      ['recoverHealth','Tự tìm chỗ thiền hồi máu'],
      ['recoverHpThreshold','Bắt đầu hồi máu dưới',1,98,'%'],
      ['recoverHpResume','Hồi đủ để tiếp tục',2,100,'%'],
      ['recoverSafeRadius','Khoảng cách an toàn với quái',80,400,'px'],
      ['stopLowHp','Dừng khi máu thấp nếu không dùng hồi máu'],
      ['hpThreshold','Ngưỡng dừng dự phòng',1,99,'%']]],
    ['Rút lui khi bị đánh mạnh', [
      ['retreatEnabled','Cho phép chạy xa'],
      ['retreatHpThreshold','Chỉ chạy khi HP dưới',1,99,'%'],
      ['damageHpThreshold','Mất HP trong 3 giây ít nhất',1,99,'%'],
      ['damageArmorThreshold','Hoặc mất giáp trong 3 giây ít nhất',1,99,'%'],
      ['retreatSeconds','Thời gian chạy tối đa từ đòn mạnh mới nhất',1,15,'s']]],
    ['Hit-and-run · né ngắn', [
      ['hitRunEnabled','Né ngắn sau khi phát đòn'],
      ['kiteMilliseconds','Thời gian né',100,600,'ms'],
      ['kiteDistance','Khoảng lùi tối đa',12,60,'px']]],
    ['Thiền hồi linh lực', [
      ['meditate','Tự thiền khi linh lực thấp'],
      ['spThreshold','Bắt đầu thiền dưới',1,99,'%'],
      ['spResumeThreshold','Tiếp tục khi hồi đủ',2,100,'%']]]
  ];
  let timer;
  const changed = () => {
    persist(); clearTimeout(timer); timer=setTimeout(onChange,300);
  };
  for (const [title,fields] of groups) {
    const group=document.createElement('fieldset'),legend=document.createElement('legend');legend.textContent=title;group.append(legend);
    for (const [key,text,min,max,unit] of fields) {
      const row=document.createElement('label');row.className='setting-row';
      const label=document.createElement('span');label.textContent=text;row.append(label);
      const input=document.createElement('input');input.id=`setting-${key}`;
      if(min==null){input.type='checkbox';input.checked=!!state.autoRules[key];input.onchange=()=>{state.autoRules[key]=input.checked;changed();};row.append(input);}
      else {
        input.type='range';input.min=min;input.max=max;input.step=1;input.value=state.autoRules[key];
        const output=document.createElement('output');output.htmlFor=input.id;output.textContent=`${input.value}${unit}`;
        input.oninput=()=>{
          state.autoRules[key]=Number(input.value);output.textContent=`${input.value}${unit}`;
          for(const [start,end]of [['recoverHpThreshold','recoverHpResume'],['spThreshold','spResumeThreshold']]){
            if(state.autoRules[end]<=state.autoRules[start])state.autoRules[end]=state.autoRules[start]+1;
            const el=root.querySelector(`#setting-${end}`);
            if(el){el.value=state.autoRules[end];el.nextElementSibling.textContent=`${el.value}%`;}
          }
          const oldInput=document.querySelector(`#${key}`);if(oldInput)oldInput.value=input.value;
          changed();
        };
        row.append(input,output);
      }
      group.append(row);
    }
    root.append(group);
  }
}
