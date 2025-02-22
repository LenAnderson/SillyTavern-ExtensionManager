import { EventEmitter } from '../../../../../lib/eventemitter.js';

export class AssetRepository {
    /** @readonly */
    /** @enum {string} */
    static EVENT = {
        /** URL was changed */
        URL: 'url',
    };

    static from(props) {
        return Object.assign(new this(), props);
    }


    /**@type {string}*/ title;
    /**@type {string}*/ #url;
    get url() { return this.#url; }
    set url(value) {
        if (this.#url != value) {
            this.#url = value;
            this.eventSource.emit(AssetRepository.EVENT.URL);
        }
    }

    /**@type {EventEmitter}*/ eventSource;

    constructor(title, url) {
        this.title = title;
        this.#url = url;

        this.eventSource = new EventEmitter();
    }

    toJSON() {
        return {
            title: this.title,
            url: this.url,
        };
    }
}
