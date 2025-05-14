import { extension_settings } from '../../../../../extensions.js';
import { JsonView } from '../../lib/JsonView/JsonView.js';
import { Tab } from '../ui/Tab.js';

export class RawTab extends Tab {
    id = 'raw';
    icon = 'pen-to-square';
    label = 'Extension settings JSON';
    title = 'View extension settings JSON';


    content = {
        /**@type {HTMLSelectElement} */
        picker: undefined,
        /**@type {HTMLElement} */
        jsonPanel: undefined,
    };




    constructor() {
        super();
    }


    renderBodyContent() {
        const frag = document.createDocumentFragment();
        const actions = document.createElement('div'); {
            actions.classList.add('stem--actions');
            const picker = document.createElement('select'); {
                this.content.picker = picker;
                picker.classList.add('text_pole');
                picker.addEventListener('change', ()=>this.showSettings());
                actions.append(picker);
            }
            const pickerRefresh = document.createElement('div'); {
                pickerRefresh.classList.add('menu_button');
                pickerRefresh.classList.add('fa-solid', 'fa-fw', 'fa-rotate-left');
                pickerRefresh.addEventListener('click', ()=>this.populatePicker());
                actions.append(pickerRefresh);
            }
            frag.append(actions);
        }
        const jsonPanel = document.createElement('div'); {
            this.content.jsonPanel = jsonPanel;
            jsonPanel.classList.add('stem--jsonPanel');
            frag.append(jsonPanel);
        }
        this.populatePicker();
        return frag;
    }

    populatePicker() {
        const picker = this.content.picker;
        const val = picker.value;
        picker.innerHTML = '';
        const kvList = [
            ['', '-- Select an extension --'],
            ...Object.keys(extension_settings)
                .toSorted((a,b)=>a.toLowerCase().localeCompare(b.toLowerCase()))
                .map(it=>[it,it])
            ,
        ];
        for (const [value, label] of kvList) {
            const opt = document.createElement('option'); {
                opt.value = value;
                opt.textContent = label;
                picker.append(opt);
            }
        }
        picker.value = val;
        this.showSettings();
    }

    showSettings() {
        this.content.jsonPanel.innerHTML = '';
        if (!this.content.picker?.value.length) return;
        const jv = new JsonView(extension_settings[this.content.picker.value]);
        this.content.jsonPanel.append(jv.render());
    }
}
