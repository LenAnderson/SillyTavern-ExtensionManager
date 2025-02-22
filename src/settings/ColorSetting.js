import { BaseSetting } from './BaseSetting.js';

export class ColorSetting extends BaseSetting {
    /**@type {object} */ input;
    /**@type {string} */ currentValue;

    get value() { return this.currentValue ?? this.initialValue; }
    set value(value) {
        if (this.input) {
            this.input.color = value;
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
                    lbl.addEventListener('pointerdown', (evt)=>{
                        if (evt.target == inp) return;
                        if (!this.input.state.isPopupVisible) {
                            this.input.toggle();
                        }
                    });
                    const inp = document.createElement('toolcool-color-picker'); {
                        this.input = inp;
                        inp.id = this.id;
                        inp.classList.add('input');
                        inp.color = this.initialValue;
                        let initialChange = true;
                        inp.addEventListener('change', (evt)=>{
                            if (initialChange) {
                                initialChange = false;
                                inp.color = this.initialValue;
                                return;
                            }
                            this.currentValue = evt.detail.rgb;
                            this.onChange?.(this);
                        });
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
