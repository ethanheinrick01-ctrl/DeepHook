// lib/supabase-client.js — minimal Supabase REST client, no SDK needed

export class SupabaseClient {
  constructor(url, anonKey) {
    this.url = url.replace(/\/$/, '');
    this.key = anonKey;
  }

  _headers() {
    return {
      'Content-Type': 'application/json',
      'apikey': this.key,
      'Authorization': `Bearer ${this.key}`,
    };
  }

  async insert(table, row) {
    const res = await fetch(`${this.url}/rest/v1/${table}`, {
      method: 'POST',
      headers: { ...this._headers(), 'Prefer': 'return=representation' },
      body: JSON.stringify(row),
    });
    if (!res.ok) throw new Error(`Insert failed ${res.status}: ${await res.text()}`);
    const data = await res.json();
    return data[0];
  }

  // Poll for candidates — reliable fallback when realtime is unavailable
  async pollForCandidates(requestId, { maxWaitMs = 30000, intervalMs = 1500 } = {}) {
    const start = Date.now();
    while (Date.now() - start < maxWaitMs) {
      await new Promise(r => setTimeout(r, intervalMs));
      try {
        const res = await fetch(
          `${this.url}/rest/v1/troll_candidates?request_id=eq.${requestId}&order=rank_index.asc`,
          { headers: this._headers() }
        );
        if (!res.ok) continue;
        const rows = await res.json();
        if (rows.length >= 3) return rows;
      } catch {
        // keep polling
      }
    }
    throw new Error('Timed out waiting for candidates');
  }
}
