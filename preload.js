// preload.js
const { contextBridge } = require('electron');
const { app } = require('@electron/remote');

// Create Service object with gui module injected
const Service = require('./src/browser/service');
const gui = require('./src/gui');
Service.gui = gui;

// 将主进程的 getLocale 方法安全暴露给渲染进程
contextBridge.exposeInMainWorld('api', {
    getLocale: () => app.getLocale()
});

// 暴露 Service 给渲染进程
contextBridge.exposeInMainWorld('loadService', () => Service);
