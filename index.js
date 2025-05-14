import { event_types, eventSource, getRequestHeaders } from '../../../../script.js';
import { Popup } from '../../../popup.js';
import { delay } from '../../../utils.js';
import { error, log } from './lib/console.js';
import { Manager } from './src/Manager.js';
import { Extension } from './src/Extension.js';
import { ExtensionError } from './src/ExtensionError.js';
import { Settings } from './src/Settings.js';
import { ConfigTab } from './src/tabs/ConfigTab.js';
import { ManageExtensionsTab } from './src/tabs/ManageExtensionsTab.js';
import { Tab } from './src/ui/Tab.js';
import { TabAction } from './src/ui/TabAction.js';
import { TabUi } from './src/ui/TabUi.js';
import { ManagePluginsTab } from './src/tabs/ManagePluginsTab.js';
import { CatalogTab } from './src/tabs/CatalogTab.js';

const appReady = new Promise(resolve=>eventSource.once(event_types.APP_READY, resolve));

export const settings = new Settings();


/**
 * @returns {boolean}
 */
const checkDependencies = async()=>{
    const pluginTest = await fetch('/api/plugins/emp/');
    if (!pluginTest.ok) {
        Popup.show.text('Extension Manager', '<strong>Dependency Missing!</strong><br>Extension Manager requires the server plugin Extension Manager Plugin');
        return false;
    }
    const pluginVersion = await pluginTest.json();
    if (pluginVersion.version != '1.0.0') {
        Popup.show.text('Extension Manager', '<strong>Dependency Outdated!</strong><br>Extension Manager requires an updated server plugin Extension Manager Plugin');
        return false;
    }
    return true;
};

const init = async()=>{
    if (!await checkDependencies()) return;

    const drawer = /**@type {HTMLElement}*/(document.querySelector('#rm_extensions_block'));
    const settingsBody = /**@type {HTMLElement}*/(drawer.querySelector(':scope > .extensions_block'));
    const header = /**@type {HTMLElement}*/(settingsBody.children[0]);
    settingsBody.insertAdjacentElement('beforebegin', header);

    drawer.classList.add('stem--drawer');
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
        const ext = Extension.cache?.find(it=>it.name == source);
        if (ext) {
            ext.addError(new ExtensionError(Date.now(), ex.stack));
        }
        // if (!errors[source]) errors[source] = [];
        // errors[source].push({ time:Date.now(), stack:ex.stack });
        // manifests.find(it=>it.name == source)?.tblRow?.setAttribute('data-stem--hasErrors', '1');
    };
    window.addEventListener('error', (evt)=>handleError(evt));
    window.addEventListener('unhandledrejection', (evt)=>handleError(evt));

    const tabs = new TabUi();
    {
        const tab = new Tab();
        tab.id = 'extensionSettings';
        tab.icon = 'wrench';
        tab.label = 'Extension settings';
        tab.title = 'Extension settings';
        tab.renderBodyContent = ()=>{
            const frag = document.createDocumentFragment();
            const colorPickers = [...settingsBody.querySelectorAll('toolcool-color-picker')].map(it=>({
                picker: it,
                color: it.color.originalInput,
            }));
            log('[COLORS]', colorPickers);
            frag.append(settingsBody);
            Promise.resolve().then(async()=>{
                while (!settingsBody.closest('.stem--tabUi') || !settingsBody.closest('body')) await delay(100);
                for (const { picker, color } of colorPickers) {
                    picker.color = color;
                }
            });
            return frag;
        };
        tabs.addTab(tab);
    }
    {
        tabs.addTab(new ManageExtensionsTab());
    }
    {
        tabs.addTab(new ManagePluginsTab());
    }
    {
        tabs.addTab(new CatalogTab());
    }
    {
        const action = new TabAction();
        action.id = 'manual';
        action.icon = 'plus';
        action.label = 'Install';
        action.title = 'Install extension or plugin from URL';
        action.callback = async()=>{
            const repo = await Popup.show.input(
                'Install Extension or Server Plugin',
                'Enter the Git URL of the extension or server plugin to install.',
                null,
                {
                    okButton: 'Install',
                    cancelButton: 'Cancel',
                },
            );
            if (!repo?.length) return;
            await Manager.install(repo);
        };
        tabs.addAction(action);
    }
    {
        tabs.addTab(new RawTab(), false);
    }
    {
        tabs.addTab(new ConfigTab(), false);
    }
    drawer.append(tabs.render());
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
