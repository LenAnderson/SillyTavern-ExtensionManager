import { BaseSetting } from './BaseSetting.js';
import { SettingAction } from './SettingAction.js';
import { SettingIcon } from './SettingIcon.js';

export class CheckboxSetting extends BaseSetting {
    /**@type {HTMLInputElement} */ input;

    get value() { return this.input?.checked ?? this.initialValue; }
    set value(value) {
        if (this.input) {
            this.input.checked = value;
        } else {
            this.initialValue = value;
        }
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
                const lbl = document.createElement('label'); {
                    lbl.classList.add('checkboxLabel');
                    const inp = document.createElement('input'); {
                        this.input = inp;
                        inp.id = this.id;
                        inp.classList.add('input');
                        inp.type = 'checkbox';
                        inp.checked = this.initialValue ?? false;
                        inp.addEventListener('click', ()=>this.onChange?.(this));
                        lbl.append(inp);
                    }
                    const desc = document.createElement('div'); {
                        desc.classList.add('description');
                        desc.innerHTML = this.description;
                        lbl.append(desc);
                    }
                    item.append(lbl);
                }
                // if (this.actionList?.length) {
                //     const actions = document.createElement('div'); {
                //         actions.classList.add('actions');
                //         actions.append(...this.actionList.map(it=>it.render()));
                //         item.append(actions);
                //     }
                // }
            }
        }
        return this.dom;
    }
}
