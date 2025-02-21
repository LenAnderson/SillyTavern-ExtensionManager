import { EventEmitter } from '../../../../../lib/eventemitter.js';
import { settings } from '../index.js';
import { log } from '../lib/console.js';
import { Extension } from './Extension.js';
import { Manager } from './Manager.js';
import { Plugin } from './Plugin.js';
import { STEM_ITEM_EVENT } from './STEMItem.js';

/**@typedef {{name:string, url:string}} AssetAuthor */
export class Asset {
    /** @readonly */
    /** @enum {string} */
    static EVENT = {
        /** extension or plugin has been updated */
        ITEM_UPDATED: 'item_updated',
    };

    /**@type {Asset[]} */
    static cache = [];
    static cachePromise;

    static async from(props) {
        /**@type {Asset} */
        const instance = Object.assign(new Asset(), props);
        instance.item = (await (instance.type == 'extension' ? Extension : Plugin).list()).find(it=>it.repo?.toLowerCase().replace(/\.git$/, '') == instance.url.toLowerCase().replace(/\.git$/, ''));
        const insertIdx = this.cache.findIndex(it=>{
            return it.name.toLowerCase().localeCompare(instance.name.toLowerCase()) == 1;
        });
        if (insertIdx == -1) {
            this.cache.push(instance);
        } else {
            this.cache.splice(insertIdx, 0, instance);
        }
        return instance;
    }

    static async list() {
        log('Asset.list()');
        while (this.cachePromise) {
            log('Asset.list()', 'waiting...');
            await this.cachePromise();
        }
        if (this.cache.length == 0) {
            log('Asset.list()', 'fetching...');
            const { promise, resolve } = Promise.withResolvers();
            this.cachePromise = promise;
            let items = [];
            for (const repo of settings.repoList) {
                const response = await fetch(repo.url);
                if (!response.ok) {
                    toastr.warning(`Failed to fetch list of assets from ${repo.url}`, 'Extension Manager');
                    continue;
                }
                const data = await response.json();
                items.push(...data.filter(it=>['extension', 'plugin'].includes(it.type)));
            }
            items = items.filter((a,idx,list)=>idx == list.findIndex(b=>b.url.toLowerCase().replace(/\.git$/, '') == a.url.toLowerCase().replace(/\.git$/, '')));
            for (const item of items) {
                await Asset.from(item);
            }
            Manager.eventSource.on(Manager.EVENT.INSTALLED_EXTENSION, (/**@type {Extension}*/ext)=>{
                const asset = this.cache.find(it=>it.url.toLowerCase().replace(/\.git$/, '') == ext.repo?.toLowerCase().replace(/\.git$/, ''));
                if (asset) {
                    asset.item = ext;
                }
            });
            Manager.eventSource.on(Manager.EVENT.INSTALLED_PLUGIN, (/**@type {Plugin}*/plugin)=>{
                const asset = this.cache.find(it=>it.url.toLowerCase().replace(/\.git$/, '') == plugin.repo?.toLowerCase().replace(/\.git$/, ''));
                if (asset) {
                    asset.item = plugin;
                }
            });
            Extension.eventSource.on(STEM_ITEM_EVENT.GIT_STATUS, (/**@type {Extension}*/ext)=>{
                const asset = this.cache.find(it=>it.url.toLowerCase().replace(/\.git$/, '') == ext.repo?.toLowerCase().replace(/\.git$/, ''));
                if (asset) {
                    asset.item = ext;
                }
            });
            Plugin.eventSource.on(STEM_ITEM_EVENT.GIT_STATUS, (/**@type {Plugin}*/plugin)=>{
                const asset = this.cache.find(it=>it.url.toLowerCase().replace(/\.git$/, '') == plugin.repo?.toLowerCase().replace(/\.git$/, ''));
                if (asset) {
                    asset.item = plugin;
                }
            });
            this.cachePromise = null;
            resolve();
        }
        log('/Asset.list()');
        return this.cache;
    }




    /**@type {string} */ id;
    /**@type {'extension'|'plugin'} */ type;
    /**@type {string} */ name;
    /**@type {string} */ description;
    /**@type {string} */ url;
    /**@type {AssetAuthor} */ author;
    /**@type {string[]} */ tags;
    /**@type {string} */ thumb;

    /**@type {import('./STEMItem.js').STEMItem} */ #item;
    get item() { return this.#item; }
    set item(value) {
        if (this.#item != value) {
            this.#item = value;
            if (value) {
                value.eventSource.on(STEM_ITEM_EVENT.GIT_STATUS, ()=>{
                    this.eventSource.emit(Asset.EVENT.ITEM_UPDATED);
                });
                value.eventSource.on(STEM_ITEM_EVENT.UNINSTALL, ()=>{
                    this.item = null;
                });
            }
            this.eventSource.emit(Asset.EVENT.ITEM_UPDATED);
        }
    }

    /**@type {EventEmitter} */
    eventSource = new EventEmitter();
}
