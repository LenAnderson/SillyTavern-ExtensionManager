import { EventEmitter } from '../../../../../lib/eventemitter.js';
import { getRequestHeaders, reloadMarkdownProcessor } from '../../../../../script.js';
import { disableExtension, enableExtension, extension_settings } from '../../../../extensions.js';
import { Popup, POPUP_TYPE } from '../../../../popup.js';
import { delay } from '../../../../utils.js';
import { settings } from '../index.js';
import { log } from '../lib/console.js';
import { ExtensionError } from './ExtensionError.js';
import { ExtensionManifest } from './ExtensionManifest.js';
import { Manager } from './Manager.js';

export class Extension extends ExtensionManifest {
    /** @readonly */
    /** @enum {string} */
    static EVENT = {
        /** enabled / disabled (this.isDisabled) */
        STATE: 'state',
        /** extension has been installed */
        INSTALL: 'install',
        /** extension has been uninstalled */
        UNINSTALL: 'uninstall',
        /** git status is being checked */
        GIT_STATUS_CHECK: 'gitStatusCheck',
        /** git status has been updated */
        GIT_STATUS: 'gitStatus',
        /** async task started or stopped (this.isBusy) */
        BUSY: 'busy',
        /** extension requires browser refresh (this.isModified) */
        MODIFIED: 'modified',
        /** exception from this extension has been caught */
        ERROR: 'error',
    };

    /**@type {Extension[]} */
    static cache = [];
    static cachePromise;

    /**
     * @param {ExtensionManifest & { name:string, isCore:boolean }} manifest
     * @returns {Extension}
     */
    static fromManifest(manifest) {
        const instance = Object.assign(new Extension(), settings.extensionCache.find(it=>it.name == manifest.name), manifest);
        instance.isDisabled = extension_settings.disabledExtensions.includes(manifest.name);
        instance.isDisabledNow = instance.isDisabled;
        const insertIdx = this.cache.findIndex(it=>{
            if (!instance.isCore && it.isCore) return true;
            if (instance.isCore && !it.isCore) return false;
            return it.displayName.toLowerCase().localeCompare(instance.displayName.toLowerCase()) == 1;
        });
        if (insertIdx == -1) {
            this.cache.push(instance);
        } else {
            this.cache.splice(insertIdx, 0, instance);
        }
        instance.eventSource.on(Extension.EVENT.UNINSTALL, ()=>{
            const idx = this.cache.indexOf(instance);
            if (idx > -1) {
                this.cache.splice(idx, 1);
            }
        });
        if (!settings.extensionList.includes(instance)) {
            settings.extensionList.push(instance);
            settings.save();
        }
        return instance;
    }

    static async list() {
        log('Extension.list()');
        while (this.cachePromise) {
            log('Extension.list()', 'waiting...');
            await this.cachePromise;
        }
        if (this.cache.length == 0) {
            log('Extension.list()', 'fetching...');
            const { promise, resolve } = Promise.withResolvers();
            this.cachePromise = promise;
            const response = await fetch('/api/plugins/emp/extensions/list');
            const manifests = await response.json();
            for (const manifest of manifests) {
                this.fromManifest(manifest);
            }
            this.cachePromise = null;
            resolve();
        }
        log('/Extension.list()');
        return this.cache;
    }




    /**@type {string}*/ name;
    /**@type {boolean}*/ isCore;

    /**@type {boolean}*/ isDisabled;
    /**@type {boolean}*/ isDisabledNow;
    /**@type {boolean}*/ isUpToDate;
    /**@type {object[]}*/ updateLog;
    /**@type {boolean}*/ isUpdated;
    /**@type {boolean}*/ #isModified = false;
    get isModified() { return this.#isModified; }
    set isModified(value) {
        if (this.#isModified != value) {
            this.#isModified = value;
            this.eventSource.emit(Extension.EVENT.MODIFIED);
        }
    }

    /**@type {ExtensionError[]} */ errorList = [];

    /**@type {boolean}*/ #isBusy = false;
    /**@type {Promise}*/ busyPromise;
    /**@type {(any)=>void}*/ busyPromiseResolver;
    get isBusy() { return this.#isBusy; }
    set isBusy(value) {
        if (this.#isBusy != value) {
            this.#isBusy = value;
            this.eventSource.emit(Extension.EVENT.BUSY);
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
    /**@type {{current:string, detached:boolean, all:string[], branches:{[name:string]:{}}}}*/ branch;
    /**@type {number} */ checkedOn;

    /**@type {EventEmitter}*/ eventSource;




    constructor() {
        super();
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
        const response = await fetch('/api/plugins/emp/extensions/uninstall', {
            method: 'POST',
            headers: getRequestHeaders(),
            body: JSON.stringify({
                extension: this.name.slice('third-party/'.length),
            }),
        });
        if (response.ok) {
            const result = await response.json();
            if (result.success) {
                this.eventSource.emit(Extension.EVENT.UNINSTALL);
            }
        }
        this.isBusy = false;
    }

    async toggleState() {
        while (this.busyPromise) await this.busyPromise;
        this.isBusy = true;
        if (this.isDisabledNow) {
            await enableExtension(this.name, false);
            this.isDisabledNow = false;
        } else {
            await disableExtension(this.name, false);
            this.isDisabledNow = true;
        }
        this.isModified = true;
        this.eventSource.emit(Extension.EVENT.STATE);
        this.isBusy = false;
    }

    async checkForUpdate() {
        while (this.busyPromise) await this.busyPromise;
        this.isBusy = true;
        this.eventSource.emit(Extension.EVENT.GIT_STATUS_CHECK);
        const data = await Manager.queueForUpdateCheck(this);
        this.applyGitStatus(data);
        this.eventSource.emit(Extension.EVENT.GIT_STATUS);
        settings.save();
        this.isBusy = false;
    }
    applyGitStatus(data) {
        if (!data?.isRepo) {
            this.isRepo = data.isRepo;
            this.branch = null;
        } else {
            this.isRepo = true;
            this.isSparse = data.isSparse;
            this.isUpToDate = data.isUpToDate;
            this.branch = data.branch;
            this.checkedOn = Date.now();
            this.updateLog = data.log;
        }
    }

    async update() {
        while (this.busyPromise) await this.busyPromise;
        if (this.isUpToDate) return;
        this.isBusy = true;
        this.eventSource.emit(Extension.EVENT.GIT_STATUS_CHECK);
        const response = await fetch('/api/plugins/emp/extensions/update', {
            method: 'POST',
            headers: getRequestHeaders(),
            body: JSON.stringify({
                extension: this.name.slice('third-party/'.length),
            }),
        });
        if (response.ok) {
            const result = await response.json();
            if (result.success) {
                this.applyGitStatus(result.data);
            }
        }
        this.isModified = true;
        this.eventSource.emit(Extension.EVENT.GIT_STATUS);
        settings.save();
        this.isBusy = false;
    }

    async unSparse() {
        while (this.busyPromise) await this.busyPromise;
        this.isBusy = true;
        this.eventSource.emit(Extension.EVENT.GIT_STATUS_CHECK);
        const response = await fetch('/api/plugins/emp/extensions/unSparse', {
            method: 'POST',
            headers: getRequestHeaders(),
            body: JSON.stringify({
                extension: this.name.slice('third-party/'.length),
            }),
        });
        if (response.ok) {
            const result = await response.json();
            if (result.success) {
                this.applyGitStatus(result.data);
            }
        }
        this.eventSource.emit(Extension.EVENT.GIT_STATUS);
        settings.save();
        this.isBusy = false;
    }

    async switchBranch(branch) {
        while (this.busyPromise) await this.busyPromise;
        this.isBusy = true;
        this.eventSource.emit(Extension.EVENT.GIT_STATUS_CHECK);
        const response = await fetch('/api/plugins/emp/extensions/switchBranch', {
            method: 'POST',
            headers: getRequestHeaders(),
            body: JSON.stringify({
                extension: this.name.slice('third-party/'.length),
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
        this.eventSource.emit(Extension.EVENT.GIT_STATUS);
        settings.save();
        this.isBusy = false;
    }


    async showLog() {
        const dom = document.createElement('div'); {
            dom.classList.add('stem--gitLogPopup');
            const head = document.createElement('h3'); {
                head.classList.add('stem--title');
                const text = document.createElement('div'); {
                    text.textContent = this.display_name;
                    head.append(text);
                }
                dom.append(head);
            }
            const content = document.createElement('div'); {
                content.classList.add('stem--gitLogContent');
                content.textContent = 'fetching change log...';
                fetch('/api/plugins/emp/extensions/log', {
                    method: 'POST',
                    headers: getRequestHeaders(),
                    body: JSON.stringify({
                        extension: this.name.slice('third-party/'.length),
                    }),
                }).then(async(res)=>{
                    const data = await res.json();
                    if (!data.isRepo) {
                        content.textContent = 'not a repo';
                        return;
                    }
                    console.log('[EMP]', data.log);
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
                fetch(`/scripts/extensions/${this.name}/README.md`).then(async(res)=>{
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

    async showErrors() {
        const dom = document.createElement('div'); {
            dom.classList.add('stem--errorLogPopup');
            const head = document.createElement('h3'); {
                head.classList.add('stem--title');
                const text = document.createElement('div'); {
                    text.textContent = this.display_name;
                    head.append(text);
                }
                const copy = document.createElement('div'); {
                    copy.classList.add('menu_button');
                    copy.classList.add('fa-solid', 'fa-fw', 'fa-copy');
                    copy.title = 'Copy error log to clipboard';
                    copy.addEventListener('click', async()=>{
                        const value = this.errorList
                            .map(ex=>`${new Date(ex.time).toISOString()}\n${ex.stack}`)
                            .join('\n\n')
                        ;
                        let ok = false;
                        try {
                            navigator.clipboard.writeText(value.toString());
                            ok = true;
                        } catch {
                            console.warn('/copy cannot use clipboard API, falling back to execCommand');
                            const ta = document.createElement('textarea'); {
                                ta.value = value.toString();
                                ta.style.position = 'fixed';
                                ta.style.inset = '0';
                                document.body.append(ta);
                                ta.focus();
                                ta.select();
                                try {
                                    document.execCommand('copy');
                                    ok = true;
                                } catch (err) {
                                    console.error('Unable to copy to clipboard', err);
                                }
                                ta.remove();
                            }
                        }
                        copy.classList.add(`stem--${ok ? 'success' : 'failure'}`);
                        await delay(1000);
                        copy.classList.remove(`stem--${ok ? 'success' : 'failure'}`);
                    });
                    head.append(copy);
                }
                dom.append(head);
            }
            const content = document.createElement('div'); {
                content.classList.add('stem--errorContent');
                for (const ex of this.errorList ?? []) {
                    const err = document.createElement('div'); {
                        err.classList.add('stem--error');
                        const h = document.createElement('div'); {
                            h.classList.add('stem--head');
                            h.textContent = new Date(ex.time).toISOString();
                            err.append(h);
                        }
                        const stack = document.createElement('div'); {
                            stack.classList.add('stem--stack');
                            stack.textContent = ex.stack;
                            err.append(stack);
                        }
                        content.append(err);
                    }
                }
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

    addError(error) {
        this.errorList.push(error);
        this.eventSource.emit(Extension.EVENT.ERROR);
    }
}
