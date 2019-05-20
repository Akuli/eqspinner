/*
design notes:
  * MathElements are not html dom elements
  * in the MathElement representing x+x, the x's are DIFFERENT objects
    this way there's no need to keep track of a MathElement and its location
    because each MathElement is in only one location
    both x objects are created with "new Symbol('x')", which must be done twice
    there is a .equals() method that can be used for comparing the x objects
  * all MathElements except Container are immutable
    or at least you should never mutate them
    or at least you should never mutate anything else than .parent
  * Container elements are mutable
    their child elements can be changed on-the-fly
*/

const Precedences = {
  EVERYTHING_CONTAINER: -10,
  SUM_AND_NEGATION: 0,
  PRODUCT: 1,
  FRACTION: 2,
  POWER: 3,
  NEVER_PARENTHESIZE: 10,
};


function toAsciiMathWithParens(childElem) {
  if (childElem.parent.childNeedsParens(childElem, 'asciimath')) {
    return '(' + childElem.toAsciiMath() + ')';
  }
  return childElem.toAsciiMath();
}


export class MathElement {
  constructor() {
    this.parent = null;
  }

  getChildElements() {
    return [];
  }

  // this doesn't get called automagically, only with explicit something.equals(something)
  //
  // must be an equivalence relation; that is, for all MathElements a,b,c:
  //  * a.equals(a)                                       (reflexive)
  //  * if a.equals(b), then b.equals(a)                  (symmetric)
  //  * if a.equals(b) and b.equals(c), then a.equals(c)  (transitive)
  equals(that) {
    throw new Error("wasn't overrided");
  }

  // a.copy().equals(a) must be always true, but a.copy() === a must be false
  copy() {
    throw new Error("wasn't overrided");
  }

  toAsciiMath() {
    throw new Error("toAsciiMath wasn't overrided");
  }

  // think of this as something that returns debugging information
  // e.g. console.log(someElement + '');
  // use .toAsciiMath() directly when you need it
  toString() {
    return this.toAsciiMath();
  }
}
MathElement.precedence = Precedences.NEVER_PARENTHESIZE;


// e.g. x
export class Symbol extends MathElement {
  constructor(name) {
    super();
    this.name = name;
  }

  toAsciiMath() {
    return this.name;
  }

  equals(that) {
    return (that instanceof Symbol) && this.name === that.name;
  }

  copy() {
    return new Symbol(this.name);
  }
}


// e.g. 3, but not -3, that would be: new Negation(new IntConstant(3))
export class IntConstant extends MathElement {
  constructor(jsNumber) {
    super();
    if (!Number.isInteger(jsNumber)) {
      throw new Error("not an integer: " + jsNumber);
    }
    if (jsNumber < 0) {
      return new Negation(new IntConstant(Math.abs(jsNumber)));
    }
    this.jsNumber = jsNumber;
  }

  toAsciiMath() {
    return this.jsNumber + '';
  }

  equals(that) {
    return (that instanceof IntConstant) && this.name === that.name;
  }

  copy() {
    return new IntConstant(this.jsNumber);
  }
}


function arrayEquals(a, b, key) {
  return a.length === b.length && a.every((junk, i) => key(a[i], b[i]));
}


// subclasses must provide a .copy(), and that must do a recursive copy
class Container extends MathElement {
  getChildElements() {
    throw new Error("getChildElements wasn't overrided");
  }

  replace(oldChild, newChild) {
    throw new Error("replace wasn't overrided");
  }

  _childHasBeenAdded(child) {
    if (child.parent !== null) {
      throw new Error(`cannot add element to 2 places: ${child} ${child.constructor.name} is already in ${child.parent} ${child.parent.constructor.name}, would be added to ${this} ${this.constructor.name}`);
    }
    child.parent = this;
  }

  _childWillBeRemoved(child) {
    if (child.parent !== this) {
      throw new Error(`cannot remove the child element ${child}, it hasn't been added`);
    }
    child.parent = null;
  }

  // forWhatPurpose is 'display' or 'asciimath'
  childNeedsParens(child, forWhatPurpose) {
    if (child.parent !== this) {
      throw new Error("childNeedsParens called for non-child");
    }
    return (this.constructor.precedence >= child.constructor.precedence);
  }

  equals(that) {
    // instanceof might not be symmetric because inheritance, that's why === with constructors
    return (this.constructor === that.constructor &&
            arrayEquals( this.getChildElements(), that.getChildElements(), (a,b) => a.equals(b) ));
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
    if (nameArray.length === 0) {
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

  copy() {
    return new this.constructor(...( this.getChildElements().map(elem => elem.copy()) ));
  }
}


// all elements are wrapped into one of these
export class EverythingContainer extends FixedNumberOfChildElementsContainer {
  toAsciiMath() {
    return this.content.toAsciiMath();
  }
}
EverythingContainer._setNames(['content']);
EverythingContainer.precedence = Precedences.EVERYTHING_CONTAINER;


// -something
export class Negation extends FixedNumberOfChildElementsContainer {
  toAsciiMath() {
    return '-' + toAsciiMathWithParens(this.inner);
  }
}
Negation._setNames(['inner']);
Negation.precedence = Precedences.SUM_AND_NEGATION;


// something/something
export class Fraction extends FixedNumberOfChildElementsContainer {
  toAsciiMath() {
    return toAsciiMathWithParens(this.numer) + '/' + toAsciiMathWithParens(this.denom);
  }
}
Fraction._setNames(['numer', 'denom']);
Fraction.precedence = Precedences.FRACTION;


// something^something
export class Power extends FixedNumberOfChildElementsContainer {
  toAsciiMath() {
    return toAsciiMathWithParens(this.base) + '^' + toAsciiMathWithParens(this.exponent);
  }

  childNeedsParens(child, forWhatPurpose) {
    if (child === this.exponent && forWhatPurpose === 'display') {
      /*
                b             /  b \
               a              \ a  /
      display x   instead of x
      */
      return false;
    }
    return super.childNeedsParens(child, forWhatPurpose);
  }
}
Power._setNames(['base', 'exponent']);
Power.precedence = Precedences.POWER;


export class List extends Container {
  constructor(children) {
    super();
    if (children.length === 0) {
      return this._createEmptyValue();
    }
    if (children.length === 1) {
      return children[0];
    }

    this._children = [];
    for (const child of children) {
      this.appendChildElement(child);
    }
  }

  _createEmptyValue() {
    throw new Error("wasn't overrided");
  }

  getChildElements() {
    return this._children.slice();   // copy it
  }

  insertChildElement(index, child) {
    if (index < 0 || index > this._children.length) {
      throw new Error("invalid index: " + index);
    }

    this._children.splice(index, 0, child);
    this._childHasBeenAdded(child);
  }

  appendChildElement(child) {
    this.insertChildElement(this._children.length, child);
  }

  removeChildElements(children) {
    // see end of this method for reason
    if (this.parent === null) {
      throw new Error("cannot remove from a List that hasn't been added to a parent");
    }

    if (!children.every(child => this._children.includes(child))) {
      throw new Error("child to remove not found, trying to remove: " + children);
    }

    children
      .map(child => this._children.indexOf(child))
      .sort((a,b) => b-a)   // biggest index first
      .forEach(i => {
        this._childWillBeRemoved(this._children[i]);
        this._children.splice(i, 1);
      });

    // because empty and 1-element Lists would create very annoying corner cases
    if (this._children.length === 0) {
      this.parent.replace(this, this._createEmptyValue());
    }
    if (this._children.length === 1) {
      const child = this._children[0];
      this._childWillBeRemoved(child);
      this._children.length = 0;
      this.parent.replace(this, child);
    }
  }

  replace(oldChild, newChild) {
    const i = this._children.indexOf(oldChild);
    if (i === -1) {
      throw new Error("old child element not found: " + oldChild);
    }

    this._childWillBeRemoved(oldChild);
    this._children[i] = newChild;
    this._childHasBeenAdded(newChild);
  }

  copy() {
    return new this.constructor( this.getChildElements().map(elem => elem.copy()) );
  }
}


// something*something*...*something
export class Product extends List {
  _createEmptyValue() {
    return new IntConstant(1);
  }

  toAsciiMath() {
    // TODO: prevent stuff like s*i*n = sin
    return this.getChildElements().map(toAsciiMathWithParens).join('');
  }
}
Product.precedence = Precedences.PRODUCT;


// something + something + ... + something
// x-y is represented as: new Sum([ x, new Negation(y) ])
export class Sum extends List {
  _createEmptyValue() {
    return new IntConstant(0);
  }

  childNeedsParens(child, forWhatPurpose) {
    if (child instanceof Negation) {
      return false;
    }
    return super.childNeedsParens(child, forWhatPurpose);
  }

  toAsciiMath() {
    return this.getChildElements()
      .map(elem => (elem instanceof Negation) ? ['-', elem.inner] : ['+', elem])
      .flatMap(( [sign,elem] ) => [sign, toAsciiMathWithParens(elem)])
      .filter((string, index) => !(index === 0 && string === '+'))
      .join(' ');
  }
}
Sum.precedence = Precedences.SUM_AND_NEGATION;
