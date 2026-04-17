// content/content.js — manual-only highlight tooltip (no auto-scan, no sidebar)

(function () {
  'use strict';

  // ══════════════════════════════════════════════════════════════════════════════
  // Draggable tooltip (shadow DOM, manual highlight → generate)
  // ══════════════════════════════════════════════════════════════════════════════

  const TOOLTIP_ID = 'deephook-tooltip-root';
  const ROLE_ICON = { lead: '🥊', support: '📍', sting: '💀' };

  let tooltipHost = null;
  let tooltipShadow = null;
  let userMoved = false;

  function injectTooltip() {
    if (document.getElementById(TOOLTIP_ID)) return;

    tooltipHost = document.createElement('div');
    tooltipHost.id = TOOLTIP_ID;
    Object.assign(tooltipHost.style, {
      position: 'fixed',
      zIndex: '2147483647',
      display: 'none',
    });

    tooltipShadow = tooltipHost.attachShadow({ mode: 'open' });
    tooltipShadow.innerHTML = `
    <style>
      * { box-sizing: border-box; margin: 0; padding: 0; }
      #tooltip {
        background: #1a1a1a;
        color: #eee;
        border: 1px solid #444;
        border-radius: 10px;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
        box-shadow: 0 8px 32px rgba(0,0,0,0.5);
        width: 420px;
        max-height: 70vh;
        display: flex;
        flex-direction: column;
        overflow: hidden;
      }
      #tooltip-header {
        display: flex; justify-content: space-between; align-items: center;
        padding: 8px 12px;
        background: #111;
        border-bottom: 1px solid #333;
        cursor: grab;
        user-select: none;
        flex-shrink: 0;
      }
      #tooltip-header.dragging { cursor: grabbing; }
      #tooltip-title { font-weight: bold; font-size: 13px; color: #fff; }
      #tooltip-close {
        background: none; border: none; color: #888;
        cursor: pointer; font-size: 16px; padding: 0 4px;
      }
      #tooltip-close:hover { color: #fff; }
      #tooltip-body {
        padding: 10px;
        overflow-y: auto;
        flex: 1 1 auto;
      }
      #generate-btn {
        width: 100%; background: #2d1f4e; border: 1px solid #5b3fa0;
        color: #d4bfff; border-radius: 6px; padding: 8px 12px;
        font-size: 13px; font-weight: 600; cursor: pointer;
        transition: all 0.15s;
      }
      #generate-btn:hover { background: #3d2a6e; color: #fff; }
      .claim-preview {
        font-size: 11px; color: #aaa;
        border-left: 2px solid #5b3fa0; padding: 6px 0 6px 8px;
        margin-bottom: 10px;
        line-height: 1.4;
        white-space: pre-wrap;
        word-break: break-word;
        max-height: 120px;
        overflow-y: auto;
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
      .candidate-text {
        word-break: break-word;
        white-space: pre-wrap;
        color: #ddd;
      }
      .btn-row { display: flex; gap: 6px; margin-top: 8px; }
      .copy-btn, .insert-btn {
        flex: 1; border-radius: 4px; padding: 6px 8px;
        font-size: 12px; cursor: pointer; font-weight: 600;
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
        <button id="tooltip-close" title="Close">✕</button>
      </div>
      <div id="tooltip-body">
        <button id="generate-btn">🎣 Generate Bait</button>
      </div>
    </div>`;

    document.body.appendChild(tooltipHost);

    tooltipShadow.getElementById('tooltip-close').addEventListener('click', hideTooltip);
    makeDraggable(tooltipShadow.getElementById('tooltip-header'));
  }

  function makeDraggable(handle) {
    let startX = 0, startY = 0, startLeft = 0, startTop = 0, dragging = false;

    handle.addEventListener('mousedown', (e) => {
      if (e.target.id === 'tooltip-close') return;
      dragging = true;
      handle.classList.add('dragging');
      const rect = tooltipHost.getBoundingClientRect();
      startX = e.clientX;
      startY = e.clientY;
      startLeft = rect.left;
      startTop = rect.top;
      tooltipHost.style.left = `${startLeft}px`;
      tooltipHost.style.top = `${startTop}px`;
      e.preventDefault();
    });

    document.addEventListener('mousemove', (e) => {
      if (!dragging) return;
      const nx = startLeft + (e.clientX - startX);
      const ny = startTop + (e.clientY - startY);
      const maxX = window.innerWidth - 80;
      const maxY = window.innerHeight - 40;
      tooltipHost.style.left = `${Math.min(Math.max(-tooltipHost.offsetWidth + 80, nx), maxX)}px`;
      tooltipHost.style.top = `${Math.min(Math.max(0, ny), maxY)}px`;
      userMoved = true;
    });

    document.addEventListener('mouseup', () => {
      if (dragging) handle.classList.remove('dragging');
      dragging = false;
    });
  }

  function showTooltipAt(rect, claimText, onGenerate) {
    if (!tooltipHost) injectTooltip();

    const body = tooltipShadow.getElementById('tooltip-body');
    body.innerHTML = `
      <div class="claim-preview"></div>
      <button id="generate-btn">🎣 Generate Bait</button>
    `;
    body.querySelector('.claim-preview').textContent = `"${claimText}"`;

    tooltipShadow.getElementById('generate-btn').addEventListener('click', () => {
      onGenerate(claimText);
    });

    tooltipHost.style.display = 'block';
    if (!userMoved) {
      const left = Math.min(Math.max(10, rect.left), window.innerWidth - 440);
      const top = Math.min(rect.bottom + 8, window.innerHeight - 100);
      tooltipHost.style.left = `${left}px`;
      tooltipHost.style.top = `${top}px`;
    }
  }

  function hideTooltip() {
    if (tooltipHost) tooltipHost.style.display = 'none';
  }

  function showTooltipSpinner() {
    const body = tooltipShadow.getElementById('tooltip-body');
    body.innerHTML = `<div id="spinner">⚙️ generating bait…</div>`;
  }

  function showTooltipError(msg) {
    const body = tooltipShadow.getElementById('tooltip-body');
    body.innerHTML = `<div id="error-msg"></div>`;
    body.querySelector('#error-msg').textContent = msg;
  }

  function renderTooltipCandidates(candidates, claimText, onInsert) {
    const body = tooltipShadow.getElementById('tooltip-body');
    body.innerHTML = '';

    const preview = document.createElement('div');
    preview.className = 'claim-preview';
    preview.textContent = `"${claimText}"`;
    body.appendChild(preview);

    for (const cand of candidates) {
      const role = cand.weave_role || cand.role || 'lead';
      const icon = ROLE_ICON[role] || '💬';
      const text = cand.candidate_text || cand.text || '';

      const div = document.createElement('div');
      div.className = 'candidate';

      const header = document.createElement('div');
      header.className = 'candidate-header';
      const badge = document.createElement('span');
      badge.className = `role-badge role-${role}`;
      badge.textContent = `${icon} ${role}`;
      header.appendChild(badge);

      const textDiv = document.createElement('div');
      textDiv.className = 'candidate-text';
      textDiv.textContent = text;

      const btnRow = document.createElement('div');
      btnRow.className = 'btn-row';

      const copyBtn = document.createElement('button');
      copyBtn.className = 'copy-btn';
      copyBtn.textContent = '📋 Copy';
      copyBtn.addEventListener('click', async () => {
        try {
          await navigator.clipboard.writeText(text);
          copyBtn.textContent = '✓ Copied!';
          copyBtn.classList.add('copied');
          setTimeout(() => {
            copyBtn.textContent = '📋 Copy';
            copyBtn.classList.remove('copied');
          }, 1500);
        } catch {
          copyBtn.textContent = '⚠️ Failed';
        }
      });

      const insertBtn = document.createElement('button');
      insertBtn.className = 'insert-btn';
      insertBtn.textContent = '⏎ Insert';
      insertBtn.addEventListener('click', () => {
        onInsert(text);
        insertBtn.textContent = '✓ Inserted!';
        insertBtn.classList.add('inserted');
        setTimeout(() => {
          insertBtn.textContent = '⏎ Insert';
          insertBtn.classList.remove('inserted');
        }, 1500);
      });

      btnRow.appendChild(copyBtn);
      btnRow.appendChild(insertBtn);

      div.appendChild(header);
      div.appendChild(textDiv);
      div.appendChild(btnRow);
      body.appendChild(div);
    }

    const regen = document.createElement('button');
    regen.id = 'regenerate-btn';
    regen.textContent = '↻ Regenerate';
    regen.addEventListener('click', () => {
      generateFromHighlight(claimText);
    });
    body.appendChild(regen);
  }

  // ══════════════════════════════════════════════════════════════════════════════
  // Main — highlight → generate (manual only)
  // ══════════════════════════════════════════════════════════════════════════════

  let isGenerating = false;

  function init() {
    injectTooltip();

    document.addEventListener('mouseup', (e) => {
      if (e.target.closest?.('#deephook-tooltip-root')) return;

      const sel = window.getSelection();
      const text = sel?.toString().trim();

      if (!text || text.length < 20) return;

      const range = sel.getRangeAt(0);
      const rect = range.getBoundingClientRect();
      showTooltipAt(rect, text, (claimText) => {
        generateFromHighlight(claimText);
      });
    });
  }

  async function generateFromHighlight(claimText) {
    if (isGenerating) return;
    isGenerating = true;

    showTooltipSpinner();

    try {
      const response = await sendMessageWithTimeout({
        type: 'GENERATE_REQUEST',
        payload: {
          claimText,
          url: location.href,
          persona: null,
          platform: null,
        },
      }, 120000);

      if (response.type === 'GENERATE_ERROR') {
        showTooltipError(`⚠️ ${response.error}`);
      } else if (response.type === 'GENERATE_RESPONSE') {
        renderTooltipCandidates(response.candidates || [], claimText, (text) => {
          insertIntoReply(text);
        });
      } else {
        showTooltipError('⚠️ Unexpected response');
      }
    } catch (err) {
      showTooltipError(`⚠️ ${err.message || 'Generation failed'}`);
    } finally {
      isGenerating = false;
    }
  }

  function insertIntoReply(text) {
    const selectors = [
      'div[contenteditable="true"]',
      'textarea[name="body"]',
      'textarea[placeholder*="comment"]',
      'textarea[placeholder*="reply"]',
      '[data-testid="tweetTextarea_0"]',
      '[role="textbox"][data-testid]',
      'textarea',
      '[contenteditable="true"]',
    ];

    for (const sel of selectors) {
      const el = document.querySelector(sel);
      if (el && el.offsetParent !== null) {
        if (el.tagName === 'TEXTAREA' || el.tagName === 'INPUT') {
          el.value = text;
          el.dispatchEvent(new Event('input', { bubbles: true }));
        } else {
          el.focus();
          document.execCommand('insertText', false, text);
        }
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        return true;
      }
    }
    navigator.clipboard.writeText(text);
    return false;
  }

  function sendMessageWithTimeout(message, timeoutMs) {
    timeoutMs = timeoutMs || 120000;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error('Service worker timeout — try reloading the page'));
      }, timeoutMs);
      chrome.runtime.sendMessage(message, (response) => {
        clearTimeout(timer);
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
        } else {
          resolve(response);
        }
      });
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
