
/** @readonly */
/** @enum {string} */
const TYPE = {
    NULL: 'null',
    ARRAY: 'array',
    OBJECT: 'object',
    NUMBER: 'number',
    STRING: 'string',
    BOOLEAN: 'boolean',
};


export class JsonView {
    /**@type {object} */ value;

    /**@type {any[]} */ renderRecurseCheck = [];


    dom = {
        /**@type {HTMLElement} */
        root: undefined,
    };




    constructor(value) {
        this.value = value;
    }


    render() {
        if (!this.dom.root) {
            while (this.renderRecurseCheck.pop());
            const root = document.createElement('ul'); {
                this.dom.root = root;
                root.classList.add('jsonView--root');
                root.append(this.renderItem(this.value));
            }
        }
        return this.dom.root;
    }

    renderItem(obj, name = null) {
        let type = this.getType(obj);
        const o = document.createElement('li'); {
            o.classList.add('jsonView--item');
            o.dataset.type = type;
            switch (type) {
                case TYPE.ARRAY: {
                    o.dataset.typeGroup = 'complex';
                    o.append(this.renderArray(obj, name));
                    break;
                }
                case TYPE.OBJECT: {
                    o.dataset.typeGroup = 'complex';
                    o.append(this.renderObject(obj, name));
                    break;
                }
                case TYPE.NULL:
                case TYPE.STRING:
                case TYPE.NUMBER:
                case TYPE.BOOLEAN: {
                    o.dataset.typeGroup = 'primitive';
                    o.append(this.renderPrimitive(obj, name));
                    break;
                }
            }
        }
        return o;
    }

    /**
     *
     * @param {any[]} obj
     * @returns
     */
    renderArray(obj, name = null) {
        const recurse = this.renderRecurseCheck.includes(obj);
        this.renderRecurseCheck.push(obj);
        return this.renderComplex(obj.map(it=>[null, it]), '[', ']', name, recurse);
    }
    /**
     * @param {object} obj
     * @returns
     */
    renderObject(obj, name) {
        const recurse = this.renderRecurseCheck.includes(obj);
        this.renderRecurseCheck.push(obj);
        const items = Object.entries(obj);
        return this.renderComplex(items, '{', '}', name, recurse);
    }

    renderComplex(items, openString, closeString, name = null, isRecurse = false) {
        const frag = document.createDocumentFragment(); {
            const head = document.createElement('div'); {
                head.classList.add('jsonView--head');
                head.addEventListener('click', ()=>{
                    head.classList.toggle('jsonView--isCollapsed');
                });
                const toggle = document.createElement('div'); {
                    toggle.classList.add('jsonView--toggle');
                    head.append(toggle);
                }
                if (name !== null) {
                    const n = document.createElement('div'); {
                        n.classList.add('jsonView--name');
                        n.textContent = name;
                        head.append(n);
                    }
                }
                const open = document.createElement('div'); {
                    open.classList.add('jsonView--open');
                    open.textContent = openString;
                    head.append(open);
                }
                const count = document.createElement('div'); {
                    count.classList.add('jsonView--count');
                    count.textContent = items.length.toString();
                    head.append(count);
                }
                frag.append(head);
            }
            const content = document.createElement('ul'); {
                content.classList.add('jsonView--content');
                if (isRecurse) {
                    content.append(' RECURSIVE ');
                } else {
                    for (const [name, item] of items) {
                        content.append(this.renderItem(item, name));
                    }
                }
                frag.append(content);
            }
            const close = document.createElement('div'); {
                close.classList.add('jsonView--close');
                close.textContent = closeString;
                frag.append(close);
            }
        }
        return frag;
    }

    renderPrimitive(obj, name) {
        const frag = document.createDocumentFragment(); {
            const head = document.createElement('div'); {
                head.classList.add('jsonView--head');
                if (name !== null) {
                    const n = document.createElement('div'); {
                        n.classList.add('jsonView--name');
                        n.textContent = name;
                        head.append(n);
                    }
                }
                frag.append(head);
            }
            const content = document.createElement('div'); {
                content.classList.add('jsonView--primitiveContent');
                content.textContent = JSON.stringify(obj);
                frag.append(content);
            }
        }
        return frag;
    }

    /**
     * @param {any} obj
     * @returns {TYPE}
     */
    getType(obj) {
        if (obj === undefined || obj === null) return TYPE.NULL;
        if (Array.isArray(obj)) return TYPE.ARRAY;
        return typeof obj;
    }
}
