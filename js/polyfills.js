// this is loaded before anything else in html files

// https://github.com/jonathantneal/array-flat-polyfill/blob/master/src/polyfill-flat.js
// the mdn polyfill seems to be broken
if (!Array.prototype.flat) {
  Object.defineProperty(Array.prototype, 'flat', {
    configurable: true,
    value: function flat () {
      var depth = isNaN(arguments[0]) ? 1 : Number(arguments[0]);

      return depth ? Array.prototype.reduce.call(this, function (acc, cur) {
        if (Array.isArray(cur)) {
          acc.push.apply(acc, flat.call(cur, depth - 1));
        } else {
          acc.push(cur);
        }

        return acc;
      }, []) : Array.prototype.slice.call(this);
    },
    writable: true
  });
}

// https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/flatMap
// something gets broken without the Infinity
if (!Array.prototype.flatMap) {
  Array.prototype.flatMap = function() {
    return Array.prototype.map.apply(this, arguments).flat(1);
  };
}
