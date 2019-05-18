/*
design notes:
  * MathElements are not html dom elements
  * in the MathElement representing x+x, the x's are DIFFERENT objects
    this way there's no need to keep track of a MathElement and its location
    because each MathElement is in only one location
    both x's are created with "new Symbol('x')", which must be done twice
  * all MathElements except Container are immutable
    or at least you should never mutate them
    or at least you should never mutate anything else than .parent
  * Container elements are mutable
    their child elements can be changed on-the-fly
  * toString() methods are there mostly for debugging
    e.g. console.log(someElement + '');
*/

const Precedences = {
  SUM: 0,
  PRODUCT: 1,
  FRACTION: 2,
  POWER: 3,
  NEVER_PARENTHESIZE: 10,
};


function toStringWithParens(parentElem, childElem) {
  if (parentElem.childNeedsParens(childElem)) {
    return '(' + childElem.toString() + ')';
  }
  return childElem.toString();
}


export class MathElement {
  constructor() {
    this.parent = null;
  }

  getChildElements() {
    return [];
  }
}
MathElement.precedence = Precedences.NEVER_PARENTHESIZE;


export class Symbol extends MathElement {
  constructor(name) {
    super();
    this.name = name;
  }

  toString() {
    return this.name;
  }
}


export class IntConstant extends MathElement {
  constructor(jsNumber) {
    super();
    if (!Number.isInteger(jsNumber)) {
      throw new Error("not an integer: " + jsNumber);
    }
    if (jsNumber < 0) {
      return new Sum([ { elem: new IntConstant(Math.abs(jsNumber)), sign: '-' } ]);
    }
    this.jsNumber = jsNumber;
  }

  toString() {
    return this.jsNumber + '';
  }
}


class Container extends MathElement {
  getChildElements() {
    throw new Error("getChildElements wasn't overrided");
  }

  replace(oldChild, newChild) {
    throw new Error("replace wasn't overrided");
  }

  _childHasBeenAdded(child) {
    if (child.parent !== null) {
      throw new Error("cannot add same element to 2 places");
    }
    child.parent = this;
  }

  _childWillBeRemoved(child) {
    if (child.parent !== this) {
      throw new Error(`cannot remove the child element ${child}, it hasn't been added`);
    }
    child.parent = null;
  }

  childNeedsParens(child) {
    if (child.parent !== this) {
      throw new Error("childNeedsParens called for non-child");
    }
    return (this.constructor.precedence >= child.constructor.precedence);
  }
}


function addChildElementProperty(klass, propertyName) {
  Object.defineProperty(klass.prototype, propertyName, {
    get: function() {
      return this['_' + propertyName];
    },

    set: function(newValue) {
      const oldValue = this['_' + propertyName];
      this._childWillBeRemoved(oldValue);
      this['_' + propertyName] = newValue;
      this._childHasBeenAdded(newValue);
    }
  });
}


// call _setNames() after subclassing
class FixedNumberOfChildElementsContainer extends Container {
  static _setNames(nameArray) {
    if (nameArray.length < 2) {
      throw new Error("not enough child element property names");
    }

    this._names = nameArray;
    for (const name of nameArray) {
      addChildElementProperty(this, name);
    }
  }

  constructor(...args) {
    super();
    if (args.length !== this.constructor._names.length) {
      throw new Error("wrong number of arguments");
    }
    this.constructor._names.forEach((name, i) => {
      this['_' + name] = args[i];
      this._childHasBeenAdded(args[i]);
    });
  }

  getChildElements() {
    return this.constructor._names.map(name => this[name]);
  }

  replace(oldChild, newChild) {
    for (const name of this.constructor._names) {
      if (this[name] === oldChild) {
        this[name] = newChild;
        return;
      }
    }
    throw new Error("child element not found: " + oldChild);
  }
}

export class Fraction extends FixedNumberOfChildElementsContainer {
  toString() {
    // the precedence stuff was designed for doing:
    //
    //    numer
    //   -------
    //    denom
    //
    // but this method has to do numer/denom instead
    // solution: use explicit parentheses
    return `(${this.numer.toString()})/(${this.denom.toString()})`
  }
}
Fraction._setNames(['numer', 'denom']);
Fraction.precedence = Precedences.FRACTION;


export class Power extends FixedNumberOfChildElementsContainer {
  toString() {
    return toStringWithParens(this, this.base) + '^' + toStringWithParens(this, this.exponent);
  }

  childNeedsParens(child) {
    if (child === this.exponent) {
      /*
                b             /  b \
               a              \ a  /
      display x   instead of x
      */
      return false;
    }
    return super.childNeedsParens(child);
  }
}
Power._setNames(['base', 'exponent']);
Power.precedence = Precedences.POWER;


class List extends Container {
  constructor() {
    super();
    this._childObjects = [];    // may contain elements or something else, depends on subclass
  }

  _getElement(childObject) {
    throw new Error("wasn't overrided");
  }

  // should return a new object, and not mutate
  _changeElement(childObject, element) {
    throw new Error("wasn't overrided");
  }

  _createChildObject(...args) {
    throw new Error("wasn't overrided");
  }

  getChildElements() {
    return this._childObjects.map(childObject => this._getElement(childObject));
  }

  insertChildElement(index, ...args) {
    if (index < 0 || index > this._childObjects.length) {
      throw new Error("invalid index: " + index);
    }

    const childObject = this._createChildObject(...args);
    this._childObjects.splice(index, 0, childObject);
    this._childHasBeenAdded(this._getElement(childObject));
  }

  appendChildElement(...args) {
    this.insertChildElement(this._childObjects.length, ...args);
  }

  replace(oldChild, newChild) {
    const i = this.getChildElements().indexOf(oldChild);
    if (i === -1) {
      throw new Error("old child element not found: " + oldChild);
    }

    this._childWillBeRemoved(oldChild);
    this._childObjects[i] = this._changeElement(this._childObjects[i], newChild);
    this._childHasBeenAdded(newChild);
  }
}


export class Product extends List {
  constructor(childElements) {
    super();
    if (childElements.length === 0) {
      return new IntConstant(1);
    }
    if (childElements.length === 1) {
      return childElements[0];
    }

    for (const elem of childElements) {
      this.appendChildElement(elem);
    }
  }

  _getElement(childObject) { return childObject; }
  _changeElement(childObject, element) { return element; }
  _createChildObject(element) { return element; }

  toString() {
    return this.getChildElements()
      .map(elem => toStringWithParens(this, elem))
      .join('*');
  }
}
Product.precedence = Precedences.PRODUCT;


// represents things separated with + or - characters
// -x is represented as: new Sum([ { elem: x, sign: '-' } ])
export class Sum extends List {
  // elemsAndSigns should contain items like this:
  // { elem: someMathElement, sign: '+' or '-' }
  constructor(elemsAndSigns) {
    super();

    if (elemsAndSigns.length === 0) {
      return new IntConstant(0);
    }
    if (elemsAndSigns.length === 1 && elemsAndSigns[0].sign === '+') {
      return elemsAndSigns[0].elem;
    }

    for (const { elem, sign } of elemsAndSigns) {
      this.appendChildElement(elem, sign);
    }
  }

  _getElement(childObject) { return childObject.elem; }
  _changeElement(childObject, element) { return { elem: element, sign: childObject.sign }; }
  _createChildObject(element, sign) { return { elem: element, sign: sign }; }

  getChildElementsAndSigns() {
    return this._childObjects.slice();    // copy it
  }

  toString() {
    return this.getChildElementsAndSigns()
      .flatMap(elemSign => [ elemSign.sign, toStringWithParens(this, elemSign.elem) ])
      .filter((string, index) => !(index === 0 && string === '+'))
      .join(' ');
  }
}
Sum.precedence = Precedences.SUM;
