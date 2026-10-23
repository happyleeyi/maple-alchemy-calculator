export const MAX_DURATION = 24 * 60 * 60 * 1000;
export const DEFAULT_DURATION = 2 * 60 * 60 * 1000;
const validDuration = n => Number.isInteger(n) && n >= 1000 && n <= MAX_DURATION;
export function createTimer(durationMs = DEFAULT_DURATION, reminderMs = 0) {
  if (!validDuration(durationMs)) throw new RangeError('시간은 1초부터 24시간까지 설정할 수 있습니다.');
  return {version:1,status:'idle',durationMs,remainingMs:durationMs,deadline:null,reminderMs,lastReminder:0};
}
export function remainingTime(state, now = Date.now()) {
  return state.status === 'running' ? Math.max(0, Math.min(state.durationMs,state.deadline-now)) : state.remainingMs;
}
export function startTimer(state, now = Date.now()) {
  if (state.status === 'running') return state;
  const fresh = state.status === 'finished' ? createTimer(state.durationMs,state.reminderMs) : state;
  return {...fresh,status:'running',deadline:now+fresh.remainingMs};
}
export function pauseTimer(state, now = Date.now()) {
  if (state.status !== 'running') return state;
  const left = remainingTime(state,now);
  return left === 0 ? advanceTimer(state,now).state : {...state,status:'paused',remainingMs:left,deadline:null};
}
export function resetTimer(state) { return createTimer(state.durationMs,state.reminderMs); }
export function addTime(state, ms, now = Date.now()) {
  if (!['running','paused'].includes(state.status) || !Number.isInteger(ms) || ms <= 0) return state;
  const added = Math.min(ms,MAX_DURATION-state.durationMs);
  return {...state,durationMs:state.durationMs+added,remainingMs:remainingTime(state,now)+added,
    deadline:state.status==='running' ? state.deadline+added : null};
}
export function advanceTimer(state, now = Date.now()) {
  if (state.status !== 'running') return {state,event:null};
  const left = remainingTime(state,now);
  if (left === 0) return {state:{...state,status:'finished',remainingMs:0},event:'finished'};
  const reached = state.reminderMs > 0 ? Math.floor((state.durationMs-left)/state.reminderMs) : 0;
  if (reached > state.lastReminder) return {state:{...state,remainingMs:left,lastReminder:reached},event:'reminder'};
  return {state,event:null};
}
export function restoreTimer(saved, now = Date.now()) {
  if (!saved || saved.version!==1 || !validDuration(saved.durationMs) || !['idle','running','paused','finished'].includes(saved.status)) return createTimer();
  if (!Number.isFinite(saved.remainingMs) || saved.remainingMs<0 || saved.remainingMs>saved.durationMs) return createTimer();
  if (saved.status==='running' && (!Number.isFinite(saved.deadline) || saved.deadline<=0)) return createTimer();
  const reminderMs = Number.isInteger(saved.reminderMs) && saved.reminderMs>=60000 && saved.reminderMs<=MAX_DURATION ? saved.reminderMs : 0;
  const safe = {...createTimer(saved.durationMs,reminderMs),status:saved.status,
    remainingMs:saved.remainingMs,deadline:saved.status==='running'||saved.status==='finished' ? saved.deadline : null,
    lastReminder:Number.isInteger(saved.lastReminder)&&saved.lastReminder>=0 ? saved.lastReminder : 0};
  return advanceTimer(safe,now).state;
}
export function formatTime(ms) {
  const seconds = Math.max(0,Math.ceil(ms/1000));
  return [Math.floor(seconds/3600),Math.floor(seconds%3600/60),seconds%60].map(n=>String(n).padStart(2,'0')).join(':');
}
