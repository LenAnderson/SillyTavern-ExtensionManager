import { warn } from '../../lib/console.js';
import { Extension } from '../Extension.js';
import { Plugin } from '../Plugin.js';
import { Filter } from '../ui/filter/Filter.js';
import { FilterGroup } from '../ui/filter/FilterGroup.js';
import { Tab } from '../ui/Tab.js';

export class ManageItemsTab extends Tab {
    /**@type {{[columnName:string]:string}} */
    columnMap = {};
    /**@type {string} */
    itemWord = 'item';
    itemsWord = 'items';


    /**@type {string[]} */
    columns = ['Name', 'Source', 'Version', 'Branch', 'Author', 'URL', 'Actions'];

    /**@type {Filter[]} */
    filterList = [];
    /**@type {ManageItemssItem[]} */
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
            const filters = [
                { group: 'State', list: [
                    { label: 'Enabled', tester: (filter, item)=>!item.isDisabled },
                    { label: 'Disabled', tester: (filter, item)=>item.isDisabled },
                ] },
                { group: 'Updates', list: [
                    { label: 'Has Update', tester: (filter, item)=>item.isUpToDate === false },
                    { label: 'Updated', tester: (filter, item)=>item.isUpToDate === true },
                    { label: 'Can\'t update', tester: (filter, item)=>item.isRepo === false || item.isCore },
                ] },
                { group: 'Errors', list: [
                    { label: 'Errors', tester: (filter, item)=>item.errorList.length > 0 },
                    { label: 'No Errors', tester: (filter, item)=>item.errorList.length == 0 },
                ] },
                { group: 'Source', list: [
                    { label: 'Core', tester: (filter, item)=>item.isCore },
                    { label: 'Third-party', tester: (filter, item)=>!item.isCore },
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
        warn('ManageItemsTab.populateTable() has not been implemented!');
    }
}
