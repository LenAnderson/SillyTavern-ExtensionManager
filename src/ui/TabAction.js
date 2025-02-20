export class TabAction {
    /**@type {string} */ id;
    /**@type {string} */ label;
    /**@type {string} */ icon;
    /**@type {string} */ title;
    /**@type {(evt:MouseEvent)=>Promise<any>|any} */ callback;

    dom = {
        /**@type {HTMLElement} */
        root: undefined,
    };




    /**
     * @param {MouseEvent} evt
     */
    async performAction(evt) {
        await this.callback?.(evt);
    }




    /**
     * @returns {HTMLElement}
     */
    render() {
        if (!this.dom.root) {
            const root = document.createElement('div'); {
                this.dom.root = root;
                root.classList.add('stem--tab');
                root.classList.add('stem--action');
                root.title = this.title;
                root.setAttribute('data-stem--action', this.id);
                root.addEventListener('click', (evt)=>this.performAction(evt));
                const icon = document.createElement('i'); {
                    icon.classList.add('fa-solid', 'fa-fw', `fa-${this.icon}`);
                    root.append(icon);
                }
                const label = document.createElement('span'); {
                    label.classList.add('stem--label');
                    label.textContent = this.label;
                    root.append(label);
                }
            }
        }
        return this.dom.root;
    }
}
