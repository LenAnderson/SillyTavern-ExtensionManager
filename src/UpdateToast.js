import { Extension } from './Extension.js';
import { Plugin } from './Plugin.js';

export class UpdateToast {
    dom = {
        /**@type {HTMLElement} */
        root: undefined,
        extensions: {
            /**@type {HTMLElement} */
            root: undefined,
            /**@type {HTMLElement} */
            list: undefined,
        },
        plugins: {
            /**@type {HTMLElement} */
            root: undefined,
            /**@type {HTMLElement} */
            list: undefined,
        },
        /**@type {JQuery} */
        toast: undefined,
    };

    get isActive() {
        return (this.dom.toast && this.dom.root && this.dom.root.closest('body'));
    }


    render() {
        if (!this.dom.root) {
            const root = document.createElement('div'); {
                this.dom.root = root;
                root.classList.add('stem--root');
                const wrap = document.createElement('div'); {
                    wrap.classList.add('stem--wrap');
                    const extensions = document.createElement('div'); {
                        this.dom.extensions.root = extensions;
                        extensions.classList.add('stem--extensions');
                        const title = document.createElement('div'); {
                            title.classList.add('stem--title');
                            title.textContent = 'Extensions can be updated:';
                            extensions.append(title);
                        }
                        const list = document.createElement('ul'); {
                            this.dom.extensions.list = list;
                            extensions.append(list);
                        }
                        wrap.append(extensions);
                    }
                    const plugins = document.createElement('div'); {
                        this.dom.plugins.root = plugins;
                        plugins.classList.add('stem--plugins');
                        const title = document.createElement('div'); {
                            title.classList.add('stem--title');
                            title.textContent = 'Plugins can be updated:';
                            plugins.append(title);
                        }
                        const list = document.createElement('ul'); {
                            this.dom.plugins.list = list;
                            plugins.append(list);
                        }
                        wrap.append(plugins);
                    }
                    root.append(wrap);
                }
                const actions = document.createElement('div'); {
                    actions.classList.add('stem--actions');
                    const update = document.createElement('div'); {
                        update.classList.add('stem--action');
                        update.textContent = 'Update All';
                        update.addEventListener('click', async()=>{
                            const items = (await Promise.all([
                                Extension.list(),
                                Plugin.list(),
                            ])).flat().filter(it=>it.isRepo && !it.isUpToDate);
                            for (const item of items) {
                                await item.update();
                            }
                        });
                        actions.append(update);
                    }
                    const dismiss = document.createElement('div'); {
                        dismiss.classList.add('stem--action');
                        dismiss.textContent = 'Dismiss';
                        actions.append(dismiss);
                    }
                    root.append(actions);
                }
            }
        }
        return this.dom.root;
    }

    async update() {
        if (!this.isActive) return;
        const extensions = (await Extension.list()).filter(it=>it.isRepo && !it.isUpToDate);
        const plugins = (await Plugin.list()).filter(it=>it.isRepo && !it.isUpToDate);
        if (extensions.length || plugins.length) {
            this.dom.root.classList.remove(
                'stem--hasExtensions',
                'stem--hasPlugins',
            );
            this.dom.extensions.list.innerHTML = '';
            this.dom.plugins.list.innerHTML = '';
            const add = (list, domList)=>{
                for (const item of list) {
                    const li = document.createElement('li'); {
                        li.textContent = item.displayName;
                        domList.append(li);
                    }
                }
            };
            if (extensions.length) {
                this.dom.root.classList.add('stem--hasExtensions');
                const list = extensions;
                const domList = this.dom.extensions.list;
                add(list, domList);
            }
            if (plugins.length) {
                this.dom.root.classList.add('stem--hasPlugins');
                const list = plugins;
                const domList = this.dom.plugins.list;
                add(list, domList);
            }
        }
    }

    show() {
        if (!this.isActive) {
            this.dom.toast = toastr.info($(this.render()), 'Extension Manager', {
                escapeHtml: false,
                timeOut: 0,
                extendedTimeOut: 0,
                toastClass: 'stem--updateNotice',
            });
        }
        this.update();
    }
}
