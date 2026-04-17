// lib/ui.js — Shadow DOM sidebar builder

const SIDEBAR_ID = 'trollbox-sidebar-root';

export function isSidebarInjected() {
  return !!document.getElementById(SIDEBAR_ID);
}

export function injectSidebar() {
  if (isSidebarInjected()) return document.getElementById(SIDEBAR_ID);

  const host = document.createElement('div');
  host.id = SIDEBAR_ID;
  Object.assign(host.style, {
    position: 'fixed',
    top: '80px',
    right: '0',
    zIndex: '2147483647',
    width: '320px',
  });

  const shadow = host.attachShadow({ mode: 'open' });
  shadow.innerHTML = `
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    #panel {
      background: #111;
      color: #eee;
      border-radius: 8px 0 0 8px;
      border: 1px solid #333;
      border-right: none;
      overflow: hidden;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    }
    #header {
      display: flex; justify-content: space-between; align-items: center;
      padding: 10px 12px;
      background: #1a1a1a;
      border-bottom: 1px solid #333;
      cursor: grab;
      user-select: none;
    }
    #title { font-weight: bold; font-size: 14px; color: #fff; }
    #collapse-btn {
      background: none; border: none; color: #aaa;
      cursor: pointer; font-size: 16px; padding: 0 4px;
    }
    #collapse-btn:hover { color: #fff; }
    #body { padding: 10px; }
    .collapsed #body { display: none; }
    #spinner { text-align: center; padding: 20px; color: #666; font-size: 13px; }
    .claim-preview {
      font-size: 11px; color: #888;
      border-left: 2px solid #444; padding-left: 8px;
      margin-bottom: 10px; max-height: 40px;
      overflow: hidden; text-overflow: ellipsis;
    }
    .candidate {
      background: #1c1c1c; border: 1px solid #2a2a2a;
      border-radius: 6px; padding: 8px 10px; margin-bottom: 8px;
      font-size: 13px; line-height: 1.5;
    }
    .candidate-header {
      display: flex; justify-content: space-between; align-items: center;
      font-size: 10px; color: #666; margin-bottom: 4px;
    }
    .role-badge { font-weight: bold; }
    .role-lead { color: #f0883e; }
    .role-support { color: #58a6ff; }
    .role-sting { color: #da3633; }
    .copy-btn {
      background: #2a2a2a; border: 1px solid #444; color: #ccc;
      border-radius: 4px; padding: 2px 8px; font-size: 11px; cursor: pointer;
    }
    .copy-btn:hover { background: #333; color: #fff; }
    .copy-btn.copied { background: #1a3a1a; color: #4caf50; border-color: #4caf50; }
    .candidate-text { word-break: break-word; }
    #error-msg { color: #e57373; font-size: 12px; padding: 10px; text-align: center; }
    #actions { display: flex; gap: 8px; margin-top: 10px; }
    #generate-more-btn {
      flex: 1; background: #1a1a2e; border: 1px solid #444; color: #aaa;
      border-radius: 4px; padding: 6px; font-size: 12px; cursor: pointer;
    }
    #generate-more-btn:hover { background: #222244; color: #fff; }
    #idle-msg { text-align: center; padding: 20px; color: #555; font-size: 12px; }
  </style>
  <div id="panel">
    <div id="header">
      <span id="title">🎣 DeepHook Bait Layer</span>
      <button id="collapse-btn">▲</button>
    </div>
    <div id="body">
      <div id="idle-msg">Highlight text or scroll to scan</div>
      <div id="spinner" style="display:none">⚙️ generating…</div>
      <div id="candidates-area"></div>
      <div id="error-msg" style="display:none"></div>
      <div id="actions">
        <button id="generate-more-btn">↻ Generate More</button>
      </div>
    </div>
  </div>`;

  document.body.appendChild(host);

  const panel = shadow.getElementById('panel');
  shadow.getElementById('collapse-btn').addEventListener('click', () => {
    panel.classList.toggle('collapsed');
    shadow.getElementById('collapse-btn').textContent =
      panel.classList.contains('collapsed') ? '▼' : '▲';
  });

  return host;
}

export function getSidebar() {
  return document.getElementById(SIDEBAR_ID);
}

export function showSpinner(sidebar) {
  const s = sidebar.shadowRoot;
  s.getElementById('idle-msg').style.display = 'none';
  s.getElementById('spinner').style.display = 'block';
  s.getElementById('candidates-area').innerHTML = '';
  s.getElementById('error-msg').style.display = 'none';
}

export function showError(sidebar, message) {
  const s = sidebar.shadowRoot;
  s.getElementById('spinner').style.display = 'none';
  s.getElementById('idle-msg').style.display = 'none';
  s.getElementById('error-msg').textContent = message;
  s.getElementById('error-msg').style.display = 'block';
}

export function showIdle(sidebar) {
  const s = sidebar.shadowRoot;
  s.getElementById('spinner').style.display = 'none';
  s.getElementById('error-msg').style.display = 'none';
  s.getElementById('candidates-area').innerHTML = '';
  s.getElementById('idle-msg').style.display = 'block';
}

const ROLE_ICON = { lead: '🥊', support: '📍', sting: '💀' };

export function renderCandidates(sidebar, candidates, claimText) {
  const s = sidebar.shadowRoot;
  s.getElementById('spinner').style.display = 'none';
  s.getElementById('idle-msg').style.display = 'none';
  s.getElementById('error-msg').style.display = 'none';
  const area = s.getElementById('candidates-area');
  area.innerHTML = '';

  if (claimText) {
    const preview = document.createElement('div');
    preview.className = 'claim-preview';
    preview.textContent = `"${claimText.slice(0, 120)}${claimText.length > 120 ? '…' : ''}"`;
    area.appendChild(preview);
  }

  for (const cand of candidates) {
    const role = cand.weave_role || cand.role || 'lead';
    const icon = ROLE_ICON[role] || '💬';
    const text = cand.candidate_text || cand.text || '';
    const encoded = encodeURIComponent(text);

    const div = document.createElement('div');
    div.className = 'candidate';
    div.innerHTML = `
      <div class="candidate-header">
        <span class="role-badge role-${role}">${icon} ${role}</span>
        <button class="copy-btn" data-text="${encoded}">copy</button>
      </div>
      <div class="candidate-text">${text.replace(/</g, '&lt;')}</div>`;

    div.querySelector('.copy-btn').addEventListener('click', async (e) => {
      const t = decodeURIComponent(e.target.dataset.text);
      await navigator.clipboard.writeText(t);
      e.target.textContent = '✓ copied';
      e.target.classList.add('copied');
      setTimeout(() => {
        e.target.textContent = 'copy';
        e.target.classList.remove('copied');
      }, 1500);
    });

    area.appendChild(div);
  }
}

export function onGenerateMore(sidebar, callback) {
  sidebar.shadowRoot.getElementById('generate-more-btn').addEventListener('click', callback);
}
