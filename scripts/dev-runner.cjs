const { spawn } = require('child_process');
const net = require('net');

const isWindows = process.platform === 'win32';
const withElectron = process.argv.includes('--electron');
const activeChildren = new Set();

const services = [
  {
    name: 'frontend',
    command: 'npm run dev:frontend',
    port: 5173,
    reuseIfBusy: true,
  },
  {
    name: 'backend',
    command: 'npm run dev:backend',
    port: 3001,
    reuseIfBusy: true,
  },
  {
    name: 'ollama',
    command: 'npm run dev:ollama',
    port: 11434,
    reuseIfBusy: true,
  },
];

if (withElectron) {
  services.push({
    name: 'electron',
    command: 'cross-env NODE_ENV=development electron .',
    reuseIfBusy: false,
  });
}

async function isPortListening(port) {
  for (const host of ['127.0.0.1', '::1', 'localhost']) {
    // Skip IPv6 probe if the platform does not support it cleanly.
    if (host === '::1' && isWindows === false && process.env.CI) {
      continue;
    }

    const isListening = await new Promise((resolve) => {
      const socket = net.connect({ port, host }, () => {
        socket.destroy();
        resolve(true);
      });

      socket.setTimeout(500);

      socket.on('error', () => resolve(false));
      socket.on('timeout', () => {
        socket.destroy();
        resolve(false);
      });
    });

    if (isListening) {
      return true;
    }
  }

  return false;
}

function spawnService(service) {
  const child = spawn(service.command, {
    shell: true,
    stdio: 'inherit',
    cwd: process.cwd(),
    env: Object.assign({}, process.env),
  });

  activeChildren.add(child);

  child.on('exit', (code, signal) => {
    activeChildren.delete(child);
    const reason = signal ? `signal ${signal}` : `code ${code}`;
    console.log(`[${service.name}] exited with ${reason}`);

    if (activeChildren.size === 0) {
      process.exit(code || 0);
    }
  });

  child.on('error', (error) => {
    activeChildren.delete(child);
    console.error(`[${service.name}] failed to start:`, error);
    if (activeChildren.size === 0) {
      process.exit(1);
    }
  });
}

async function start() {
  for (const service of services) {
    if (service.port && service.reuseIfBusy && await isPortListening(service.port)) {
      console.log(`[${service.name}] Reusing existing process on port ${service.port}`);
      continue;
    }

    spawnService(service);
  }

  if (activeChildren.size === 0) {
    console.log('[dev-runner] Nothing to start. Reusing existing services.');
    process.exit(0);
  }
}

function terminateChild(child) {
  if (!child.pid) {
    return;
  }

  if (isWindows) {
    spawn('taskkill', ['/pid', String(child.pid), '/t', '/f'], {
      stdio: 'ignore',
      shell: false,
    });
    return;
  }

  child.kill('SIGTERM');
}

function shutdown(signal) {
  console.log(`[dev-runner] Received ${signal}, shutting down...`);
  for (const child of activeChildren) {
    terminateChild(child);
  }
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

start().catch((error) => {
  console.error('[dev-runner] Failed to start services:', error);
  process.exit(1);
});
