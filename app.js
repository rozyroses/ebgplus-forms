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

const logo='<span class="logo-art"><img src="/branding/ebgplus-ink-blue.png" alt="EBG+" width="1920" height="819"></span>';
const renderShell=(body)=>`<a class="skip-link" href="#content">Skip to content</a><div class="shell"><header class="topbar"><a class="brand" href="/">${logo}<span class="product-label">Forms</span></a><nav aria-label="Main navigation"><a href="/">Opportunities</a><a href="https://ebgplus.app/app/applications">My applications</a><button id="auth-button" class="ghost">${getSession()?'Sign out':'Sign in'}</button></nav></header><main id="content">${body}</main><footer><a class="brand" href="https://ebgplus.app">${logo}</a><p>Your next chapter starts here.</p><a href="https://ebgplus.app/app/help">Need a hand? Get help ↗</a></footer></div>`;

const loadForms = async () => request('/rest/v1/ebg_forms?status=eq.open&order=created_at.desc');
const loadForm = async (slug) => {
  const forms = await request(`/rest/v1/ebg_forms?slug=eq.${encodeURIComponent(slug)}&status=eq.open&limit=1`);
  if (!forms?.[0]) return null;
  const form = forms[0];
  const questions = await request(`/rest/v1/ebg_form_questions?form_id=eq.${encodeURIComponent(form.id)}&order=position.asc`);
  return { ...form, questions };
};

const renderAuth = () => {
  app.innerHTML = renderShell(`<section class="auth-card"><p class="eyebrow">EBG ACCOUNT</p><h1>Sign in before you apply.</h1><p>Signing in links your submission to EBG+ so you can receive application updates and message the team.</p><form id="login"><label>Email<input name="email" type="email" autocomplete="email" required></label><label>Password<input name="password" type="password" autocomplete="current-password" required></label><button>Sign in</button><p id="status" role="status" aria-live="polite"></p></form><button id="cancel-login" class="ghost">Continue without signing in</button></section>`);
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
  app.innerHTML=renderShell('<section class="empty" role="status"><h1>Finding your next chapter…</h1></section>');wireAuth();
  try {
    const forms=await loadForms();
    app.innerHTML=renderShell(`<section class="hero"><div><p class="eyebrow">THE EBG+ OPPORTUNITY BOARD</p><h1>You belong<br>in the <em>story.</em></h1><p>Casting calls. Creative opportunities. Your next big thing. Find your place in the EBG+ universe.</p><a class="primary" href="#opportunities">Explore opportunities ↗</a></div><aside class="hero-note"><span class="note-index">01 — YOUR NEXT CHAPTER</span><div class="plus-art" aria-hidden="true">+</div><h2>Make your<br>mark.</h2><p>One application.<br>A world of possibilities.</p></aside></section><section id="opportunities" class="directory"><div class="section-heading"><div><p class="eyebrow">FIND YOUR FIT</p><h2>Open opportunities <span class="count">${forms.length}</span></h2></div><label class="search-label"><span class="sr-only">Search opportunities</span><input id="form-search" type="search" placeholder="Search opportunities…"></label></div><div class="form-list" id="form-list"></div><p id="result-count" class="sr-only" role="status"></p></section><section class="how-it-works"><div><p class="eyebrow">FROM HELLO TO WHAT’S NEXT</p><h2>A little about you.<br>A new possibility.</h2></div><ol><li><span>01</span><div><h3>Find your opportunity</h3><p>Explore what’s open and choose a form that fits.</p></div></li><li><span>02</span><div><h3>Tell us your story</h3><p>Take your time. Check your answers, then send them our way.</p></div></li><li><span>03</span><div><h3>Stay in the loop</h3><p>Apply signed in to follow updates in My applications.</p></div></li></ol></section>`);
    const paint=()=>{
      const query=document.querySelector('#form-search').value.trim().toLowerCase();
      const visible=forms.filter(f=>[f.title,f.description,f.eyebrow].join(' ').toLowerCase().includes(query));
      document.querySelector('#form-list').innerHTML=visible.map((f,i)=>`<a class="form-card" href="/${encodeURIComponent(f.slug)}"><div class="card-top"><span class="card-number">${String(i+1).padStart(2,'0')}</span><span class="badge">Open now</span></div><div><p class="eyebrow">${esc(f.eyebrow||'EBG+ OPPORTUNITY')}</p><h3>${esc(f.title)}</h3><p>${esc(f.description||'')}</p></div><strong>View opportunity <span aria-hidden="true">↗</span></strong></a>`).join('')||`<div class="empty"><h3>${query?'No matches just yet.':'Something new is on the way.'}</h3><p>${query?'Try another search to find your fit.':'No opportunities are open right now. Check back for the next chapter.'}</p></div>`;
      document.querySelector('#result-count').textContent=`${visible.length} opportunities found`;
    };paint();document.querySelector('#form-search').addEventListener('input',paint);wireAuth();
  }catch(err){app.innerHTML=renderShell(`<section class="empty"><h1>We couldn’t load opportunities.</h1><p>${esc(err.message)}</p><button class="primary" id="retry">Try again</button></section>`);wireAuth();document.querySelector('#retry').addEventListener('click',renderHome);}
};

const renderForm = async (slug) => {
  try {
    const form = await loadForm(slug);
    if (!form) { app.innerHTML = renderShell('<div class="empty"><h1>Form unavailable</h1><p>This form may be closed or no longer exist.</p><a href="/">View open forms</a></div>'); wireAuth(); return; }
    if (!getSession() && !sessionStorage.getItem('ebg.forms.skipLogin')) { renderAuth(); return; }
    const fields = (form.questions || []).map(q => {
      const common = `name="${esc(q.key)}" ${q.required ? 'required' : ''} placeholder="${esc(q.placeholder || '')}"`;
      if (q.type === 'textarea') return `<label class="full">${esc(q.label)} <span class="field-note">${q.required ? 'Required' : 'Optional'}</span><textarea ${common}></textarea></label>`;
      if (q.type === 'select') return `<label>${esc(q.label)} <span class="field-note">${q.required ? 'Required' : 'Optional'}</span><select ${common}><option value="">Choose one</option>${(q.options || []).map(o=>`<option>${esc(o)}</option>`).join('')}</select></label>`;
      return `<label>${esc(q.label)} <span class="field-note">${q.required ? 'Required' : 'Optional'}</span><input ${common} type="${esc(q.type)}" ${q.key === 'age' ? 'min="21"' : ''}></label>`;
    }).join('');
    app.innerHTML=renderShell(`<section class="application-layout"><aside class="application-context"><a class="back-link" href="/">← All opportunities</a><p class="eyebrow">${esc(form.eyebrow||'EBG+ OPPORTUNITY')}</p><h1>${esc(form.title)}</h1><p>${esc(form.description||'')}</p><div class="application-progress"><span id="progress-copy">0 of ${(form.questions||[]).length} questions completed</span><progress id="completion" value="0" max="${Math.max(1,(form.questions||[]).length)}" aria-label="Questions completed"></progress><p>Take your time. Your answers are sent only when you submit.</p></div></aside><div class="form-page"><div class="form-intro"><p class="eyebrow">YOUR APPLICATION</p><h2>Let’s get to know you.</h2><p>Fields marked Required need an answer.</p></div>${getSession()?'<div class="signed-in">✓ Signed in. Follow this submission in My applications.</div>':'<div class="signed-in muted">You’re applying as a guest. Sign in above to receive account updates and messages.</div>'}<form id="dynamic-form" class="question-grid">${fields}<div class="full submit-area"><p>Happy with everything? Give your answers one last look.</p><button id="submit">Send application ↗</button><p id="status" role="status" aria-live="polite"></p></div></form></div></section>`);
    const formElement=document.querySelector('#dynamic-form');
    formElement.addEventListener('input',()=>{const data=new FormData(formElement);const done=(form.questions||[]).filter(q=>String(data.get(q.key)||'').trim()).length;document.querySelector('#completion').value=done;document.querySelector('#progress-copy').textContent=`${done} of ${(form.questions||[]).length} questions completed`;});
    wireAuth();
    document.querySelector('#dynamic-form')?.addEventListener('submit', async (e) => {
      e.preventDefault(); const formEl=e.currentTarget; const button=document.querySelector('#submit'); const status=document.querySelector('#status'); const data=new FormData(formEl); const answers={};
      (form.questions||[]).forEach(q => answers[q.key]=String(data.get(q.key)||'').trim());
      const emailQ=(form.questions||[]).find(q=>q.type==='email'); const email=emailQ ? String(answers[emailQ.key]||'') : '';
      button.disabled=true; status.textContent='Submitting…';
      try {
        const session=getSession();
        await request('/rest/v1/rpc/submit_ebg_form', {method:'POST', body:JSON.stringify({p_form_id:form.id,p_answers:answers,p_respondent_email:email||null})}, session?.access_token);
        document.querySelector('.form-page').innerHTML=`<section class="confirmation" role="status" tabindex="-1"><span class="confirmation-mark" aria-hidden="true">✓</span><p class="eyebrow">APPLICATION RECEIVED</p><h2>You’re on our radar.</h2><p>${esc(form.submit_message||'Thanks for sharing your story. Your application has been sent to EBG.')}</p><a class="primary" href="/">Explore more opportunities ↗</a>${session?'<a class="back-link" href="https://ebgplus.app/app/applications">View my applications</a>':''}</section>`;document.querySelector('.confirmation').focus();
      } catch(err) { status.className='error'; status.textContent=err.message || 'Your response could not be submitted.'; }
      finally { button.disabled=false; }
    });
  } catch(err) { app.innerHTML=renderShell(`<div class="empty"><h1>Something went wrong.</h1><p>${esc(err.message)}</p></div>`); wireAuth(); }
};

const path = decodeURIComponent(location.pathname).replace(/^\/+|\/+$/g,'');
path ? renderForm(path) : renderHome();
