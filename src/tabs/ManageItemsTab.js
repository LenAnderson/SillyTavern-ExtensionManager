import { warn } from '../../lib/console.js';
import { Extension } from '../Extension.js';
import { Manager } from '../Manager.js';
import { Plugin } from '../Plugin.js';
import { Filter } from '../ui/filter/Filter.js';
import { FilterGroup } from '../ui/filter/FilterGroup.js';
import { Tab } from '../ui/Tab.js';
import { ManageItemsItem } from './ManageItemsItem.js';

export class ManageItemsTab extends Tab {
    /**@type {{[columnName:string]:string}} */
    columnMap = {};
    /**@type {string} */
    itemWord = 'item';
    itemsWord = 'items';


    /**@type {string[]} */
    columns = ['Name', 'Version', 'Branch', 'Author', 'URL', 'Actions'];

    filterList = [
        { group: 'Updates', list: [
            { label: 'Has Update', tester: (filter, item)=>item.isUpToDate === false },
            { label: 'Updated', tester: (filter, item)=>item.isUpToDate === true },
            { label: 'Can\'t update', tester: (filter, item)=>item.isRepo === false || item.isCore },
        ] },
    ];
    /**@type {ManageItemsItem<import('../STEMItem.js').STEMItem>[]} */
    itemList = [];

    content = {
        actions: {
            update: {
                /**@type {HTMLElement} */
                button: undefined,
                /**@type {HTMLElement} */
                icon: undefined,
            },
            check: {
                /**@type {HTMLElement} */
                button: undefined,
                /**@type {HTMLElement} */
                icon: undefined,
            },
        },
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
            if (filter.test(item.model)) {
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
                    title: `Search ${this.itemsWord}`,
                    /**
                     * @param {Filter} filter
                     * @param {Extension|Plugin} item
                     * @returns {boolean}
                     */
                    tester: (filter, item)=>
                        item.displayName.toLowerCase().includes(filter.value.toString().toLowerCase())
                        || item.name.toLowerCase().includes(filter.value.toString().toLowerCase())
                    ,
                });
                search.eventSource.on(Filter.EVENT.INPUT, ()=>this.applyFilter(search));
                searchGroup.add(search);
                filterPanel.append(searchGroup.render());
            }
            for (const fg of this.filterList) {
                const group = new FilterGroup(fg.group);
                for (const f of fg.list) {
                    const filter = new Filter(f.label, f);
                    filter.eventSource.on(Filter.EVENT.INPUT, ()=>this.applyFilter(filter));
                    group.add(filter);
                }
                filterPanel.append(group.render());
            }
            const actions = document.createElement('div'); {
                actions.classList.add('stem--actions');
                const updateAll = document.createElement('div'); {
                    this.content.actions.update.button = updateAll;
                    updateAll.classList.add('stem--action');
                    updateAll.classList.add('menu_button');
                    updateAll.classList.add('fa-fw');
                    updateAll.title = `Update all ${this.itemsWord}`;
                    updateAll.addEventListener('click', async()=>{
                        const list = this.itemList.filter(it=>it.model.isRepo && !it.model.isUpToDate);
                        if (list.length) {
                            i.classList.remove('fa-download');
                            i.classList.add('fa-spinner', 'fa-spin-pulse');
                            for (const item of list) {
                                await item.model.update();
                            }
                            i.classList.add('fa-download');
                            i.classList.remove('fa-spinner', 'fa-spin-pulse');
                        } else {
                            toastr.info(`No ${this.itemWord} updates`, 'ExtensionManager');
                        }
                    });
                    const i = document.createElement('i'); {
                        this.content.actions.update.icon = i;
                        i.classList.add('fa-solid', 'fa-fw', 'fa-download');
                        updateAll.append(i);
                    }
                    actions.append(updateAll);
                }
                const checkAll = document.createElement('div'); {
                    checkAll.classList.add('stem--action');
                    checkAll.classList.add('menu_button');
                    checkAll.classList.add('fa-fw');
                    checkAll.title = `Check all ${this.itemsWord} for updates`;
                    checkAll.addEventListener('click', async()=>{
                        this.content.actions.check.button = checkAll;
                        i.classList.remove('fa-rotate');
                        i.classList.add('fa-spinner', 'fa-spin-pulse');
                        Manager.firstUpdateCheck = true;
                        const proms = [];
                        for (const item of this.itemList) {
                            proms.push(item.model.checkForUpdate());
                        }
                        await Promise.all(proms);
                        i.classList.add('fa-rotate');
                        i.classList.remove('fa-spinner', 'fa-spin-pulse');
                    });
                    const i = document.createElement('i'); {
                        this.content.actions.check.icon = i;
                        i.classList.add('fa-solid', 'fa-fw', 'fa-rotate');
                        checkAll.append(i);
                    }
                    actions.append(checkAll);
                }
                filterPanel.append(actions);
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
                                th.textContent = this.columnMap[col] ?? col;
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
        warn('ManageItemsTab.populateTable() has not been implemented!');
    }

    updateUpdateButton() {
        if (this.content.actions.update) {
            const list = this.itemList.filter(it=>it.model.isRepo && !it.model.isUpToDate);
            this.content.actions.update.button.title = [
                `Update all ${this.itemsWord}`,
                '---',
                list.length == 0 ? 'no updates' : list.map(it=>`• ${it.model.displayName}`).join('\n'),
            ].join('\n');
        }
    }
}
