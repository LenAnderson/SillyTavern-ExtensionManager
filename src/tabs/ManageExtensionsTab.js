import { delay } from '../../../../../utils.js';
import { settings } from '../../index.js';
import { Manager } from '../Manager.js';
import { Extension } from '../Extension.js';
import { Filter } from '../ui/filter/Filter.js';
import { FilterGroup } from '../ui/filter/FilterGroup.js';
import { Tab } from '../ui/Tab.js';
import { ManageExtensionsItem } from './ManageExtensionsItem.js';

export class ManageExtensionsTab extends Tab {
    id = 'manageExtensions';
    icon = 'cubes';
    label = 'Extensions';
    title = 'Manage installed UI extensions';

    /**@type {string[]} */
    columns = ['Extension', 'Source', 'Version', 'Branch', 'Author', 'URL', 'Actions'];

    /**@type {Filter[]} */
    filterList = [];
    /**@type {ManageExtensionsItem[]} */
    itemList = [];

    content = {
        table: {
            /**@type {HTMLTableElement} */
            root: undefined,
            /**@type {HTMLTableSectionElement} */
            head: undefined,
            /**@type {HTMLTableSectionElement} */
            body: undefined,
        },
    };


    constructor() {
        super();
        Manager.eventSource.on(Manager.EVENT.INSTALLED_EXTENSION, async(ext)=>{
            this.renderExtensionRow(ext, (await Extension.list()).indexOf(ext) + 1);
        });
        window.setInterval(()=>{
            this.itemList.forEach(it=>it.updateCheckUpdateTimestamp());
        }, 1000 * 60);
    }


    /**
     * @param {Filter} filter
     */
    applyFilter(filter) {
        for (const item of this.itemList) {
            const attr = JSON.parse(item.dom.root.dataset.filter ?? '[]');
            if (filter.test(item.extension)) {
                const idx = attr.indexOf(filter.id);
                if (idx > -1) {
                    attr.splice(idx, 1);
                }
            } else {
                if (!attr.includes(filter.id)) {
                    attr.push(filter.id);
                }
            }
            item.dom.root.dataset.filter = JSON.stringify(attr);
        }
    }


    renderBodyContent() {
        const frag = document.createDocumentFragment();
        const filterPanel = document.createElement('div'); {
            filterPanel.classList.add('stem--filterPanel');
            const searchGroup = new FilterGroup(); {
                const search = new Filter('search', {
                    label: 'Search:',
                    type: 'search',
                    title: 'Search extensions',
                    /**
                     * @param {Filter} filter
                     * @param {Extension} extension
                     * @returns {boolean}
                     */
                    tester: (filter, extension)=>
                        extension.displayName.toLowerCase().includes(filter.value.toString().toLowerCase())
                        || extension.name.toLowerCase().includes(filter.value.toString().toLowerCase())
                    ,
                });
                search.eventSource.on(Filter.EVENT.INPUT, ()=>this.applyFilter(search));
                searchGroup.add(search);
                filterPanel.append(searchGroup.render());
            }
            const filters = [
                { group: 'State', list: [
                    { label: 'Enabled', tester: (filter, extension)=>!extension.isDisabled },
                    { label: 'Disabled', tester: (filter, extension)=>extension.isDisabled },
                ] },
                { group: 'Updates', list: [
                    { label: 'Has Update', tester: (filter, extension)=>extension.isUpToDate === false },
                    { label: 'Updated', tester: (filter, extension)=>extension.isUpToDate === true },
                    { label: 'Can\'t update', tester: (filter, extension)=>extension.isRepo === false || extension.isCore },
                ] },
                { group: 'Errors', list: [
                    { label: 'Errors', tester: (filter, extension)=>extension.errorList.length > 0 },
                    { label: 'No Errors', tester: (filter, extension)=>extension.errorList.length == 0 },
                ] },
                { group: 'Source', list: [
                    { label: 'Core', tester: (filter, extension)=>extension.isCore },
                    { label: 'Third-party', tester: (filter, extension)=>!extension.isCore },
                ] },
            ];
            for (const fg of filters) {
                const group = new FilterGroup(fg.group);
                for (const f of fg.list) {
                    const filter = new Filter(f.label, f);
                    filter.eventSource.on(Filter.EVENT.INPUT, ()=>this.applyFilter(filter));
                    group.add(filter);
                }
                filterPanel.append(group.render());
            }
            frag.append(filterPanel);
        }
        const tblWrap = document.createElement('div'); {
            tblWrap.classList.add('stem--tableWrap');
            const tbl = document.createElement('table'); {
                this.content.table.root = tbl;
                tbl.classList.add('stem--table');
                tbl.classList.add('stem--isLoading');
                const thead = document.createElement('thead'); {
                    this.content.table.head = thead;
                    for (const col of this.columns) {
                        const th = document.createElement('th'); {
                            th.dataset.property = col;
                            if (!['Source', 'Actions'].includes(col)) {
                                th.textContent = col;
                            }
                            thead.append(th);
                        }
                    }
                    tbl.append(thead);
                }
                const tbody = document.createElement('tbody'); {
                    this.content.table.body = tbody;
                    const tr = document.createElement('tr'); {
                        tr.classList.add('stem--spinner');
                        const td = document.createElement('td'); {
                            td.textContent = 'loading...';
                            td.colSpan = this.columns.length;
                            tr.append(td);
                        }
                        tbody.append(tr);
                    }
                    tbl.append(tbody);
                }
                tblWrap.append(tbl);
            }
            frag.append(tblWrap);
        }
        this.populateTable();
        return frag;
    }

    async populateTable() {
        const list = await Extension.list();
        this.content.table.root.classList.remove('stem--isLoading');
        const now = Date.now();
        for (const [idx, ext] of Object.entries(list)) {
            this.renderExtensionRow(ext, parseInt(idx));
            if (!ext.isCore) {
                const lastCheck = ext.checkedOn ?? 0;
                const targetTime = lastCheck + (1000 * 60 * 60 * settings.updateCheckHours);
                if (targetTime < now) {
                    ext.checkForUpdate();
                }
            }
        }
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
            this.content.table.body.append(item.render());
        } else {
            this.content.table.body.children[idx - 1].insertAdjacentElement('afterend', item.render());
        }
    }
}
