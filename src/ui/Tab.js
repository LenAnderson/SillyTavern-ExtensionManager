import { EventEmitter } from '../../../../../../lib/eventemitter.js';

export class Tab {
    /** @readonly */
    /** @enum {string} */
    static EVENT = {
        SELECT: 'select',
    };


    /**@type {string} */ id;
    /**@type {string} */ label;
    /**@type {string} */ icon;
    /**@type {string} */ title;

    /**@type {EventEmitter} */ eventSource;

    /**@type {boolean} */ isSelected;

    dom = {
        /**@type {HTMLElement} */
        tab: undefined,
        /**@type {HTMLElement} */
        body: undefined,
    };

    get isRendered() { return !!this.dom.tab && !!this.dom.body; }




    constructor() {
        this.eventSource = new EventEmitter();
    }




    select() {
        this.isSelected = true;
        if (this.isRendered) {
            this.dom.tab.classList.add('stem--isSelected');
            this.dom.body.classList.add('stem--isSelected');
        }
    }

    deselect() {
        this.isSelected = false;
        if (this.isRendered) {
            this.dom.tab.classList.remove('stem--isSelected');
            this.dom.body.classList.remove('stem--isSelected');
        }
    }




    /**
     * @returns {HTMLElement}
     */
    renderTab() {
        if (!this.dom.tab) {
            const root = document.createElement('div'); {
                this.dom.tab = root;
                root.classList.add('stem--tab');
                if (this.isSelected) root.classList.add('stem--isSelected');
                root.title = this.title;
                root.addEventListener('click', ()=>this.eventSource.emit(Tab.EVENT.SELECT));
                const icon = document.createElement('i'); {
                    icon.classList.add('fa-solid', 'fa-fw', `fa-${this.icon}`);
                    root.append(icon);
                }
                const label = document.createElement('span'); {
                    label.classList.add('stem--label');
                    label.textContent = this.label;
                    root.append(label);
                }
            }
        }
        return this.dom.tab;
    }

    /**
     * @returns {HTMLElement}
     */
    renderBody() {
        if (!this.dom.body) {
            const root = document.createElement('div'); {
                this.dom.body = root;
                root.classList.add('stem--body');
                if (this.isSelected) root.classList.add('stem--isSelected');
                root.setAttribute('data-stem--tab', this.id);
                root.append(this.renderBodyContent());
            }
        }
        return this.dom.body;
    }

    /**
     * @returns {DocumentFragment}
     */
    renderBodyContent() {
        console.warn('[STEM]', '[TABUI]', 'renderBodyContent not implemented');
        const frag = document.createDocumentFragment();
        frag.append('⚠️ ');
        frag.append(this.id);
        frag.append(' ⚠️');
        return frag;
    }
}
