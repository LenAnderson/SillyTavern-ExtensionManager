export class ExtensionError {
    /**@type {number} */ time;
    /**@type {string} */ stack;

    constructor(time, stack) {
        this.time =  time;
        this.stack = stack;
    }
}
