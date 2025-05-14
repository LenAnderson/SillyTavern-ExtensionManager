import { showLoader } from '../../../../../loader.js';
import { delay } from '../../../../../utils.js';
import { settings } from '../../index.js';
import { Manager } from '../Manager.js';
import { Plugin } from '../Plugin.js';
import { STEM_ITEM_EVENT } from '../STEMItem.js';
import { ManageItemsTab } from './ManageItemsTab.js';
import { ManagePluginsItem } from './ManagePluginsItem.js';

export class ManagePluginsTab extends ManageItemsTab {
    id = 'managePlugins';
    icon = 'puzzle-piece';
    label = 'Plugins';
    title = 'Manage installed server plugins';

    itemWord = 'plugin';
    itemsWord = 'plugins';

    columnMap = {
        'Name': 'Plugin',
    };


    constructor() {
        super();
        Manager.eventSource.on(Manager.EVENT.INSTALLED_PLUGIN, async(ext)=>{
            // this.renderExtensionRow(ext, (await Extension.list()).indexOf(ext) + 1);
        });
        Plugin.eventSource.on(STEM_ITEM_EVENT.GIT_STATUS, async()=>{
            this.updateUpdateButton();
        });
    }

    showReloadToast() {
        if (this.reloadToast) return;
        const dom = document.createElement('div'); {
            const mes = document.createElement('p'); {
                mes.textContent = 'You must restart the SillyTavern server to apply changes to plugins.';
                dom.append(mes);
            }
            const hint = document.createElement('small'); {
                hint.textContent = 'click to restart';
                dom.append(hint);
            }
        }
        this.reloadToast = toastr.info(dom.outerHTML, 'Extension Manager', {
            closeButton: false,
            escapeHtml: false,
            timeOut: 0,
            extendedTimeOut: 0,
            onclick: async()=>{
                showLoader();
                await fetch('/api/plugins/stem/st/restart');
                await delay(1000);
                while (!(await fetch('/', { method:'HEAD' })).ok) await delay(500);
                location.reload();
            },
        });
    }

    async populateTable() {
        const list = await Plugin.list();
        this.content.table.root.classList.remove('stem--isLoading');
        const now = Date.now();
        for (const [idx, item] of Object.entries(list)) {
            this.renderItemRow(item, parseInt(idx));
            const lastCheck = item.checkedOn ?? 0;
            const targetTime = lastCheck + (1000 * 60 * 60 * settings.updateCheckHours);
            if (targetTime < now) {
                item.checkForUpdate();
            }
        }
        this.updateUpdateButton();
    }

    /**
     *
     * @param {Plugin} manifest
     * @param {number} idx
     */
    renderItemRow(manifest, idx) {
        const item = new ManagePluginsItem(manifest);
        this.itemList.push(item);
        if (this.content.table.body.children.length <= idx + 1) {
            this.content.table.body.append(item.render(this.columns));
        } else {
            this.content.table.body.children[idx - 1].insertAdjacentElement('afterend', item.render());
        }
    }
}
