import { BaseSetting } from './BaseSetting.js';
import { SettingAction } from './SettingAction.js';
import { SettingIcon } from './SettingIcon.js';

export class NumberSetting extends BaseSetting {
    /**
     * @param {object} props
     * @param {string} props.id
     * @param {string} props.name
     * @param {string} props.description
     * @param {number} props.min
     * @param {number} props.max
     * @param {number} props.step
     * @param {*} props.initialValue
     * @param {string[]} props.category
     * @param {SettingAction[]} [props.actionList]
     * @param {SettingIcon[]} [props.iconList]
     * @param {()=>void} [props.onChange]
     */
    static fromProps(props) {
        return Object.assign(new this(), props);
    }




    /**@type {number} */ min;
    /**@type {number} */ max;
    /**@type {number} */ step;

    /**@type {HTMLInputElement} */ range;
    /**@type {HTMLInputElement} */ input;

    get value() { return Number(this.input?.value) ?? this.initialValue; }
    set value(value) {
        if (this.input) {
            this.input.value = value;
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
                const desc = document.createElement('div'); {
                    desc.classList.add('description');
                    desc.innerHTML = this.description;
                    item.append(desc);
                }
                const wrap = document.createElement('div'); {
                    wrap.classList.add('neo-range-wrap');
                    const range = document.createElement('input'); {
                        this.range = range;
                        range.id = `${this.id}`;
                        range.classList.add('neo-range-slider');
                        range.type = 'range';
                        range.min = `${this.min}`;
                        range.max = `${this.max}`;
                        range.step = `${this.step}`;
                        range.value = this.initialValue ?? false;
                        range.addEventListener('input', ()=>{
                            this.input.value = range.value;
                            this.onChange?.(this);
                        });
                        wrap.append(range);
                    }
                    const inp = document.createElement('input'); {
                        this.input = inp;
                        inp.id = `${this.id}_input`;
                        inp.classList.add('neo-range-input');
                        inp.type = 'number';
                        inp.min = `${this.min}`;
                        inp.max = `${this.max}`;
                        inp.step = `${this.step}`;
                        inp.value = this.initialValue ?? false;
                        inp.addEventListener('input', ()=>{
                            this.range.value = inp.value;
                            this.onChange?.(this);
                        });
                        wrap.append(inp);
                    }
                    item.append(wrap);
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
