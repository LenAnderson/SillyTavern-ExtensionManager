import { settings } from '../../index.js';
import { Settings } from '../Settings.js';
import { Tab } from './Tab.js';
import { TabAction } from './TabAction.js';

export class TabUi {
    /**@type {Tab[]} */ primaryTabList = [];
    /**@type {Tab[]} */ secondaryTabList = [];
    /**@type {TabAction[]} */ actionList = [];

    /**@type {Tab} */ currentTab;

    dom = {
        /**@type {HTMLElement} */
        root: undefined,
        tabs: {
            /**@type {HTMLElement} */
            primary: undefined,
            /**@type {HTMLElement} */
            secondary: undefined,
            /**@type {HTMLElement} */
            actions: undefined,
        },
        /**@type {HTMLElement} */
        body: undefined,
    };

    get isRendered() { return !!this.dom.root; }




    /**
     * @param {Tab} tab
     */
    addTab(tab, isPrimary = true) {
        if (isPrimary) {
            this.primaryTabList.push(tab);
        } else {
            this.secondaryTabList.push(tab);
        }
        tab.eventSource.on(Tab.EVENT.SELECT, ()=>this.selectTab(tab));
        if (this.isRendered) {
            if (isPrimary) {
                this.dom.tabs.primary.append(tab.renderTab());
            } else {
                this.dom.tabs.secondary.append(tab.renderTab());
            }
            this.dom.body.append(tab.renderBody());
        }
        if (this.primaryTabList.length == 1) {
            this.selectTab(tab);
        }
    }

    addAction(action) {
        this.actionList.push(action);
        if (this.isRendered) {
            this.dom.tabs.actions.append(action.render());
        }
    }


    /**
     * @param {Tab} tab
     */
    selectTab(tab) {
        this.currentTab?.deselect();
        this.currentTab = tab;
        this.currentTab.select();
    }




    render() {
        if (!this.isRendered) {
            const root = document.createElement('div'); {
                this.dom.root = root;
                root.classList.add('stem--tabUi');
                root.style.setProperty('--accentColor', settings.currentAccentColor);
                settings.eventSource.on(Settings.EVENT.ACCENT_COLOR, ()=>{
                    root.style.setProperty('--accentColor', settings.currentAccentColor);
                });
                root.classList[settings.monochromeCoreIcon ? 'add' : 'remove']('stem--monochromeCoreIcon');
                settings.eventSource.on(Settings.EVENT.CORE_ICON_COLOR, ()=>{
                    root.classList[settings.monochromeCoreIcon ? 'add' : 'remove']('stem--monochromeCoreIcon');
                });
                const tabRow = document.createElement('div'); {
                    tabRow.classList.add('stem--tabRow');
                    const primary = document.createElement('div'); {
                        this.dom.tabs.primary = primary;
                        primary.classList.add('stem--primary');
                        tabRow.append(primary);
                    }
                    const actions = document.createElement('div'); {
                        this.dom.tabs.actions = actions;
                        actions.classList.add('stem--actions');
                        tabRow.append(actions);
                    }
                    const separator = document.createElement('div'); {
                        separator.classList.add('stem--separator');
                        tabRow.append(separator);
                    }
                    const secondary = document.createElement('div'); {
                        this.dom.tabs.secondary = secondary;
                        secondary.classList.add('stem--secondary');
                        tabRow.append(secondary);
                    }
                    root.append(tabRow);
                }
                const bodyContainer = document.createElement('div'); {
                    this.dom.body = bodyContainer;
                    bodyContainer.classList.add('stem--bodyContainer');
                    root.append(bodyContainer);
                }
            }
            for (const tab of this.primaryTabList) {
                this.dom.tabs.primary.append(tab.renderTab());
                this.dom.body.append(tab.renderBody());
            }
            for (const tab of this.secondaryTabList) {
                this.dom.tabs.secondary.append(tab.renderTab());
                this.dom.body.append(tab.renderBody());
            }
            for (const action of this.actionList) {
                this.dom.tabs.actions.append(action.render());
            }
        }
        return this.dom.root;
    }
}
