const $ = s => document.querySelector(s);
let emails = [], selected;

const esc = s => String(s || '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const label = t => t === 'important' ? '중요' : t === 'normal' ? '일반' : '낮음';

function playFlap(dialogId) {
  const flap = document.querySelector(`#${dialogId} .dialog-flap`);
  if (!flap) return;
  flap.classList.remove('flap-play');
  requestAnimationFrame(() => requestAnimationFrame(() => flap.classList.add('flap-play')));
}
function updateSky() {
  const now = new Date();
  const pad = n => String(n).padStart(2, '0');
  $('#pmDate').textContent = `${now.getFullYear()}.${pad(now.getMonth() + 1)}.${pad(now.getDate())}`;
  $('#pmTime').textContent = `${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;
}
updateSky();
setInterval(updateSky, 1000);

async function api(path, options) {
  const r = await fetch(path, options);
  const data = await r.json();
  if (!r.ok) throw new Error(data.error);
  return data;
}

function mailCard(e, i = 0) {
  return `<article class="mail ${e.importance}" data-id="${e.id}" style="--stagger:${Math.min(i, 14)}">
    <div class="badges">
      <span class="badge">${label(e.importance)}</span>
      ${e.isCallSummary ? '<span class="badge call-badge">통화요약</span>' : ''}
      ${e.category && e.category !== '기타' ? `<span class="badge cat-badge">${esc(e.category)}</span>` : ''}
      ${e.attachments && e.attachments.length ? `<span class="badge attach-badge">📎 ${e.attachments.length}</span>` : ''}
    </div>
    <h3>${esc(e.subject)}</h3>
    <p class="from">${esc(e.from)}</p>
    <p class="snip">${esc(e.summary || e.snippet)}</p>
    ${e.dueDate ? `<p class="due">기한 · ${esc(e.dueDate)}</p>` : ''}
  </article>`;
}

function renderSummary() {
  const count = t => emails.filter(e => e.importance === t && !e.isVerification).length;
  $('#summary').innerHTML = ['important', 'normal', 'low'].map(t =>
    `<div class="seal ${t}"><span class="dot"></span><div><strong>${count(t)}</strong><span>${label(t)}</span></div></div>`
  ).join('');
}

function renderInbox() {
  const list = emails.filter(e => !e.isVerification);
  $('#emails').innerHTML = list.length
    ? list.map((e, i) => mailCard(e, i)).join('')
    : '<p class="empty">아직 분석한 메일이 없습니다. "최근 30개 분석"을 눌러보세요.</p>';
}

let calMonth = new Date(); calMonth.setDate(1);

function parseDue(str) {
  const t = Date.parse(str);
  return isNaN(t) ? null : new Date(t);
}
function dayKey(d) { return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; }

function renderCalendarGrid() {
  const y = calMonth.getFullYear(), m = calMonth.getMonth();
  $('#calLabel').textContent = `${y}년 ${m + 1}월`;
  const dueMap = new Map();
  emails.filter(e => !e.isVerification).forEach(e => { const d = parseDue(e.dueDate); if (d) { const k = dayKey(d); dueMap.set(k, (dueMap.get(k) || 0) + 1); } });
  const first = new Date(y, m, 1);
  const startOffset = first.getDay();
  const totalDays = new Date(y, m + 1, 0).getDate();
  const todayKey = dayKey(new Date());
  let html = ['일', '월', '화', '수', '목', '금', '토'].map(d => `<div class="cal-dow">${d}</div>`).join('');
  for (let i = 0; i < startOffset; i++) html += '<div class="cal-cell empty-cell"></div>';
  for (let d = 1; d <= totalDays; d++) {
    const k = dayKey(new Date(y, m, d));
    const count = dueMap.get(k) || 0;
    html += `<div class="cal-cell${count ? ' has-due' : ''}${k === todayKey ? ' today' : ''}" data-day="${k}">
      <span class="cal-daynum">${d}</span>
      ${count ? `<span class="cal-dot">${count}</span>` : ''}
    </div>`;
  }
  $('#calGrid').innerHTML = html;
  document.querySelectorAll('.cal-cell.has-due').forEach(cell => {
    cell.onclick = () => {
      const target = document.querySelector(`[data-daygroup="${cell.dataset.day}"]`);
      if (target) target.scrollIntoView({ behavior: 'smooth', block: 'center' });
    };
  });
}

function renderSchedule() {
  renderCalendarGrid();
  const pool = emails.filter(e => !e.isVerification);
  const withDue = pool.filter(e => parseDue(e.dueDate));
  const noDate = pool.filter(e => e.dueDate && !parseDue(e.dueDate));
  if (!withDue.length && !noDate.length) {
    $('#schedule').innerHTML = '<p class="empty">기한이 있는 메일이 여기 날짜순으로 모입니다.</p>';
    return;
  }
  const groups = new Map();
  for (const e of withDue) { const k = dayKey(parseDue(e.dueDate)); if (!groups.has(k)) groups.set(k, []); groups.get(k).push(e); }
  const dates = [...groups.keys()].sort();
  let html = dates.map(k =>
    `<div class="day-group" data-daygroup="${k}"><h4>${esc(k)}</h4><div class="emails">${groups.get(k).map((e, i) => mailCard(e, i)).join('')}</div></div>`
  ).join('');
  if (noDate.length) html += `<div class="day-group"><h4>날짜 확인 필요</h4><div class="emails">${noDate.map((e, i) => mailCard(e, i)).join('')}</div></div>`;
  $('#schedule').innerHTML = html;
}

$('#prevMonth').onclick = () => { calMonth.setMonth(calMonth.getMonth() - 1); renderCalendarGrid(); };
$('#nextMonth').onclick = () => { calMonth.setMonth(calMonth.getMonth() + 1); renderCalendarGrid(); };

function renderBiz() {
  const cats = ['견적요청', '현장방문요청', '미팅요청', '단순질문', '기타'];
  const pool = emails.filter(e => !e.isVerification);
  const groups = cats.map(c => ({ c, list: pool.filter(e => (e.category || '기타') === c) })).filter(g => g.list.length);
  $('#bizEmails').innerHTML = groups.length
    ? groups.map(g => `<div class="biz-group"><h4>${esc(g.c)} · ${g.list.length}건</h4><div class="emails">${g.list.map((e, i) => mailCard(e, i)).join('')}</div></div>`).join('')
    : '<p class="empty">아직 분석한 메일이 없습니다. "최근 30개 분석"을 눌러보세요.</p>';
  document.querySelectorAll('#bizEmails .mail').forEach(el => el.onclick = () => openMail(el.dataset.id, true));
}

function authCard(e, i = 0) {
  return `<article class="auth-card" data-id="${e.id}" style="--stagger:${Math.min(i, 14)}">
    <div class="auth-code-box">
      <span class="auth-code-label">CODE</span>
      <span class="auth-code-value">${esc(e.verificationCode || '—')}</span>
    </div>
    <div class="auth-body">
      <h3>${esc(e.subject)}</h3>
      <p class="from">${esc(e.from)} · ${esc(e.date)}</p>
      <p class="snip">${esc(e.summary || e.snippet)}</p>
    </div>
    <button class="button ghost small copy-code-btn" data-code="${esc(e.verificationCode || '')}" ${e.verificationCode ? '' : 'disabled'}>코드 복사</button>
  </article>`;
}

function renderAuth() {
  const list = emails.filter(e => e.isVerification);
  $('#authEmails').innerHTML = list.length
    ? list.map((e, i) => authCard(e, i)).join('')
    : '<p class="empty">아직 도착한 인증코드 메일이 없어요. 분석 시 자동으로 여기에 모여요.</p>';
}
document.addEventListener('click', async e => {
  const btn = e.target.closest('.copy-code-btn');
  if (!btn || btn.disabled) return;
  try {
    await navigator.clipboard.writeText(btn.dataset.code);
    const original = btn.textContent;
    btn.textContent = '복사했어요';
    setTimeout(() => { btn.textContent = original; }, 1500);
  } catch { /* 클립보드 접근 실패는 조용히 무시 */ }
});

function memoSlip(e, i = 0) {
  return `<article class="memo-slip" data-id="${e.id}" style="--stagger:${Math.min(i, 14)}">
    <div class="memo-head"><span class="memo-icon">TEL</span><span class="memo-title">부재중 전화 메모</span></div>
    <dl class="memo-fields">
      <dt>발신</dt><dd title="${esc(e.from)}">${esc(e.from)}</dd>
      <dt>날짜</dt><dd>${esc(e.date)}</dd>
    </dl>
    <p class="memo-msg">${esc(e.summary || e.snippet)}</p>
    ${e.action ? `<p class="memo-action">▸ ${esc(e.action)}</p>` : ''}
  </article>`;
}

function renderCalls() {
  const list = emails.filter(e => e.isCallSummary);
  $('#callMemos').innerHTML = list.length
    ? list.map((e, i) => memoSlip(e, i)).join('')
    : '<p class="empty">아직 통화 요약 메일이 없어요. 에이닷 등에서 통화 요약이 오면 여기에 자동으로 모여요.</p>';
  document.querySelectorAll('#callMemos .memo-slip').forEach(el => el.onclick = () => openMail(el.dataset.id, false));
}

function senderCard(g, i = 0) {
  const initial = (g.fromName || g.fromEmail || '?').trim().charAt(0).toUpperCase();
  return `<article class="sender-card" data-email="${esc(g.fromEmail)}" style="--stagger:${Math.min(i, 14)}">
    <div class="sender-avatar">${esc(initial)}</div>
    <div class="sender-info">
      <h3>${esc(g.fromName)}</h3>
      <p class="sender-email">${esc(g.fromEmail)}</p>
    </div>
    <div class="sender-meta">
      <span class="badge">메일 ${g.emails.length}건</span>
      ${g.attachmentCount ? `<span class="badge attach-badge">📎 ${g.attachmentCount}</span>` : ''}
      ${g.hasImportant ? '<span class="badge" style="color:var(--burgundy);background:var(--burgundy-tint)">중요 있음</span>' : ''}
    </div>
  </article>`;
}

function renderSenders() {
  const { senders } = window.__sendersCache || {};
  const list = senders || [];
  $('#sendersList').innerHTML = list.length
    ? list.map((g, i) => senderCard(g, i)).join('')
    : '<p class="empty">아직 분석한 메일이 없습니다. "최근 30개 분석"을 눌러보세요.</p>';
  document.querySelectorAll('.sender-card').forEach(el => el.onclick = () => openSenderThread(el.dataset.email));
}

async function loadSenders() {
  window.__sendersCache = await api('/api/senders');
  renderSenders();
}

function openSenderThread(email) {
  const group = (window.__sendersCache?.senders || []).find(g => g.fromEmail === email);
  if (!group) return;
  const list = [...group.emails].sort((a, b) => (a.date < b.date ? 1 : -1));
  $('#meta').textContent = `${group.fromName} · 메일 ${list.length}건`;
  $('#subject').textContent = `${group.fromName}님과 주고받은 메일`;
  $('#emailSummary').textContent = '';
  $('#details').innerHTML = list.map(e => `
    <div class="thread-item" data-id="${e.id}">
      <dt>${esc(e.date)}</dt>
      <dd>${esc(e.subject)} ${e.attachments?.length ? `<span class="badge attach-badge">📎 ${e.attachments.length}</span>` : ''}</dd>
    </div>`).join('');
  $('#answer').textContent = '';
  $('#question').value = '';
  $('#draftBox').hidden = true;
  $('#costNote').hidden = true;
  $('#sendRow').hidden = true;
  $('#ideasList').innerHTML = '';
  $('#ideasNote').textContent = '';
  document.querySelectorAll('.tone-btn').forEach(b => b.classList.remove('active'));
  $('#modal').showModal();
  playFlap('modal');
  document.querySelectorAll('.thread-item').forEach(el => el.onclick = () => openMail(el.dataset.id, false));
}

function attachmentRow(a, i = 0) {
  const url = `/api/attachment?messageId=${encodeURIComponent(a.messageId)}&attachmentId=${encodeURIComponent(a.attachmentId)}&filename=${encodeURIComponent(a.filename)}`;
  const sizeKb = a.size ? `${Math.round(a.size / 1024)}KB` : '';
  return `<a class="attachment-item" href="${url}" style="--stagger:${Math.min(i, 14)}">
    <span class="attach-icon">📎</span>
    <div class="attach-info">
      <span class="attach-name">${esc(a.filename)}</span>
      <span class="attach-meta">${esc(a.fromName || a.from)} · ${esc(a.subject)} ${sizeKb ? '· ' + sizeKb : ''}</span>
    </div>
    <span class="attach-download">다운로드</span>
  </a>`;
}

async function loadAttachments() {
  const { attachments } = await api('/api/attachments');
  $('#attachmentsList').innerHTML = attachments.length
    ? attachments.map((a, i) => attachmentRow(a, i)).join('')
    : '<p class="empty">아직 첨부파일이 있는 메일이 없습니다.</p>';
}

function render() {
  renderSummary();
  renderInbox();
  renderBiz();
  renderAuth();
  renderCalls();
  renderSchedule();
  loadSenders();
  loadAttachments();
  document.querySelectorAll('#emails .mail').forEach(el => el.onclick = () => openMail(el.dataset.id, false));
}

function openMail(id, bizMode) {
  selected = emails.find(e => e.id === id);
  $('#meta').textContent = `${selected.from} · ${selected.date}`;
  $('#subject').textContent = selected.subject;
  $('#emailSummary').textContent = selected.summary;
  const attachHtml = (selected.attachments || []).length
    ? `<dt>첨부파일</dt><dd>${selected.attachments.map(a => `<a class="chip" href="/api/attachment?messageId=${encodeURIComponent(selected.id)}&attachmentId=${encodeURIComponent(a.attachmentId)}&filename=${encodeURIComponent(a.filename)}">📎 ${esc(a.filename)}</a>`).join(' ')}</dd>`
    : '';
  $('#details').innerHTML = `
    <dt>유형</dt><dd>${esc(selected.category || '-')}${selected.isCallSummary ? ' · 통화요약' : ''}</dd>
    <dt>중요 이유</dt><dd>${esc(selected.reason || '-')}</dd>
    <dt>할 일</dt><dd>${esc(selected.action || '-')}</dd>
    <dt>기한</dt><dd>${esc(selected.dueDate || '-')}</dd>
    ${attachHtml}`;
  $('#answer').textContent = '';
  $('#question').value = '';
  $('#draftBox').hidden = true;
  $('#draftText').value = '';
  $('#draftStatus').textContent = ''; $('#draftStatus').className = 'draft-status';
  $('#costNote').hidden = true;
  $('#sendRow').hidden = true;
  $('#ideasList').innerHTML = '';
  $('#ideasNote').textContent = '';
  document.querySelectorAll('.tone-btn').forEach(b => b.classList.remove('active'));
  $('#modal').showModal();
  playFlap('modal');
  if (bizMode) makeDraft('business');
}

let currentTone = null;
async function makeDraft(tone) {
  currentTone = tone;
  document.querySelectorAll('.tone-btn').forEach(b => b.classList.toggle('active', b.dataset.tone === tone));
  $('#draftBox').hidden = false;
  $('#draftStatus').textContent = '초안 작성 중…';
  $('#draftText').value = '';
  try {
    const { draft, category } = await api('/api/draft', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: selected.id, tone }) });
    $('#draftText').value = draft;
    $('#draftStatus').textContent = '';
    $('#costNote').hidden = category !== '견적요청';
    $('#sendRow').hidden = tone !== 'business';
  } catch (e) { $('#draftStatus').textContent = e.message; }
}

async function sendMailNow() {
  if (!selected) return;
  const text = $('#draftText').value.trim();
  if (!text) { alert('보낼 내용이 비어 있어요. 먼저 답장을 작성해주세요.'); return; }
  const to = selected.from;
  const subject = /^re:/i.test(selected.subject || '') ? selected.subject : `Re: ${selected.subject || ''}`;

  if (!confirm(`받는사람: ${to}\n제목: ${subject}\n\n이 내용으로 실제 전송을 진행할까요? (1/3)`)) return;
  if (!confirm(`한 번 더 확인할게요. 아래 내용 그대로 보낼까요? (2/3)\n\n──────────\n${text}\n──────────`)) return;
  if (!confirm('마지막 확인이에요. 전송 후에는 되돌릴 수 없어요. 정말 전송할까요? (3/3)')) return;

  const b = $('#sendMail');
  b.disabled = true; b.textContent = '전송 중…';
  const status = $('#draftStatus');
  status.textContent = ''; status.className = 'draft-status';
  try {
    await api('/api/send', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: selected.id, body: text }) });
    status.textContent = '실제로 전송했어요.'; status.className = 'draft-status success';
    saveStyleSample(text, selected.category || '기타');
  } catch (e) {
    status.textContent = `전송 실패: ${e.message}`; status.className = 'draft-status error';
  } finally {
    b.disabled = false; b.textContent = '지금 전송하기';
  }
}
$('#sendMail').onclick = sendMailNow;

$('#getIdeas').onclick = async () => {
  const b = $('#getIdeas');
  b.disabled = true; b.textContent = '아이디어 생각 중…';
  $('#ideasList').innerHTML = '';
  $('#ideasNote').textContent = '';
  try {
    const { ideas, isBusinessInquiry } = await api('/api/ideas', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: selected.id }) });
    $('#ideasList').innerHTML = ideas.map(i => `<li data-idea="${esc(i)}" data-mailid="${selected.id}">${esc(i)}</li>`).join('');
    $('#ideasNote').textContent = (isBusinessInquiry ? '사업 아이디어로 저장됐어요. ' : '') + '항목을 클릭하면 실행 계획표를 짜드려요.';
    loadVault();
  } catch (e) { $('#ideasList').innerHTML = `<li class="error">${esc(e.message)}</li>`; }
  finally { b.disabled = false; b.textContent = '아이디어 제안받기'; }
};

let currentPlan = { mailId: null, idea: null };

async function openPlan(mailId, ideaText) {
  currentPlan = { mailId, idea: ideaText };
  $('#planTitle').textContent = ideaText;
  $('#planSteps').innerHTML = '<p class="empty">계획표 작성 중…</p>';
  $('#planMaterials').innerHTML = '';
  $('#planResources').innerHTML = '';
  $('#planQuestion').value = '';
  $('#planAnswer').textContent = '';
  $('#planModal').showModal();
  playFlap('planModal');
  try {
    const { steps, materials, resources } = await api('/api/idea-plan', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: mailId, idea: ideaText }) });
    $('#planSteps').innerHTML = steps.map((s, i) => `
      <div class="plan-step">
        <span class="plan-num">${i + 1}</span>
        <div class="plan-body">
          <div class="plan-head"><h4>${esc(s.title)}</h4><span class="plan-time">${esc(s.timeframe)}</span></div>
          <p>${esc(s.description)}</p>
        </div>
      </div>`).join('');
    if (materials && materials.length) {
      $('#planMaterials').innerHTML = `<h4 class="plan-extra-title">준비하면 좋을 재료·도구</h4><div class="chip-list">${materials.map(m =>
        `<a class="chip" target="_blank" rel="noopener" href="https://www.google.com/search?tbm=shop&q=${encodeURIComponent(m.searchQuery)}" title="${esc(m.note)}">${esc(m.name)}</a>`
      ).join('')}</div>`;
    }
    if (resources && resources.length) {
      $('#planResources').innerHTML = `<h4 class="plan-extra-title">참고하면 좋을 자료</h4><div class="chip-list">${resources.map(r =>
        `<a class="chip" target="_blank" rel="noopener" href="https://www.google.com/search?q=${encodeURIComponent(r.searchQuery)}">${esc(r.label)}</a>`
      ).join('')}</div>`;
    }
  } catch (e) { $('#planSteps').innerHTML = `<p class="error">${esc(e.message)}</p>`; }
}

$('#planAsk').onclick = async () => {
  const q = $('#planQuestion').value.trim();
  if (!q) return;
  $('#planAnswer').textContent = '답변 작성 중…';
  try {
    $('#planAnswer').textContent = (await api('/api/plan-chat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: currentPlan.mailId, idea: currentPlan.idea, question: q }) })).answer;
  } catch (e) { $('#planAnswer').textContent = e.message; }
};
$('#planQuestion').addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); $('#planAsk').click(); } });
document.addEventListener('click', e => {
  const li = e.target.closest('.ideas-list li[data-idea]');
  if (li) openPlan(li.dataset.mailid, li.dataset.idea);
});
$('#closePlan').onclick = () => $('#planModal').close();

$('#tones').addEventListener('click', e => {
  const btn = e.target.closest('.tone-btn');
  if (btn) makeDraft(btn.dataset.tone);
});
$('#redraft').onclick = () => { if (currentTone) makeDraft(currentTone); };
$('#copyDraft').onclick = async () => {
  try {
    await navigator.clipboard.writeText($('#draftText').value);
    $('#draftStatus').textContent = '복사했어요. Gmail에 붙여넣기 하세요.';
    saveStyleSample($('#draftText').value, selected.category || '기타');
  } catch { $('#draftStatus').textContent = '복사에 실패했어요. 직접 선택해 복사해주세요.'; }
};

async function saveStyleSample(text, category) {
  try {
    const { store } = await api('/api/style', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text, category }) });
    renderStyleCounts(store);
  } catch { /* 학습 저장 실패는 조용히 무시 */ }
}
function renderStyleCounts(store) {
  const cats = ['단순질문', '견적요청', '현장방문요청', '미팅요청', '기타'];
  $('#styleCounts').innerHTML = cats.map(c => `<span class="chip">${esc(c)} · ${(store[c] || []).length}개</span>`).join('');
}

$('#styleBtn').onclick = async () => {
  $('#stylePanel').hidden = false;
  try { renderStyleCounts((await api('/api/style')).store); } catch {}
};
$('#closeStyle').onclick = () => { $('#stylePanel').hidden = true; };
$('#addStyle').onclick = async () => {
  const text = $('#styleInput').value.trim();
  const category = $('#styleCategory').value;
  if (text.length < 10) { alert('조금 더 긴 예시를 붙여넣어주세요.'); return; }
  await saveStyleSample(text, category);
  $('#styleInput').value = '';
};
$('#resetStyle').onclick = async () => {
  const { store } = await api('/api/style/reset', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
  renderStyleCounts(store);
};

function switchView(name) {
  document.querySelectorAll('.tab').forEach(t => t.classList.toggle('active', t.dataset.view === name));
  $('#view-inbox').hidden = name !== 'inbox';
  $('#view-senders').hidden = name !== 'senders';
  $('#view-business').hidden = name !== 'business';
  $('#view-attachments').hidden = name !== 'attachments';
  $('#view-auth').hidden = name !== 'auth';
  $('#view-calls').hidden = name !== 'calls';
  $('#view-schedule').hidden = name !== 'schedule';
  $('#view-vault').hidden = name !== 'vault';
  if (name === 'vault') loadVault();
  if (name === 'senders') loadSenders();
  if (name === 'attachments') loadAttachments();
}

async function loadVault() {
  const { items } = await api('/api/idea-vault');
  $('#vault').innerHTML = items.length ? items.map(v => `
    <article class="vault-card${v.isBusinessInquiry ? ' biz' : ''}">
      <div class="vault-head">
        ${v.isBusinessInquiry ? '<span class="badge biz-badge">사업 아이디어</span>' : ''}
        <h3>${esc(v.subject)}</h3>
        <p class="from">${esc(v.from)}</p>
      </div>
      <ul class="ideas-list">${v.ideas.map(i => `<li data-idea="${esc(i)}" data-mailid="${esc(v.id)}">${esc(i)}</li>`).join('')}</ul>
    </article>`).join('') : '<p class="empty">메일 상세에서 "아이디어 제안받기"를 누르면 여기에 모여요. 사업 제안 메일은 더 넓고 기발한 아이디어로 정리돼요.</p>';
}

async function load() {
  const status = await api('/api/status');
  $('#status').textContent = !status.configReady
    ? `.env에서 다음 값을 입력하세요: ${status.missingConfig.join(', ')}`
    : status.gmailConnected
      ? 'Gmail이 읽기 전용으로 연결되었습니다.'
      : 'Gmail 연결을 완료하세요.';
  emails = (await api('/api/emails')).emails;
  render();
  try { renderStyleCounts((await api('/api/style')).store); } catch {}
}

$('#tabs').addEventListener('click', e => {
  const tab = e.target.closest('.tab');
  if (tab) switchView(tab.dataset.view);
});

$('#sync').onclick = async () => {
  const b = $('#sync');
  b.disabled = true; b.textContent = 'AI가 분석 중…';
  $('#adFilterNote').hidden = true;
  try {
    const result = await api('/api/sync', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{"limit":30}' });
    emails = result.emails;
    render();
    if (result.adFilteredCount > 0) {
      $('#adFilterNote').textContent = `광고로 보이는 메일 ${result.adFilteredCount}건은 자동으로 제외했어요.`;
      $('#adFilterNote').hidden = false;
    }
  } catch (e) { alert(e.message); }
  finally { b.disabled = false; b.textContent = '최근 30개 분석'; }
};

$('#notifyTelegram').onclick = async () => {
  const b = $('#notifyTelegram');
  b.disabled = true; b.textContent = '보내는 중…';
  try {
    await api('/api/notify-telegram', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
    b.textContent = '보냈어요';
    setTimeout(() => { b.textContent = '텔레그램 알림 보내기'; }, 2200);
  } catch (e) {
    alert(e.message);
    b.textContent = '텔레그램 알림 보내기';
  } finally {
    b.disabled = false;
  }
};

$('#ask').onclick = async () => {
  const q = $('#question').value.trim();
  if (!q) return;
  $('#answer').textContent = '답변 작성 중…';
  try {
    $('#answer').textContent = (await api('/api/chat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: selected.id, question: q }) })).answer;
  } catch (e) { $('#answer').textContent = e.message; }
};
$('#question').addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); $('#ask').click(); } });
$('#styleInput').addEventListener('keydown', e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); $('#addStyle').click(); } });

$('#weeklySummary').onclick = async () => {
  const b = $('#weeklySummary');
  b.disabled = true; b.textContent = '요약 작성 중…';
  $('#reportPanel').hidden = false;
  $('#reportText').textContent = '';
  try {
    const { report } = await api('/api/weekly-summary', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
    $('#reportText').textContent = report;
  } catch (e) { $('#reportText').textContent = e.message; }
  finally { b.disabled = false; b.textContent = '이번 주 요약'; }
};
$('#closeReport').onclick = () => { $('#reportPanel').hidden = true; };
$('#close').onclick = () => $('#modal').close();

load().catch(e => $('#status').textContent = e.message);
