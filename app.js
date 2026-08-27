const app = document.querySelector('#app');
const cfg = window.EBG_FORMS_CONFIG || {};
const API = String(cfg.supabaseUrl || '').replace(/\/$/, '');
const KEY = String(cfg.supabaseAnonKey || '');
const SESSION_KEY = 'ebg.forms.session.v1';

const esc = (value='') => String(value).replace(/[&<>"']/g, (c) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
const headers = (token) => ({ apikey: KEY, Authorization: `Bearer ${token || KEY}`, 'Content-Type': 'application/json' });
const request = async (path, init={}, token) => {
  if (!API || !KEY) throw new Error('EBG Forms is not configured yet.');
  const res = await fetch(`${API}${path}`, { ...init, headers: { ...headers(token), ...(init.headers || {}) } });
  const body = await res.json().catch(() => null);
  if (!res.ok) throw new Error(body?.message || body?.error_description || body?.error || `Request failed (${res.status})`);
  return body;
};
const getSession = () => { try { return JSON.parse(localStorage.getItem(SESSION_KEY) || 'null'); } catch { return null; } };
const saveSession = (session) => session ? localStorage.setItem(SESSION_KEY, JSON.stringify(session)) : localStorage.removeItem(SESSION_KEY);

const renderShell = (body) => `
  <main class="shell">
    <header class="topbar"><a class="brand" href="/">EBG+ <span>FORMS</span></a><nav><a href="https://ebgplus.app/app/applications">My Applications</a><button id="auth-button" class="ghost">${getSession() ? 'Sign out' : 'Sign in'}</button></nav></header>
    ${body}
  </main>`;

const loadForms = async () => request('/rest/v1/ebg_forms?status=eq.open&order=created_at.desc');
const loadForm = async (slug) => {
  const forms = await request(`/rest/v1/ebg_forms?slug=eq.${encodeURIComponent(slug)}&status=eq.open&limit=1`);
  if (!forms?.[0]) return null;
  const form = forms[0];
  const questions = await request(`/rest/v1/ebg_form_questions?form_id=eq.${encodeURIComponent(form.id)}&order=position.asc`);
  return { ...form, questions };
};

const renderAuth = () => {
  app.innerHTML = renderShell(`<section class="auth-card"><p class="eyebrow">EBG ACCOUNT</p><h1>Sign in before you apply.</h1><p>Signing in links your submission to EBG+ so you can receive application updates and message the team.</p><form id="login"><label>Email<input name="email" type="email" required></label><label>Password<input name="password" type="password" required></label><button>Sign in</button><p id="status"></p></form><button id="cancel-login" class="ghost">Continue without signing in</button></section>`);
  document.querySelector('#login')?.addEventListener('submit', async (e) => {
    e.preventDefault(); const data = new FormData(e.currentTarget); const status = document.querySelector('#status');
    try {
      status.textContent = 'Signing in…';
      const session = await request('/auth/v1/token?grant_type=password', { method:'POST', body: JSON.stringify({ email:String(data.get('email')||''), password:String(data.get('password')||'') }) });
      saveSession(session); location.reload();
    } catch (err) { status.textContent = err.message || 'Could not sign in.'; }
  });
  document.querySelector('#cancel-login')?.addEventListener('click', () => { sessionStorage.setItem('ebg.forms.skipLogin','1'); location.reload(); });
};

const wireAuth = () => document.querySelector('#auth-button')?.addEventListener('click', () => {
  if (getSession()) { saveSession(null); location.reload(); }
  else { sessionStorage.removeItem('ebg.forms.skipLogin'); renderAuth(); }
});

const renderHome = async () => {
  try {
    const forms = await loadForms();
    app.innerHTML = renderShell(`<section class="hero"><p class="eyebrow">EBG FORMS</p><h1>Step into the EBG universe.</h1><p>Applications, casting calls, sign-ups, fan opportunities, and official network submissions all live here.</p><div class="form-list">${forms.map(form => `<a class="form-card" href="/${esc(form.slug)}"><span>${esc(form.eyebrow)}</span><h2>${esc(form.title)}</h2><p>${esc(form.description)}</p><strong>Open form →</strong></a>`).join('') || '<div class="empty">No forms are open right now.</div>'}</div><p class="legacy">EBG Forms legacy has been sunset. All new forms are created and managed through EBG Studio.</p></section>`);
    wireAuth();
  } catch (err) { app.innerHTML = renderShell(`<div class="empty"><h1>Forms unavailable</h1><p>${esc(err.message)}</p></div>`); wireAuth(); }
};

const renderForm = async (slug) => {
  try {
    const form = await loadForm(slug);
    if (!form) { app.innerHTML = renderShell('<div class="empty"><h1>Form unavailable</h1><p>This form may be closed or no longer exist.</p><a href="/">View open forms</a></div>'); wireAuth(); return; }
    if (!getSession() && !sessionStorage.getItem('ebg.forms.skipLogin')) { renderAuth(); return; }
    const fields = (form.questions || []).map(q => {
      const common = `name="${esc(q.key)}" ${q.required ? 'required' : ''} placeholder="${esc(q.placeholder || '')}"`;
      if (q.type === 'textarea') return `<label class="full">${esc(q.label)}<textarea ${common}></textarea></label>`;
      if (q.type === 'select') return `<label>${esc(q.label)}<select ${common}><option value="">Choose one</option>${(q.options || []).map(o=>`<option>${esc(o)}</option>`).join('')}</select></label>`;
      return `<label>${esc(q.label)}<input ${common} type="${esc(q.type)}" ${q.key === 'age' ? 'min="21"' : ''}></label>`;
    }).join('');
    app.innerHTML = renderShell(`<section class="form-page"><p class="eyebrow">${esc(form.eyebrow)}</p><h1>${esc(form.title)}</h1><p>${esc(form.description)}</p>${getSession() ? '<div class="signed-in">✓ Signed in — this application will appear in My Applications.</div>' : '<div class="signed-in muted">Submitting as guest. Sign in first if you want in-app updates and messaging.</div>'}<form id="dynamic-form" class="question-grid">${fields}<div class="full"><button id="submit">Submit to EBG</button><p id="status"></p></div></form></section>`);
    wireAuth();
    document.querySelector('#dynamic-form')?.addEventListener('submit', async (e) => {
      e.preventDefault(); const formEl=e.currentTarget; const button=document.querySelector('#submit'); const status=document.querySelector('#status'); const data=new FormData(formEl); const answers={};
      (form.questions||[]).forEach(q => answers[q.key]=String(data.get(q.key)||'').trim());
      const emailQ=(form.questions||[]).find(q=>q.type==='email'); const email=emailQ ? String(answers[emailQ.key]||'') : '';
      button.disabled=true; status.textContent='Submitting…';
      try {
        const session=getSession();
        await request('/rest/v1/rpc/submit_ebg_form', {method:'POST', body:JSON.stringify({p_form_id:form.id,p_answers:answers,p_respondent_email:email||null})}, session?.access_token);
        formEl.reset(); status.className='success'; status.textContent=form.submit_message;
      } catch(err) { status.className='error'; status.textContent=err.message || 'Your response could not be submitted.'; }
      finally { button.disabled=false; }
    });
  } catch(err) { app.innerHTML=renderShell(`<div class="empty"><h1>Something went wrong.</h1><p>${esc(err.message)}</p></div>`); wireAuth(); }
};

const path = decodeURIComponent(location.pathname).replace(/^\/+|\/+$/g,'');
path ? renderForm(path) : renderHome();
