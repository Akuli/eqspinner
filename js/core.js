/*
design notes:
  * in the MathElement representing x+x, the x's are DIFFERENT objects
    this way there's no need to keep track of a MathElement and its location
    because each MathElement is in only one location
    both x's are created with "new Symbol('x')", which must be done twice
  * MathElements that don't contain other MathElements are immutable
  * MathElements that do contain other elements are mutable
    their child elements can be changed on-the-fly
*/

const Precedences = {
  SUM: 0,
  PRODUCT: 1,
  FRACTION: 2,
  POWER: 3,
  NEVER_PARENTHESIZE: 10,
};


export function needsParens(parentElem, childElem) {
  return (parentElem.constructor.precedence >= childElem.constructor.precedence);
}

function toStringWithParens(parentElem, childElem) {
  if (needsParens(parentElem, childElem)) {
    return '(' + childElem.toString() + ')';
  }
  return childElem.toString();
}


// subclasses override toString() methods for debugging
export class MathElement extends EventTarget {
  constructor() {
    super();
    this._className = this.constructor.name;   // for debugging
    this.parent = null;
  }

  getSubElements() {
    return [];
  }
}
MathElement.precedence = Precedences.NEVER_PARENTHESIZE;


export class Symbol extends MathElement {
  constructor(name) {
    super();
    this._name = name;
  }

  get name() {
    return this._name;
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
    this._jsNumber = jsNumber;
  }

  get jsNumber() {
    return this._jsNumber;
  }

  toString(parentElementPrecedence) {
    return this.jsNumber + '';
  }
}


function addSubElementProperty(klass, propertyName) {
  Object.defineProperty(klass.prototype, propertyName, {
    get: function() {
      return this['_' + propertyName];
    },

    set: function(value) {
      this._dispatchSubElementEvent('SubElementRemoving', this['_' + propertyName]);
      this['_' + propertyName] = value;
      this._dispatchSubElementEvent('SubElementAdded', value);
    }
  });
}


// call setNames() after subclassing
class TwoSubElements extends MathElement {
  static setNames(aName, bName) {
    this._aName = aName;
    this._bName = bName;
    addSubElementProperty(this, aName);
    addSubElementProperty(this, bName);
  }

  constructor(a, b) {
    super();
    this['_' + this.constructor._aName] = a;
    this['_' + this.constructor._bName] = b;
  }

  getSubElements() {
    return [ this[this.constructor._aName], this[this.constructor._bName] ];
  }
}

export class Fraction extends TwoSubElements {
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
Fraction.setNames('numer', 'denom');
Fraction.precedence = Precedences.FRACTION;


export class Power extends TwoSubElements {
  toString() {
    return toStringWithParens(this, this.base) + '^' + toStringWithParens(this, this.exponent);
  }
}
Power.setNames('base', 'exponent');
Power.precedence = Precedences.POWER;


export class Product extends MathElement {
  constructor(subElements) {
    super();
    this._subElements = Array.from(subElements);
    if (this._subElements.length === 0) {
      return new IntConstant(1);
    }
    if (this._subElements.length === 1) {
      return this._subElements[0];
    }
  }

  getSubElements() {
    return this._subElements.slice();   // copy it
  }

  toString() {
    return this.getSubElements()
      .map(elem => toStringWithParens(this, elem))
      .join('*');
  }
}
Product.precedence = Precedences.PRODUCT;


// represents things separated with + or - characters
// -x is represented as: new Sum([ { elem: x, sign: '-' } ])
export class Sum extends MathElement {
  // elemsAndSigns should contain items like this:
  // { elem: someMathElement, sign: '+' or '-' }
  constructor(elemsAndSigns) {
    super();
    this._elemsAndSigns = Array.from(elemsAndSigns);

    for (const { elem, sign } of this._elemsAndSigns) {
      if (sign !== '+' && sign !== '-') {
        throw new Error("invalid sign: " + sign);
      }
    }

    if (this._elemsAndSigns.length === 0) {
      return new IntConstant(0);
    }
    if (this._elemsAndSigns.length === 1 && this._elemsAndSigns[0].sign === '+') {
      return this._elemsAndSigns[0].elem;
    }
  }

  getSubElements() {
    return this._elemsAndSigns.map(item => item.elem);
  }

  getSubElementsAndSigns() {
    return this._elemsAndSigns.slice();   // copy it
  }

  toString() {
    return this.getSubElementsAndSigns()
      .flatMap(elemSign => [ elemSign.sign, toStringWithParens(this, elemSign.elem) ])
      .filter((string, index) => !(index === 0 && string === '+'))
      .join(' ');
  }
}
Sum.precedence = Precedences.SUM;
