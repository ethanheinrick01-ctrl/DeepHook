// popup/popup.js
import { getSettings, setSetting } from '../lib/storage.js';

const $ = id => document.getElementById(id);

// Legacy persona ids (v1.1.0 and earlier) → real engine persona names.
// Older builds shipped short names the engine never recognized, so it
// silently fell back to dry_midwit_savant. Map saved values forward.
const LEGACY_PERSONA_MAP = {
  smug_oracle: 'smug_moron_oracle',
  calm_ghoul: 'calm_unbothered_ghoul',
  fake_sincere: 'fake_sincere_questioner',
  absurdist: 'absurdist_accelerator',
};

function normalizePersona(value) {
  return LEGACY_PERSONA_MAP[value] || value || 'dry_midwit_savant';
}

async function init() {
  const settings = await getSettings();

  // ── Mode ──────────────────────────────────────────────────────────────────
  $('btn-local').addEventListener('click', () => {
    setActivePair('btn-local', 'btn-cloud', 'btn-local');
    $('supabase-key-row').style.display = 'none';
  });
  $('btn-cloud').addEventListener('click', () => {
    setActivePair('btn-local', 'btn-cloud', 'btn-cloud');
    $('supabase-key-row').style.display = 'flex';
  });

  if (settings.mode === 'local') {
    setActivePair('btn-local', 'btn-cloud', 'btn-local');
  } else {
    setActivePair('btn-local', 'btn-cloud', 'btn-cloud');
    $('supabase-key-row').style.display = 'flex';
  }

  // ── Auto ───────────────────────────────────────────────────────────────────
  $('btn-auto-off').addEventListener('click', () =>
    setActivePair('btn-auto-off', 'btn-auto-on', 'btn-auto-off')
  );
  $('btn-auto-on').addEventListener('click', () =>
    setActivePair('btn-auto-off', 'btn-auto-on', 'btn-auto-on')
  );

  if (settings.autoMode) {
    setActivePair('btn-auto-off', 'btn-auto-on', 'btn-auto-on');
  } else {
    setActivePair('btn-auto-off', 'btn-auto-on', 'btn-auto-off');
  }

  // ── Dropdowns ───────────────────────────────────────────────────────────────
  $('persona-select').value = normalizePersona(settings.persona);
  $('platform-select').value = settings.platform || 'web';
  $('supabase-key').value = settings.supabaseAnonKey || '';

  // ── Status check ────────────────────────────────────────────────────────────
  checkStatus(settings.mode);

  // ── Save ─────────────────────────────────────────────────────────────────────
  $('save-btn').addEventListener('click', async () => {
    const mode = $('btn-local').classList.contains('active') ? 'local' : 'cloud';
    await setSetting('mode', mode);
    await setSetting('persona', $('persona-select').value);
    await setSetting('platform', $('platform-select').value);
    await setSetting('autoMode', $('btn-auto-on').classList.contains('active'));
    await setSetting('supabaseAnonKey', $('supabase-key').value.trim());

    const msg = $('save-msg');
    msg.style.display = 'block';
    setTimeout(() => { msg.style.display = 'none'; }, 2000);

    checkStatus(mode);
  });
}

function setActivePair(aId, bId, activeId) {
  $(aId).classList.toggle('active', aId === activeId);
  $(bId).classList.toggle('active', bId === activeId);
}

async function checkStatus(mode) {
  const indicator = $('status-indicator');
  if (mode === 'local') {
    try {
      const res = await fetch('http://localhost:8765/api/health', {
        signal: AbortSignal.timeout(2000),
      });
      if (res.ok) {
        indicator.textContent = '🟢 Engine online';
      } else {
        indicator.textContent = '🟡 Engine responded (non-200)';
      }
    } catch {
      indicator.textContent = '🔴 Engine offline — start panel-serve';
    }
  } else {
    indicator.textContent = '☁️ Cloud mode';
  }
}

init();
