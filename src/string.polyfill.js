if (!String.prototype.endsWith) {
    /**
     * The endsWith() method determines whether a string ends with the characters of another string,
     * returning true or false as appropriate.
     *
     * @param searchString
     * @param position
     * @returns {boolean}
     * @see https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String/endsWith
     */
    String.prototype.endsWith = function (searchString, position) {
        var subjectString = this.toString();
        if (typeof position !== 'number' || !isFinite(position) || Math.floor(position) !== position || position > subjectString.length) {
            position = subjectString.length;
        }
        position -= searchString.length;
        var lastIndex = subjectString.indexOf(searchString, position);
        return lastIndex !== -1 && lastIndex === position;
    };
}

if (!String.prototype.startsWith) {
    /**
     * The startsWith() method determines whether a string begins with the characters of another string,
     * returning true or false as appropriate.
     *
     * @param searchString
     * @param position
     * @returns {boolean}
     * @see https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String/startsWith
     */
    String.prototype.startsWith = function (searchString, position) {
        position = position || 0;
        return this.indexOf(searchString, position) === position;
    };
}
