'use client';

import { useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { pretty } from '../lib/format';

export default function AiInsightCard({ initialInsight, summary, profileId }) {
  const [text, setText] = useState(initialInsight || '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function regenerate() {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/ai', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ kind: 'insight', data: summary }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error || 'Something went wrong generating the insight.');
        setLoading(false);
        return;
      }
      setText(json.text);
      // Persist the freshly generated insight
      await supabase.from('ai_insights').insert({
        scope_type: 'executive',
        content: json.text,
        generated_by: profileId || null,
      });
    } catch (e) {
      setError('Could not reach the AI service. Please try again.');
    }
    setLoading(false);
  }

  return (
    <div className="card">
      <div className="card-head">
        <h2>AI Insight</h2>
        <button className="btn-small" onClick={regenerate} disabled={loading || !summary}>
          {loading ? 'Generating…' : '↻ Regenerate'}
        </button>
      </div>
      {error ? <div className="login-error" style={{ marginBottom: 12 }}>{error}</div> : null}
      <div className="insight">
        <span className="tag">Executive summary</span>
        <div>{pretty(text) || 'No insight yet — click Regenerate to generate one live with AI.'}</div>
      </div>
    </div>
  );
}
