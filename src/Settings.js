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
        /** accent color was changed */
        ACCENT_COLOR: 'accent_color',
        /** core icon color was changed */
        CORE_ICON_COLOR: 'core_color',
    };


    /**@type {AssetRepository[]} */ repoList = [];
    /**@type {number} */ updateCheckHours = 24;
    /**@type {boolean} */ updateNotify = true;
    /**@type {number} */ tileSize = 250;

    /**@type {boolean} */ #useCustomAccentColor = false;
    get useCustomAccentColor() { return this.#useCustomAccentColor; }
    set useCustomAccentColor(value) {
        if (this.#useCustomAccentColor != value) {
            this.#useCustomAccentColor = value;
            this.eventSource?.emit(Settings.EVENT.ACCENT_COLOR);
        }
    }
    /**@type {string} */ #customAccentColor = 'rgb(0 255 0 / 1)';
    get customAccentColor() { return this.#customAccentColor; }
    set customAccentColor(value) {
        if (this.#customAccentColor != value) {
            this.#customAccentColor = value;
            this.eventSource?.emit(Settings.EVENT.ACCENT_COLOR);
        }
    }
    get currentAccentColor() { return this.useCustomAccentColor ? this.customAccentColor : 'var(--SmartThemeQuoteColor)'; }

    /**@type {boolean} */ #monochromeCoreIcon = true;
    get monochromeCoreIcon() { return this.#monochromeCoreIcon; }
    set monochromeCoreIcon(value) {
        if (this.#monochromeCoreIcon != value) {
            this.#monochromeCoreIcon = value;
            this.eventSource?.emit(Settings.EVENT.CORE_ICON_COLOR);
        }
    }

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
            useCustomAccentColor: this.useCustomAccentColor,
            customAccentColor: this.customAccentColor,
            monochromeCoreIcon: this.monochromeCoreIcon,

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
