import { contextBridge, ipcRenderer } from 'electron';

// Expose electron API for overlay window
contextBridge.exposeInMainWorld('electronAPI', {
  hideOverlay: () => ipcRenderer.send('hide-overlay')
});

console.log('Cortex preload script loaded');
