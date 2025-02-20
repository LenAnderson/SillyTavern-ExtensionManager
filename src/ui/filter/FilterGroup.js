import { EventEmitter } from '../../../../../../../lib/eventemitter.js';
import { Filter } from './Filter.js';

export class FilterGroup {
    /** @readonly */
    /** @enum {string} */
    static EVENT = {
        /** filter state changed */
        INPUT: 'input',
    };


    /**@type {string} */ label;
    /**@type {Filter[]} */ #filterList = [];
    get filterList() { return this.#filterList; }

    /**@type {EventEmitter} */ eventSource;


    constructor(label = null) {
        this.label = label;
        this.eventSource = new EventEmitter();
    }


    add(...filters) {
        for (const filter of filters) {
            filter.eventSource.on(Filter.EVENT.INPUT, ()=>this.eventSource.emit(FilterGroup.EVENT.INPUT));
            this.#filterList.push(filter);
        }
    }

    render() {
        const root = document.createElement('div'); {
            root.classList.add('stem--filterGroup');
            if (this.label) {
                const lbl = document.createElement('div'); {
                    lbl.classList.add('stem--filterGroupLabel');
                    lbl.textContent = this.label;
                    root.append(lbl);
                }
            }
            for (const filter of this.#filterList) {
                root.append(filter.render());
            }
        }
        return root;
    }
}
