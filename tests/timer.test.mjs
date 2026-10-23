import test from 'node:test';
import assert from 'node:assert/strict';
import {createTimer,remainingTime,startTimer,pauseTimer,resetTimer,addTime,advanceTimer,restoreTimer,formatTime,MAX_DURATION} from '../timer-core.mjs';
test('백그라운드에서 틱이 누락되어도 실제 종료 시각을 기준으로 남은 시간 계산',()=>{
  const s=startTimer(createTimer(7200000),100000);
  assert.equal(remainingTime(s,3700000),3600000);
  const end=advanceTimer(s,9000000);assert.equal(end.state.status,'finished');assert.equal(end.event,'finished');
  assert.equal(advanceTimer(end.state,9000100).event,null);
});
test('일시정지 동안 시간을 차감하지 않고 정확히 재개',()=>{
  const s=pauseTimer(startTimer(createTimer(60000),1000),11000);
  assert.equal(s.remainingMs,50000);assert.equal(remainingTime(s,500000),50000);
  const resumed=startTimer(s,500000);assert.equal(resumed.deadline,550000);assert.equal(remainingTime(resumed,510000),40000);
});
test('새로고침 시 실행 상태·일시정지 상태·이미 끝난 상태 복원',()=>{
  const s=startTimer(createTimer(30000),1000);
  assert.equal(remainingTime(restoreTimer(JSON.parse(JSON.stringify(s)),12000),12000),19000);
  assert.equal(restoreTimer(s,32000).status,'finished');
  assert.equal(restoreTimer(pauseTimer(s,11000),999999).remainingMs,20000);
});
test('중간 알림이 중복되지 않으며 놓친 여러 알림을 한 번으로 처리',()=>{
  let s=startTimer(createTimer(7200000,1800000),1000);
  let next=advanceTimer(s,1801000);assert.equal(next.event,'reminder');assert.equal(next.state.lastReminder,1);
  assert.equal(advanceTimer(next.state,1801250).event,null);
  next=advanceTimer(next.state,5501000);assert.equal(next.event,'reminder');assert.equal(next.state.lastReminder,3);
  assert.equal(advanceTimer(next.state,7201000).event,'finished');
});
test('5분 추가는 진행 시간과 중간 알림 기준을 유지',()=>{
  const s=addTime(startTimer(createTimer(3600000,1800000),1000),300000,601000);
  assert.equal(s.durationMs,3900000);assert.equal(remainingTime(s,601000),3300000);
  assert.equal(s.durationMs-remainingTime(s,601000),600000);
  const paused=addTime(pauseTimer(s,601000),300000,999999);assert.equal(paused.remainingMs,3600000);
});
test('초기화·완료 후 재시작·시간 표시·최대 시간',()=>{
  let s=advanceTimer(startTimer(createTimer(1000),1000),2000).state;
  assert.equal(startTimer(s,5000).deadline,6000);
  assert.equal(resetTimer(s).status,'idle');assert.equal(resetTimer(s).remainingMs,1000);
  assert.equal(formatTime(7199999),'02:00:00');assert.equal(formatTime(0),'00:00:00');
  assert.equal(addTime(startTimer(createTimer(MAX_DURATION-1000),1000),300000,1000).durationMs,MAX_DURATION);
  assert.throws(()=>createTimer(0));assert.throws(()=>createTimer(MAX_DURATION+1000));
});
test('잘못되거나 오래된 저장값은 안전한 기본 타이머로 복원',()=>{
  assert.equal(restoreTimer({version:99}).durationMs,7200000);
  assert.equal(restoreTimer({...createTimer(),status:'running',deadline:null}).status,'idle');
  assert.equal(restoreTimer({...createTimer(),remainingMs:-100}).status,'idle');
});
