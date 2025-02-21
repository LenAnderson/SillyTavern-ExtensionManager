import { Asset } from '../Asset.js';
import { Filter } from '../ui/filter/Filter.js';
import { FilterGroup } from '../ui/filter/FilterGroup.js';
import { Tab } from '../ui/Tab.js';
import { CatalogItem } from './CatalogItem.js';

export class CatalogTab extends Tab {
    id = 'catalog';
    icon = 'book-open';
    label = 'Catalogue';
    title = 'Install extensions and plugins from catalogue';

    /**
     * @type {{
            group: string;
            list: {
                label: string,
                defaultValue?: any,
                tester: (filter: any, item: Asset) => boolean,
                filter?: Filter,
            }[];
        }[]}
     */
    filterList = [
        { group: 'Type', list: [
            { label: 'Extension', tester: (filter, /**@type {Asset}*/item)=>item.type === 'extension' },
            { label: 'Plugin', tester: (filter, /**@type {Asset}*/item)=>item.type === 'plugin' },
        ] },
        { group: 'Status', list: [
            { label: 'Installed', defaultValue:false, tester: (filter, /**@type {Asset}*/item)=>!!item.item },
            { label: 'Not Installed', tester: (filter, /**@type {Asset}*/item)=>!item.item },
        ] },
    ];

    /**@type {CatalogItem[]} */ itemList = [];

    content = {
        /**@type {HTMLElement} */
        tagPanel: undefined,
        /**@type {HTMLElement} */
        list: undefined,
    };


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
                    title: 'Search extensions and plugins',
                    /**
                     * @param {Filter} filter
                     * @param {Asset} item
                     * @returns {boolean}
                     */
                    tester: (filter, item)=>
                        item.name.toLowerCase().includes(filter.value.toString().toLowerCase())
                        || item.description.toLowerCase().includes(filter.value.toString().toLowerCase())
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
                    f.filter = filter;
                    filter.eventSource.on(Filter.EVENT.INPUT, ()=>this.applyFilter(filter));
                    group.add(filter);
                }
                filterPanel.append(group.render());
            }
            frag.append(filterPanel);
        }
        const tagPanel = document.createElement('div'); {
            this.content.tagPanel = tagPanel;
            tagPanel.classList.add('stem--tagPanel');
            frag.append(tagPanel);
        }
        const listWrap = document.createElement('div'); {
            listWrap.classList.add('stem--listWrap');
            const list = document.createElement('div'); {
                this.content.list = list;
                list.classList.add('stem--list');
                list.classList.add('stem--isLoading');
                list.append('loading...');
                listWrap.append(list);
            }
            frag.append(listWrap);
        }
        //TODO size input?
        this.populate();
        return frag;
    }

    async populate() {
        const list = await Asset.list();
        this.content.list.classList.remove('stem--isLoading');
        this.content.list.innerHTML = '';
        const tags = list
            .map(it=>it.tags ?? [])
            .flat()
            .filter((a,idx,list)=>list.findIndex(b=>b.toLowerCase() == a.toLowerCase()) == idx)
            .toSorted((a,b)=>a.toLowerCase().localeCompare(b.toLowerCase()))
        ;
        for (const t of tags) {
            const tag = document.createElement('div'); {
                tag.classList.add('stem--tag');
                tag.textContent = t;
                this.content.tagPanel.append(tag);
            }
        }
        for (const [idx, ext] of Object.entries(list)) {
            this.renderAsset(ext, parseInt(idx));
        }
        for (const fg of this.filterList) {
            for (const f of fg.list) {
                this.applyFilter(f.filter);
            }
        }
    }

    /**
     * @param {Asset} asset
     * @param {number} idx
     */
    async renderAsset(asset, idx) {
        const item = new CatalogItem(asset);
        this.itemList.push(item);
        if (this.content.list.children.length <= idx + 1) {
            this.content.list.append(item.render());
        } else {
            this.content.list.children[idx - 1].insertAdjacentElement('afterend', item.render());
        }
    }
}
