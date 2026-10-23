/* AVIX — Página /material: carrega a isca, valida e envia o lead. */
(function () {
  const CFG = window.AVIX_MATERIAL || {};
  const BASE = String(CFG.N8N_URL || '').replace(/\/+$/, '');
  const params = new URLSearchParams(location.search);
  const slug = (params.get('isca') || '').trim();
  const UTM_KEYS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content'];
  const utms = {};
  UTM_KEYS.forEach(k => { utms[k] = params.get(k) || ''; });

  /* Mock: só liga com ?mock=1 explícito na URL. Extras para testar estados:
     &mock_post=erro (POST falha) · &mock_delay=ms (atraso das respostas) */
  const MOCK = params.get('mock') === '1';
  const MOCK_DELAY = Math.min(parseInt(params.get('mock_delay'), 10) || 900, 10000);

  const $ = id => document.getElementById(id);

  /* ── Mock ── */
  function mockImg(label, c1, c2) {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 600"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${c1}"/><stop offset="1" stop-color="${c2}"/></linearGradient></defs><rect width="800" height="600" fill="#0A0F2E"/><rect x="230" y="90" width="340" height="420" rx="18" fill="url(#g)"/><rect x="270" y="150" width="220" height="18" rx="9" fill="#fff" opacity=".85"/><rect x="270" y="190" width="160" height="12" rx="6" fill="#fff" opacity=".5"/><text x="400" y="560" font-family="sans-serif" font-size="26" fill="#9A9AA8" text-anchor="middle">${label}</text></svg>`;
    return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
  }
  const MOCK_ISCAS = [
    { slug: 'calc-leads', titulo: 'Calculadora de leads perdidos', subtitulo: 'Descubra quanto dinheiro escapa toda vez que um lead fica sem resposta.', bullets: ['Calcule a perda mensal em reais com os seus números', 'Veja o impacto do tempo de resposta na conversão', 'Compare o cenário atual com atendimento 24/7'], imagem: mockImg('Calculadora', '#5B0BE9', '#0B4BEF'), ativo: true },
    { slug: 'checklist-funil', titulo: 'Checklist: seu funil vaza onde?', subtitulo: 'Um diagnóstico rápido das etapas onde você perde oportunidades.', bullets: ['22 pontos de verificação do primeiro contato ao fechamento', 'Identifique os gargalos que mais custam vendas', 'Priorize o que corrigir primeiro'], imagem: mockImg('Checklist', '#0B4BEF', '#00ADF0'), ativo: true },
    { slug: 'teste-5min', titulo: 'Teste dos 5 minutos', subtitulo: 'Um teste prático para saber se seu time responde rápido o bastante.', bullets: ['Roteiro passo a passo para testar seu próprio atendimento', 'Benchmarks de tempo de resposta no B2B', 'O que fazer com o resultado'], imagem: mockImg('Teste', '#5B0BE9', '#00ADF0'), ativo: true }
  ];
  const wait = ms => new Promise(r => setTimeout(r, ms));
  async function mockFetch(url, opts) {
    await wait(MOCK_DELAY);
    const u = new URL(url);
    const json = (status, body) => ({ ok: status < 400, status, json: async () => body });
    if (u.pathname.endsWith('/webhook/isca')) {
      const found = MOCK_ISCAS.find(i => i.slug === u.searchParams.get('slug'));
      return found ? json(200, found) : json(404, { erro: 'nao_encontrada' });
    }
    if (u.pathname.endsWith('/webhook/iscas')) return json(200, MOCK_ISCAS.filter(i => i.ativo));
    if (u.pathname.endsWith('/webhook/lead-isca')) {
      console.info('[mock] POST lead-isca', JSON.parse(opts.body));
      if (params.get('mock_post') === 'erro') throw new TypeError('Falha de rede simulada');
      return json(200, { ok: true });
    }
    return json(404, {});
  }
  const api = (path, opts) => {
    const url = (MOCK ? 'https://mock.avix.local' : BASE) + path;
    return MOCK ? mockFetch(url, opts) : fetch(url, opts);
  };

  /* ── Helpers ── */
  const safeUrl = s => {
    if (/^data:image\//.test(s)) return s;
    try { const u = new URL(s, location.href); return /^https?:$/.test(u.protocol) ? u.href : ''; } catch (e) { return ''; }
  };
  function materialUrl(newSlug) {
    const p = new URLSearchParams(location.search);
    p.set('isca', newSlug);
    return location.pathname + '?' + p.toString();
  }

  /* ── Estados da isca ── */
  function showIsca(isca) {
    $('isca-titulo').textContent = isca.titulo || '';
    $('isca-subtitulo').textContent = isca.subtitulo || '';
    const ul = $('isca-bullets');
    ul.replaceChildren();
    (Array.isArray(isca.bullets) ? isca.bullets : []).slice(0, 3).forEach(b => {
      const li = document.createElement('li');
      li.textContent = b;
      ul.appendChild(li);
    });
    const img = $('isca-img');
    const src = isca.imagem ? safeUrl(isca.imagem) : '';
    if (src) { img.src = src; img.alt = isca.titulo || 'Material'; img.hidden = false; } else img.hidden = true;
    if (isca.titulo) document.title = isca.titulo + ' | Avix';
    $('skeleton').hidden = true;
    $('isca-body').hidden = false;
    $('isca').setAttribute('aria-busy', 'false');
    $('form-card').hidden = false;
  }

  async function showChoose() {
    $('isca').hidden = true;
    $('form-card').hidden = true;
    $('choose').hidden = false;
    const list = $('choose-list');
    let iscas = [];
    try {
      const r = await api('/webhook/iscas');
      if (r.ok) iscas = await r.json();
    } catch (e) { /* lista vazia */ }
    iscas = (Array.isArray(iscas) ? iscas : []).filter(i => i && i.slug && i.ativo !== false);
    if (!iscas.length) { $('choose-empty').hidden = false; return; }
    iscas.forEach(i => {
      const a = document.createElement('a');
      a.className = 'm-choice';
      a.href = materialUrl(i.slug);
      const src = i.imagem ? safeUrl(i.imagem) : '';
      if (src) { const img = document.createElement('img'); img.src = src; img.alt = ''; img.loading = 'lazy'; a.appendChild(img); }
      const body = document.createElement('div');
      body.className = 'm-choice-body';
      const h = document.createElement('h2'); h.textContent = i.titulo || i.slug;
      body.appendChild(h);
      if (i.subtitulo) { const p = document.createElement('p'); p.textContent = i.subtitulo; body.appendChild(p); }
      const cta = document.createElement('span'); cta.className = 'm-choice-cta'; cta.textContent = 'Quero este material →';
      body.appendChild(cta);
      a.appendChild(body);
      list.appendChild(a);
    });
  }

  async function loadIsca() {
    if (!slug) return showChoose();
    try {
      const r = await api('/webhook/isca?slug=' + encodeURIComponent(slug));
      if (!r.ok) return showChoose();
      const isca = await r.json();
      if (!isca || isca.ativo === false || !isca.titulo) return showChoose();
      showIsca(isca);
    } catch (e) {
      showChoose();
    }
  }

  /* ── WhatsApp: máscara e normalização ── */
  function maskPhone(v) {
    let d = v.replace(/\D/g, '');
    if (d.length > 11 && d.startsWith('55')) d = d.slice(2);
    d = d.slice(0, 11);
    if (d.length <= 2) return d.length ? '(' + d : '';
    const ddd = d.slice(0, 2), rest = d.slice(2);
    const split = rest.length > 8 ? 5 : 4;
    return '(' + ddd + ') ' + (rest.length > split ? rest.slice(0, split) + '-' + rest.slice(split) : rest);
  }
  /* Retorna 55 + DDD + 9 + 8 dígitos, ou null se inválido. */
  function normalizePhone(v) {
    let d = v.replace(/\D/g, '');
    if (d.length >= 12 && d.startsWith('55')) d = d.slice(2);
    if (d.length === 10 && /[6-9]/.test(d[2])) d = d.slice(0, 2) + '9' + d.slice(2); // celular sem nono dígito
    if (d.length !== 11) return null;
    if (!/^[1-9][1-9]$/.test(d.slice(0, 2))) return null;
    if (d[2] !== '9') return null;
    if (/^(\d)\1+$/.test(d.slice(3))) return null;
    return '55' + d;
  }

  /* ── Formulário ── */
  const form = $('lead-form');
  const phone = $('f-whatsapp');
  phone.addEventListener('input', () => {
    phone.value = maskPhone(phone.value);
    clearErr('whatsapp');
  });

  function setErr(field, msg) {
    const wrap = form.querySelector(`[data-field="${field}"]`);
    wrap.classList.add('err');
    wrap.classList.remove('shake'); void wrap.offsetWidth; wrap.classList.add('shake');
    $('e-' + field).textContent = msg;
    const input = wrap.querySelector('input, select');
    input.setAttribute('aria-invalid', 'true');
    input.setAttribute('aria-describedby', 'e-' + field);
  }
  function clearErr(field) {
    const wrap = form.querySelector(`[data-field="${field}"]`);
    if (!wrap) return;
    wrap.classList.remove('err', 'shake');
    $('e-' + field).textContent = '';
    wrap.querySelector('input, select').removeAttribute('aria-invalid');
  }
  form.addEventListener('input', e => { const f = e.target.closest('[data-field]'); if (f && f.dataset.field !== 'whatsapp') clearErr(f.dataset.field); });
  form.addEventListener('change', e => { const f = e.target.closest('[data-field]'); if (f) clearErr(f.dataset.field); });

  function validate() {
    const errs = [];
    ['nome', 'empresa', 'cargo'].forEach(f => {
      if (!form.elements[f].value.trim()) errs.push([f, 'Preencha este campo.']);
    });
    if (!phone.value.trim()) errs.push(['whatsapp', 'Informe seu WhatsApp.']);
    else if (!normalizePhone(phone.value)) errs.push(['whatsapp', 'WhatsApp inválido. Use DDD + número, ex.: (15) 99999-8888.']);
    if (!form.elements.leads_mes.value) errs.push(['leads_mes', 'Selecione uma opção.']);
    if (!form.elements.consentimento.checked) errs.push(['consentimento', 'Marque para receber o material.']);
    ['nome', 'empresa', 'cargo', 'whatsapp', 'leads_mes', 'consentimento'].forEach(clearErr);
    errs.forEach(([f, m]) => setErr(f, m));
    if (errs.length) form.querySelector(`[data-field="${errs[0][0]}"] input, [data-field="${errs[0][0]}"] select`).focus();
    return !errs.length;
  }

  const btn = $('submit');
  function setSending(on) {
    btn.disabled = on;
    btn.classList.toggle('is-sending', on);
    btn.querySelector('.btn-tx').textContent = on ? 'Enviando...' : 'Receber no meu WhatsApp';
    btn.setAttribute('aria-busy', String(on));
  }

  async function send() {
    if (btn.disabled) return;
    if (!validate()) return;
    $('send-err').hidden = true;
    setSending(true);
    const payload = Object.assign({
      isca: slug,
      nome: form.elements.nome.value.trim(),
      empresa: form.elements.empresa.value.trim(),
      cargo: form.elements.cargo.value.trim(),
      whatsapp: normalizePhone(phone.value),
      leads_mes: form.elements.leads_mes.value,
      consentimento: form.elements.consentimento.checked
    }, utms, { hp: form.elements.hp.value });
    try {
      const r = await api('/webhook/lead-isca', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (!r.ok) throw new Error('HTTP ' + r.status);
      showSuccess();
    } catch (e) {
      setSending(false);
      $('send-err').hidden = false;
    }
  }
  form.addEventListener('submit', e => { e.preventDefault(); send(); });
  $('retry').addEventListener('click', send);

  function showSuccess() {
    form.hidden = true;
    const num = String(CFG.NUMERO_ALEX || '').replace(/\D/g, '');
    $('wa-link').href = 'https://wa.me/' + num + '?text=' + encodeURIComponent('Quero o material [' + slug + ']');
    const s = $('success');
    s.hidden = false;
    s.focus();
  }

  /* ── Init ── */
  $('privacy-link').href = CFG.POLITICA_URL || '#';
  if (MOCK) console.info('[AVIX] Modo mock ativo (?mock=1). Nenhuma chamada real ao n8n.');
  loadIsca();
})();
