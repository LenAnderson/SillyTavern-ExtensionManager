/**
 * @param {number} dt
 * @returns {string}
 */
export const ago = (dt)=>{
    const now = Date.now();
    const delta = (now - dt) / 1000 / 60;
    let val = delta;
    let unit = '';
    if (delta < 1) {
        return 'just now';
    }
    if (delta < 60) {
        unit = 'minute';
    } else if (delta < 60 * 48) {
        val = delta / 60;
        unit = 'hour';
    } else {
        val = delta / 60 / 24;
        unit = 'day';
    }
    val = Math.round(val);
    return `${val} ${unit}${val > 1 ? 's' : ''} ago`;
};
