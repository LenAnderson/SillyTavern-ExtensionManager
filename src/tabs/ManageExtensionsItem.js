import { Extension } from '../Extension.js';
import { STEM_ITEM_EVENT } from '../STEMItem.js';
import { ManageItemsItem } from './ManageItemsItem.js';

/**
 * @class
 * @extends ManageItemsItem<Extension>
 */
export class ManageExtensionsItem extends ManageItemsItem {
    /**
     * @param {Extension} model
     */
    constructor(model) {
        super(model);
        this.dom.actions.errorLog = {
            /**@type {HTMLElement} */
            button: undefined,
            /**@type {HTMLElement} */
            icon: undefined,
        };
    }




    renderItem(item) {
        if (this.model.isCore) item.classList.add('stem--isCore');
        if (this.model.isDisabled) item.classList.add('stem--isDisabled');
        this.model.eventSource.on(STEM_ITEM_EVENT.STATE, ()=>{
            item.classList[this.model.isDisabledNow ? 'add' : 'remove']('stem--isDisabled');
            this.dom.actions.toggle.title = this.model.isDisabledNow ? 'Enable extension' : 'Disable extension';
        });
        fetch(`/scripts/extensions/${this.model.name}/README.md`, { method:'HEAD' }).then((res)=>{
            if (res.ok) {
                this.dom.root?.classList.add('stem--hasReadme');
            }
        });
    }

    renderColumn(item, name) {
        switch (name) {
            case 'Actions': {
                /** @type {HTMLElement} */
                const actions = super.renderColumn(item, name);
                const wrap = actions.querySelector('.stem--actions');
                const toggle = document.createElement('div'); {
                    this.dom.actions.toggle.button = toggle;
                    this.dom.actions.toggle.icon = toggle;
                    toggle.classList.add('stem--toggle');
                    toggle.classList.add('stem--action');
                    toggle.classList.add('menu_button');
                    toggle.classList.add('fa-solid', 'fa-fw', 'fa-power-off');
                    toggle.title = this.model.isDisabledNow ? 'Enable extension' : 'Disable extension';
                    toggle.addEventListener('click', async(evt)=>{
                        this.model.toggleState();
                    });
                    wrap.prepend(toggle);
                }
                if (!this.model.isCore) {
                    const errorLog = document.createElement('div'); {
                        this.dom.actions.errorLog.button = errorLog;
                        this.dom.actions.errorLog.icon = errorLog;
                        errorLog.classList.add('stem--action');
                        errorLog.classList.add('stem--errorLog');
                        errorLog.classList.add('menu_button');
                        errorLog.classList.add('fa-stack', 'fa-fw');
                        errorLog.title = 'Errors';
                        errorLog.addEventListener('click', async()=>{
                            this.model.showErrors();
                        });
                        const iconFile = document.createElement('i'); {
                            iconFile.classList.add('fa-solid', 'fa-stack-1x', 'fa-file');
                            errorLog.append(iconFile);
                        }
                        const iconExclamation = document.createElement('i'); {
                            iconExclamation.classList.add('fa-solid', 'fa-stack-1x', 'fa-exclamation');
                            errorLog.append(iconExclamation);
                        }
                        wrap.lastElementChild.insertAdjacentElement('beforebegin', errorLog);
                    }
                }
                return actions;
            }
            case 'Source': {
                const source = document.createElement('td'); {
                    source.dataset.property = 'Source';
                    const icon = document.createElement('div'); {
                        icon.classList.add('stem--source');
                        icon.classList.add('fa-solid', 'fa-fw');
                        if (this.model.isCore) {
                            icon.classList.add('stem--core');
                            source.title = 'Core extension';
                        } else {
                            icon.classList.add('fa-cubes');
                            source.title = 'Third-party extension';
                        }
                        source.append(icon);
                    }
                    item.append(source);
                }
                return source;
            }
            default: {
                return super.renderColumn(item, name);
            }
        }
    }
}
