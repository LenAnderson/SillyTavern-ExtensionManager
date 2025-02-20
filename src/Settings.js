import { saveSettingsDebounced } from '../../../../../script.js';
import { extension_settings } from '../../../../extensions.js';
import { AssetRepository } from './AssetRepository.js';
import { Extension } from './Extension.js';

export class Settings {
    /**@type {AssetRepository[]} */ repoList = [];
    /**@type {number} */ updateCheckHours = 24;
    /**@type {Extension[]} */ extensionList = [];
    /**@type {Plugin[]} */ pluginList = [];

    /**@type {Extension[]} */ extensionCache = [];
    /**@type {Plugin[]} */ pluginCache = [];

    constructor() {
        const savedSettings = extension_settings.extensionManager ?? {};
        Object.assign(this, savedSettings);
        if (this.repoList.length == 0) {
            this.repoList.push(new AssetRepository(
                'Asset Repo Copy',
                'https://raw.githubusercontent.com/LenAnderson/SillyTavern-Content/refs/heads/asset-catalog/index.json',
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
        extension_settings.extensionManager = this.toJSON();
    }

    toJSON() {
        return {
            repoList: this.repoList,
            updateCheckHours: this.updateCheckHours,
            extensionCache: this.extensionList.filter(it=>!it.isCore),
            pluginCache: this.pluginList,
        };
    }

    save() {
        extension_settings.extensionManager = this.toJSON();
        saveSettingsDebounced();
    }
}
