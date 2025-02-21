import { EventEmitter } from '../../../../../lib/eventemitter.js';
import { getRequestHeaders, reloadMarkdownProcessor } from '../../../../../script.js';
import { Popup, POPUP_TYPE } from '../../../../popup.js';
import { settings } from '../index.js';
import { log } from '../lib/console.js';
import { Manager } from './Manager.js';
import { STEM_ITEM_EVENT } from './STEMItem.js';
/**
 * @typedef {import('./STEMItem.js').STEMItem} STEMItem
 */

/**
 * @implements {STEMItem}
 */
export class Plugin {
    /**@type {EventEmitter} */
    static eventSource = new EventEmitter();
    /**@type {Plugin[]} */
    static cache = [];
    static cachePromise;

    /**
     * @param {Plugin} props
     */
    static from(props) {
        const instance = Object.assign(new Plugin(), settings.pluginCache.find(it=>it.name == props.name), props);
        const insertIdx = this.cache.findIndex(it=>{
            return it.displayName.toLowerCase().localeCompare(instance.displayName.toLowerCase()) == 1;
        });
        if (insertIdx == -1) {
            this.cache.push(instance);
        } else {
            this.cache.splice(insertIdx, 0, instance);
        }
        instance.eventSource.on(STEM_ITEM_EVENT.UNINSTALL, ()=>{
            const idx = this.cache.indexOf(instance);
            if (idx > -1) {
                this.cache.splice(idx, 1);
            }
            this.eventSource.emit(STEM_ITEM_EVENT.UNINSTALL, instance);
        });
        instance.eventSource.on(STEM_ITEM_EVENT.GIT_STATUS, ()=>{
            this.eventSource.emit(STEM_ITEM_EVENT.GIT_STATUS, instance);
        });
        if (!settings.pluginList.includes(instance)) {
            settings.pluginList.push(instance);
            settings.save();
        }
    }

    static async list() {
        log('Plugin.list()');
        while (this.cachePromise) {
            log('Plugin.list()', 'waiting...');
            await this.cachePromise;
        }
        if (this.cache.length == 0) {
            log('Plugin.list()', 'fetching...');
            const { promise, resolve } = Promise.withResolvers();
            this.cachePromise = promise;
            const response = await fetch('/api/plugins/emp/plugins/list');
            const manifests = await response.json();
            for (const manifest of manifests) {
                this.from(manifest);
            }
            this.cachePromise = null;
            resolve();
        }
        log('/Plugin.list()');
        return this.cache;
    }




    /**@type {string}*/ name;
    get displayName() { return this.name.replace(/^SillyTavern-/, ''); }
    /**@type {string}*/ version;
    get author() {
        if (this.isRepo) {
            try {
                return new URL(this.repo).pathname.split('/')[1];
            } catch { /* empty */ }
        }
        return '';
    }
    get homePage() { return this.repo?.replace(/\.git$/, '') ?? ''; }
    /**@type {boolean}*/ isCore = false;

    /**@type {boolean}*/ isUpToDate;
    /**@type {object[]}*/ updateLog;
    /**@type {boolean}*/ isUpdated;
    /**@type {boolean}*/ #isModified = false;
    get isModified() { return this.#isModified; }
    set isModified(value) {
        if (this.#isModified != value) {
            this.#isModified = value;
            this.eventSource.emit(STEM_ITEM_EVENT.MODIFIED);
        }
    }

    /**@type {boolean}*/ #isBusy = false;
    /**@type {Promise}*/ busyPromise;
    /**@type {(any)=>void}*/ busyPromiseResolver;
    get isBusy() { return this.#isBusy; }
    set isBusy(value) {
        if (this.#isBusy != value) {
            this.#isBusy = value;
            this.eventSource.emit(STEM_ITEM_EVENT.BUSY);
            this.busyPromiseResolver?.();
            if (value) {
                const { promise, resolve } = Promise.withResolvers();
                this.busyPromise = promise;
                this.busyPromiseResolver = resolve;
            } else {
                this.busyPromise = null;
            }
        }
    }

    /**@type {boolean}*/ isRepo;
    /**@type {boolean}*/ isSparse;
    /**@type {string}*/ repo;
    /**@type {{current:string, detached:boolean, all:string[], branches:{[name:string]:{commit:string}}}}*/ branch;
    /**@type {number} */ checkedOn;

    /**@type {EventEmitter}*/ eventSource;




    constructor() {
        this.eventSource = new EventEmitter();
    }

    toJSON() {
        return {
            name: this.name,
            isUpToDate: this.isUpToDate,
            updateLog: this.updateLog,
            isRepo: this.isRepo,
            isSparse: this.isSparse,
            repo: this.repo,
            branch: this.branch,
            checkedOn: this.checkedOn,
        };
    }


    async uninstall() {
        while (this.busyPromise) await this.busyPromise;
        this.isBusy = true;
        const response = await fetch('/api/plugins/emp/plugins/uninstall', {
            method: 'POST',
            headers: getRequestHeaders(),
            body: JSON.stringify({
                plugin: this.name,
            }),
        });
        if (response.ok) {
            const result = await response.json();
            if (result.success) {
                this.eventSource.emit(STEM_ITEM_EVENT.UNINSTALL);
            }
        }
        this.isBusy = false;
    }

    async checkForUpdate() {
        while (this.busyPromise) await this.busyPromise;
        this.isBusy = true;
        this.eventSource.emit(STEM_ITEM_EVENT.GIT_STATUS_CHECK);
        const data = await Manager.queueForUpdateCheck(this);
        this.applyGitStatus(data);
        this.eventSource.emit(STEM_ITEM_EVENT.GIT_STATUS);
        settings.save();
        this.isBusy = false;
    }
    applyGitStatus(data) {
        if (!data?.isRepo) {
            this.isRepo = data.isRepo;
            this.branch = null;
            this.checkedOn = Date.now();
        } else {
            this.isRepo = true;
            this.isSparse = data.isSparse;
            this.isUpToDate = data.isUpToDate;
            this.branch = data.branch;
            this.checkedOn = Date.now();
            this.updateLog = data.log;
            this.repo = data.remoteUrl;
        }
    }

    async update() {
        while (this.busyPromise) await this.busyPromise;
        if (this.isUpToDate) return;
        this.isBusy = true;
        this.eventSource.emit(STEM_ITEM_EVENT.GIT_STATUS_CHECK);
        const response = await fetch('/api/plugins/emp/plugins/update', {
            method: 'POST',
            headers: getRequestHeaders(),
            body: JSON.stringify({
                plugin: this.name,
            }),
        });
        if (response.ok) {
            const result = await response.json();
            if (result.success) {
                this.applyGitStatus(result.data);
            }
        }
        this.isModified = true;
        this.eventSource.emit(STEM_ITEM_EVENT.GIT_STATUS);
        settings.save();
        this.isBusy = false;
    }

    async unSparse() {
        while (this.busyPromise) await this.busyPromise;
        this.isBusy = true;
        this.eventSource.emit(STEM_ITEM_EVENT.GIT_STATUS_CHECK);
        const response = await fetch('/api/plugins/emp/plugins/unSparse', {
            method: 'POST',
            headers: getRequestHeaders(),
            body: JSON.stringify({
                plugin: this.name,
            }),
        });
        if (response.ok) {
            const result = await response.json();
            if (result.success) {
                this.applyGitStatus(result.data);
            }
        }
        this.eventSource.emit(STEM_ITEM_EVENT.GIT_STATUS);
        settings.save();
        this.isBusy = false;
    }

    async switchBranch(branch) {
        while (this.busyPromise) await this.busyPromise;
        this.isBusy = true;
        this.eventSource.emit(STEM_ITEM_EVENT.GIT_STATUS_CHECK);
        const response = await fetch('/api/plugins/emp/plugins/switchBranch', {
            method: 'POST',
            headers: getRequestHeaders(),
            body: JSON.stringify({
                plugin: this.name,
                branch,
            }),
        });
        if (response.ok) {
            const result = await response.json();
            if (result.success) {
                this.applyGitStatus(result.data);
            }
        }
        this.isModified = true;
        this.eventSource.emit(STEM_ITEM_EVENT.GIT_STATUS);
        settings.save();
        this.isBusy = false;
    }


    async showLog() {
        const dom = document.createElement('div'); {
            dom.classList.add('stem--gitLogPopup');
            const head = document.createElement('h3'); {
                head.classList.add('stem--title');
                const text = document.createElement('div'); {
                    text.textContent = this.displayName;
                    head.append(text);
                }
                dom.append(head);
            }
            const content = document.createElement('div'); {
                content.classList.add('stem--gitLogContent');
                content.textContent = 'fetching change log...';
                fetch('/api/plugins/emp/plugins/log', {
                    method: 'POST',
                    headers: getRequestHeaders(),
                    body: JSON.stringify({
                        plugin: this.name,
                    }),
                }).then(async(res)=>{
                    const data = await res.json();
                    if (!data.isRepo) {
                        content.textContent = 'not a repo';
                        return;
                    }
                    log(data.log);
                    content.innerHTML = '';
                    for (const commit of data.log) {
                        const versionItem = data.versionLog.find(it=>it.commit == commit.hash);
                        if (versionItem) {
                            const vhead = document.createElement('div'); {
                                vhead.classList.add('stem--version');
                                vhead.textContent = versionItem.version;
                                content.append(vhead);
                            }
                        }
                        const item = document.createElement('div'); {
                            item.classList.add('stem--commit');
                            item.title = commit.hash;
                            const dt = document.createElement('div'); {
                                dt.classList.add('stem--time');
                                dt.textContent = new Date(commit.date).toLocaleString();
                                item.append(dt);
                            }
                            const mes = document.createElement('div'); {
                                mes.classList.add('stem--message');
                                mes.textContent = commit.message;
                                item.append(mes);
                            }
                            content.append(item);
                        }
                    }
                });
                dom.append(content);
            }
        }
        const dlg = new Popup(dom, POPUP_TYPE.TEXT, null, {
            wide: true,
            wider: true,
            large: true,
        });
        dlg.show();
    }

    async showReadme() {
        const dom = document.createElement('div'); {
            dom.classList.add('stem--readmePopup');
            const content = document.createElement('div'); {
                content.classList.add('stem--readmeContent');
                content.textContent = 'fetching readme...';
                fetch('/api/plugins/emp/plugins/readme/get', {
                    method: 'POST',
                    headers: getRequestHeaders(),
                    body: JSON.stringify({ plugin:this.name }),
                }).then(async(res)=>{
                    const md = await res.text();
                    const converter = reloadMarkdownProcessor();
                    const readme = converter.makeHtml(md);
                    const html = `
                        <div class="mes stem--readme"><div class="mes_text">${readme}</div></div>
                    `;
                    content.innerHTML = html;
                    const url = `/scripts/extensions/${this.name}`;
                    for (const a of /**@type {HTMLAnchorElement[]}*/([...content.querySelectorAll('a')])) {
                        if (a.href.startsWith(`${location.origin}#`)) continue;
                        a.target = '_blank';
                        if (a.href.startsWith('/')) continue;//a.href = `https://github.com${a.href}`;
                        else if (!a.href.includes('://')) a.href = `${url}/${a.href}`;
                        else if (a.href.startsWith(location.origin)) a.href = `${url}/${a.href.slice(location.origin.length)}`;
                    }
                    for (const el of /**@type {HTMLImageElement[]}*/([...content.querySelectorAll('[src]')])) {
                        if (el.src.startsWith('/')) continue;//el.src = `https://github.com${el.src}`;
                        else if (el.src.startsWith(location.origin)) el.src = `${url}/${el.src.slice(location.origin.length)}`;
                    }
                });
                dom.append(content);
            }
        }
        const dlg = new Popup(dom, POPUP_TYPE.TEXT, null, {
            wide: true,
            wider: true,
            large: true,
            allowVerticalScrolling: true,
        });
        dlg.show();
    }
}
