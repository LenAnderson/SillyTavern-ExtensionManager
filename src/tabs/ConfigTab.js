import { event_types, eventSource } from '../../../../../../script.js';
import { settings } from '../../index.js';
import { Tab } from '../ui/Tab.js';

export class ConfigTab extends Tab {
    id = 'config';
    icon = 'gear';
    label = 'Extension Manager settings';
    title = 'Extension Manager settings';

    content = {
        /**@type {HTMLTextAreaElement} */
        input: undefined,
    };

    constructor() {
        super();
        eventSource.on(event_types.SETTINGS_UPDATED, ()=>{
            if (this.content.input) {
                this.content.input.value = JSON.stringify(settings, null, '\t');
            }
        });
    }

    renderBodyContent() {
        const frag = document.createDocumentFragment();
        const actions = document.createElement('div'); {
            actions.classList.add('stem--actions');
            const reset = document.createElement('div'); {
                reset.classList.add('menu_button');
                reset.classList.add('menu_button_icon');
                reset.addEventListener('click', ()=>input.value = JSON.stringify(settings, null, '\t'));
                const i = document.createElement('i'); {
                    i.classList.add('fa-solid', 'fa-fw', 'fa-rotate-left');
                    reset.append(i);
                }
                const t = document.createElement('span'); {
                    t.textContent = 'Reset';
                    t.title = 'Reset to last saved state';
                    reset.append(t);
                }
                actions.append(reset);
            }
            const save = document.createElement('div'); {
                save.classList.add('menu_button');
                save.classList.add('menu_button_icon');
                save.addEventListener('click', ()=>{
                    try {
                        const parsed = JSON.parse(input.value);
                        Object.assign(settings, parsed);
                        settings.save();
                        toastr.success('Config saved');
                    } catch (ex) {
                        alert(ex);
                    }
                });
                const i = document.createElement('i'); {
                    i.classList.add('fa-solid', 'fa-fw', 'fa-save');
                    save.append(i);
                }
                const t = document.createElement('span'); {
                    t.textContent = 'Save';
                    t.title = 'Save changes';
                    save.append(t);
                }
                actions.append(save);
            }
            frag.append(actions);
        }
        const input = document.createElement('textarea'); {
            this.content.input = input;
            input.value = JSON.stringify(settings, null, '\t');
            frag.append(input);
        }
        return frag;
    }
}
