import { getRequestHeaders } from '../../../../../../script.js';
import { Plugin } from '../Plugin.js';
import { ManageItemsItem } from './ManageItemsItem.js';


/**
 * @class
 * @extends ManageItemsItem<Plugin>
 */
export class ManagePluginsItem extends ManageItemsItem {
    renderItem(item) {
        fetch('/api/plugins/emp/plugins/readme/exists', {
            method: 'POST',
            headers: getRequestHeaders(),
            body: JSON.stringify({ plugin:this.model.name }),
        }).then(async(res)=>{
            if (await res.json()) {
                this.dom.root?.classList.add('stem--hasReadme');
            }
        });
    }

    updateGitStatus() {
        super.updateGitStatus();

        if (this.model.isRepo) {
            this.dom.version.textContent = this.model.branch.branches[this.model.branch.current].commit;
        }

        this.dom.url.href = this.model.homePage;
        this.dom.url.textContent = this.model.homePage;
        this.dom.url.title = `Open link in new tab\n${this.model.homePage}`;

        this.dom.author.textContent = this.model.author;
    }
}
