// content/content.js — bundled (no ES imports for MV3 content scripts)
// Includes: lib/extractor.js, lib/ui.js, lib/tooltip.js, content logic

(function () {
  'use strict';

  // ══════════════════════════════════════════════════════════════════════════════
  // lib/extractor.js
  // ══════════════════════════════════════════════════════════════════════════════

  const CLAIM_TRIGGERS = [
    'because', 'actually', 'clearly', 'obviously', 'the fact is',
    'everyone knows', 'studies show', "it's proven", 'simply',
    'if you think about it', 'anyone with half a brain',
    'you have to admit', 'undeniably', 'without question',
    'there is no doubt', 'it is clear that', 'wake up',
    'sheep', 'sheeple', 'do your research', 'just saying',
  ];

  const PLATFORM_SELECTORS = {
    'reddit.com': [
      'shreddit-post [slot="text-body"] p',
      'shreddit-comment .md p',
      '[data-testid="post-container"] [data-click-id="text"]',
      '[data-testid="comment"]',
      '.Comment__body',
    ],
    'x.com': ['[data-testid="tweetText"]'],
    'twitter.com': ['[data-testid="tweetText"]'],
    'facebook.com': ['[data-ad-preview="message"]', '.userContent'],
  };

  function scoreText(text) {
    if (!text || text.length < 30) return 0;
    let score = 0;
    const lower = text.toLowerCase();
    for (const trigger of CLAIM_TRIGGERS) {
      if (lower.includes(trigger)) score += 2;
    }
    if (text.length > 100) score += 2;
    if (text.length > 250) score += 1;
    if (text.includes('?')) score += 1;
    return score;
  }

  function getSelectorsForHost(hostname) {
    for (const [domain, selectors] of Object.entries(PLATFORM_SELECTORS)) {
      if (hostname.includes(domain)) return selectors;
    }
    return ['p', 'article', '.post-content', '.entry-content', 'blockquote'];
  }

  function extractClaims(root) {
    root = root || document;
    const hostname = window.location.hostname;
    const selectors = getSelectorsForHost(hostname);
    const seen = new Set();
    const results = [];

    for (const selector of selectors) {
      try {
        const elements = root.querySelectorAll(selector);
        for (const el of elements) {
          const text = el.innerText?.trim();
          if (!text || seen.has(text)) continue;
          const score = scoreText(text);
          if (score >= 2) {
            seen.add(text);
            results.push({ text, score, element: el });
          }
        }
      } catch {
        // selector may be invalid on some pages
      }
    }

    return results.sort((a, b) => b.score - a.score).slice(0, 5);
  }

  function hashText(str) {
    let hash = 5381;
    for (let i = 0; i < str.length; i++) {
      hash = ((hash << 5) + hash) + str.charCodeAt(i);
      hash |= 0;
    }
    return hash.toString(36);
  }

  // ══════════════════════════════════════════════════════════════════════════════
  // lib/ui.js — Shadow DOM sidebar builder
  // ══════════════════════════════════════════════════════════════════════════════

  const SIDEBAR_ID = 'trollbox-sidebar-root';

  function isSidebarInjected() {
    return !!document.getElementById(SIDEBAR_ID);
  }

  function injectSidebar() {
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

  function showSpinner(sidebar) {
    const s = sidebar.shadowRoot;
    s.getElementById('idle-msg').style.display = 'none';
    s.getElementById('spinner').style.display = 'block';
    s.getElementById('candidates-area').innerHTML = '';
    s.getElementById('error-msg').style.display = 'none';
  }

  function showError(sidebar, message) {
    const s = sidebar.shadowRoot;
    s.getElementById('spinner').style.display = 'none';
    s.getElementById('idle-msg').style.display = 'none';
    s.getElementById('error-msg').textContent = message;
    s.getElementById('error-msg').style.display = 'block';
  }

  function showIdle(sidebar) {
    const s = sidebar.shadowRoot;
    s.getElementById('spinner').style.display = 'none';
    s.getElementById('error-msg').style.display = 'none';
    s.getElementById('candidates-area').innerHTML = '';
    s.getElementById('idle-msg').style.display = 'block';
  }

  const ROLE_ICON = { lead: '🥊', support: '📍', sting: '💀' };

  function renderCandidates(sidebar, candidates, claimText) {
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

  function onGenerateMore(sidebar, callback) {
    sidebar.shadowRoot.getElementById('generate-more-btn').addEventListener('click', callback);
  }

  // ══════════════════════════════════════════════════════════════════════════════
  // lib/tooltip.js — floating tooltip for highlight-to-generate
  // ══════════════════════════════════════════════════════════════════════════════

  const TOOLTIP_ID = 'deephook-tooltip-root';
  let tooltipHost = null;
  let tooltipShadow = null;

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

    tooltipShadow.getElementById('tooltip-close').addEventListener('click', hideTooltip);
  }

  function showTooltipAt(rect, claimText, onGenerate) {
    if (!tooltipHost) injectTooltip();

    const body = tooltipShadow.getElementById('tooltip-body');
    body.innerHTML = `
      <div class="claim-preview">"${claimText.slice(0, 150)}${claimText.length > 150 ? '…' : ''}"</div>
      <button id="generate-btn">🎣 Generate Bait</button>
    `;

    tooltipShadow.getElementById('generate-btn').addEventListener('click', () => {
      onGenerate(claimText);
    });

    Object.assign(tooltipHost.style, {
      display: 'block',
      position: 'fixed',
      top: `${rect.bottom + 8}px`,
      left: `${Math.min(Math.max(10, rect.left), window.innerWidth - 440)}px`,
    });
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
    body.innerHTML = `<div id="error-msg">${msg}</div>`;
  }

  function renderTooltipCandidates(candidates, claimText, onInsert) {
    const body = tooltipShadow.getElementById('tooltip-body');
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

  // ══════════════════════════════════════════════════════════════════════════════
  // Main content script logic
  // ══════════════════════════════════════════════════════════════════════════════

  let lastHash = null;
  let isGenerating = false;
  let currentClaim = null;
  let rescanTimer = null;
  let contentRescanTimer = null;
  let sidebar = null;
  let initialized = false;

  // ── Highlight-to-generate ──────────────────────────────────────────────────

  function initHighlightMode() {
    injectTooltip();

    document.addEventListener('mouseup', (e) => {
      if (e.target.closest?.('#trollbox-sidebar-root') || e.target.closest?.('#deephook-tooltip-root')) return;

      const sel = window.getSelection();
      const text = sel?.toString().trim();

      if (!text || text.length < 20) {
        setTimeout(() => {
          const currentSel = window.getSelection()?.toString().trim();
          if (!currentSel || currentSel.length < 20) hideTooltip();
        }, 200);
        return;
      }

      const range = sel.getRangeAt(0);
      const rect = range.getBoundingClientRect();
      showTooltipAt(rect, text, (claimText) => {
        generateFromHighlight(claimText, rect);
      });
    });
  }

  async function generateFromHighlight(claimText, rect) {
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

  // ── Auto-scan sidebar ─────────────────────────────────────────────────────

  let autoModeEnabled = true; // will be synced from storage on init

  async function syncAutoMode() {
    try {
      const settings = await new Promise(resolve => {
        chrome.storage.local.get({ autoMode: true }, resolve);
      });
      autoModeEnabled = settings.autoMode !== false;
    } catch {
      autoModeEnabled = true;
    }
  }

  // Listen for storage changes (e.g., user toggles auto in popup)
  chrome.storage.onChanged.addListener((changes) => {
    if (changes.autoMode) {
      autoModeEnabled = changes.autoMode.newValue !== false;
      if (!autoModeEnabled && isGenerating) {
        isGenerating = false;
        if (sidebar) showIdle(sidebar);
      }
    }
  });

  function init() {
    syncAutoMode();
    sidebar = injectSidebar();
    onGenerateMore(sidebar, () => {
      if (currentClaim) triggerGeneration(currentClaim);
    });

    initHighlightMode();
    scanAndGenerate();
    watchForSPANavigation();
    initialized = true;
  }

  function watchForSPANavigation() {
    let lastUrl = location.href;
    const urlObserver = new MutationObserver(() => {
      if (location.href !== lastUrl) {
        // Real SPA navigation — rescan promptly.
        lastUrl = location.href;
        scheduleRescan();
      } else {
        // Same URL, DOM just mutated (infinite scroll, live updates). Firing on
        // every mutation re-scans the whole DOM continuously and hammers the
        // engine. Debounce heavily so we only rescan once mutations settle.
        scheduleContentRescan();
      }
    });
    urlObserver.observe(document.body, {
      childList: true, subtree: true,
      characterData: false, attributes: false,
    });
  }

  function scheduleRescan() {
    clearTimeout(rescanTimer);
    clearTimeout(contentRescanTimer);
    rescanTimer = setTimeout(scanAndGenerate, 200);
  }

  function scheduleContentRescan() {
    clearTimeout(contentRescanTimer);
    contentRescanTimer = setTimeout(scanAndGenerate, 1500);
  }

  function scanAndGenerate() {
    if (!initialized) return;
    if (!autoModeEnabled) {
      if (!isGenerating && isSidebarInjected()) showIdle(sidebar);
      return;
    }
    const claims = extractClaims(document);
    if (!claims.length) {
      if (!isGenerating && isSidebarInjected()) showIdle(sidebar);
      return;
    }
    const topClaim = claims[0];
    const hash = hashText(topClaim.text);
    if (hash === lastHash) return;
    lastHash = hash;
    currentClaim = topClaim.text;
    triggerGeneration(topClaim.text);
  }

  async function triggerGeneration(claimText) {
    if (isGenerating) return;
    isGenerating = true;

    if (!isSidebarInjected()) {
      sidebar = injectSidebar();
      onGenerateMore(sidebar, () => {
        if (currentClaim) triggerGeneration(currentClaim);
      });
    }
    showSpinner(sidebar);

    try {
      const response = await sendMessageWithTimeout({
        type: 'GENERATE_REQUEST',
        payload: { claimText, url: location.href, persona: null, platform: null },
      }, 120000);

      if (response.type === 'GENERATE_ERROR') {
        showError(sidebar, `⚠️ ${response.error}`);
      } else if (response.type === 'GENERATE_RESPONSE') {
        renderCandidates(sidebar, response.candidates || [], claimText);
      } else {
        showError(sidebar, '⚠️ Unexpected response from engine');
      }
    } catch (err) {
      showError(sidebar, `⚠️ ${err.message || 'Generation failed'}`);
    } finally {
      isGenerating = false;
    }
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

  // Boot
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
