import { createPreset, compareSchedules, buildExport } from './scheduling.mjs';
const $ = id => document.getElementById(id);
const colors = ['#2353c6', '#c9472d', '#1e695b', '#7146a2', '#a06512', '#294f76', '#a23867', '#47631d'];
let jobs = createPreset(), results;
const color = id => colors[(id.charCodeAt(0) - 65) % colors.length];
const names = { specialists: '机器各有所长', priority: '一个高权重订单', equal: '完全相同的订单' };

function button(label, action, disabled = false) {
  const b = document.createElement('button'); b.type = 'button'; b.textContent = label; b.disabled = disabled; b.addEventListener('click', action); return b;
}
function renderInputs(focus) {
  $('jobs').replaceChildren();
  jobs.forEach((job, index) => {
    const row = document.createElement('tr');
    const title = document.createElement('th'); title.scope = 'row';
    const tag = document.createElement('span'); tag.className = 'job-label'; tag.style.setProperty('--job-color', color(job.id)); tag.textContent = job.id; title.append(tag); row.append(title);
    for (const [key, value, label, max] of [['p0',job.processing[0],'机器 1 工时',20],['p1',job.processing[1],'机器 2 工时',20],['weight',job.weight,'权重',10]]) {
      const td = document.createElement('td'), input = document.createElement('input');td.dataset.label=label;
      input.type = 'number'; input.min = '1'; input.max = String(max); input.step = '1'; input.value = value;
      input.dataset.job = job.id; input.dataset.key = key; input.setAttribute('aria-label', `订单 ${job.id} ${label}`);
      input.addEventListener('input', recalculate); td.append(input); row.append(td);
    }
    const td = document.createElement('td'), actions = document.createElement('div'); actions.className = 'row-actions';
    const up = button('↑', () => move(index, -1), index === 0); up.setAttribute('aria-label', `将订单 ${job.id} 上移`);
    const down = button('↓', () => move(index, 1), index === jobs.length - 1); down.setAttribute('aria-label', `将订单 ${job.id} 下移`);
    const remove = button('×', () => {if(!recalculate())return;jobs.splice(index,1);renderInputs(jobs[Math.min(index,jobs.length-1)].id);recalculate('已移除订单。');}, jobs.length === 1); remove.setAttribute('aria-label', `移除订单 ${job.id}`);
    actions.append(up,down,remove); td.append(actions); row.append(td); $('jobs').append(row);
  });
  $('add').disabled = jobs.length >= 8;
  if (focus) document.querySelector(`input[data-job="${focus}"]`)?.focus();
}
function move(index, offset) {
  if(!recalculate())return;
  const id = jobs[index].id;
  [jobs[index], jobs[index+offset]] = [jobs[index+offset],jobs[index]];
  renderInputs(id); recalculate('输入顺序已改变。');
}

function metrics(element, result) {
  element.replaceChildren(); const box = document.createElement('div'); box.className = 'metrics';
  for (const [value, label] of [[result.objective,'加权完工时间'],[result.makespan,'总工期'],[result.completionSum,'完工时间总和']]) {
    const item = document.createElement('div'), strong = document.createElement('strong'), span = document.createElement('span'); strong.textContent = value; span.textContent = label; item.append(strong,span); box.append(item);
  }
  element.append(box);
}
function chart(element, result, horizon) {
  element.replaceChildren(); const inner = document.createElement('div'); inner.className = 'chart-inner';
  const axis = document.createElement('div'); axis.className = 'axis';
  for (let i = 0; i <= 5; i++) {const mark = document.createElement('span');mark.textContent = Math.round(horizon*i/5);axis.append(mark);} inner.append(axis);
  result.lanes.forEach((tasks,machine) => {
    const lane = document.createElement('div'), label = document.createElement('span'), track = document.createElement('div');
    lane.className = 'lane'; label.className = 'lane-label'; label.textContent = `机器 ${machine+1}`; track.className = 'track';
    if (!tasks.length) {const empty = document.createElement('span');empty.className = 'idle-label';empty.textContent = '空闲';track.append(empty);}
    for (const task of tasks) {
      const bar = document.createElement('div');bar.className = 'bar';bar.style.left = `${task.start/horizon*100}%`;bar.style.width = `${task.duration/horizon*100}%`;bar.style.setProperty('--job-color',color(task.id));
      const info = `订单 ${task.id}，机器 ${machine+1}，开始 ${task.start}，完工 ${task.completion}，工时 ${task.duration}，权重 ${task.weight}`;
      bar.setAttribute('role','img');bar.setAttribute('aria-label',info);bar.title = info;
      const text = document.createElement('span');text.textContent = task.id;bar.append(text);track.append(bar);
    }
    lane.append(label,track);inner.append(lane);
  }); element.append(inner);
}
function detailTable(element, result) {
  element.replaceChildren();const table = document.createElement('table');table.className = 'details-table';
  const header = document.createElement('thead'), row = document.createElement('tr');
  ['订单','机器','开始','完工 C','权重 w','w × C'].forEach(label=>{const th=document.createElement('th');th.scope='col';th.textContent=label;row.append(th);});header.append(row);table.append(header);
  const body = document.createElement('tbody');
  const tasks = result.lanes.flat();
  jobs.forEach(job=>{const task=tasks.find(t=>t.id===job.id),tr=document.createElement('tr');[task.id,task.machine+1,task.start,task.completion,task.weight,task.weightedCompletion].forEach(value=>{const td=document.createElement('td');td.textContent=value;tr.append(td);});body.append(tr);});table.append(body);element.append(table);
}
function recalculate(message) {
  if (typeof message !== 'string') message = '';
  let invalid;
  const candidate = jobs.map(job => ({...job,processing:[...job.processing]}));
  for (const input of $('jobs').querySelectorAll('input')) {
    const value = input.valueAsNumber, max = Number(input.max), ok = Number.isInteger(value) && value >= 1 && value <= max;
    input.setAttribute('aria-invalid',String(!ok));
    if (!ok) {invalid ||= input;continue;}
    const job = candidate.find(j=>j.id===input.dataset.job);
    if (input.dataset.key==='weight') job.weight=value;else job.processing[Number(input.dataset.key[1])]=value;
  }
  if (invalid) {results = null; $('comparison').hidden = true; $('export').disabled = true; $('status').classList.add('error'); $('status').textContent = `${invalid.getAttribute('aria-label')}需要填写 1–${invalid.max} 的整数。结果暂不显示，请修正输入。`; return false;}
  jobs = candidate; results = compareSchedules(jobs); $('comparison').hidden = false; $('export').disabled = false; $('status').classList.remove('error');
  metrics($('baseline-metrics'),results.baseline);metrics($('optimized-metrics'),results.optimized);
  const horizon = Math.max(5,Math.ceil(Math.max(results.baseline.makespan,results.optimized.makespan)/5)*5);
  chart($('baseline-chart'),results.baseline,horizon);chart($('optimized-chart'),results.optimized,horizon);
  detailTable($('baseline-table'),results.baseline);detailTable($('optimized-table'),results.optimized);
  $('assignment-count').textContent=`检查 ${results.optimized.assignmentsChecked} 种分配`;
  const difference=results.baseline.objective-results.optimized.objective;
  const comparison = difference ? `当前合成输入下，加权完工时间从 ${results.baseline.objective} 降到 ${results.optimized.objective}，少 ${difference}。` : '当前合成输入下，直观派单已达到这个模型的最优加权完工时间。';
  $('comparison-note').textContent=comparison+' 总工期是另一个指标，不一定同时下降。';
  $('status').textContent=(message?message+' ':'')+comparison;
  return true;
}
function reset() {jobs=createPreset($('preset').value);renderInputs();recalculate(`已恢复“${names[$('preset').value]}”。`);}
$('preset').addEventListener('change',reset);$('reset').addEventListener('click',reset);
$('add').addEventListener('click',()=>{if(!recalculate())return;const id='ABCDEFGH'.split('').find(id=>!jobs.some(job=>job.id===id));if(!id)return;jobs.push({id,weight:2,processing:[4,5]});renderInputs(id);recalculate('已新增订单。');});
$('export').addEventListener('click',()=>{if(!results)return;const blob=new Blob([JSON.stringify(buildExport(jobs),null,2)+'\n'],{type:'application/json'});const url=URL.createObjectURL(blob),link=document.createElement('a');link.href=url;link.download='scheduling-experiment.json';document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);$('status').textContent='已生成 JSON 下载，包含当前订单、模型与两种安排。';});
renderInputs();recalculate();$('lab').hidden=false;
