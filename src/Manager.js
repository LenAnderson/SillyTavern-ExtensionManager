import { EventEmitter } from '../../../../../lib/eventemitter.js';
import { getRequestHeaders } from '../../../../../script.js';
import { delay } from '../../../../utils.js';
import { settings } from '../index.js';
import { error } from '../lib/console.js';
import { Extension } from './Extension.js';
import { Plugin } from './Plugin.js';

export class Manager {
    /** @readonly */
    /** @enum {string} */
    static EVENT = {
        /** extension has been installed */
        INSTALLED_EXTENSION: 'installed_extension',
        /** plugin has been installed */
        INSTALLED_PLUGIN: 'installed_plugin',
    };
    static eventSource = new EventEmitter();

    /**@type {{ item:Extension|Plugin, resolve:(Object)=>void }[]} */
    static updateQueue = [];
    /**@type {boolean} */
    static isProcessingUpdateQueue = false;


    static async install(repo) {
        const installToast = toastr.info(`Installing ${repo}`, 'ExtensionManager', { timeOut:0 });
        const response = await fetch('/api/plugins/emp/install', {
            method: 'POST',
            headers: getRequestHeaders(),
            body: JSON.stringify({
                repo,
            }),
        });
        if (!response.ok) {
            toastr.clear(installToast);
            toastr.error(`${response.status}: ${response.statusText}`, 'Extension Manager');
            error(response);
            return;
        }
        const result = await response.json();
        if (!result.success) {
            toastr.clear(installToast);
            const ex = (typeof result.exception == 'string') ? result.exception : JSON.stringify(result.exception);
            toastr.error(ex, 'Extension Manager');
            error(result);
            return;
        }
        switch (result.type) {
            case 'extension': {
                const ext = Extension.fromManifest(result.manifest);
                this.eventSource.emit(this.EVENT.INSTALLED_EXTENSION, ext);
                toastr.success(`Installed extension: ${result.manifest.display_name}`, 'ExtensionManager');
                break;
            }
            case 'plugin': {
                //TODO get plugin instance
                const plugin = result.plugin;
                this.eventSource.emit(this.EVENT.INSTALLED_PLUGIN, plugin);
                toastr.success(`Installed server plugin: ${result.plugin.name}`, 'ExtensionManager');
                break;
            }
        }
        toastr.clear(installToast);
    }


    /**
     *
     * @param {Extension|Plugin} item
     */
    static async queueForUpdateCheck(item) {
        const { promise, resolve } = Promise.withResolvers();
        this.updateQueue.push({ item, resolve });
        this.processUpdateQueue();
        return await promise;
    }
    static async processUpdateQueue() {
        if (this.isProcessingUpdateQueue) return;
        this.isProcessingUpdateQueue = true;
        while (this.updateQueue.length) {
            await delay(200);
            const { item, resolve } = this.updateQueue.shift();
            try {
                const response = await fetch('/api/plugins/emp/checkGitRepo', {
                    method: 'POST',
                    headers: getRequestHeaders(),
                    body: JSON.stringify({
                        type: item instanceof Extension ? 'extension' : 'plugin',
                        name: item.name.replace(/^third-party\//, ''),
                    }),
                });
                if (!response.ok) {
                    resolve(null);
                    continue;
                }
                const data = await response.json();
                resolve(data);
            } catch {
                resolve(null);
                continue;
            }
        }
        this.isProcessingUpdateQueue = false;
    }
}
