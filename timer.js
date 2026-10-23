import {createTimer,remainingTime,startTimer,pauseTimer,resetTimer,addTime,advanceTimer,restoreTimer,formatTime,MAX_DURATION} from './timer-core.mjs';

const $ = selector => document.querySelector(selector);
const $$ = selector => [...document.querySelectorAll(selector)];
const STORAGE_KEY = 'maple-hunt-timer-v1';
const PAGE_TITLE = '재획 타이머 · 메이플 연구실';
const CIRCUMFERENCE = 2*Math.PI*154;
let settings = {sound:true,volume:60,notifications:false};
let timer = createTimer();
let context;
let soundReady = false;
let alarmInterval;
let reminderNoticeTimeout;
let previousStatus;
let storageAvailable = true;
try {
  const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
  if (saved?.version===1) {
    timer = restoreTimer(saved.timer);
    settings = {sound:saved.settings?.sound!==false,
      volume:Number.isFinite(saved.settings?.volume) ? Math.min(100,Math.max(0,saved.settings.volume)) : 60,
      notifications:saved.settings?.notifications===true};
  }
} catch { storageAvailable = false; }
function save() {
  try { localStorage.setItem(STORAGE_KEY,JSON.stringify({version:1,timer,settings})); storageAvailable=true; }
  catch { storageAvailable=false; }
}
function notifyPage(message) {
  $('#notice').textContent=message;
  $('#notice').hidden=false;
  clearTimeout(reminderNoticeTimeout);
  reminderNoticeTimeout=setTimeout(()=>{$('#notice').hidden=true;},10000);
}
function notificationAvailable() { return 'Notification' in window && window.isSecureContext; }
function updateNotificationUI() {
  const available=notificationAvailable();
  const permission=available ? Notification.permission : 'unsupported';
  $('#notification-status').textContent = !available ? '이 브라우저에서는 지원하지 않습니다' : permission==='denied' ? '브라우저에서 차단됨' : settings.notifications && permission==='granted' ? '사용 중' : '사용 안 함';
  $('#notifications').textContent = settings.notifications && permission==='granted' ? '사용 안 함' : '사용 설정';
  $('#notifications').disabled = !available || permission==='denied';
}
function sendNotification(title,body) {
  if (!settings.notifications || !notificationAvailable() || Notification.permission!=='granted') return;
  try {
    const notification = new Notification(title,{body,tag:'maple-hunt-timer',renotify:true});
    notification.onclick = ()=>{ window.focus(); notification.close(); };
  } catch { notifyPage('이 브라우저에서는 시스템 알림을 표시할 수 없습니다. 화면과 소리 알림을 확인해 주세요.'); }
}
function unlockAudio() {
  if (!settings.sound) return;
  try {
    const Audio = window.AudioContext || window.webkitAudioContext;
    if (!Audio) { $('#audio-hint').textContent='이 브라우저에서는 소리를 지원하지 않습니다.'; return; }
    context ??= new Audio();
    if (context.state==='suspended') context.resume().then(()=>{soundReady=context.state==='running'; updateAudioHint();}).catch(()=>{soundReady=false;updateAudioHint();});
    soundReady=context.state==='running';
    updateAudioHint();
  } catch { soundReady=false; updateAudioHint(); }
}
function updateAudioHint() {
  $('#audio-hint').textContent = !settings.sound ? '소리 알림이 꺼져 있습니다.' : soundReady ? '소리가 준비되었습니다. 기기 음량도 확인해 주세요.' : '소리 시험을 눌러 알림음을 준비해 주세요.';
}
function playChime(kind='finished') {
  if (!settings.sound || !context || context.state!=='running') { updateAudioHint(); return false; }
  const start=context.currentTime;
  const notes=kind==='reminder' ? [660,880] : [523.25,659.25,783.99,1046.5];
  notes.forEach((frequency,index)=>{
    const oscillator=context.createOscillator(), gain=context.createGain();
    const at=start+index*.22;
    oscillator.type='sine';oscillator.frequency.value=frequency;
    gain.gain.setValueAtTime(0,at);
    gain.gain.linearRampToValueAtTime((settings.volume/100)*.28,at+.025);
    gain.gain.exponentialRampToValueAtTime(.0001,at+.33);
    oscillator.connect(gain);gain.connect(context.destination);
    oscillator.start(at);oscillator.stop(at+.35);
    oscillator.onended=()=>{oscillator.disconnect();gain.disconnect();};
  });
  return true;
}
function stopAlarm() { clearInterval(alarmInterval); alarmInterval=undefined; }
function finished() {
  $('#silence').textContent='알림 확인';
  playChime();
  sendNotification('재획이 끝났습니다','수고하셨습니다. 물약과 다음 재획을 확인해 주세요.');
  stopAlarm();
  if (settings.sound) {
    let repeats=0;
    alarmInterval=setInterval(()=>{
      if(timer.status!=='finished'||!settings.sound||repeats>=5) { stopAlarm(); return; }
      playChime();repeats++;
    },5000);
  }
}
function tick() {
  const next=advanceTimer(timer);
  timer=next.state;
  if(next.event) {
    save();
    if(next.event==='finished') finished();
    else {
      playChime('reminder');
      const message=`재획 중간 알림 · ${formatTime(remainingTime(timer))} 남았습니다. 물약과 버프를 확인해 주세요.`;
      notifyPage(message);sendNotification('재획 중간 알림',message);
    }
  }
  render();
}
function readableDuration(ms) {
  const seconds=Math.round(ms/1000), h=Math.floor(seconds/3600), m=Math.floor(seconds%3600/60), s=seconds%60;
  return [h?`${h}시간`:'',m?`${m}분`:'',s?`${s}초`:''].filter(Boolean).join(' ') || '0초';
}
function setDurationInputs() {
  const seconds=Math.round(timer.durationMs/1000);
  $('#custom-hours').value=Math.floor(seconds/3600);
  $('#custom-minutes').value=Math.floor(seconds%3600/60);
  $('#custom-seconds').value=seconds%60;
}
function render() {
  const now=Date.now(), left=remainingTime(timer,now), elapsed=timer.durationMs-left;
  const percent=Math.max(0,Math.min(100,elapsed/timer.durationMs*100));
  const text=formatTime(left);
  $('#time-display').textContent=text;
  $('#elapsed').textContent=`진행 ${formatTime(Math.floor(elapsed/1000)*1000)}`;
  $('#progress-percent').textContent=`${Math.floor(percent)}%`;
  $('#progress-fill').style.width=`${percent}%`;
  $('#ring-progress').style.strokeDasharray=String(CIRCUMFERENCE);
  $('#ring-progress').style.strokeDashoffset=String(CIRCUMFERENCE*percent/100);
  $('#duration-label').textContent=readableDuration(timer.durationMs);
  $('#end-time').textContent=timer.status==='running' ? new Date(timer.deadline).toLocaleTimeString('ko-KR',{hour:'2-digit',minute:'2-digit',second:'2-digit',hour12:false}) : timer.status==='paused' ? '재개하면 표시' : timer.status==='finished' ? '재획 완료' : '시작하면 표시';
  const nextReminder=(timer.lastReminder+1)*timer.reminderMs;
  $('#next-reminder').textContent=timer.reminderMs===0 ? '사용 안 함' : timer.status==='finished'||nextReminder>=timer.durationMs ? '이번 재획 없음' : `${formatTime(Math.max(0,nextReminder-elapsed))} 후`;
  document.title=timer.status==='running'||timer.status==='paused' ? `${text} ${timer.status==='paused'?'일시정지':'재획 중'} · 메이플` : timer.status==='finished' ? '재획 완료! · 메이플 연구실' : PAGE_TITLE;
  if(previousStatus!==timer.status) {
    const labels={idle:['시작 준비','물약을 사용한 뒤 시작해 주세요.','▶','재획 시작'],running:['재획 중','좋은 득템이 함께하길 바랍니다.','Ⅱ','일시정지'],paused:['일시정지','잠깐 쉬어 가셔도 괜찮습니다.','▶','이어서 시작'],finished:['재획 완료','수고하셨습니다. 쉬어 가세요.','↻','다시 시작']};
    const [status,message,icon,button]=labels[timer.status];
    $('#status').textContent=status;$('#clock-message').textContent=message;
    $('#start').innerHTML=`${icon} <span>${button}</span>`;
    $('#timer-stage').classList.toggle('finished',timer.status==='finished');
    $('#timer-stage').classList.toggle('paused',timer.status==='paused');
    $('#finish-banner').hidden=timer.status!=='finished';
    const active=['running','paused'].includes(timer.status);
    for(const el of $$('[data-minutes],#custom-hours,#custom-minutes,#custom-seconds,#apply-duration,#reminder,#reminder-minutes')) el.disabled=active;
    $('#add-time').disabled=!active;
    $('#duration-hint').textContent=active ? '시간과 중간 알림을 바꾸려면 초기화를 눌러 주세요.' : '1초부터 24시간까지 설정할 수 있습니다.';
    previousStatus=timer.status;
  }
  $$('[data-minutes]').forEach(el=>{
    const selected=Number(el.dataset.minutes)*60000===timer.durationMs;
    el.classList.toggle('selected',selected);el.setAttribute('aria-pressed',String(selected));
  });
}
$('#start').addEventListener('click',()=>{
  tick();stopAlarm();
  if(timer.status==='running') timer=pauseTimer(timer);
  else { unlockAudio();timer=startTimer(timer); }
  save();render();
});
$('#reset').addEventListener('click',()=>{
  stopAlarm();timer=resetTimer(timer);save();render();$('#notice').hidden=true;$('#silence').textContent='알림 확인';
});
$('#add-time').addEventListener('click',()=>{
  tick();
  const before=timer.durationMs;
  timer=addTime(timer,5*60000);save();setDurationInputs();render();
  notifyPage(before===MAX_DURATION ? '최대 설정 시간은 24시간입니다.' : '재획 시간을 최대 5분 연장했습니다.');
});
$$('[data-minutes]').forEach(button=>button.addEventListener('click',()=>{
  stopAlarm();timer=createTimer(Number(button.dataset.minutes)*60000,timer.reminderMs);
  save();setDurationInputs();render();$('#duration-error').hidden=true;
}));
$('#duration-form').addEventListener('submit',event=>{
  event.preventDefault();
  const values=['#custom-hours','#custom-minutes','#custom-seconds'].map(id=>$(id).value.trim()===''?0:Number($(id).value));
  const [hours,minutes,seconds]=values;
  const duration=(hours*3600+minutes*60+seconds)*1000;
  if(values.some(n=>!Number.isInteger(n)||n<0)||minutes>59||seconds>59||duration<1000||duration>MAX_DURATION) {
    $('#duration-error').textContent='1초부터 24시간까지 설정해 주세요. 분과 초는 0~59입니다.';$('#duration-error').hidden=false;return;
  }
  stopAlarm();timer=createTimer(duration,timer.reminderMs);save();render();$('#duration-error').hidden=true;
});
$('#sound').addEventListener('change',event=>{
  settings.sound=event.target.checked;
  if(!settings.sound) stopAlarm();else unlockAudio();
  save();updateAudioHint();
});
$('#volume').addEventListener('input',event=>{
  settings.volume=Number(event.target.value);$('#volume-value').textContent=`${settings.volume}%`;save();
});
$('#test-sound').addEventListener('click',()=>{
  settings.sound=true;$('#sound').checked=true;save();unlockAudio();
  if(context) Promise.resolve(context.resume()).then(()=>{soundReady=context.state==='running';updateAudioHint();playChime();}).catch(()=>notifyPage('브라우저의 소리 차단 설정을 확인해 주세요.'));
});
function changeReminder() {
  timer={...timer,reminderMs:$('#reminder').checked?Number($('#reminder-minutes').value)*60000:0,lastReminder:0};save();render();
}
$('#reminder').addEventListener('change',changeReminder);
$('#reminder-minutes').addEventListener('change',changeReminder);
$('#notifications').addEventListener('click',async()=>{
  if(!notificationAvailable())return;
  if(settings.notifications&&Notification.permission==='granted') settings.notifications=false;
  else {
    try { const permission=await Notification.requestPermission(); settings.notifications=permission==='granted'; }
    catch { settings.notifications=false;notifyPage('알림을 사용할 수 없습니다. 브라우저 설정을 확인해 주세요.'); }
  }
  save();updateNotificationUI();
});
$('#silence').addEventListener('click',()=>{stopAlarm();$('#silence').textContent='확인했습니다';});
$('#fullscreen').addEventListener('click',async()=>{
  try { if(document.fullscreenElement)await document.exitFullscreen();else await $('#timer-stage').requestFullscreen(); }
  catch { notifyPage('이 브라우저에서는 전체 화면을 열 수 없습니다.'); }
});
document.addEventListener('fullscreenchange',()=>{
  $('#fullscreen').setAttribute('aria-label',document.fullscreenElement?'전체 화면 닫기':'타이머 전체 화면');
  $('#fullscreen').innerHTML=document.fullscreenElement?'⛶ <span>전체 화면 닫기</span>':'⛶ <span>전체 화면</span>';
});
if(!document.fullscreenEnabled)$('#fullscreen').hidden=true;
document.addEventListener('visibilitychange',tick);
window.addEventListener('pageshow',tick);
window.addEventListener('pagehide',save);
$('#sound').checked=settings.sound;$('#volume').value=settings.volume;$('#volume-value').textContent=`${settings.volume}%`;
$('#reminder').checked=timer.reminderMs>0;
if(timer.reminderMs)$('#reminder-minutes').value=timer.reminderMs/60000;
setDurationInputs();updateAudioHint();updateNotificationUI();render();save();
if(!storageAvailable)notifyPage('브라우저 저장 기능을 사용할 수 없어 새로고침하면 타이머가 초기화될 수 있습니다.');
setInterval(tick,250);
