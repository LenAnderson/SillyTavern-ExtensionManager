import { event_types, eventSource, getRequestHeaders, reloadMarkdownProcessor, saveSettingsDebounced } from '../../../../script.js';
import { disableExtension, enableExtension, extension_settings, openThirdPartyExtensionMenu } from '../../../extensions.js';
import { Popup, POPUP_TYPE } from '../../../popup.js';
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
    extensionUpdateCheckList: {extension:string, checkedOn:number, hasUpdate:boolean, details:{}}[],
    pluginUpdateCheckList: {plugin:string, checkedOn:number, hasUpdate:boolean, details:{}}[],
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
        branch:{current:string, detached:boolean, all:string[], branches:{[name:string]:{}}},
        isCore:boolean,
        isDisabled:boolean,
        isDisabledNow:boolean,
        isUpToDate:boolean,
        isUpdated:boolean,
        isRepo:boolean,

        tblRow:HTMLElement,
    }[]} */
let manifests = [];
/**@type {{
 *      [extension:string]: { time:number, stack:string }[]
 * }} */
let errors = {};

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
            const response = await fetch('/api/plugins/emp/extensions/hasUpdates', {
                method: 'POST',
                headers: getRequestHeaders(),
                body: JSON.stringify({ extension:name.slice('third-party'.length) }),
            });
            if (!response.ok) {
                resolve(null);
                continue;
            }
            const data = await response.json();
            let item = settings.extensionUpdateCheckList.find(it=>it.extension == name);
            if (item) {
                item.checkedOn = Date.now();
                item.hasUpdate = !data.isUpToDate;
                item.details = data;
            } else {
                item = {
                    extension:name,
                    checkedOn:Date.now(),
                    hasUpdate:!data.isUpToDate,
                    details: data,
                };
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
            const response = await fetch('/api/plugins/emp/plugins/hasUpdates', {
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
    const pluginTest = await fetch('/api/plugins/emp/');
    if (!pluginTest.ok) {
        Popup.show.text('Extension Manager', '<strong>Dependency Missing!</strong><br>Extension Manager requires the server plugin Extension Manager Plugin');
        return;
    }
    const drawer = /**@type {HTMLElement}*/(document.querySelector('#rm_extensions_block'));
    const settingsBody = /**@type {HTMLElement}*/(drawer.querySelector(':scope > .extensions_block'));
    const header = /**@type {HTMLElement}*/(settingsBody.children[0]);
    settingsBody.insertAdjacentElement('beforebegin', header);

    drawer.classList.add('stem--drawer');
    settingsBody.classList.add('stem--extensionSettings');
    settingsBody.classList.add('stem--body');
    settingsBody.classList.add('stem--active');
    header.classList.add('stem--head');

    // reload warning
    const warning = document.createElement('div'); {
        warning.classList.add('stem--reloadWarning');
        warning.textContent = 'Reload the page to apply extension changes';
        document.body.append(warning);
    }

    // collect extension errors
    /**
     * @param {ErrorEvent|PromiseRejectionEvent} evt
     */
    const handleError = (evt)=>{
        const ex = evt instanceof ErrorEvent ? evt.error : evt.reason;
        const stack = ex.stack.split('\n').map(it=>it.trim());
        const isThirdParty = stack.find(it=>it.includes('/scripts/extensions/third-party/')) != null;
        if (!isThirdParty) return;
        const source = stack.find(it=>it.includes('/scripts/extensions/third-party/')).replace(/^.*?\/scripts\/extensions\/(third-party\/[^/]+)\/.*$/, '$1');
        if (!errors[source]) errors[source] = [];
        errors[source].push({ time:Date.now(), stack:ex.stack });
        manifests.find(it=>it.name == source)?.tblRow?.setAttribute('data-stem--hasErrors', '1');
    };
    window.addEventListener('error', (evt)=>handleError(evt));
    window.addEventListener('unhandledrejection', (evt)=>handleError(evt));

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
            const filterPanel = document.createElement('div'); {
                filterPanel.classList.add('stem--filters');
                const search = document.createElement('label'); {
                    search.classList.add('stem--search');
                    const lbl = document.createElement('div'); {
                        lbl.textContent = 'Search:';
                        search.append(lbl);
                    }
                    const inp = document.createElement('input'); {
                        inp.classList.add('text_pole');
                        inp.type = 'search';
                        inp.placeholder = 'Search extensions';
                        inp.setAttribute('data-stem--filter', 'query');
                        inp.addEventListener('input', ()=>{
                            for (const manifest of manifests) {
                                const show = inp.value.length == 0 || manifest.display_name.toLowerCase().includes(inp.value.toLowerCase());
                                const filter = JSON.parse(manifest.tblRow.getAttribute('data-stem--filter') ?? '[]');
                                const cur = filter.includes(inp.getAttribute('data-stem--filter'));
                                if (!show) {
                                    if (!cur) {
                                        filter.push(inp.getAttribute('data-stem--filter'));
                                    }
                                } else if (cur) {
                                    filter.splice(filter.indexOf(inp.getAttribute('data-stem--filter')), 1);
                                }
                                manifest.tblRow.setAttribute('data-stem--filter', JSON.stringify(filter));
                            }
                        });
                        search.append(inp);
                    }
                    filterPanel.append(search);
                }
                const groupStatus = document.createElement('div'); {
                    groupStatus.classList.add('stem--group');
                    const lbl = document.createElement('div'); {
                        lbl.classList.add('stem--groupLabel');
                        lbl.textContent = 'Status';
                        groupStatus.append(lbl);
                    }
                    const filterEnabled = document.createElement('label'); {
                        filterEnabled.classList.add('stem--filter');
                        const cb = document.createElement('input'); {
                            cb.type = 'checkbox';
                            cb.checked = true;
                            cb.setAttribute('data-stem--filter', 'Enabled');
                            cb.addEventListener('click', ()=>{
                                for (const manifest of manifests) {
                                    const show = !manifest.isDisabledNow;
                                    const filter = JSON.parse(manifest.tblRow.getAttribute('data-stem--filter') ?? '[]');
                                    const cur = filter.includes(cb.getAttribute('data-stem--filter'));
                                    if (!cb.checked && show) {
                                        if (!cur) {
                                            filter.push(cb.getAttribute('data-stem--filter'));
                                        }
                                    } else if (cur) {
                                        filter.splice(filter.indexOf(cb.getAttribute('data-stem--filter')), 1);
                                    }
                                    manifest.tblRow.setAttribute('data-stem--filter', JSON.stringify(filter));
                                }
                            });
                            filterEnabled.append(cb);
                        }
                        const lbl = document.createElement('div'); {
                            lbl.textContent = 'Enabled';
                            filterEnabled.append(lbl);
                        }
                        groupStatus.append(filterEnabled);
                    }
                    const filterDisabled = document.createElement('label'); {
                        filterDisabled.classList.add('stem--filter');
                        const cb = document.createElement('input'); {
                            cb.type = 'checkbox';
                            cb.checked = true;
                            cb.setAttribute('data-stem--filter', 'Disabled');
                            cb.addEventListener('click', ()=>{
                                for (const manifest of manifests) {
                                    const show = manifest.isDisabledNow;
                                    const filter = JSON.parse(manifest.tblRow.getAttribute('data-stem--filter') ?? '[]');
                                    const cur = filter.includes(cb.getAttribute('data-stem--filter'));
                                    if (!cb.checked && show) {
                                        if (!cur) {
                                            filter.push(cb.getAttribute('data-stem--filter'));
                                        }
                                    } else if (cur) {
                                        filter.splice(filter.indexOf(cb.getAttribute('data-stem--filter')), 1);
                                    }
                                    manifest.tblRow.setAttribute('data-stem--filter', JSON.stringify(filter));
                                }
                            });
                            filterDisabled.append(cb);
                        }
                        const lbl = document.createElement('div'); {
                            lbl.textContent = 'Disabled';
                            filterDisabled.append(lbl);
                        }
                        groupStatus.append(filterDisabled);
                    }
                    filterPanel.append(groupStatus);
                }
                const groupUpdates = document.createElement('div'); {
                    groupUpdates.classList.add('stem--group');
                    const lbl = document.createElement('div'); {
                        lbl.classList.add('stem--groupLabel');
                        lbl.textContent = 'Updates';
                        groupUpdates.append(lbl);
                    }
                    const filterUpdated = document.createElement('label'); {
                        filterUpdated.classList.add('stem--filter');
                        const cb = document.createElement('input'); {
                            cb.type = 'checkbox';
                            cb.checked = true;
                            cb.setAttribute('data-stem--filter', 'Updated');
                            cb.addEventListener('click', ()=>{
                                for (const manifest of manifests) {
                                    const show = manifest.isRepo && manifest.isUpToDate;
                                    const filter = JSON.parse(manifest.tblRow.getAttribute('data-stem--filter') ?? '[]');
                                    const cur = filter.includes(cb.getAttribute('data-stem--filter'));
                                    if (!cb.checked && show) {
                                        if (!cur) {
                                            filter.push(cb.getAttribute('data-stem--filter'));
                                        }
                                    } else if (cur) {
                                        filter.splice(filter.indexOf(cb.getAttribute('data-stem--filter')), 1);
                                    }
                                    manifest.tblRow.setAttribute('data-stem--filter', JSON.stringify(filter));
                                }
                            });
                            filterUpdated.append(cb);
                        }
                        const lbl = document.createElement('div'); {
                            lbl.textContent = 'Updated';
                            filterUpdated.append(lbl);
                        }
                        groupUpdates.append(filterUpdated);
                    }
                    const filterHasUpdate = document.createElement('label'); {
                        filterHasUpdate.classList.add('stem--filter');
                        const cb = document.createElement('input'); {
                            cb.type = 'checkbox';
                            cb.checked = true;
                            cb.setAttribute('data-stem--filter', 'HasUpdate');
                            cb.addEventListener('click', ()=>{
                                for (const manifest of manifests) {
                                    const show = manifest.isRepo && !manifest.isUpToDate;
                                    const filter = JSON.parse(manifest.tblRow.getAttribute('data-stem--filter') ?? '[]');
                                    const cur = filter.includes(cb.getAttribute('data-stem--filter'));
                                    if (!cb.checked && show) {
                                        if (!cur) {
                                            filter.push(cb.getAttribute('data-stem--filter'));
                                        }
                                    } else if (cur) {
                                        filter.splice(filter.indexOf(cb.getAttribute('data-stem--filter')), 1);
                                    }
                                    manifest.tblRow.setAttribute('data-stem--filter', JSON.stringify(filter));
                                }
                            });
                            filterHasUpdate.append(cb);
                        }
                        const lbl = document.createElement('div'); {
                            lbl.textContent = 'Has update';
                            filterHasUpdate.append(lbl);
                        }
                        groupUpdates.append(filterHasUpdate);
                    }
                    const filterCantUpdate = document.createElement('label'); {
                        filterCantUpdate.classList.add('stem--filter');
                        const cb = document.createElement('input'); {
                            cb.type = 'checkbox';
                            cb.checked = true;
                            cb.setAttribute('data-stem--filter', 'CantUpdate');
                            cb.addEventListener('click', ()=>{
                                for (const manifest of manifests) {
                                    const show = !manifest.isRepo;
                                    const filter = JSON.parse(manifest.tblRow.getAttribute('data-stem--filter') ?? '[]');
                                    const cur = filter.includes(cb.getAttribute('data-stem--filter'));
                                    if (!cb.checked && show) {
                                        if (!cur) {
                                            filter.push(cb.getAttribute('data-stem--filter'));
                                        }
                                    } else if (cur) {
                                        filter.splice(filter.indexOf(cb.getAttribute('data-stem--filter')), 1);
                                    }
                                    manifest.tblRow.setAttribute('data-stem--filter', JSON.stringify(filter));
                                }
                            });
                            filterCantUpdate.append(cb);
                        }
                        const lbl = document.createElement('div'); {
                            lbl.textContent = 'Can\'t Update';
                            filterCantUpdate.append(lbl);
                        }
                        groupUpdates.append(filterCantUpdate);
                    }
                    filterPanel.append(groupUpdates);
                }
                const groupErrors = document.createElement('div'); {
                    groupErrors.classList.add('stem--group');
                    const lbl = document.createElement('div'); {
                        lbl.classList.add('stem--groupLabel');
                        lbl.textContent = 'Errors';
                        groupErrors.append(lbl);
                    }
                    const filterErrorLog = document.createElement('label'); {
                        filterErrorLog.classList.add('stem--filter');
                        const cb = document.createElement('input'); {
                            cb.type = 'checkbox';
                            cb.checked = true;
                            cb.setAttribute('data-stem--filter', 'ErrorLog');
                            cb.addEventListener('click', ()=>{
                                for (const manifest of manifests) {
                                    const show = !!errors[manifest.name]?.length;
                                    const filter = JSON.parse(manifest.tblRow.getAttribute('data-stem--filter') ?? '[]');
                                    const cur = filter.includes(cb.getAttribute('data-stem--filter'));
                                    if (!cb.checked && show) {
                                        if (!cur) {
                                            filter.push(cb.getAttribute('data-stem--filter'));
                                        }
                                    } else if (cur) {
                                        filter.splice(filter.indexOf(cb.getAttribute('data-stem--filter')), 1);
                                    }
                                    manifest.tblRow.setAttribute('data-stem--filter', JSON.stringify(filter));
                                }
                            });
                            filterErrorLog.append(cb);
                        }
                        const lbl = document.createElement('div'); {
                            lbl.textContent = 'Errors';
                            filterErrorLog.append(lbl);
                        }
                        groupErrors.append(filterErrorLog);
                    }
                    const filterNoErrorLog = document.createElement('label'); {
                        filterNoErrorLog.classList.add('stem--filter');
                        const cb = document.createElement('input'); {
                            cb.type = 'checkbox';
                            cb.checked = true;
                            cb.setAttribute('data-stem--filter', 'NoErrorLog');
                            cb.addEventListener('click', ()=>{
                                for (const manifest of manifests) {
                                    const show = !errors[manifest.name]?.length;
                                    const filter = JSON.parse(manifest.tblRow.getAttribute('data-stem--filter') ?? '[]');
                                    const cur = filter.includes(cb.getAttribute('data-stem--filter'));
                                    if (!cb.checked && show) {
                                        if (!cur) {
                                            filter.push(cb.getAttribute('data-stem--filter'));
                                        }
                                    } else if (cur) {
                                        filter.splice(filter.indexOf(cb.getAttribute('data-stem--filter')), 1);
                                    }
                                    manifest.tblRow.setAttribute('data-stem--filter', JSON.stringify(filter));
                                }
                            });
                            filterNoErrorLog.append(cb);
                        }
                        const lbl = document.createElement('div'); {
                            lbl.textContent = 'No Errors';
                            filterNoErrorLog.append(lbl);
                        }
                        groupErrors.append(filterNoErrorLog);
                    }
                    filterPanel.append(groupErrors);
                }
                const groupSource = document.createElement('div'); {
                    groupSource.classList.add('stem--group');
                    const lbl = document.createElement('div'); {
                        lbl.classList.add('stem--groupLabel');
                        lbl.textContent = 'Source';
                        groupSource.append(lbl);
                    }
                    const filterCore = document.createElement('label'); {
                        filterCore.classList.add('stem--filter');
                        const cb = document.createElement('input'); {
                            cb.type = 'checkbox';
                            cb.checked = true;
                            cb.setAttribute('data-stem--filter', 'Core');
                            cb.addEventListener('click', ()=>{
                                for (const manifest of manifests) {
                                    const show = manifest.isCore;
                                    const filter = JSON.parse(manifest.tblRow.getAttribute('data-stem--filter') ?? '[]');
                                    const cur = filter.includes(cb.getAttribute('data-stem--filter'));
                                    if (!cb.checked && show) {
                                        if (!cur) {
                                            filter.push(cb.getAttribute('data-stem--filter'));
                                        }
                                    } else if (cur) {
                                        filter.splice(filter.indexOf(cb.getAttribute('data-stem--filter')), 1);
                                    }
                                    manifest.tblRow.setAttribute('data-stem--filter', JSON.stringify(filter));
                                }
                            });
                            filterCore.append(cb);
                        }
                        const lbl = document.createElement('div'); {
                            lbl.textContent = 'Core';
                            filterCore.append(lbl);
                        }
                        groupSource.append(filterCore);
                    }
                    const filterThirdParty = document.createElement('label'); {
                        filterThirdParty.classList.add('stem--filter');
                        const cb = document.createElement('input'); {
                            cb.type = 'checkbox';
                            cb.checked = true;
                            cb.setAttribute('data-stem--filter', 'ThirdParty');
                            cb.addEventListener('click', ()=>{
                                for (const manifest of manifests) {
                                    const show = !manifest.isCore;
                                    const filter = JSON.parse(manifest.tblRow.getAttribute('data-stem--filter') ?? '[]');
                                    const cur = filter.includes(cb.getAttribute('data-stem--filter'));
                                    if (!cb.checked && show) {
                                        if (!cur) {
                                            filter.push(cb.getAttribute('data-stem--filter'));
                                        }
                                    } else if (cur) {
                                        filter.splice(filter.indexOf(cb.getAttribute('data-stem--filter')), 1);
                                    }
                                    manifest.tblRow.setAttribute('data-stem--filter', JSON.stringify(filter));
                                }
                            });
                            filterThirdParty.append(cb);
                        }
                        const lbl = document.createElement('div'); {
                            lbl.textContent = 'Third-party';
                            filterThirdParty.append(lbl);
                        }
                        groupSource.append(filterThirdParty);
                    }
                    filterPanel.append(groupSource);
                }
                body.append(filterPanel);
            }
            let tbl;
            let tblBody;
            const updateExtensionList = (async()=>{
                tbl?.remove();
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
                    if (a.isCore && !b.isCore) return 1;
                    if (!a.isCore && b.isCore) return -1;
                    return a.display_name.toLowerCase().localeCompare(b.display_name.toLowerCase());
                });
                tbl = document.createElement('table'); {
                    tbl.classList.add('stem--table');
                    const thead = document.createElement('thead'); {
                        for (const col of ['Extension', 'Source', 'Version', 'Branch', 'Author', 'URL', 'Actions']) {
                            const th = document.createElement('th'); {
                                th.dataset.property = col;
                                if (col == 'Qrs') {
                                    th.classList.add('stem--numeric');
                                }
                                if (!['Source', 'Actions'].includes(col)) {
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
                for (const manifest of manifests) {
                    console.warn(manifest.display_name, manifest);
                    const item = document.createElement('tr'); {
                        item.classList.add('stem--item');
                        if (manifest.isCore) item.classList.add('stem--isCore');
                        if (manifest.isDisabled) item.classList.add('stem--isDisabled');
                        manifest.tblRow = item;
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
                        let branchLabel;
                        const branch = document.createElement('td'); {
                            branch.dataset.property = 'Branch';
                            const wrap = document.createElement('div'); {
                                wrap.classList.add('stem--actions');
                                branchLabel = document.createElement('div'); {
                                    branchLabel.classList.add('stem--branchLabel');
                                    wrap.append(branchLabel);
                                }
                                const branchBtn = document.createElement('div'); {
                                    branchBtn.classList.add('stem--action');
                                    branchBtn.classList.add('menu_button');
                                    branchBtn.classList.add('fa-solid', 'fa-fw', 'fa-code-branch');
                                    branchBtn.title = 'Switch to another branch';
                                    branchBtn.addEventListener('click', ()=>{
                                        toastr.info('nope');
                                    });
                                    wrap.append(branchBtn);
                                }
                                branch.append(wrap);
                            }
                            item.append(branch);
                        }
                        const author = document.createElement('td'); {
                            author.dataset.property = 'Author';
                            author.textContent = manifest.author;
                            item.append(author);
                        }
                        const url = document.createElement('td'); {
                            url.dataset.property = 'URL';
                            if (!manifest.isCore) {
                                const wrap = document.createElement('span'); {
                                    wrap.classList.add('stem--urlWrap');
                                    const a = document.createElement('a'); {
                                        a.href = manifest.homePage;
                                        a.target = '_blank';
                                        a.textContent = manifest.homePage;
                                        a.title = 'Open link in new tab';
                                        wrap.append(a);
                                    }
                                    url.append(wrap);
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
                                    let updateIcon;
                                    const update = document.createElement('div'); {
                                        update.classList.add('stem--action');
                                        update.classList.add('menu_button');
                                        update.classList.add('fa-fw');
                                        updateIcon = document.createElement('i'); {
                                            updateIcon.classList.add('fa-solid', 'fa-fw', 'fa-spinner', 'fa-spin-pulse');
                                            update.append(updateIcon);
                                        }
                                        update.title = 'Checking for updates...';
                                        update.addEventListener('click', async()=>{
                                            if (manifest.isUpToDate === true) return;
                                            item.classList.add('stem--isBusy');
                                            updateIcon.classList.remove('fa-download');
                                            updateIcon.classList.add('fa-spinner', 'fa-spin-pulse');
                                            update.title = 'Updating...';
                                            const response = await fetch('/api/extensions/update', {
                                                method: 'POST',
                                                headers: getRequestHeaders(),
                                                body: JSON.stringify({ extensionName:manifest.name.slice('third-party'.length) }),
                                            });
                                            if (!response.ok) {
                                                item.classList.remove('stem--isBusy');
                                                updateIcon.classList.remove('fa-spinner', 'fa-spin-pulse');
                                                updateIcon.classList.add('fa-download');
                                                toastr.warning(`Failed to update extension: ${manifest.display_name}`);
                                                return;
                                            }
                                            manifest.isUpToDate = true;
                                            manifest.isUpdated = true;
                                            const cache = settings.extensionUpdateCheckList.find(it=>it.extension == manifest.name);
                                            if (cache) {
                                                cache.checkedOn = Date.now();
                                                cache.hasUpdate = false;
                                            }
                                            item.classList.remove('stem--isBusy');
                                            item.classList.add('stem--mustReload');
                                            updateIcon.classList.remove('fa-spinner', 'fa-spin-pulse');
                                            updateIcon.classList.add('fa-check');
                                        });
                                        wrap.append(update);
                                    }
                                    const checkUpdate = document.createElement('div'); {
                                        checkUpdate.classList.add('stem--action');
                                        checkUpdate.classList.add('menu_button');
                                        checkUpdate.classList.add('fa-fw');
                                        checkUpdate.title = 'Check for updates';
                                        const i = document.createElement('i'); {
                                            i.classList.add('fa-solid', 'fa-fw', 'fa-rotate');
                                            checkUpdate.append(i);
                                        }
                                        const checkForUpdate = async(manifest, cache = null)=>{
                                            update.classList.remove('stem--noUpdate');
                                            update.classList.remove('stem--hasUpdate');
                                            update.classList.remove('stem--error');
                                            updateIcon.classList.remove('fa-bounce');
                                            updateIcon.classList.remove('fa-triangle-exclamation');
                                            let data;
                                            if (!cache?.details) {
                                                data = await queueCheckForUpdate(manifest.name);
                                            } else {
                                                data = cache.details;
                                            }
                                            updateIcon.classList.remove('fa-spinner', 'fa-spin-pulse');
                                            i.classList.remove('fa-spinner', 'fa-spin-pulse');
                                            if (!data?.isRepo) {
                                                update.classList.add('stem--error');
                                                updateIcon.classList.add('fa-triangle-exclamation');
                                                update.title = 'Failed to fetch extension status!';
                                                manifest.isRepo = false;
                                                branchLabel.textContent = '';
                                                branch.title = '';
                                                return;
                                            }
                                            manifest.isRepo = true;
                                            manifest.isUpToDate = data.isUpToDate;
                                            manifest.branch = data.branch;
                                            branchLabel.textContent = data.branch?.current ?? '';
                                            const branchList = manifest.branch?.all
                                                ?.filter(it=>it.startsWith('remotes/'))
                                                ?.map(it=>`• ${it.replace(/^remotes\/(?:origin\/)?/, '')}`)
                                                ?? []
                                            ;
                                            branch.title = [
                                                'Branches:',
                                                ...branchList,
                                            ].join('\n');
                                            branch.dataset.count = branchList.length;
                                            if (data.isUpToDate) {
                                                update.classList.add('stem--noUpdate');
                                                updateIcon.classList.add('fa-check');
                                                update.title = 'No update';
                                            } else {
                                                update.classList.add('stem--hasUpdate');
                                                updateIcon.classList.add('fa-bounce');
                                                updateIcon.classList.add('fa-download');
                                                update.title = [
                                                    'Download update',
                                                    `v${data.manifest?.version ?? '??'}`,
                                                    '---',
                                                    (data.log?.all ?? []).map(it=>`• ${it.message}`).join('\n'),
                                                ].join('\n');
                                            }
                                        };
                                        checkUpdate.addEventListener('click', async()=>{
                                            updateIcon.classList.remove('fa-check');
                                            updateIcon.classList.add('fa-spinner', 'fa-spin-pulse');
                                            update.title = 'Checking for updates...';
                                            await checkForUpdate(manifest);
                                        });
                                        appReady.then(()=>{
                                            const cache = settings.extensionUpdateCheckList.find(it=>it.extension == manifest.name);
                                            const lastCheck = cache?.checkedOn ?? 0;
                                            const targetTime = lastCheck + (1000 * 60 * 60 * settings.updateCheckHours);
                                            if (targetTime < Date.now()) {
                                                ((manifest)=>checkForUpdate(manifest))(manifest);
                                            } else {
                                                ((manifest, cache)=>checkForUpdate(manifest, cache))(manifest, cache);

                                            }
                                            return null;
                                        });
                                        wrap.append(checkUpdate);
                                    }
                                    const errorLog = document.createElement('div'); {
                                        errorLog.classList.add('stem--action');
                                        errorLog.classList.add('stem--errorLog');
                                        errorLog.classList.add('menu_button');
                                        errorLog.classList.add('fa-stack', 'fa-fw');
                                        errorLog.title = 'Errors';
                                        errorLog.addEventListener('click', async()=>{
                                            const dom = document.createElement('div'); {
                                                dom.classList.add('stem--errorLogPopup');
                                                const head = document.createElement('h3'); {
                                                    head.classList.add('stem--title');
                                                    const text = document.createElement('div'); {
                                                        text.textContent = manifest.display_name;
                                                        head.append(text);
                                                    }
                                                    const copy = document.createElement('div'); {
                                                        copy.classList.add('menu_button');
                                                        copy.classList.add('fa-solid', 'fa-fw', 'fa-copy');
                                                        copy.title = 'Copy error log to clipboard';
                                                        copy.addEventListener('click', async()=>{
                                                            const value = errors[manifest.name]
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
                                                    for (const ex of errors[manifest.name] ?? []) {
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
                                        });
                                        const iconFile = document.createElement('i'); {
                                            iconFile.classList.add('fa-solid', 'fa-stack-1x', 'fa-file');
                                            errorLog.append(iconFile);
                                        }
                                        const iconExclamation = document.createElement('i'); {
                                            iconExclamation.classList.add('fa-solid', 'fa-stack-1x', 'fa-exclamation');
                                            errorLog.append(iconExclamation);
                                        }
                                        wrap.append(errorLog);
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
                const listResponse = await fetch('/api/plugins/emp/plugins/list');
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
                                            const response = await fetch('/api/plugins/emp/plugins/repo', {
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
                                            i.classList.add('fa-check');
                                            update.title = 'No update\n---\nclick to check for updates';
                                        } else {
                                            i.classList.add('fa-download');
                                            update.title = 'Download update';
                                        }
                                    };
                                    update.addEventListener('click', async()=>{
                                        if (plugin.isUpToDate !== false) {
                                            i.classList.remove('fa-check');
                                            i.classList.add('fa-spinner', 'fa-spin-pulse');
                                            update.title = 'Checking for updates...';
                                            await checkForUpdate(plugin);
                                            return;
                                        }
                                        item.classList.add('stem--isBusy');
                                        i.classList.remove('fa-download');
                                        i.classList.add('fa-spinner', 'fa-spin-pulse');
                                        update.title = 'Updating...';
                                        const response = await fetch('/api/plugins/emp/plugins/update', {
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
                                        i.classList.add('fa-check');
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
                                        await fetch('/api/plugins/emp/plugins/uninstall', {
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
                                        let isOpen = true;
                                        const readmeDlg = new Popup(
                                            'Fetching readme...',
                                            POPUP_TYPE.TEXT,
                                            null,
                                            {
                                                okButton:'Close',
                                                wide:true,
                                                wider:true,
                                                allowVerticalScrolling:true,
                                                large:true,
                                                onClose: ()=>{
                                                    isOpen = false;
                                                },
                                            },
                                        );
                                        readmeDlg.show();
                                        const response = await fetch('/api/plugins/emp/catalog/readme', {
                                            method: 'POST',
                                            headers: getRequestHeaders(),
                                            body: JSON.stringify({
                                                repo: ext.url,
                                            }),
                                        });
                                        const { branch, readme:md } = await response.json();
                                        if (!isOpen) return;
                                        const converter = reloadMarkdownProcessor();
                                        const readme = converter.makeHtml(md);
                                        const html = `
                                            <div class="mes stem--readme"><div class="mes_text">${readme}</div></div>
                                        `;
                                        readmeDlg.content.innerHTML = html;
                                        readmeDlg.dlg.addEventListener('mousedown', evt=>evt.stopPropagation());
                                        for (const a of Array.from(readmeDlg.dlg.querySelectorAll('a'))) {
                                            a.target = '_blank';
                                            if (a.href.startsWith('/')) a.href = `https://github.com${a.href}`;
                                            else if (!a.href.includes('://')) a.href = `${ext.url}/${a.href}`;
                                            else if (a.href.startsWith(location.href)) a.href = `${ext.url}/${a.href.slice(location.href.length)}`;
                                        }
                                        for (const el of Array.from(readmeDlg.dlg.querySelectorAll('[src]'))) {
                                            if (el.src.startsWith('/')) el.src = `https://github.com${el.src}`;
                                            // else if (!el.src.includes('://')) el.src = `${baseUrl}/${el.src}`;
                                            else if (el.src.startsWith(location.href)) el.src = `${ext.url}/raw/${branch}/${el.src.slice(location.href.length)}`;
                                        }
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


let isDiscord;
const checkDiscord = async()=>{
    let newIsDiscord = window.getComputedStyle(document.body).getPropertyValue('--nav-bar-width') !== '';
    if (isDiscord != newIsDiscord) {
        isDiscord = newIsDiscord;
        document.body.classList[isDiscord ? 'remove' : 'add']('stem--nonDiscord');
    }
    setTimeout(()=>checkDiscord(), 1000);
};
checkDiscord();
