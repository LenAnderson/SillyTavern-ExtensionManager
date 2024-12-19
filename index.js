import { event_types, eventSource, getRequestHeaders, reloadMarkdownProcessor, saveSettingsDebounced } from '../../../../script.js';
import { disableExtension, enableExtension, extension_settings, openThirdPartyExtensionMenu } from '../../../extensions.js';
import { Popup, POPUP_TYPE } from '../../../popup.js';
import { executeSlashCommandsWithOptions } from '../../../slash-commands.js';
import { delay } from '../../../utils.js';

class Repository {
    /**@type {string}*/ title;
    /**@type {string}*/ url;

    constructor(title, url) {
        this.title = title;
        this.url = url;
    }

    toJSON() {
        return {
            title: this.title,
            url: this.url,
        };
    }
}
/**@type {{
    repoList: Repository[],
    updateCheckHours: number,
    extensionUpdateCheckList: {extension:string, checkedOn:number, hasUpdate:boolean}[],
    pluginUpdateCheckList: {plugin:string, checkedOn:number, hasUpdate:boolean}[],
}} */
const settings = Object.assign({
    /**@type {Repository[]} */
    repoList: [],
    /**@type {number} */
    updateCheckHours: 24,
    /**@type {{extension:string, checkedOn:number, hasUpdate:boolean}[]} */
    extensionUpdateCheckList: [],
    /**@type {{plugin:string, checkedOn:number, hasUpdate:boolean}[]} */
    pluginUpdateCheckList: [],
}, extension_settings.extensionManager ?? {});
if (!extension_settings.extensionManager) {
    settings.repoList.push(new Repository(
        'Asset Repo Copy',
        'https://raw.githubusercontent.com/LenAnderson/SillyTavern-Content/refs/heads/asset-catalog/index.json',
    ));
    const originalInput = /**@type {HTMLInputElement}*/(document.querySelector('#assets-json-url-field'));
    const originalRepo = new Repository(
        'SillyTavern - Content (official assets)',
        originalInput.value,
    );
    settings.repoList.push(originalRepo);
    for (const repo of extension_settings.assetRepoManager?.repositoryList ?? []) {
        settings.repoList.push(new Repository(repo.title, repo.url));
    }
}
const saveSettings = ()=>{
    extension_settings.extensionManager = settings;
    if (dom.config.textarea) {
        dom.config.textarea.value = JSON.stringify(settings, null, '\t');
    }
    saveSettingsDebounced();
};

const appReady = new Promise(resolve=>eventSource.once(event_types.APP_READY, resolve));




/**@type {{
        display_name:string,
        loading_order:number,
        requires:string[],
        optional:string[],
        js:string,
        css:string,
        author:string,
        version:string,
        homePage:string,

        name:string,
        isCore:boolean,
        isDisabled:boolean,
        isDisabledNow:boolean,
        isUpToDate:boolean,
        isUpdated:boolean,
    }[]} */
let manifests = [];

const dom = {
    config: {
        /**@type {HTMLTextAreaElement} */
        textarea: undefined,
    },
};
const updates = {
    /**@type {()=>Promise} */
    extensions: undefined,
    /**@type {()=>Promise} */
    plugins: undefined,
    /**@type {()=>Promise} */
    catalog: undefined,
};




let isProcessing = false;
const updateQueue = [];
const queueCheckForUpdate = async(name)=>{
    const prom = new Promise(resolve=>updateQueue.push({ name, resolve }));
    processQueue();
    return prom;
};
const processQueue = async()=>{
    if (isProcessing) return;
    isProcessing = true;
    while (updateQueue.length) {
        await delay(200);
        const { name, resolve } = updateQueue.shift();
        try {
            const response = await fetch('/api/extensions/version', {
                method: 'POST',
                headers: getRequestHeaders(),
                body: JSON.stringify({ extensionName:name.slice('third-party'.length) }),
            });
            if (!response.ok) {
                resolve(null);
                continue;
            }
            const data = await response.json();
            let item = settings.extensionUpdateCheckList.find(it=>it.extension == name);
            if (item) {
                item.checkedOn = Date.now();
            } else {
                item = { extension:name, checkedOn:Date.now(), hasUpdate:!data.isUpToDate };
                settings.extensionUpdateCheckList.push(item);
            }
            saveSettings();
            resolve(data);
        } catch {
            resolve(null);
        }
    }
    isProcessing = false;
};

let isPluginProcessing = false;
const pluginUpdateQueue = [];
const queueCheckPluginForUpdate = async(name)=>{
    const prom = new Promise(resolve=>pluginUpdateQueue.push({ name, resolve }));
    processPluginQueue();
    return prom;
};
const processPluginQueue = async()=>{
    if (isPluginProcessing) return;
    isPluginProcessing = true;
    while (pluginUpdateQueue.length) {
        await delay(200);
        const { name, resolve } = pluginUpdateQueue.shift();
        try {
            const response = await fetch('/api/plugins/pluginmanager/hasUpdates', {
                method: 'POST',
                headers: getRequestHeaders(),
                body: JSON.stringify({ plugin:name }),
            });
            if (!response.ok) {
                resolve(null);
                continue;
            }
            const data = await response.json();
            let item = settings.pluginUpdateCheckList.find(it=>it.plugin == name);
            if (item) {
                item.checkedOn = Date.now();
            } else {
                item = { plugin:name, checkedOn:Date.now(), hasUpdate:!data.isUpToDate };
                settings.pluginUpdateCheckList.push(item);
            }
            saveSettings();
            resolve(data);
        } catch {
            resolve(null);
        }
    }
    isPluginProcessing = false;
};




const init = async()=>{
    const drawer = /**@type {HTMLElement}*/(document.querySelector('#rm_extensions_block'));
    const settingsBody = /**@type {HTMLElement}*/(drawer.querySelector(':scope > .extensions_block'));
    const header = /**@type {HTMLElement}*/(settingsBody.children[0]);
    settingsBody.insertAdjacentElement('beforebegin', header);

    drawer.classList.add('stem--drawer');
    settingsBody.classList.add('stem--extensionSettings');
    settingsBody.classList.add('stem--body');
    settingsBody.classList.add('stem--active');
    header.classList.add('stem--head');

    const goToTab = async(key)=>{
        for (const [k, v] of Object.entries(tabBody)) {
            if (k == key) continue;
            v.classList.remove('stem--active');
        }
        tabBody[key].classList.add('stem--active');
        for (const [k, v] of Object.entries(tabTab)) {
            if (k == key) continue;
            v.classList.remove('stem--active');
        }
        tabTab[key].classList.add('stem--active');
    };

    const tabTab = {
        /**@type {HTMLElement} */
        settings: undefined,
        /**@type {HTMLElement} */
        extensions: undefined,
        /**@type {HTMLElement} */
        plugins: undefined,
        /**@type {HTMLElement} */
        catalog: undefined,
        /**@type {HTMLElement} */
        raw: undefined,
        /**@type {HTMLElement} */
        config: undefined,
    };
    const tabBody = {
        /**@type {HTMLElement} */
        settings: settingsBody,
        /**@type {HTMLElement} */
        extensions: undefined,
        /**@type {HTMLElement} */
        plugins: undefined,
        /**@type {HTMLElement} */
        catalog: undefined,
        /**@type {HTMLElement} */
        raw: undefined,
        /**@type {HTMLElement} */
        config: undefined,
    };

    const tabs = document.createElement('div'); {
        tabs.classList.add('stem--tabs');
        const tabSettings = document.createElement('div'); {
            tabTab.settings = tabSettings;
            tabSettings.classList.add('stem--tab');
            tabSettings.classList.add('stem--tabSettings');
            tabSettings.classList.add('stem--active');
            tabSettings.title = 'Extension settings';
            const i = document.createElement('i'); {
                i.classList.add('fa-solid', 'fa-fw', 'fa-wrench');
                tabSettings.append(i);
            }
            const t = document.createElement('span'); {
                t.classList.add('stem--text');
                t.textContent = 'Extension Settings';
                tabSettings.append(t);
            }
            tabSettings.addEventListener('click', async()=>{
                await goToTab('settings');
            });
            tabs.append(tabSettings);
        }
        const tabExtensions = document.createElement('div'); {
            tabTab.extensions = tabExtensions;
            tabExtensions.classList.add('stem--tab');
            tabExtensions.classList.add('stem--tabExtensions');
            tabExtensions.title = 'Manage installed UI extensions';
            const i = document.createElement('i'); {
                i.classList.add('fa-solid', 'fa-fw', 'fa-cubes');
                tabExtensions.append(i);
            }
            const t = document.createElement('span'); {
                t.classList.add('stem--text');
                t.textContent = 'Extensions';
                tabExtensions.append(t);
            }
            tabExtensions.addEventListener('click', async()=>{
                await goToTab('extensions');
            });
            tabs.append(tabExtensions);
        }
        const tabPlugins = document.createElement('div'); {
            tabTab.plugins = tabPlugins;
            tabPlugins.classList.add('stem--tab');
            tabPlugins.classList.add('stem--tabPlugins');
            tabPlugins.title = 'Manage installed server plugins';
            const i = document.createElement('i'); {
                i.classList.add('fa-solid', 'fa-fw', 'fa-puzzle-piece');
                tabPlugins.append(i);
            }
            const t = document.createElement('span'); {
                t.classList.add('stem--text');
                t.textContent = 'Plugins';
                tabPlugins.append(t);
            }
            tabPlugins.addEventListener('click', async()=>{
                await goToTab('plugins');
            });
            tabs.append(tabPlugins);
        }
        const tabCatalog = document.createElement('div'); {
            tabTab.catalog = tabCatalog;
            tabCatalog.classList.add('stem--tab');
            tabCatalog.classList.add('stem--tabCatalog');
            tabCatalog.title = 'Install extensions and plugins from catalog';
            const i = document.createElement('i'); {
                i.classList.add('fa-solid', 'fa-fw', 'fa-book-open');
                tabCatalog.append(i);
            }
            const t = document.createElement('span'); {
                t.classList.add('stem--text');
                t.textContent = 'Catalog';
                tabCatalog.append(t);
            }
            tabCatalog.addEventListener('click', async()=>{
                await goToTab('catalog');
            });
            tabs.append(tabCatalog);
        }
        const tabManual = document.createElement('div'); {
            tabManual.classList.add('stem--tab');
            tabManual.classList.add('stem--button');
            tabManual.classList.add('stem--tabManual');
            tabManual.title = 'Install extension or plugin from URL';
            const i = document.createElement('i'); {
                i.classList.add('fa-solid', 'fa-fw', 'fa-plus');
                tabManual.append(i);
            }
            tabManual.addEventListener('click', async()=>{
                //TODO use custom dlg that accepts plugins and extensions
                await openThirdPartyExtensionMenu();
                await updates.extensions();
                await updates.plugins();
                updates.catalog();
            });
            tabs.append(tabManual);
        }
        const sep = document.createElement('div'); {
            sep.classList.add('stem--sep');
            tabs.append(sep);
        }
        const tabRaw = document.createElement('div'); {
            tabTab.raw = tabRaw;
            tabRaw.classList.add('stem--tab');
            tabRaw.classList.add('stem--tabRaw');
            tabRaw.title = 'Edit extension settings JSON';
            const i = document.createElement('i'); {
                i.classList.add('fa-solid', 'fa-fw', 'fa-pen-to-square');
                tabRaw.append(i);
            }
            tabRaw.addEventListener('click', async()=>{
                await goToTab('raw');
            });
            tabs.append(tabRaw);
        }
        const tabConfig = document.createElement('div'); {
            tabTab.config = tabConfig;
            tabConfig.classList.add('stem--tab');
            tabConfig.classList.add('stem--tabConfig');
            tabConfig.title = 'Extension manager settings';
            const i = document.createElement('i'); {
                i.classList.add('fa-solid', 'fa-fw', 'fa-gear');
                tabConfig.append(i);
            }
            tabConfig.addEventListener('click', async()=>{
                await goToTab('config');
            });
            tabs.append(tabConfig);
        }
        header.insertAdjacentElement('afterend', tabs);
    }

    { // manage extensions
        const body = document.createElement('div'); {
            tabBody.extensions = body;
            body.classList.add('stem--body');
            body.classList.add('stem--manageExtensions');
            const updateExtensionList = (async()=>{
                body.innerHTML = '';
                const response = await fetch('/api/extensions/discover');
                const names = (await response.json()).map(it=>it.name);
                manifests = await Promise.all(names.map(async(name)=>{
                    const response = await fetch(`/scripts/extensions/${name}/manifest.json`);
                    if (!response.ok) {
                        return;
                    }
                    const manifest = await response.json();
                    manifest.name = name;
                    manifest.isCore = !name.startsWith('third-party/');
                    manifest.isDisabled = extension_settings.disabledExtensions.includes(name);
                    manifest.isDisabledNow = manifest.isDisabled;
                    return manifest;
                }));
                manifests.sort((a,b)=>{
                    if (a.isCore && !b.isCore) return -1;
                    if (!a.isCore && b.isCore) return 1;
                    return a.display_name.toLowerCase().localeCompare(b.display_name.toLowerCase());
                });
                let tblBody;
                const tbl = document.createElement('table'); {
                    tbl.classList.add('stem--table');
                    const thead = document.createElement('thead'); {
                        for (const col of ['Extension', 'Source', 'Version', 'Author', 'URL', 'Actions']) {
                            const th = document.createElement('th'); {
                                th.dataset.property = col;
                                if (col == 'Qrs') {
                                    th.classList.add('stem--numeric');
                                }
                                if (!['Source', 'Actions'].includes(col)) {
                                    th.textContent = col;
                                }
                                // if (col == 'Actions') {
                                //     const actions = document.createElement('div'); {
                                //         actions.classList.add('stem--actions');
                                //         const check = document.createElement('div'); {
                                //             check.classList.add('stem--action');
                                //             check.classList.add('menu_button');
                                //             check.classList.add('fa-solid', 'fa-fw', 'fa-rotate');
                                //             check.title = 'Check for updates';
                                //             check.addEventListener('click', async()=>{
                                //                 toastr.warning('oops');
                                //             });
                                //             actions.append(check);
                                //         }
                                //         th.append(actions);
                                //     }
                                // }
                                thead.append(th);
                            }
                        }
                        tbl.append(thead);
                    }
                    const tbody = document.createElement('tbody'); {
                        tblBody = tbody;
                        tbl.append(tbody);
                    }
                }
                for (const manifest of manifests) {
                    const item = document.createElement('tr'); {
                        item.classList.add('stem--item');
                        if (manifest.isCore) item.classList.add('stem--isCore');
                        if (manifest.isDisabled) item.classList.add('stem--isDisabled');
                        const name = document.createElement('td'); {
                            name.dataset.property = 'Name';
                            name.textContent = manifest.display_name;
                            item.append(name);
                        }
                        const source = document.createElement('td'); {
                            source.dataset.property = 'Source';
                            const icon = document.createElement('div'); {
                                icon.classList.add('stem--source');
                                icon.classList.add('fa-solid', 'fa-fw');
                                if (manifest.isCore) {
                                    icon.classList.add('stem--core');
                                    source.title = 'Core extension';
                                } else {
                                    icon.classList.add('fa-cubes');
                                    source.title = 'Third-party extension';
                                }
                                source.append(icon);
                            }
                            item.append(source);
                        }
                        const version = document.createElement('td'); {
                            version.dataset.property = 'Version';
                            version.textContent = manifest.version;
                            item.append(version);
                        }
                        const author = document.createElement('td'); {
                            author.dataset.property = 'Author';
                            author.textContent = manifest.author;
                            item.append(author);
                        }
                        const url = document.createElement('td'); {
                            url.dataset.property = 'URL';
                            if (!manifest.isCore) {
                                const a = document.createElement('a'); {
                                    a.href = manifest.homePage;
                                    a.target = '_blank';
                                    a.textContent = manifest.homePage;
                                    a.title = 'Open link in new tab';
                                    url.append(a);
                                }
                            }
                            item.append(url);
                        }
                        const actions = document.createElement('td'); {
                            actions.dataset.property = 'Actions';
                            const wrap = document.createElement('div'); {
                                wrap.classList.add('stem--actions');
                                actions.append(wrap);
                                const toggle = document.createElement('div'); {
                                    toggle.classList.add('stem--toggle');
                                    toggle.classList.add('stem--action');
                                    toggle.classList.add('menu_button');
                                    toggle.classList.add('fa-solid', 'fa-fw', 'fa-power-off');
                                    toggle.addEventListener('click', async(evt)=>{
                                        item.classList.add('stem--isBusy');
                                        const state = !manifest.isDisabledNow;
                                        if (!state) {
                                            await enableExtension(manifest.name, false);
                                            item.classList.remove('stem--isDisabled');
                                        } else {
                                            await disableExtension(manifest.name, false);
                                            item.classList.add('stem--isDisabled');
                                        }
                                        manifest.isDisabledNow = state;
                                        if (manifest.isUpdated || manifest.isDisabled != manifest.isDisabledNow) {
                                            item.classList.add('stem--mustReload');
                                        } else {
                                            item.classList.remove('stem--mustReload');
                                        }
                                        item.classList.remove('stem--isBusy');
                                    });
                                    wrap.append(toggle);
                                }
                                if (!manifest.isCore) {
                                    const update = document.createElement('div'); {
                                        update.classList.add('stem--action');
                                        update.classList.add('menu_button');
                                        update.classList.add('fa-fw');
                                        const i = document.createElement('i'); {
                                            i.classList.add('fa-solid', 'fa-fw', 'fa-spinner', 'fa-spin-pulse');
                                            update.append(i);
                                        }
                                        update.title = 'Checking for updates...';
                                        const checkForUpdate = async(manifest, isUpToDate = null)=>{
                                            let data;
                                            if (isUpToDate === null) {
                                                data = await queueCheckForUpdate(manifest.name);
                                            } else {
                                                data = { isUpToDate };
                                            }
                                            i.classList.remove('fa-spinner', 'fa-spin-pulse');
                                            if (!data) {
                                                update.title = 'Failed to fetch extension status!';
                                                i.classList.add('fa-triangle-exclamation');
                                                return;
                                            }
                                            manifest.isUpToDate = data.isUpToDate;
                                            if (data.isUpToDate) {
                                                i.classList.add('fa-code-commit');
                                                update.title = 'No update\n---\nclick to check for updates';
                                            } else {
                                                i.classList.add('fa-download');
                                                update.title = 'Download update';
                                            }
                                        };
                                        update.addEventListener('click', async()=>{
                                            if (manifest.isUpToDate !== false) {
                                                i.classList.remove('fa-code-commit');
                                                i.classList.add('fa-spinner', 'fa-spin-pulse');
                                                update.title = 'Checking for updates...';
                                                await checkForUpdate(manifest);
                                                return;
                                            }
                                            item.classList.add('stem--isBusy');
                                            i.classList.remove('fa-download');
                                            i.classList.add('fa-spinner', 'fa-spin-pulse');
                                            update.title = 'Updating...';
                                            const response = await fetch('/api/extensions/update', {
                                                method: 'POST',
                                                headers: getRequestHeaders(),
                                                body: JSON.stringify({ extensionName:manifest.name.slice('third-party'.length) }),
                                            });
                                            if (!response.ok) {
                                                item.classList.remove('stem--isBusy');
                                                i.classList.remove('fa-spinner', 'fa-spin-pulse');
                                                i.classList.add('fa-download');
                                                toastr.warning(`Failed to update extension: ${manifest.display_name}`);
                                                return;
                                            }
                                            manifest.isUpToDate = true;
                                            manifest.isUpdated = true;
                                            item.classList.remove('stem--isBusy');
                                            item.classList.add('stem--mustReload');
                                            i.classList.remove('fa-spinner', 'fa-spin-pulse');
                                            i.classList.add('fa-code-commit');
                                        });
                                        appReady.then(()=>{
                                            const item = settings.extensionUpdateCheckList.find(it=>it.extension == manifest.name);
                                            const lastCheck = item?.checkedOn ?? 0;
                                            const targetTime = lastCheck + (1000 * 60 * 60 * settings.updateCheckHours);
                                            if (targetTime < Date.now()) {
                                                ((manifest)=>checkForUpdate(manifest))(manifest);
                                            } else {
                                                ((manifest, item)=>checkForUpdate(manifest, !item.hasUpdate))(manifest, item);

                                            }
                                            return null;
                                        });
                                        wrap.append(update);
                                    }
                                    const del = document.createElement('div'); {
                                        del.classList.add('stem--action');
                                        del.classList.add('menu_button');
                                        del.classList.add('fa-solid', 'fa-fw', 'fa-trash-can');
                                        del.title = 'Remove extension';
                                        del.addEventListener('click', async()=>{
                                            item.classList.add('stem--isBusy');
                                            await fetch('/api/extensions/delete', {
                                                method: 'POST',
                                                headers: getRequestHeaders(),
                                                body: JSON.stringify({ extensionName:manifest.name.slice('third-party'.length) }),
                                            });
                                            item.remove();
                                        });
                                        wrap.append(del);
                                    }
                                }
                                actions.append(wrap);
                            }
                            item.append(actions);
                        }
                        tblBody.append(item);
                    }
                }
                body.append(tbl);
            });
            updates.extensions = updateExtensionList;
            await updateExtensionList();
            drawer.append(body);
        }
    }
    { // manage plugins
        const body = document.createElement('div'); {
            tabBody.plugins = body;
            body.classList.add('stem--body');
            body.classList.add('stem--managePlugins');
            const updatePluginList = (async()=>{
                body.innerHTML = '';
                const listResponse = await fetch('/api/plugins/pluginmanager/list');
                if (!listResponse.ok) {
                    return 'Something went wrong';
                }
                const plugins = await listResponse.json();
                let tblBody;
                const tbl = document.createElement('table'); {
                    tbl.classList.add('stem--table');
                    const thead = document.createElement('thead'); {
                        for (const col of ['Plugin', 'Commit', 'URL', 'Actions']) {
                            const th = document.createElement('th'); {
                                th.dataset.property = col;
                                if (col == 'Qrs') {
                                    th.classList.add('stem--numeric');
                                }
                                if (!['Actions'].includes(col)) {
                                    th.textContent = col;
                                }
                                thead.append(th);
                            }
                        }
                        tbl.append(thead);
                    }
                    const tbody = document.createElement('tbody'); {
                        tblBody = tbody;
                        tbl.append(tbody);
                    }
                }
                for (const plugin of plugins) {
                    const item = document.createElement('tr'); {
                        item.classList.add('stem--item');
                        const name = document.createElement('td'); {
                            name.dataset.property = 'Name';
                            name.textContent = plugin.name;
                            item.append(name);
                        }
                        const commit = document.createElement('td'); {
                            commit.dataset.property = 'Commit';
                            commit.textContent = '...';
                            item.append(commit);
                        }
                        let urlLink;
                        const url = document.createElement('td'); {
                            url.dataset.property = 'URL';
                            const a = document.createElement('a'); {
                                urlLink = a;
                                a.href = '...';
                                a.target = '_blank';
                                a.textContent = '...';
                                a.title = 'Open link in new tab';
                                url.append(a);
                            }
                            item.append(url);
                        }
                        const actions = document.createElement('td'); {
                            actions.dataset.property = 'Actions';
                            const wrap = document.createElement('div'); {
                                wrap.classList.add('stem--actions');
                                actions.append(wrap);
                                const update = document.createElement('div'); {
                                    update.classList.add('stem--action');
                                    update.classList.add('menu_button');
                                    update.classList.add('fa-fw');
                                    const i = document.createElement('i'); {
                                        i.classList.add('fa-solid', 'fa-fw', 'fa-spinner', 'fa-spin-pulse');
                                        update.append(i);
                                    }
                                    update.title = 'Checking for updates...';
                                    const checkForUpdate = async(plugin, isUpToDate = null)=>{
                                        let data;
                                        if (isUpToDate === null) {
                                            data = await queueCheckPluginForUpdate(plugin.name);
                                        } else {
                                            const response = await fetch('/api/plugins/pluginmanager/repo', {
                                                method: 'POST',
                                                headers: getRequestHeaders(),
                                                body: JSON.stringify({ plugin:plugin.name }),
                                            });
                                            data = Object.assign(await response.json(), { isUpToDate });
                                        }
                                        if (data.isRepo) {
                                            urlLink.textContent = data.remoteUrl;
                                            urlLink.href = data.remoteUrl;
                                            commit.textContent = data.commit.slice(0, 7);
                                            commit.title = `${data.branch.current}\n${data.commit}`;
                                        } else {
                                            urlLink.textContent = '';
                                            commit.textContent = 'no repo';
                                            data.isUpToDate = true;
                                        }
                                        i.classList.remove('fa-spinner', 'fa-spin-pulse');
                                        if (!data) {
                                            update.title = 'Failed to fetch plugin status!';
                                            i.classList.add('fa-triangle-exclamation');
                                            return;
                                        }
                                        plugin.isUpToDate = data.isUpToDate;
                                        if (data.isUpToDate) {
                                            i.classList.add('fa-code-commit');
                                            update.title = 'No update\n---\nclick to check for updates';
                                        } else {
                                            i.classList.add('fa-download');
                                            update.title = 'Download update';
                                        }
                                    };
                                    update.addEventListener('click', async()=>{
                                        if (plugin.isUpToDate !== false) {
                                            i.classList.remove('fa-code-commit');
                                            i.classList.add('fa-spinner', 'fa-spin-pulse');
                                            update.title = 'Checking for updates...';
                                            await checkForUpdate(plugin);
                                            return;
                                        }
                                        item.classList.add('stem--isBusy');
                                        i.classList.remove('fa-download');
                                        i.classList.add('fa-spinner', 'fa-spin-pulse');
                                        update.title = 'Updating...';
                                        const response = await fetch('/api/plugins/pluginmanager/update', {
                                            method: 'POST',
                                            headers: getRequestHeaders(),
                                            body: JSON.stringify({ plugin:plugin.name }),
                                        });
                                        if (!response.ok) {
                                            item.classList.remove('stem--isBusy');
                                            i.classList.remove('fa-spinner', 'fa-spin-pulse');
                                            i.classList.add('fa-download');
                                            toastr.warning(`Failed to update plugin: ${plugin.name}`);
                                            return;
                                        }
                                        plugin.isUpToDate = true;
                                        plugin.isUpdated = true;
                                        item.classList.remove('stem--isBusy');
                                        item.classList.add('stem--mustReload');
                                        i.classList.remove('fa-spinner', 'fa-spin-pulse');
                                        i.classList.add('fa-code-commit');
                                    });
                                    appReady.then(()=>{
                                        const item = settings.pluginUpdateCheckList.find(it=>it.plugin == plugin.name);
                                        const lastCheck = item?.checkedOn ?? 0;
                                        const targetTime = lastCheck + (1000 * 60 * 60 * settings.updateCheckHours);
                                        if (targetTime < Date.now()) {
                                            ((plugin)=>checkForUpdate(plugin))(plugin);
                                        } else {
                                            ((plugin, item)=>checkForUpdate(plugin, !item.hasUpdate))(plugin, item);

                                        }
                                        return null;
                                    });
                                    wrap.append(update);
                                }
                                const del = document.createElement('div'); {
                                    del.classList.add('stem--action');
                                    del.classList.add('menu_button');
                                    del.classList.add('fa-solid', 'fa-fw', 'fa-trash-can');
                                    del.title = 'Remove plugin';
                                    del.addEventListener('click', async()=>{
                                        item.classList.add('stem--isBusy');
                                        await fetch('/api/plugins/pluginmanager/uninstall', {
                                            method: 'POST',
                                            headers: getRequestHeaders(),
                                            body: JSON.stringify({ plugin:plugin.name }),
                                        });
                                        item.remove();
                                    });
                                    wrap.append(del);
                                }
                                actions.append(wrap);
                            }
                            item.append(actions);
                        }
                        tblBody.append(item);
                    }
                }
                body.append(tbl);
            });
            updates.plugins = updatePluginList;
            await updatePluginList();
            drawer.append(body);
        }
    }
    { // catalog
        const body = document.createElement('div'); {
            tabBody.catalog = body;
            body.classList.add('stem--body');
            body.classList.add('stem--catalog');
            const updateCatalog = async()=>{
                body.innerHTML = '';
                let extensions = [];
                for (const repo of settings.repoList) {
                    const response = await fetch(repo.url);
                    if (!response.ok) continue;
                    const data = await response.json();
                    extensions.push(...data.filter(it=>it.type == 'extension' || it.type == 'plugin'));
                }
                extensions = extensions.filter((a,idx,list)=>idx == list.findIndex(b=>b.url.toLowerCase() == a.url.toLowerCase()));
                extensions.sort((a,b)=>a.name.toLowerCase().localeCompare(b.name.toLowerCase()));
                const list = document.createElement('div'); {
                    list.classList.add('stem--list');
                    for (const ext of extensions) {
                        const item = document.createElement('div'); {
                            item.classList.add('stem--item');
                            if (manifests.find(it=>it.homePage == ext.url)) item.classList.add('stem--installed');
                            const img = document.createElement('div'); {
                                img.classList.add('stem--preview');
                                if (ext.thumb) {
                                    img.style.backgroundImage = `url('${ext.thumb}')`;
                                } else {
                                    if (ext.type == 'extension') {
                                        img.classList.add('fa-solid', 'fa-cubes');
                                    } else if (ext.type == 'plugin') {
                                        img.classList.add('fa-solid', 'fa-puzzle-piece');
                                    }
                                }
                                item.append(img);
                            }
                            const name = document.createElement('div'); {
                                name.classList.add('stem--name');
                                name.textContent = ext.name;
                                item.append(name);
                            }
                            const author = document.createElement('div'); {
                                author.classList.add('stem--author');
                                author.textContent = ext.author ?? '';
                                item.append(author);
                            }
                            const description = document.createElement('div'); {
                                description.classList.add('stem--description');
                                description.textContent = ext.description ?? '';
                                item.append(description);
                            }
                            const tags = document.createElement('div'); {
                                tags.classList.add('stem--tags');
                                for (const t of ext.tags ?? []) {
                                    const tag = document.createElement('div'); {
                                        tag.classList.add('stem--tag');
                                        tag.textContent = t;
                                        tags.append(tag);
                                    }
                                }
                                item.append(tags);
                            }
                            const actions = document.createElement('div'); {
                                actions.classList.add('stem--actions');
                                const dl = document.createElement('div'); {
                                    dl.classList.add('stem--action');
                                    dl.classList.add('menu_button');
                                    dl.classList.add('fa-solid', 'fa-fw');
                                    if (manifests.find(it=>it.homePage == ext.url)) {
                                        dl.classList.add('fa-trash-can');
                                        dl.title = 'Remove extension';
                                    } else {
                                        dl.classList.add('fa-download');
                                        dl.title = 'Install extension';
                                    }
                                    actions.append(dl);
                                }
                                const sep = document.createElement('div'); {
                                    sep.classList.add('stem--sep');
                                    actions.append(sep);
                                }
                                const readme = document.createElement('div'); {
                                    readme.classList.add('stem--action');
                                    readme.classList.add('menu_button');
                                    readme.classList.add('fa-solid', 'fa-fw', 'fa-file-text');
                                    readme.addEventListener('click', async()=>{
                                        // const readmeUrl = new URL(ext.url);
                                        // readmeUrl.host = 'api.github.com';
                                        // readmeUrl.pathname = `/repos${readmeUrl.pathname}/readme`;
                                        // let baseUrl = '';
                                        // let md = `
                                        //     ## No README found.

                                        //     Visit [GitHub](${ext.url}) for details.
                                        // `.split('\n').map(it=>it.trim()).join('\n');
                                        // try {
                                        //     const response = await fetch(readmeUrl);
                                        //     if (response.ok) {
                                        //         const data = await response.json();
                                        //         md = decodeURIComponent(
                                        //             atob(data.content)
                                        //                 .split('')
                                        //                 .map(char=>`%${`00${char.charCodeAt(0).toString(16)}`.slice(-2)}`)
                                        //                 .join(''),
                                        //         );
                                        //         baseUrl = data.download_url.split('/').slice(0, -1).join('/');
                                        //     }
                                        // } catch { /* empty */ }
                                        // const converter = reloadMarkdownProcessor();
                                        // const html = `
                                        //     <div class="mes stem--readme"><div class="mes_text">${converter.makeHtml(md)}</div></div>
                                        // `;
                                        let readme = (await executeSlashCommandsWithOptions(`
                                            /fetch ${ext.url} |
                                            /$ query=".markdown-body.entry-content" take=innerHTML |
                                        `)).pipe;
                                        const html = `
                                            <div class="mes stem--readme"><div class="mes_text">${readme}</div></div>
                                        `;
                                        const readmeDlg = new Popup(
                                            html,
                                            POPUP_TYPE.TEXT,
                                            null,
                                            {
                                                okButton:'Close',
                                                wide:true,
                                                wider:true,
                                                allowVerticalScrolling:true,
                                                large:true,
                                            },
                                        );
                                        readmeDlg.dlg.addEventListener('mousedown', evt=>evt.stopPropagation());
                                        for (const a of Array.from(readmeDlg.dlg.querySelectorAll('a'))) {
                                            a.target = '_blank';
                                            if (a.href.startsWith('/')) a.href = `https://github.com${a.href}`;
                                            else if (!a.href.includes('://')) a.href = `${ext.url}/${a.href}`;
                                            else if (a.href.startsWith(location.href)) a.href = `https://github.com${a.href.slice(location.href.length)}`;
                                        }
                                        for (const el of Array.from(readmeDlg.dlg.querySelectorAll('[src]'))) {
                                            if (el.src.startsWith('/')) el.src = `https://github.com${el.src}`;
                                            // else if (!el.src.includes('://')) el.src = `${baseUrl}/${el.src}`;
                                            else if (el.src.startsWith(location.href)) el.src = `https://github.com${el.src.slice(location.href.length)}`;
                                        }
                                        readmeDlg.show();
                                    });
                                    actions.append(readme);
                                }
                                const git = document.createElement('div'); {
                                    git.classList.add('stem--action');
                                    git.classList.add('menu_button');
                                    git.classList.add('fa-brands', 'fa-fw', 'fa-github');
                                    git.addEventListener('click', ()=>window.open(ext.url, '_blank'));
                                    actions.append(git);
                                }
                                item.append(actions);
                            }
                            list.append(item);
                        }
                    }
                    body.append(list);
                }
            };
            updates.catalog = updateCatalog;
            updateCatalog();
            drawer.append(body);
        }
    }
    { // raw / JSON
        const body = document.createElement('div'); {
            tabBody.raw = body;
            body.classList.add('stem--body');
            body.classList.add('stem--raw');
            let pre;
            let picker;
            const putConfig = ()=>{
                if (!pre || !picker) return;
                const extensionKey = picker.value;
                pre.value = '';
                if (extensionKey?.length) {
                    pre.value = JSON.stringify(extension_settings[extensionKey], null, '\t');
                }
            };
            const actions = document.createElement('div'); {
                actions.classList.add('stem--actions');
                { // picker
                    const populatePicker = ()=>{
                        const val = picker.value;
                        picker.innerHTML = '';
                        picker.addEventListener('change', ()=>putConfig());
                        const blank = document.createElement('option'); {
                            blank.value = '';
                            blank.textContent = '-- Select an extension --';
                            picker.append(blank);
                        }
                        for (const key of Object.keys(extension_settings).toSorted((a,b)=>a.toLowerCase().localeCompare(b.toLowerCase()))) {
                            const opt = document.createElement('option'); {
                                opt.value = key;
                                opt.textContent = key;
                                picker.append(opt);
                            }
                        }
                        picker.value = val;
                        putConfig();
                    };
                    picker = document.createElement('select'); {
                        picker.classList.add('text_pole');
                        populatePicker();
                        actions.append(picker);
                    }
                    const pickerRefresh = document.createElement('div'); {
                        pickerRefresh.classList.add('menu_button');
                        pickerRefresh.classList.add('fa-solid', 'fa-fw', 'fa-rotate-left');
                        pickerRefresh.addEventListener('click', ()=>populatePicker());
                        actions.append(pickerRefresh);
                    }
                }
                const sep = document.createElement('div'); {
                    sep.classList.add('stem--sep');
                    actions.append(sep);
                }
                const reset = document.createElement('div'); {
                    reset.classList.add('menu_button');
                    reset.classList.add('menu_button_icon');
                    reset.addEventListener('click', ()=>putConfig());
                    const i = document.createElement('i'); {
                        i.classList.add('fa-solid', 'fa-fw', 'fa-rotate-left');
                        reset.append(i);
                    }
                    const t = document.createElement('span'); {
                        t.textContent = 'Reset';
                        t.title = 'Reset to last saved state';
                        reset.append(t);
                    }
                    actions.append(reset);
                }
                const save = document.createElement('div'); {
                    save.classList.add('menu_button');
                    save.classList.add('menu_button_icon');
                    save.addEventListener('click', ()=>{
                        try {
                            if (!picker?.value?.length) return;
                            const parsed = JSON.parse(pre.value);
                            extension_settings[picker.value] = parsed;
                            saveSettingsDebounced();
                            toastr.success('Config saved');
                        } catch (ex) {
                            alert(ex);
                        }
                    });
                    const i = document.createElement('i'); {
                        i.classList.add('fa-solid', 'fa-fw', 'fa-save');
                        save.append(i);
                    }
                    const t = document.createElement('span'); {
                        t.textContent = 'Save';
                        t.title = 'Save changes';
                        save.append(t);
                    }
                    actions.append(save);
                }
                body.append(actions);
            }
            pre = document.createElement('textarea'); {
                dom.config.textarea = pre;
                putConfig();
                body.append(pre);
            }
            drawer.append(body);
        }
    }
    { // config
        const body = document.createElement('div'); {
            tabBody.config = body;
            body.classList.add('stem--body');
            body.classList.add('stem--config');
            const actions = document.createElement('div'); {
                actions.classList.add('stem--actions');
                const reset = document.createElement('div'); {
                    reset.classList.add('menu_button');
                    reset.classList.add('menu_button_icon');
                    reset.addEventListener('click', ()=>pre.value = JSON.stringify(settings, null, '\t'));
                    const i = document.createElement('i'); {
                        i.classList.add('fa-solid', 'fa-fw', 'fa-rotate-left');
                        reset.append(i);
                    }
                    const t = document.createElement('span'); {
                        t.textContent = 'Reset';
                        t.title = 'Reset to last saved state';
                        reset.append(t);
                    }
                    actions.append(reset);
                }
                const save = document.createElement('div'); {
                    save.classList.add('menu_button');
                    save.classList.add('menu_button_icon');
                    save.addEventListener('click', ()=>{
                        try {
                            const parsed = JSON.parse(pre.value);
                            Object.assign(settings, parsed);
                            saveSettings();
                            toastr.success('Config saved');
                        } catch (ex) {
                            alert(ex);
                        }
                    });
                    const i = document.createElement('i'); {
                        i.classList.add('fa-solid', 'fa-fw', 'fa-save');
                        save.append(i);
                    }
                    const t = document.createElement('span'); {
                        t.textContent = 'Save';
                        t.title = 'Save changes';
                        save.append(t);
                    }
                    actions.append(save);
                }
                body.append(actions);
            }
            const pre = document.createElement('textarea'); {
                dom.config.textarea = pre;
                pre.value = JSON.stringify(settings, null, '\t');
                body.append(pre);
            }
            drawer.append(body);
        }
    }
};
await init();
