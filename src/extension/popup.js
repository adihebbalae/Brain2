const CORTEX_URL = 'http://localhost:3001/api/capture';

document.addEventListener('DOMContentLoaded', async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  document.getElementById('url').value = tab.url || '';
  document.getElementById('title').value = tab.title || '';

  document.getElementById('clipBtn').addEventListener('click', async () => {
    const url = document.getElementById('url').value;
    const title = document.getElementById('title').value;
    const note = document.getElementById('note').value.trim();
    const btn = document.getElementById('clipBtn');
    const status = document.getElementById('status');

    if (!url) {
      status.textContent = 'No URL to clip';
      status.className = 'error';
      return;
    }

    btn.disabled = true;
    btn.textContent = 'Clipping...';

    const text = note
      ? `[${title || url}](${url}) — ${note}`
      : `[${title || url}](${url})`;

    try {
      const res = await fetch(CORTEX_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, source: 'web-clipper', tags: ['clipped'] })
      });
      if (res.ok) {
        status.textContent = '✓ Clipped to inbox!';
        status.className = 'success';
        setTimeout(() => window.close(), 1200);
      } else {
        throw new Error(`Server returned ${res.status}`);
      }
    } catch (err) {
      status.textContent = `Error: ${err.message}. Is Cortex running?`;
      status.className = 'error';
      btn.disabled = false;
      btn.textContent = 'Clip to Cortex Inbox';
    }
  });
});
