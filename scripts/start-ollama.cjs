const net = require('net');
const { spawn } = require('child_process');

const OLLAMA_PORT = 11434;

// Try to connect to check if Ollama is already running
const client = net.connect({ port: OLLAMA_PORT, host: 'localhost' }, () => {
  // Connection successful - Ollama is already running
  console.log('[ollama] Already running on port 11434');
  client.end();
  process.exit(0);
});

client.on('error', (err) => {
  if (err.code === 'ECONNREFUSED') {
    // Ollama not running - start it
    console.log('[ollama] Starting Ollama...');
    
    const ollama = spawn('ollama', ['serve'], { stdio: 'inherit' });
    
    ollama.on('error', (spawnErr) => {
      if (spawnErr.code === 'ENOENT') {
        console.log('[ollama] Ollama not found — install it from https://ollama.ai');
        process.exit(0);
      } else {
        console.error('[ollama] Error starting Ollama:', spawnErr);
        process.exit(0);
      }
    });
    
    // Don't call process.exit() - let the spawned process keep this script alive
  } else {
    // Some other error
    console.error('[ollama] Error checking Ollama:', err);
    process.exit(0);
  }
});
