import { event_types, eventSource } from '../../../../../../script.js';
import { getSortableDelay } from '../../../../../utils.js';
import { settings } from '../../index.js';
import { error } from '../../lib/console.js';
import { AssetRepository } from '../AssetRepository.js';
import { BaseSetting } from '../settings/BaseSetting.js';
import { CustomSetting } from '../settings/CustomSetting.js';
import { NumberSetting } from '../settings/NumberSetting.js';
import { Tab } from '../ui/Tab.js';

export class ConfigTab extends Tab {
    id = 'config';
    icon = 'gear';
    label = 'Extension Manager settings';
    title = 'Extension Manager settings';


    /**@type {BaseSetting[]} */ settingList = [];


    content = {
        /**@type {HTMLTextAreaElement} */
        input: undefined,
    };




    constructor() {
        super();
        this.registerSettings();
    }


    registerSettings() {
        while (this.settingList.pop());
        { // repos
            let dom;
            this.settingList.push(CustomSetting.fromProps({ id: 'stem--repoList',
                name: 'Asset Repositories',
                description: `
                    Sources for the catalogue to get extensions and plugins from.<br>
                    Asset repositories are checked from top to bottom. If an
                    extension or plugin is listed in multiple repositories
                    (same Git URL), only the information from the first repository
                    is used.
                `,
                category: ['Asset Repositories'],
                initialValue: null,
                renderCallback: ()=>{
                    if (!dom) {
                        const container = document.createElement('div'); {
                            dom = container;
                            container.classList.add('stem--repoList');
                            const add = document.createElement('div'); {
                                add.classList.add('stem--addRepo');
                                add.classList.add('menu_button');
                                add.classList.add('fa-solid', 'fa-fw', 'fa-plus');
                                add.title = 'Add asset repository';
                                add.addEventListener('click', ()=>{
                                    const item = new AssetRepository('', '');
                                    settings.addRepo(item);
                                    this.renderRepo(item, add);
                                });
                                container.append(add);
                            }
                            for (const repo of settings.repoList) {
                                this.renderRepo(repo, add);
                            }
                        }
                        $(dom).sortable({
                            handle: '.stem--dragger',
                            delay: getSortableDelay(),
                            stop: ()=>{
                                const items = [...dom.children].map(it=>it.repo);
                                settings.reorderRepoList(items);
                            },
                        });
                    }
                    return dom;
                },
                getValueCallback: ()=>null,
                setValueCallback: ()=>null,
            }));
        }
        { // updates
            this.settingList.push(NumberSetting.fromProps({ id: 'stem--updateCheckHours',
                name: 'Update Check Interval',
                description: 'Minimum hours between automatic update checks (on page load)',
                category: ['Updates'],
                initialValue: 72,
                min: 0,
                max: 7200,
                step: 1,
                onChange: (it)=>{
                    settings.updateCheckHours = it.value;
                    settings.save();
                },
            }));
        }
    }

    /**
     * @param {AssetRepository} item
     * @param {HTMLElement} add
     */
    renderRepo(item, add) {
        const wrap = document.createElement('div'); {
            wrap.classList.add('stem--repo');
            wrap.repo = item;
            const dragger = document.createElement('div'); {
                dragger.classList.add('stem--dragger');
                dragger.classList.add('fa-solid', 'fa-fw', 'fa-grip-lines');
                dragger.title = 'Drag to re-order';
                wrap.append(dragger);
            }
            const title = document.createElement('label'); {
                title.classList.add('stem--input');
                title.dataset.input = 'title';
                const lbl = document.createElement('div'); {
                    lbl.classList.add('stem--label');
                    lbl.textContent = 'Title';
                    title.append(lbl);
                }
                const inp = document.createElement('input'); {
                    inp.classList.add('stem--input');
                    inp.classList.add('text_pole');
                    inp.value = item.title;
                    inp.addEventListener('input', ()=>{
                        item.title = inp.value;
                        settings.save();
                    });
                    title.append(inp);
                }
                wrap.append(title);
            }
            const url = document.createElement('label'); {
                url.classList.add('stem--input');
                url.dataset.input = 'url';
                const lbl = document.createElement('div'); {
                    lbl.classList.add('stem--label');
                    lbl.textContent = 'URL';
                    url.append(lbl);
                }
                const inp = document.createElement('input'); {
                    inp.classList.add('stem--input');
                    inp.classList.add('text_pole');
                    inp.value = item.url;
                    inp.addEventListener('input', ()=>{
                        item.url = inp.value;
                    });
                    url.append(inp);
                }
                wrap.append(url);
            }
            const actions = document.createElement('div'); {
                actions.classList.add('stem--actions');
                const del = document.createElement('div'); {
                    del.classList.add('stem--action');
                    del.classList.add('menu_button');
                    del.classList.add('redWarningBG');
                    del.classList.add('fa-solid', 'fa-fw', 'fa-trash-can');
                    del.addEventListener('click', ()=>{
                        settings.removeRepo(item);
                        wrap.remove();
                    });
                    actions.append(del);
                }
                wrap.append(actions);
            }
            add.insertAdjacentElement('beforebegin', wrap);
        }
    }


    renderBodyContent() {
        const frag = document.createDocumentFragment();
        frag.append('loading...');
        this.popuplate();
        return frag;
    }

    async fetchTemplate() {
        const response = await fetch('/scripts/extensions/third-party/SillyTavern-ExtensionManager/html/settings.html');
        if (!response.ok) {
            error('failed to fetch template: stem--settings.html');
            return;
        }
        const settingsTpl = document
            .createRange()
            .createContextualFragment(await response.text())
            .querySelector('#stem--settings-v2')
        ;
        const dom = /**@type {HTMLElement} */(settingsTpl.cloneNode(true));
        return dom;
    }

    /**
     * @param {HTMLElement} dom
     */
    registerSearchListener(dom) {
        const search = /**@type {HTMLInputElement}*/(dom.querySelector('.search'));
        search.addEventListener('input', ()=>{
            const query = search.value.trim().toLowerCase();
            for (const setting of this.settingList) {
                if (setting.name.toLowerCase().includes(query) || setting.description.toLowerCase().includes(query)) {
                    setting.dom.classList.remove('hidden');
                } else {
                    setting.dom.classList.add('hidden');
                }
            }
            const cats = [...dom.querySelectorAll('.contentWrapper .category:has(.item:not(.hidden)) > .head')].map(it=>it.textContent);
            const heads = [...dom.querySelectorAll('.categoriesWrapper .category .head')];
            for (const head of heads) {
                if (cats.includes(head.textContent)) {
                    head.classList.remove('hidden');
                } else {
                    head.classList.add('hidden');
                }
            }
            this.updateCategory();
        });
    }

    /**
     * @param {HTMLElement} dom
     */
    renderTree(dom) {
        // build tree
        const tree = {};
        for (const setting of this.settingList) {
            let cur = tree;
            for (const key of setting.category) {
                if (!cur[key]) {
                    cur[key] = { name:key, settings:[] };
                }
                cur = cur[key];
            }
            cur.settings.push(setting);
        }

        // render tree
        const catRoot = /**@type {HTMLElement}*/(dom.querySelector('.categoriesWrapper'));
        const contRoot = /**@type {HTMLElement}*/(dom.querySelector('.contentWrapper'));
        const render = (cat, cont, cur, level = 0)=>{
            for (const key of Object.keys(cur)) {
                if (['name', 'settings'].includes(key)) continue;
                const curCat = cur[key];
                const block = document.createElement('div'); {
                    block.classList.add('category');
                    const head = document.createElement('div'); {
                        head.classList.add('head');
                        head.setAttribute('data-level', level.toString());
                        head.textContent = key;
                        block.append(head);
                    }
                }
                const catBlock = /**@type {HTMLElement}*/(block.cloneNode(true));
                catBlock.querySelector('.head').addEventListener('click', ()=>{
                    let offset = 0;
                    let head = /**@type {HTMLElement}*/(block.querySelector('.head'));
                    head = head.closest('.category').parentElement.closest('.category')?.querySelector('.head');
                    while (head) {
                        offset += head.offsetHeight;
                        head = head.closest('.category').parentElement.closest('.category')?.querySelector('.head');
                    }
                    contRoot.scrollTo({
                        top: block.offsetTop - offset,
                        behavior: 'smooth',
                    });
                });
                cat.append(catBlock);
                cont.append(block);
                for (const setting of curCat.settings) {
                    const item = setting.render();
                    block.append(item);
                }
                render(catBlock, block, curCat, level + 1);
            }
        };
        render(catRoot, contRoot, tree);
    }

    async popuplate() {
        const dom = await this.fetchTemplate();
        if (!dom) {
            this.dom.body.textContent = 'failed to load template';
            return;
        }
        dom.querySelector('.contentWrapper').addEventListener('scroll', ()=>this.updateCategory());
        this.registerSearchListener(dom);
        this.renderTree(dom);

        this.dom.body.innerHTML = '';
        this.dom.body.append(dom);
        this.updateCategory();
    }


    updateCategory() {
        const wrapRect = this.dom.body.querySelector('.contentWrapper').getBoundingClientRect();
        for (const setting of this.settingList) {
            const rect = setting.dom.getBoundingClientRect();
            if (rect.top > wrapRect.top || rect.top < wrapRect.top && rect.bottom > wrapRect.top + wrapRect.height / 4) {
                const cat = setting.dom.closest('.category').querySelector('.head').textContent;
                const heads = [...this.dom.body.querySelectorAll('.categoriesWrapper .head')];
                for (const head of heads) {
                    if (head.textContent == cat) {
                        let cur = head;
                        cur.classList.add('current');
                        while (cur) {
                            cur = cur.closest('.category').parentElement.closest('.category')?.querySelector('.head');
                            cur?.classList?.add('current');
                        }
                    } else {
                        head.classList.remove('current');
                    }
                }
                return;
            }
        }
    }
}
