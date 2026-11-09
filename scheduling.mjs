/** Two unrelated machines, all jobs released at zero; minimize sum(weight * completion). */
export function validateJobs(jobs) {
  if (!Array.isArray(jobs) || jobs.length < 1 || jobs.length > 8) throw new TypeError('Provide 1–8 jobs.');
  const ids = new Set();
  for (const job of jobs) {
    if (!job || typeof job.id !== 'string' || !/^[A-Za-z0-9_-]{1,12}$/.test(job.id) || ids.has(job.id)) throw new TypeError('Job identifiers must be unique and contain 1–12 letters, digits, underscores or hyphens.');
    ids.add(job.id);
    if (!Number.isInteger(job.weight) || job.weight < 1 || job.weight > 10 || !Array.isArray(job.processing) || job.processing.length !== 2 || !job.processing.every(p => Number.isInteger(p) && p >= 1 && p <= 20)) throw new TypeError('Weight must be 1–10 and each processing time 1–20 (integers).');
  }
}

function makeSchedule(jobs, sequences) {
  const lanes = sequences.map((indices, machine) => {
    let time = 0;
    return indices.map(index => {
      const job = jobs[index], start = time;
      time += job.processing[machine];
      return { id: job.id, machine, start, completion: time, duration: job.processing[machine], weight: job.weight, weightedCompletion: job.weight * time };
    });
  });
  return { lanes, objective: lanes.flat().reduce((sum, job) => sum + job.weightedCompletion, 0), makespan: Math.max(0, ...lanes.flat().map(job => job.completion)), completionSum: lanes.flat().reduce((sum, job) => sum + job.completion, 0) };
}

export function greedySchedule(jobs) {
  validateJobs(jobs);
  const sequences = [[], []], loads = [0, 0];
  for (let i = 0; i < jobs.length; i++) {
    const next = jobs[i].processing.map((p, k) => p + loads[k]);
    const machine = next[0] <= next[1] ? 0 : 1;
    sequences[machine].push(i); loads[machine] = next[machine];
  }
  return { ...makeSchedule(jobs, sequences), method: 'input-order earliest-completion dispatch' };
}

export function optimizeSchedule(jobs) {
  validateJobs(jobs);
  const count = 2 ** jobs.length;
  let best;
  // Every assignment is enumerated. Smith's pairwise-interchange rule exactly orders each subset.
  for (let mask = 0; mask < count; mask++) {
    const sequences = [[], []];
    jobs.forEach((job, i) => sequences[(mask >> i) & 1].push(i));
    sequences.forEach((indices, machine) => indices.sort((a, b) => {
      const left = jobs[a].processing[machine] * jobs[b].weight;
      const right = jobs[b].processing[machine] * jobs[a].weight;
      return left - right || jobs[a].id.localeCompare(jobs[b].id, 'en');
    }));
    const candidate = makeSchedule(jobs, sequences);
    if (!best || candidate.objective < best.objective) best = candidate;
  }
  return { ...best, method: 'exact assignment enumeration with Smith ordering', assignmentsChecked: count, optimalForModel: true };
}

export function compareSchedules(jobs) {
  return { baseline: greedySchedule(jobs), optimized: optimizeSchedule(jobs) };
}

export function createPreset(name = 'specialists') {
  const jobs = [
    { id: 'A', weight: 2, processing: [3, 8] },
    { id: 'B', weight: 1, processing: [8, 3] },
    { id: 'C', weight: 4, processing: [4, 6] },
    { id: 'D', weight: 2, processing: [6, 2] },
    { id: 'E', weight: 5, processing: [2, 5] },
    { id: 'F', weight: 3, processing: [5, 4] },
  ];
  if (name === 'priority') { jobs[0].weight = 1; jobs[1].weight = 1; jobs[2].weight = 1; jobs[3].weight = 1; jobs[4].weight = 1; jobs[5].weight = 10; }
  else if (name === 'equal') jobs.forEach(job => { job.weight = 1; job.processing = [4, 4]; });
  else if (name !== 'specialists') throw new TypeError('Unknown preset.');
  return jobs;
}

export function buildExport(jobs) {
  const result = compareSchedules(jobs);
  return { schemaVersion: '1.0', application: 'Engineering Optimization Examples', model: { machines: 2, releaseTime: 0, preemption: false, setupTime: 0, objective: 'sum(weight * completion)', timeUnit: 'synthetic time unit', weightUnit: 'dimensionless priority', limits: { jobs: 8, processing: [1, 20], weight: [1, 10] } }, jobs: jobs.map(job => ({ ...job, processing: [...job.processing] })), ...result, notice: 'AI-assisted synthetic teaching example; exact only under the listed model. Not a reproduction of a coursework result or a production scheduler.' };
}
