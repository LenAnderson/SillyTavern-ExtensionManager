import { delay } from '../../../../../utils.js';
import { settings } from '../../index.js';
import { Manager } from '../Manager.js';
import { Extension } from '../Extension.js';
import { Filter } from '../ui/filter/Filter.js';
import { FilterGroup } from '../ui/filter/FilterGroup.js';
import { Tab } from '../ui/Tab.js';
import { ManageExtensionsItem } from './ManageExtensionsItem.js';
import { ManageItemsTab } from './ManageItemsTab.js';
import { STEM_ITEM_EVENT } from '../STEMItem.js';

export class ManageExtensionsTab extends ManageItemsTab {
    id = 'manageExtensions';
    icon = 'cubes';
    label = 'Extensions';
    title = 'Manage installed UI extensions';

    itemWord = 'extension';
    itemsWord = 'extensions';

    columnMap = {
        'Name': 'Extension',
    };

    /**@type {JQuery} */
    reloadToast;


    constructor() {
        super();
        this.columns.splice(1, 0, 'Source');
        this.filterList.unshift(
            { group: 'State', list: [
                { label: 'Enabled', tester: (filter, item)=>!item.isDisabled },
                { label: 'Disabled', tester: (filter, item)=>item.isDisabled },
            ] },
        );
        this.filterList.push(
            { group: 'Errors', list: [
                { label: 'Errors', tester: (filter, item)=>item.errorList.length > 0 },
                { label: 'No Errors', tester: (filter, item)=>item.errorList.length == 0 },
            ] },
            { group: 'Source', list: [
                { label: 'Core', tester: (filter, item)=>item.isCore },
                { label: 'Third-party', tester: (filter, item)=>!item.isCore },
            ] },
        );
        Manager.eventSource.on(Manager.EVENT.INSTALLED_EXTENSION, async(ext)=>{
            this.renderExtensionRow(ext, (await Extension.list()).indexOf(ext) + 1);
            this.showReloadToast();
        });
        Extension.eventSource.on(STEM_ITEM_EVENT.GIT_STATUS, async()=>{
            this.updateUpdateButton();
        });
        Extension.eventSource.on(STEM_ITEM_EVENT.INSTALL, ()=>{
            this.showReloadToast();
        });
        Extension.eventSource.on(STEM_ITEM_EVENT.UNINSTALL, ()=>{
            this.showReloadToast();
        });
        Extension.eventSource.on(STEM_ITEM_EVENT.STATE, ()=>{
            this.showReloadToast();
        });
    }

    showReloadToast() {
        if (this.reloadToast) return;
        const dom = document.createElement('div'); {
            const mes = document.createElement('p'); {
                mes.textContent = 'You must refresh the page to apply changes to extensions.';
                dom.append(mes);
            }
            const hint = document.createElement('small'); {
                hint.textContent = 'click to refresh';
                dom.append(hint);
            }
        }
        this.reloadToast = toastr.info(dom.outerHTML, 'Extension Manager', {
            closeButton: false,
            escapeHtml: false,
            timeOut: 0,
            extendedTimeOut: 0,
            onclick: ()=>location.reload(),
        });
    }

    async populateTable() {
        const list = await Extension.list();
        this.content.table.root.classList.remove('stem--isLoading');
        for (const [idx, ext] of Object.entries(list)) {
            this.renderExtensionRow(ext, parseInt(idx));
        }
        this.updateUpdateButton();
    }

    /**
     *
     * @param {Extension} manifest
     * @param {number} idx
     */
    renderExtensionRow(manifest, idx) {
        const item = new ManageExtensionsItem(manifest);
        this.itemList.push(item);
        if (this.content.table.body.children.length <= idx + 1) {
            this.content.table.body.append(item.render(this.columns));
        } else {
            this.content.table.body.children[idx - 1].insertAdjacentElement('afterend', item.render(this.columns));
        }
    }
}
