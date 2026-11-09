import test from 'node:test';
import assert from 'node:assert/strict';
import { createPreset, compareSchedules, optimizeSchedule, greedySchedule, buildExport } from '../scheduling.mjs';

// Independent reference enumerates all permutations and all split points.
// This visits all labelled machine sequences without using Smith ordering.
function bruteForce(jobs) {
  let best = Infinity;
  function visit(order, remaining) {
    if (remaining.length) { for (const i of remaining) visit([...order,i],remaining.filter(j=>j!==i)); return; }
    for (let split = 0; split <= jobs.length; split++) {
      let objective = 0;
      for (let machine = 0; machine < 2; machine++) {
        let time = 0;
        for (const i of machine === 0 ? order.slice(0,split) : order.slice(split)) {time += jobs[i].processing[machine];objective += time * jobs[i].weight;}
      }
      best = Math.min(best, objective);
    }
  }
  visit([],jobs.map((_,i)=>i)); return best;
}
function verify(jobs,result) {
  const tasks = result.lanes.flat();
  assert.deepEqual(tasks.map(t=>t.id).sort(),jobs.map(j=>j.id).sort());
  let cost=0,completionSum=0,makespan=0;
  result.lanes.forEach((lane,k)=>{let previous=0;for(const task of lane){const job=jobs.find(j=>j.id===task.id);assert.equal(task.machine,k);assert.equal(task.start,previous);assert.equal(task.duration,job.processing[k]);assert.equal(task.completion,task.start+task.duration);assert.equal(task.weight,job.weight);assert.equal(task.weightedCompletion,job.weight*task.completion);previous=task.completion;cost+=task.weightedCompletion;completionSum+=task.completion;makespan=Math.max(makespan,task.completion);}});
  assert.equal(result.objective,cost);assert.equal(result.makespan,makespan);assert.equal(result.completionSum,completionSum);
}

test('all three synthetic presets match exhaustive independent optima',()=>{
  for(const name of ['specialists','priority','equal']){
    const jobs=createPreset(name),result=compareSchedules(jobs);
    verify(jobs,result.baseline);verify(jobs,result.optimized);
    assert.equal(result.optimized.objective,bruteForce(jobs));
    assert.ok(result.optimized.objective<=result.baseline.objective);
    assert.equal(result.optimized.assignmentsChecked,64);
  }
});
test('exact solver matches 60 seeded random cases with 1–6 jobs',()=>{
  let seed=9647;const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/2**32;};
  for(let sample=0;sample<60;sample++){
    const n=1+sample%6,jobs=Array.from({length:n},(_,i)=>({id:'ABCDEFGH'[i],weight:1+Math.floor(random()*10),processing:[1+Math.floor(random()*20),1+Math.floor(random()*20)]}));
    const result=compareSchedules(jobs);verify(jobs,result.optimized);verify(jobs,result.baseline);
    assert.equal(result.optimized.objective,bruteForce(jobs));
    assert.ok(result.optimized.objective<=result.baseline.objective);
  }
});
test('single job uses fastest machine and equal jobs tie deterministically',()=>{
  const one=[{id:'A',weight:10,processing:[20,1]}];
  const result=optimizeSchedule(one);assert.equal(result.objective,10);assert.equal(result.lanes[1][0].completion,1);
  const equal=createPreset('equal');assert.deepEqual(optimizeSchedule(equal),optimizeSchedule(equal));
  assert.equal(optimizeSchedule(equal).objective,48);assert.equal(greedySchedule(equal).objective,48);
});
test('exactness means weighted completion, which can increase makespan',()=>{
  const jobs=[{id:'A',weight:6,processing:[3,4]},{id:'B',weight:5,processing:[2,6]},{id:'C',weight:3,processing:[1,7]},{id:'D',weight:4,processing:[6,7]}];
  const result=compareSchedules(jobs);verify(jobs,result.optimized);
  assert.equal(result.optimized.objective,bruteForce(jobs));
  assert.equal(result.baseline.objective,89);assert.equal(result.optimized.objective,78);
  assert.equal(result.baseline.makespan,7);assert.equal(result.optimized.makespan,9);
});
test('8 jobs use at most 256 assignments and extreme inputs remain valid',()=>{
  const jobs=Array.from({length:8},(_,i)=>({id:'ABCDEFGH'[i],weight:10,processing:[20,20]}));
  const result=optimizeSchedule(jobs);verify(jobs,result);assert.equal(result.assignmentsChecked,256);assert.equal(result.objective,2 * 10 * (20+40+60+80));assert.equal(result.makespan,80);
});
test('invalid IDs, lengths, weights and processing values are rejected',()=>{
  const valid={id:'A',weight:1,processing:[1,2]};
  for(const jobs of [[],null,Array(9).fill(valid),[valid,valid],[{...valid,id:'<script>'}],[{...valid,weight:0}],[{...valid,weight:11}],[{...valid,weight:1.5}],[{...valid,weight:NaN}],[{...valid,processing:[1]}],[{...valid,processing:[0,1]}],[{...valid,processing:[1,21]}],[{...valid,processing:['2',1]}]])assert.throws(()=>optimizeSchedule(jobs),TypeError);
});
test('no mutation, order invariance of optimum, and JSON replay',()=>{
  const jobs=createPreset(),before=structuredClone(jobs),result=compareSchedules(jobs);
  assert.deepEqual(jobs,before);assert.equal(optimizeSchedule([...jobs].reverse()).objective,result.optimized.objective);
  const saved=JSON.parse(JSON.stringify(buildExport(jobs)));assert.deepEqual(compareSchedules(saved.jobs),result);
  saved.jobs[0].processing[0]=20;assert.deepEqual(jobs,before);
});
