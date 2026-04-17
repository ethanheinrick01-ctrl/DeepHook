// background/service-worker.js
// Routes GENERATE_REQUEST from content.js → local engine OR Supabase

import { getSettings } from '../lib/storage.js';
import { SupabaseClient } from '../lib/supabase-client.js';

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'GENERATE_REQUEST') {
    handleGenerateRequest(message.payload)
      .then(candidates => sendResponse({ type: 'GENERATE_RESPONSE', candidates }))
      .catch(err => sendResponse({ type: 'GENERATE_ERROR', error: err.message }));
    return true; // keep channel open for async response
  }

  if (message.type === 'PING') {
    sendResponse({ type: 'PONG' });
    return true;
  }
});

async function handleGenerateRequest({ claimText, url, persona, platform }) {
  const settings = await getSettings();

  // Check autoMode — if disabled, only generate on explicit highlight (content script sends null payload)
  // The content script always sends a claimText, so we distinguish highlight-triggered vs auto-scan
  // by checking if persona/platform are null (highlight) vs set (auto).
  const isAutoScan = persona !== null || platform !== null;
  if (isAutoScan && !settings.autoMode) {
    return []; // auto scan blocked — autoMode is off
  }

  const p = persona || settings.persona;
  const plat = platform || settings.platform;

  if (settings.mode === 'cloud') {
    return handleCloudRequest(claimText, url, p, plat, settings.supabaseUrl, settings.supabaseAnonKey);
  }
  return handleLocalRequest(claimText, url, p, plat);
}

async function handleLocalRequest(claimText, url, persona, platform) {
  try {
    const response = await fetch('http://localhost:8765/api/draft', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text: claimText,
        persona: persona || 'dry_midwit_savant',
        platform: platform || 'web',
        count: 5,
      }),
    });

    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      throw new Error(`Engine ${response.status} — ${body.error || response.statusText}`);
    }

    const data = await response.json();

    // panel-server returns { ok, run_id, top_response, candidates, ... }
    // Extract candidates from the stored run snapshot
    if (data.candidates && Array.isArray(data.candidates)) {
      return data.candidates.map((c, i) => ({
        candidate_text: c.text || c.candidate_text || String(c),
        weave_role: i === 0 ? 'lead' : i === 1 ? 'support' : 'sting',
        rank_index: i,
      }));
    }

    // Fallback: try top_response as a single candidate
    if (data.top_response) {
      return [{ candidate_text: data.top_response, weave_role: 'lead', rank_index: 0 }];
    }

    return [];
  } catch (err) {
    if (err.message.includes('Failed to fetch') || err.message.includes('NetworkError')) {
      throw new Error('Engine offline — start panel-serve on localhost:8765');
    }
    throw err;
  }
}

async function handleCloudRequest(claimText, url, persona, platform, supabaseUrl, anonKey) {
  if (!anonKey) throw new Error('Set your Supabase anon key in popup settings');

  const client = new SupabaseClient(supabaseUrl, anonKey);

  const request = await client.insert('troll_requests', {
    source_url: url,
    claim_text: claimText,
    persona,
    platform,
    status: 'pending',
  });

  const candidates = await client.pollForCandidates(request.id);
  return candidates.map((c, i) => ({
    candidate_text: c.candidate_text || c.text || '',
    weave_role: c.weave_role || (i === 0 ? 'lead' : i === 1 ? 'support' : 'sting'),
    rank_index: c.rank_index ?? i,
  }));
}
