import { EventEmitter } from '../../../../../../../lib/eventemitter.js';

export class Filter {
    /** @readonly */
    /** @enum {string} */
    static EVENT = {
        /** filter state changed */
        INPUT: 'input',
    };


    /**@type {string} */ id;
    /**@type {string} */ label;
    /**@type {string} */ title;
    /**@type {'checkbox'|'search'} */ type;
    /**@type {any} */ defaultValue;
    /**@type {(filter:Filter, itemToTest:any)=>boolean} */ tester;

    /**@type {EventEmitter} */ eventSource;

    get value() {
        switch (this.type) {
            case 'checkbox': {
                return this.dom.input.checked;
            }
            case 'search': {
                return this.dom.input.value.toLowerCase();
            }
        }
        return null;
    }

    dom = {
        /**@type {HTMLInputElement} */
        input: undefined,
    };


    /**
     *
     * @param {string} id
     * @param {Object} options
     * @param {string} options.label
     * @param {string} [options.title]
     * @param {'checkbox'|'search'} [options.type]
     * @param {any} [options.defaultValue]
     * @param {(filter:Filter, itemToTest:any)=>boolean} options.tester
     */
    constructor(id, { label, title = null, type = 'checkbox', defaultValue = true, tester }) {
        this.id = id;
        this.label = label;
        this.title = title ?? label;
        this.type = type;
        this.defaultValue = defaultValue ?? true;
        this.tester = tester;

        this.eventSource = new EventEmitter();
    }

    test(that) {
        switch (this.type) {
            case 'checkbox': {
                return this.value || !this.tester(this, that);
            }
            case 'search': {
                return !this.value || this.tester(this, that);
            }
        }
    }

    render() {
        const root = document.createElement('label'); {
            root.classList.add('stem--filter');
            root.dataset.filter = this.id;
            root.title = this.title;
            const lbl = document.createElement('div'); {
                lbl.classList.add('stem--label');
                lbl.textContent = this.label;
                root.append(lbl);
            }
            let inp;
            switch (this.type) {
                case 'checkbox': {
                    root.classList.add('stem--checkbox');
                    inp = document.createElement('input'); {
                        inp.type = 'checkbox';
                        inp.checked = this.defaultValue;
                        lbl.insertAdjacentElement('beforebegin', inp);
                    }
                    break;
                }
                case 'search': {
                    root.classList.add('stem--search');
                    inp = document.createElement('input'); {
                        inp.classList.add('text_pole');
                        inp.type = 'search';
                        inp.placeholder = this.title;
                        inp.value = this.defaultValue || '';
                        root.append(inp);
                    }
                    break;
                }
            }
            inp.addEventListener('input', ()=>this.eventSource.emit(Filter.EVENT.INPUT));
            this.dom.input = inp;
        }
        return root;
    }
}
