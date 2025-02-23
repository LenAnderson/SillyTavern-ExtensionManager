import { getRequestHeaders, reloadMarkdownProcessor } from '../../../../../../script.js';
import { Popup, POPUP_TYPE } from '../../../../../popup.js';
import { Asset } from '../Asset.js';
import { Manager } from '../Manager.js';

export class CatalogItem {
    /**@type {Asset} */ model;

    dom = {
        /**@type {HTMLElement} */
        root: undefined,
        actions: {
            dl: {
                /**@type {HTMLElement} */
                root: undefined,
                /**@type {HTMLElement} */
                icon: undefined,
            },
        },
    };


    /**
     * @param {Asset} model
     */
    constructor(model) {
        this.model = model;
        model.eventSource.on(Asset.EVENT.ITEM_UPDATED, ()=>this.updateStatus());
    }

    render() {
        const item = document.createElement('div'); {
            this.dom.root = item;
            item.classList.add('stem--item');
            const img = document.createElement('div'); {
                img.classList.add('stem--preview');
                if (this.model.thumb) {
                    img.style.backgroundImage = `url('${this.model.thumb}')`;
                } else {
                    img.classList.add('fa-solid');
                    switch (this.model.type) {
                        case 'extension': {
                            img.classList.add('fa-cubes');
                            break;
                        }
                        case 'plugin': {
                            img.classList.add('fa-puzzle-piece');
                            break;
                        }
                        default: {
                            img.classList.add('fa-question');
                        }
                    }
                }
                item.append(img);
            }
            const title = document.createElement('div'); {
                title.classList.add('stem--title');
                const name = document.createElement('div'); {
                    name.classList.add('stem--name');
                    name.textContent = this.model.name;
                    title.append(name);
                }
                const type = document.createElement('div'); {
                    type.classList.add('stem--type');
                    type.classList.add('fa-solid', 'fa-fw');
                    switch (this.model.type) {
                        case 'extension': {
                            type.classList.add('fa-cubes');
                            type.title = 'UI Extension';
                            break;
                        }
                        case 'plugin': {
                            type.classList.add('fa-puzzle-piece');
                            type.title = 'Server Plugin';
                            break;
                        }
                        default: {
                            type.classList.add('fa-question');
                            break;
                        }
                    }
                    title.append(type);
                }
                item.append(title);
            }
            const author = document.createElement('div'); {
                author.classList.add('stem--author');
                author.textContent = this.model.author?.name ?? '';
                item.append(author);
            }
            const description = document.createElement('div'); {
                description.classList.add('stem--description');
                description.textContent = this.model.description ?? '';
                item.append(description);
            }
            const tags = document.createElement('div'); {
                tags.classList.add('stem--tags');
                for (const t of this.model.tags ?? []) {
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
                    this.dom.actions.dl.root = dl;
                    dl.classList.add('stem--action');
                    dl.classList.add('menu_button');
                    dl.addEventListener('click', async()=>{
                        item.classList.add('stem--isBusy');
                        i.classList.remove('fa-download');
                        i.classList.add('fa-spinner', 'fa-spin-pulse');
                        if (this.model.item) {
                            this.model.item.uninstall();
                        } else {
                            Manager.install(this.model.url);
                        }
                    });
                    const i = document.createElement('i'); {
                        this.dom.actions.dl.icon = i;
                        i.classList.add('fa-solid', 'fa-fw');
                        dl.append(i);
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
                    readme.classList.add('fa-solid', 'fa-fw', 'fa-circle-question');
                    readme.title = 'View readme';
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
                                repo: this.model.url,
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
                        for (const a of [...readmeDlg.dlg.querySelectorAll('a')]) {
                            a.target = '_blank';
                            if (a.href.startsWith('/')) a.href = `https://github.com${a.href}`;
                            else if (!a.href.includes('://')) a.href = `${this.model.url}/${a.href}`;
                            else if (a.href.startsWith(location.href)) a.href = `${this.model.url}/${a.href.slice(location.href.length)}`;
                        }
                        for (const el of /**@type {HTMLImageElement[]}*/([...readmeDlg.dlg.querySelectorAll('[src]')])) {
                            if (el.src.startsWith('/')) el.src = `https://github.com${el.src}`;
                            // else if (!el.src.includes('://')) el.src = `${baseUrl}/${el.src}`;
                            else if (el.src.startsWith(location.href)) el.src = `${this.model.url}/raw/${branch}/${el.src.slice(location.href.length)}`;
                        }
                    });
                    actions.append(readme);
                }
                const git = document.createElement('div'); {
                    git.classList.add('stem--action');
                    git.classList.add('menu_button');
                    git.classList.add('fa-brands', 'fa-fw', 'fa-github');
                    git.title = this.model.url;
                    git.addEventListener('click', ()=>window.open(this.model.url, '_blank'));
                    actions.append(git);
                }
                item.append(actions);
            }
        }
        this.updateStatus();
        return item;
    }

    updateStatus() {
        this.dom.root.classList.remove(
            'stem--isInstalled',
            'stem--isBusy',
        );
        this.dom.actions.dl.icon.classList.remove(
            'fa-download',
            'fa-trash-can',
            'fa-spinner',
            'fa-spin-pulse',
        );
        if (this.model.item) {
            this.dom.root.classList.add('stem--isInstalled');
            this.dom.actions.dl.icon.classList.add('fa-trash-can');
            this.dom.actions.dl.root.title = 'Uninstall';
        } else {
            this.dom.actions.dl.icon.classList.add('fa-download');
            this.dom.actions.dl.root.title = 'Install';
        }
    }
}
