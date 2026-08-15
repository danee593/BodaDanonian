// Auto-detect code from URL — runs immediately since this script is at end of <body>
(function rsvpAutoLoad() {
  // Check URL first — auto-submit only when code comes from the invitation link
  let code = new URLSearchParams(window.location.search).get('code');
  if (!code && window.location.hash.includes('?')) {
    code = new URLSearchParams(window.location.hash.split('?')[1]).get('code');
  }
  const fromUrl = !!code;

  // Fall back to sessionStorage — pre-fill only, no auto-submit
  if (!code) code = sessionStorage.getItem('rsvp_code');
  if (!code) return;

  document.getElementById('rsvp-code-input').value = code.toUpperCase();
  if (!fromUrl) document.getElementById('rsvp-clear-wrap').style.display = 'block';

  window.addEventListener('load', function () {
    document.getElementById('rsvp').scrollIntoView({ behavior: 'smooth' });
    if (fromUrl) setTimeout(rsvpCheckCode, 500); // auto-submit only from URL
  });
})();

const RSVP_ENDPOINT =
  'https://script.google.com/macros/s/AKfycbw6tjkf4e0fugKX6snI8KNW-GmxHLalxWY634ddk89EOigWIZIgQgf-hIE503x-e58C/exec';

let rsvpCurrentCode = '';
let rsvpCurrentData = null;
let rsvpTransport   = null;

// ── Lookup ──────────────────────────────────────────────────────────────────

async function rsvpCheckCode() {
  const input = document.getElementById('rsvp-code-input');
  const code  = input.value.trim().toUpperCase();
  if (!code) return;

  const err = document.getElementById('rsvp-error');
  const btn = document.getElementById('rsvp-submit-btn');

  err.style.display = 'none';
  btn.disabled      = true;
  const origText    = btn.textContent;
  btn.textContent   = '·  ·  ·';

  try {
    const res  = await fetch(`${RSVP_ENDPOINT}?code=${encodeURIComponent(code)}`);
    const data = await res.json();

    if (data && data.principal) {
      sessionStorage.setItem('rsvp_code', code);
      rsvpCurrentCode = code;
      rsvpCurrentData = data;
      if (data.is_submit === true) {
        rsvpShowSummary(data);
      } else {
        rsvpShowPersonal(data);
      }
    } else {
      err.style.display = 'block';
      input.focus();
    }
  } catch (e) {
    err.style.display = 'block';
    input.focus();
  } finally {
    btn.disabled    = false;
    btn.textContent = origText;
  }
}

// ── Step: personalized message + YES / NO ───────────────────────────────────

function rsvpShowPersonal(data) {
  const name     = data.principal;
  const name2    = data.secondary;
  const adults   = parseInt(data.adults)   || 0;
  const toddlers = parseInt(data.toddlers) || 0;
  const total    = adults + toddlers;

  const isGroup   = total > 1;
  const companion = name2 === 'familia' ? 'familia' : name2;
  const greeting  = isGroup ? `Hola, ${name} y ${companion}!` : `Hola, ${name}!`;
  const verb      = isGroup ? 'puedan' : 'puedas';

  let msg = `${greeting} Nos ilusiona mucho que ${verb} ser parte de este día tan especial para nosotros.`;

  if (total === 1) {
    msg += ' Tenemos reservado para ti 1 puesto.';
  } else {
    const adultStr   = `${adults} ${adults === 1 ? 'adulto' : 'adultos'}`;
    const toddlerStr = toddlers > 0
      ? ` y ${toddlers} ${toddlers === 1 ? 'niño' : 'niños'}`
      : '';
    msg += ` Tenemos reservados para ustedes ${total} puestos — ${adultStr}${toddlerStr}.`;
  }

  document.getElementById('rsvp-message-text').textContent    = msg;
  rsvpShow('rsvp-step-personal');
}

// ── Step: already-submitted summary ─────────────────────────────────────────

function rsvpShowSummary(data) {
  const msgs      = typeof i18n !== 'undefined' && i18n[lang] ? i18n[lang] : {};
  const name      = data.principal;
  const name2     = data.secondary;
  const isGroup   = (parseInt(data.adults) || 0) + (parseInt(data.toddlers) || 0) > 1;
  const companion = name2 === 'familia' ? 'familia' : name2;
  const displayName = isGroup ? `${name} y ${companion}` : name;
  const confirmed = data.is_confirmed === true;

  document.getElementById('rsvp-summary-greeting').textContent =
    `Hola, ${displayName}. Ya tienes tu respuesta enviada.`;

  const rows = document.getElementById('rsvp-summary-rows');
  rows.innerHTML = '';

  function addRow(label, value) {
    const row = document.createElement('div');
    row.className = 'rsvp-summary-row';
    row.innerHTML = `<span class="rsvp-summary-key">${label}</span><span class="rsvp-summary-val">${value}</span>`;
    rows.appendChild(row);
  }

  addRow(
    msgs.rsvp_s_attendance || 'Asistencia',
    confirmed
      ? (msgs.rsvp_s_confirmed  || 'Confirmada')
      : (msgs.rsvp_s_declined   || 'No asistirás')
  );

  if (data.allergy_or_restriction) {
    addRow(msgs.rsvp_s_dietary || 'Restricciones', data.allergy_or_restriction);
  }

  if (data.needs_transport !== '' && data.needs_transport !== null && data.needs_transport !== undefined) {
    addRow(
      msgs.rsvp_s_transport || 'Transporte',
      data.needs_transport ? (msgs.rsvp_si || 'Sí') : (msgs.rsvp_no_short || 'No')
    );
  }

  if (data.message) {
    addRow(msgs.rsvp_s_message || 'Mensaje', `"${data.message}"`);
  }

  rsvpShow('rsvp-step-summary');
}

// ── Step: questions form ─────────────────────────────────────────────────────

function rsvpRespond(attending) {
  const msgs = typeof i18n !== 'undefined' && i18n[lang] ? i18n[lang] : {};
  document.getElementById('rsvp-step-personal').style.display = 'none';

  if (attending) {
    // Pre-fill with any existing submitted data
    rsvpTransport = null;
    document.getElementById('rsvp-transport-yes').classList.remove('active');
    document.getElementById('rsvp-transport-no').classList.remove('active');

    if (rsvpCurrentData && rsvpCurrentData.is_submit) {
      document.getElementById('rsvp-dietary').value       = rsvpCurrentData.allergy_or_restriction || '';
      document.getElementById('rsvp-message-field').value = rsvpCurrentData.message || '';
      const t = rsvpCurrentData.needs_transport;
      if      (t === true  || t === 1) rsvpSetTransport(true);
      else if (t === false || t === 0) rsvpSetTransport(false);
    }

    rsvpShow('rsvp-step-questions');
  } else {
    rsvpPost({ code: rsvpCurrentCode, is_confirmed: false, alergy_or_restriction: '', needs_transport: '', message: '', is_submit: true });
    document.getElementById('rsvp-done-msg').textContent = msgs.rsvp_no_done || 'Gracias por avisarnos. Te echaremos mucho de menos ese día.';
    rsvpShow('rsvp-step-done');
  }
}

function rsvpGoBack() {
  rsvpShow('rsvp-step-personal');
}

function rsvpEdit() {
  rsvpShow('rsvp-step-personal');
}

function rsvpSetTransport(val) {
  rsvpTransport = val;
  document.getElementById('rsvp-transport-yes').classList.toggle('active', val === true);
  document.getElementById('rsvp-transport-no').classList.toggle('active', val === false);
}

// ── Submit ───────────────────────────────────────────────────────────────────

function rsvpPost(payload) {
  fetch(RSVP_ENDPOINT, {
    method:  'POST',
    headers: { 'Content-Type': 'text/plain' }, // avoids CORS preflight on GAS
    body:    JSON.stringify(payload)
  }).catch(() => {});
}

function rsvpSubmit(e) {
  e.preventDefault();
  const msgs      = typeof i18n !== 'undefined' && i18n[lang] ? i18n[lang] : {};
  const dietary   = document.getElementById('rsvp-dietary').value.trim();
  const message   = document.getElementById('rsvp-message-field').value.trim();
  const transport = rsvpTransport === null ? '' : rsvpTransport;

  rsvpPost({
    code:                   rsvpCurrentCode,
    is_confirmed:           true,
    alergy_or_restriction:  dietary,
    needs_transport:        transport,
    message,
    is_submit:              true
  });

  document.getElementById('rsvp-done-msg').textContent = msgs.rsvp_yes_done || '¡Nos vemos en Quito! Estamos muy emocionados de celebrar contigo ese día.';
  rsvpShow('rsvp-step-done');
}

function rsvpClearCode() {
  sessionStorage.removeItem('rsvp_code');
  document.getElementById('rsvp-code-input').value = '';
  document.getElementById('rsvp-clear-wrap').style.display = 'none';
  document.getElementById('rsvp-code-input').focus();
}

// ── Utility ──────────────────────────────────────────────────────────────────

function rsvpShow(id) {
  ['rsvp-step-code', 'rsvp-step-personal', 'rsvp-step-summary',
   'rsvp-step-questions', 'rsvp-step-done'].forEach(function (s) {
    document.getElementById(s).style.display = s === id ? 'block' : 'none';
  });
}
