export const categories={personal:{label:'Pessoal',color:'#b6c99b',emoji:'🌿'},work:{label:'Trabalho',color:'#d3b18b',emoji:'💼'},study:{label:'Faculdade',color:'#a9afd0',emoji:'📚'},health:{label:'Saúde',color:'#8dbdb3',emoji:'🏃'}};
export const types={task:'Tarefa',event:'Evento',goal:'Meta',reminder:'Lembrete'};
export const defaults={seconds:true,returnMinutes:5,weekStart:0,clock24:true,pinned:false,brightness:100,scale:125,home:'agenda'};
export function dayKey(date=new Date()){return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`}
export function parseDay(s){const [y,m,d]=s.split('-').map(Number);return new Date(y,m-1,d,12)}
export function validDay(s){return typeof s==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(s)&&dayKey(parseDay(s))===s}
export function normalizeItem(x){
 if(!x||typeof x!=='object'||typeof x.title!=='string'||!x.title.trim()||x.title.length>160||!validDay(x.date)||!types[x.type]||!categories[x.category])throw Error('Item inválido: título, data, tipo ou categoria.');
 for(const k of ['time','endTime'])if(x[k]&&!/^([01]\d|2[0-3]):[0-5]\d$/.test(x[k]))throw Error('Horário inválido.');
 if(x.endTime&&(!x.time||x.endTime<x.time))throw Error('O horário final deve ser igual ou posterior ao inicial.');
 if(x.id!==undefined&&(typeof x.id!=='string'||!/^[-\w]{1,100}$/.test(x.id)))throw Error('ID inválido.');
 if(x.color!==undefined&&!/^#[0-9a-f]{6}$/i.test(x.color))throw Error('Cor inválida.');
 if(x.notes!==undefined&&(typeof x.notes!=='string'||x.notes.length>2000))throw Error('Notas inválidas.');
 if(x.emoji!==undefined&&(typeof x.emoji!=='string'||x.emoji.length>16))throw Error('Emoji inválido.');
 const progress=Number(x.progress??0);if(!Number.isFinite(progress)||progress<0||progress>100)throw Error('Progresso deve estar entre 0 e 100.');
 return {id:x.id||crypto.randomUUID(),title:x.title.trim(),date:x.date,type:x.type,category:x.category,time:x.time||'',endTime:x.endTime||'',priority:['normal','high','low'].includes(x.priority)?x.priority:'normal',color:x.color||categories[x.category].color,emoji:x.emoji??categories[x.category].emoji,notes:x.notes||'',progress,done:x.done===true,updatedAt:typeof x.updatedAt==='string'?x.updatedAt:new Date().toISOString()};
}
export function parseImport(text,existing=[]){const data=JSON.parse(text);if(data.version!==1||!Array.isArray(data.items)||data.items.length>2000)throw Error('Use o formato versão 1 com até 2.000 itens.');const seen=new Set(existing.map(x=>x.id));let skipped=0;const items=[];for(const raw of data.items){const item=normalizeItem(raw);if(seen.has(item.id)){skipped++;continue}seen.add(item.id);items.push(item)}return{items,skipped}}
export function escapeHTML(s){return String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
