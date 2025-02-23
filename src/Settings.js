import { EventEmitter } from '../../../../../lib/eventemitter.js';
import { saveSettingsDebounced } from '../../../../../script.js';
import { extension_settings } from '../../../../extensions.js';
import { AssetRepository } from './AssetRepository.js';
import { Extension } from './Extension.js';
import { Plugin } from './Plugin.js';
import { BaseSetting } from './settings/BaseSetting.js';

export class Settings {
    /** @readonly */
    /** @enum {string} */
    static EVENT = {
        /** asset repository list was changed */
        REPO_LIST: 'repo_list',
    };


    /**@type {AssetRepository[]} */ repoList = [];
    /**@type {number} */ updateCheckHours = 24;
    /**@type {number} */ tileSize = 250;

    /**@type {Extension[]} */ extensionList = [];
    /**@type {Plugin[]} */ pluginList = [];

    /**@type {Extension[]} */ extensionCache = [];
    /**@type {Plugin[]} */ pluginCache = [];

    /**@type {EventEmitter}*/ eventSource;




    constructor() {
        this.load();

        this.eventSource = new EventEmitter();
    }

    toJSON() {
        return {
            repoList: this.repoList,
            updateCheckHours: this.updateCheckHours,
            tileSize: this.tileSize,

            extensionCache: this.extensionList.filter(it=>!it.isCore),
            pluginCache: this.pluginList,
        };
    }

    load() {
        const savedSettings = extension_settings.extensionManager ?? {};
        Object.assign(this, savedSettings);
        if (this.repoList.length == 0) {
            this.repoList.push(new AssetRepository(
                'Asset Repo Copy',
                'https://raw.githubusercontent.com/LenAnderson/SillyTavern-Content/refs/heads/asset-catalog/index.json',
            ));
            this.repoList.push(new AssetRepository(
                'Lenny Suite (underscore)',
                'https://raw.githubusercontent.com/underscorex86/SillyTavern-LennySuite/main/index.json',
            ));
            const originalInput = /**@type {HTMLInputElement}*/(document.querySelector('#assets-json-url-field'));
            if (originalInput) {
                const originalRepo = new AssetRepository(
                    'SillyTavern - Content (official assets)',
                    originalInput.value,
                );
                this.repoList.push(originalRepo);
            }
        } else {
            for (const [idx, repo] of Object.entries(this.repoList)) {
                this.repoList[idx] = new AssetRepository(repo.title, repo.url);
            }
        }
        for (const repo of this.repoList) {
            repo.eventSource.on(AssetRepository.EVENT.URL, ()=>this.eventSource.emit(Settings.EVENT.REPO_LIST));
        }
        extension_settings.extensionManager = this.toJSON();
    }

    save() {
        extension_settings.extensionManager = this.toJSON();
        saveSettingsDebounced();
    }


    /**
     * @param {AssetRepository} repo
     */
    addRepo(repo) {
        this.repoList.push(repo);
        repo.eventSource.on(AssetRepository.EVENT.URL, ()=>this.eventSource.emit(Settings.EVENT.REPO_LIST));
        this.eventSource.emit(Settings.EVENT.REPO_LIST);
        this.save();
    }
    /**
     * @param {AssetRepository} repo
     */
    removeRepo(repo) {
        const idx = this.repoList.indexOf(repo);
        if (idx > -1) {
            this.repoList.splice(idx, 1);
            this.eventSource.emit(Settings.EVENT.REPO_LIST);
        }
        this.save();
    }
    /**
     * @param {AssetRepository[]} repos
     */
    reorderRepoList(repos) {
        this.repoList.sort((a,b)=>repos.indexOf(a) - repos.indexOf(b));
        this.eventSource.emit(Settings.EVENT.REPO_LIST);
        this.save();
    }
}
