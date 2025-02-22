/**@readonly*/
/**@enum {{icon:string, tooltip:string}}*/
export const SETTING_ICON = {
    'MOBILE_ONLY': { icon:'fa-mobile-screen-button', tooltip:'mobile only' },
    'DESKTOP_ONLY': { icon:'fa-desktop', tooltip:'desktop only' },
    'EXPERIMENTAL': { icon:'fa-flask', tooltip:'Experimental feature.' },
};

export class SettingIcon {
    /**
     * @param {SETTING_ICON} props
     */
    static fromProps(props) {
        return new this(props.icon, props.tooltip);
    }



    /**@type {string} */ icon;
    /**@type {string} */ tooltip;

    /**@type {HTMLElement} */ dom;

    constructor(icon, tooltip) {
        this.icon = icon;
        this.tooltip = tooltip;
    }

    render() {
        if (!this.dom) {
            const dom = document.createElement('i'); {
                this.dom = dom;
                dom.classList.add('fa-solid');
                dom.classList.add(this.icon);
                dom.title = this.tooltip;
            }
        }
        return this.dom;
    }
}
