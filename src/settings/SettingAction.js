export class SettingAction {
    /**
     * @param {object} props
     * @param {string} [props.label]
     * @param {string} [props.icon]
     * @param {string} props.tooltip
     * @param {function} props.action
     */
    static fromProps(props) {
        return Object.assign(new this(), props);
    }



    /**@type {string} */ label;
    /**@type {string} */ icon;
    /**@type {string} */ tooltip;
    /**@type {function} */ action;

    /**@type {HTMLElement} */ dom;



    render() {
        if (!this.dom) {
            const dom = document.createElement('div'); {
                this.dom = dom;
                dom.classList.add('action');
                dom.classList.add('menu_button');
                dom.title = this.tooltip;
                if (this.icon && !this.label) {
                    dom.classList.add('fa-solid');
                    dom.classList.add(this.icon);
                } else if (this.icon && this.label) {
                    dom.classList.add('menu_button_icon');
                    const i = document.createElement('i'); {
                        i.classList.add('fa-fw');
                        i.classList.add('fa-solid');
                        i.classList.add(this.icon);
                        dom.append(i);
                    }
                    const lbl = document.createElement('span'); {
                        lbl.textContent = this.label;
                        dom.append(lbl);
                    }
                } else if (this.label) {
                    dom.textContent = this.label;
                }
                dom.addEventListener('click', ()=>this.action());
            }
        }
        return this.dom;
    }
}
