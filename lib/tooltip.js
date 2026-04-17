// lib/tooltip.js — floating tooltip for highlight-to-generate

const TOOLTIP_ID = 'deephook-tooltip-root';

let tooltipHost = null;
let shadow = null;

export function injectTooltip() {
  if (document.getElementById(TOOLTIP_ID)) return;

  tooltipHost = document.createElement('div');
  tooltipHost.id = TOOLTIP_ID;
  Object.assign(tooltipHost.style, {
    position: 'fixed',
    zIndex: '2147483647',
    display: 'none',
  });

  shadow = tooltipHost.attachShadow({ mode: 'open' });
  shadow.innerHTML = `
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    #tooltip {
      background: #1a1a1a;
      color: #eee;
      border: 1px solid #444;
      border-radius: 10px;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      box-shadow: 0 8px 32px rgba(0,0,0,0.5);
      max-width: 420px;
      min-width: 300px;
      overflow: hidden;
    }
    #tooltip-header {
      display: flex; justify-content: space-between; align-items: center;
      padding: 8px 12px;
      background: #111;
      border-bottom: 1px solid #333;
    }
    #tooltip-title { font-weight: bold; font-size: 13px; color: #fff; }
    #tooltip-close {
      background: none; border: none; color: #888;
      cursor: pointer; font-size: 16px; padding: 0 4px;
    }
    #tooltip-close:hover { color: #fff; }
    #tooltip-body { padding: 10px; }
    #generate-btn {
      width: 100%; background: #2d1f4e; border: 1px solid #5b3fa0;
      color: #d4bfff; border-radius: 6px; padding: 8px 12px;
      font-size: 13px; font-weight: 600; cursor: pointer;
      transition: all 0.15s;
    }
    #generate-btn:hover { background: #3d2a6e; color: #fff; }
    .claim-preview {
      font-size: 11px; color: #888;
      border-left: 2px solid #5b3fa0; padding-left: 8px;
      margin-bottom: 10px; max-height: 50px;
      overflow: hidden; text-overflow: ellipsis;
      line-height: 1.4;
    }
    #spinner { text-align: center; padding: 16px; color: #888; font-size: 13px; }
    #error-msg { color: #e57373; font-size: 12px; padding: 10px; text-align: center; }
    .candidate {
      background: #222; border: 1px solid #333;
      border-radius: 8px; padding: 10px 12px; margin-bottom: 8px;
      font-size: 13px; line-height: 1.5;
    }
    .candidate-header {
      display: flex; justify-content: space-between; align-items: center;
      font-size: 10px; color: #666; margin-bottom: 6px;
    }
    .role-badge { font-weight: bold; }
    .role-lead { color: #f0883e; }
    .role-support { color: #58a6ff; }
    .role-sting { color: #da3633; }
    .candidate-text { word-break: break-word; color: #ddd; }
    .btn-row { display: flex; gap: 6px; margin-top: 8px; }
    .copy-btn, .insert-btn {
      flex: 1; border-radius: 4px; padding: 5px 8px;
      font-size: 11px; cursor: pointer; font-weight: 600;
      transition: all 0.15s; border: 1px solid;
    }
    .copy-btn {
      background: #1a2a1a; border-color: #4caf50; color: #4caf50;
    }
    .copy-btn:hover { background: #2a3a2a; color: #6fcf6f; }
    .copy-btn.copied { background: #1a3a1a; color: #4caf50; }
    .insert-btn {
      background: #1a1a2e; border-color: #5b8cff; color: #5b8cff;
    }
    .insert-btn:hover { background: #222244; color: #8cb4ff; }
    .insert-btn.inserted { background: #1a2a3a; color: #5b8cff; }
    #regenerate-btn {
      width: 100%; background: #222; border: 1px solid #444; color: #aaa;
      border-radius: 4px; padding: 6px; font-size: 12px; cursor: pointer;
      margin-top: 4px;
    }
    #regenerate-btn:hover { background: #333; color: #fff; }
  </style>
  <div id="tooltip">
    <div id="tooltip-header">
      <span id="tooltip-title">🎣 DeepHook</span>
      <button id="tooltip-close">✕</button>
    </div>
    <div id="tooltip-body">
      <button id="generate-btn">🎣 Generate Bait</button>
    </div>
  </div>`;

  document.body.appendChild(tooltipHost);

  shadow.getElementById('tooltip-close').addEventListener('click', hideTooltip);
}

export function showTooltipAt(rect, claimText, onGenerate) {
  if (!tooltipHost) injectTooltip();

  const body = shadow.getElementById('tooltip-body');
  body.innerHTML = `
    <div class="claim-preview">"${claimText.slice(0, 150)}${claimText.length > 150 ? '…' : ''}"</div>
    <button id="generate-btn">🎣 Generate Bait</button>
  `;

  shadow.getElementById('generate-btn').addEventListener('click', () => {
    onGenerate(claimText);
  });

  // Position near selection
  const top = rect.bottom + window.scrollY + 8;
  const left = Math.max(10, rect.left + window.scrollX);

  Object.assign(tooltipHost.style, {
    display: 'block',
    position: 'absolute',
    top: `${rect.bottom + 8}px`,
    left: `${Math.min(left, window.innerWidth - 440)}px`,
    position: 'fixed',
  });
}

export function hideTooltip() {
  if (tooltipHost) tooltipHost.style.display = 'none';
}

export function showTooltipSpinner() {
  const body = shadow.getElementById('tooltip-body');
  body.innerHTML = `<div id="spinner">⚙️ generating bait…</div>`;
}

export function showTooltipError(msg) {
  const body = shadow.getElementById('tooltip-body');
  body.innerHTML = `<div id="error-msg">${msg}</div>`;
}

const ROLE_ICON = { lead: '🥊', support: '📍', sting: '💀' };

export function renderTooltipCandidates(candidates, claimText, onInsert) {
  const body = shadow.getElementById('tooltip-body');
  body.innerHTML = '';

  const preview = document.createElement('div');
  preview.className = 'claim-preview';
  preview.textContent = `"${claimText.slice(0, 120)}${claimText.length > 120 ? '…' : ''}"`;
  body.appendChild(preview);

  for (const cand of candidates) {
    const role = cand.weave_role || cand.role || 'lead';
    const icon = ROLE_ICON[role] || '💬';
    const text = cand.candidate_text || cand.text || '';

    const div = document.createElement('div');
    div.className = 'candidate';
    div.innerHTML = `
      <div class="candidate-header">
        <span class="role-badge role-${role}">${icon} ${role}</span>
      </div>
      <div class="candidate-text">${text.replace(/</g, '&lt;')}</div>
      <div class="btn-row">
        <button class="copy-btn">📋 Copy</button>
        <button class="insert-btn">⏎ Insert</button>
      </div>`;

    div.querySelector('.copy-btn').addEventListener('click', async (e) => {
      await navigator.clipboard.writeText(text);
      e.target.textContent = '✓ Copied!';
      setTimeout(() => { e.target.textContent = '📋 Copy'; }, 1500);
    });

    div.querySelector('.insert-btn').addEventListener('click', (e) => {
      onInsert(text);
      e.target.textContent = '✓ Inserted!';
      setTimeout(() => { e.target.textContent = '⏎ Insert'; }, 1500);
    });

    body.appendChild(div);
  }

  const regen = document.createElement('button');
  regen.id = 'regenerate-btn';
  regen.textContent = '↻ Regenerate';
  regen.addEventListener('click', () => {
    showTooltipSpinner();
    chrome.runtime.sendMessage({
      type: 'GENERATE_REQUEST',
      payload: { claimText, url: location.href, persona: null, platform: null },
    }, (response) => {
      if (response?.type === 'GENERATE_RESPONSE') {
        renderTooltipCandidates(response.candidates || [], claimText, onInsert);
      } else {
        showTooltipError(`⚠️ ${response?.error || 'Failed'}`);
      }
    });
  });
  body.appendChild(regen);
}
