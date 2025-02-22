import { BaseSetting } from './BaseSetting.js';
import { SettingAction } from './SettingAction.js';
import { SettingIcon } from './SettingIcon.js';

export class CustomSetting extends BaseSetting {
    /**
     * @param {object} props
     * @param {string} props.id
     * @param {string} props.name
     * @param {string} props.description
     * @param {*} props.initialValue
     * @param {string[]} props.category
     * @param {boolean} [props.actionsFirst]
     * @param {()=>HTMLElement} props.renderCallback
     * @param {()=>*} props.getValueCallback
     * @param {(value:*)=>void} props.setValueCallback
     * @param {SettingAction[]} [props.actionList]
     * @param {SettingIcon[]} [props.iconList]
     * @param {()=>void} [props.onChange]
     */
    static fromProps(props) {
        return Object.assign(new this(), props);
    }




    /**@type {boolean} */ actionsFirst = false;
    /**@type {()=>HTMLElement} */ renderCallback;
    /**@type {()=>*} */ getValueCallback;
    /**@type {(value:*)=>void} */ setValueCallback;

    get value() {
        return this.getValueCallback();
    }
    set value(value) {
        this.setValueCallback(value);
    }




    render() {
        if (!this.dom) {
            const item = document.createElement('div'); {
                this.dom = item;
                item.classList.add('item');
                const head = document.createElement('div'); {
                    head.classList.add('head');
                    const text = document.createElement('div'); {
                        text.classList.add('text');
                        text.textContent = this.name;
                        head.append(text);
                    }
                    const key = document.createElement('small'); {
                        key.textContent = `#${this.id}`;
                        key.style.fontWeight = 'normal';
                        head.append(key);
                    }
                    const icons = document.createElement('div'); {
                        icons.classList.add('icons');
                        icons.append(...this.iconList.map(it=>it.render()));
                        head.append(icons);
                    }
                    item.append(head);
                }
                const desc = document.createElement('div'); {
                    desc.classList.add('description');
                    desc.innerHTML = this.description;
                    item.append(desc);
                }
                if (this.actionsFirst) item.append(...this.renderActions());
                const inp = this.renderCallback(); {
                    item.append(inp);
                }
                if (!this.actionsFirst) item.append(...this.renderActions());
            }
        }
        return this.dom;
    }

    renderActions() {
        if (this.actionList?.length) {
            const actions = document.createElement('div'); {
                actions.classList.add('actions');
                actions.append(...this.actionList.map(it=>it.render()));
            }
            return [actions];
        }
        return [];
    }
}
