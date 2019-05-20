import * as mathElems from  './math-elems.js';
import { ModalDialog } from './modal-dialog.js';
import * as asciiMathParser from './asciimath-parser.js';
import { Renderer } from './renderer.js';


// in this code, callbackResult means one of:
//    * null:                       nothing done
//    * a math element:             same as wrapping it in an array of 1 element
//    * an array of math elements:  something was done, these elements should be selected
//
// callback or this._callback means a function that can return any of these
class Action {
  constructor(kind, name, keyBinding, callback) {
    this._kind = kind;
    this.name = name;
    this.keyBinding = keyBinding;
    this._callback = async(...args) => {
      const result = callback(...args);
      return (result instanceof Promise) ? (await result) : result;
    };
  }

  static ofSingleElement(name, keyBinding, callback) {
    return new this({ id: 'singleElement' }, name, keyBinding, callback);
  }

  // singleElement loops through all the selected elements if more than 1 element is selected
  // this does nothing in that case
  static ofSingleElementReally(name, keyBinding, callback) {
    return new this({ id: 'singleElementReally' }, name, keyBinding, callback);
  }

  static ofNChildElements(name, keyBinding, n, callback) {
    if (n < 2) {
      throw new Error("n must be 2 or greater");
    }
    return new this({ id: 'nChildElements', n: n }, name, keyBinding, callback);
  }

  static ofTwoOrMoreChildElements(name, keyBinding, callback) {
    return new this({ id: 'twoOrMoreChildElements' }, name, keyBinding, callback);
  }

  // returns a Selection.select() argument array, or null for nothing done
  async run(selection) {
    const selected = selection.getSelectedElements()

    if (this._kind.id === 'singleElement' || this._kind.id === 'singleElementReally') {
      if (this._kind.id === 'singleElementReally' && selected.length > 1) {
        return null;
      }

      let somethingDone = false;

      const toSelect = (await Promise.all(selected.map(async(elem) => {
        const callbackResult = await this._callback(elem);
        if (callbackResult === null) {
          return elem;
        }

        somethingDone = true;
        return callbackResult;
      }))).flat(1);

      if (!somethingDone) {
        // toSelect should have same content as selection.getSelectedElements()
        return null;
      }
      return toSelect;
    }

    if (this._kind.id === 'nChildElements') {
      // TODO: if user wants to swap x and y of xy, and has selected the whole xy
      //       handle that correctly, and figure out how it generalizes for n > 2
      if (selected.length !== this._kind.n) {
        return null;
      }

      const parentSet = new Set(selected.map(el => el.parent));
      if (parentSet.size !== 1) {
        return null;
      }

      const callbackResult = await this._callback(...parentSet, ...selected);
      if (callbackResult === null) {
        return null;
      }
      return [].concat(callbackResult);
    }

    if (this._kind.id === 'twoOrMoreChildElements') {
      const byParent = selected.reduce(
        (map, el) => (map.get(el.parent).push(el), map),
        new Map( selected.map(el => el.parent).map(parent => [parent, []]) ),
      );

      let somethingDone = false;
      const toSelect = (await Promise.all([ ... byParent.entries() ].map( async([parent, children]) => {
        if (children.length < 2) {
          return children;
        }

        const callbackResult = await this._callback(parent, children);
        if (callbackResult === null) {
          return children;
        }

        somethingDone = true;
        return callbackResult;
      }))).flat(1);

      if (!somethingDone) {
        return null;
      }
      return toSelect;
    }

    throw new Error("unknown action kind: " + this._kind.id);
  }
}


export const ACTIONS = [];


ACTIONS.push(Action.ofSingleElement('Unnest', 'U', elem => {
  if (!( (elem.parent instanceof mathElems.List) && (elem instanceof elem.parent.constructor) )) {
    return null;
  }

  const children = elem.getChildElements();
  const childCopies = elem.getChildElements().map(el => el.copy());
  const parent = elem.parent;
  const firstIndex = parent.getChildElements().indexOf(elem);

  childCopies.forEach((childCopy, index) => {
    if (index === 0) {
      parent.replace(elem, childCopy);
    } else {
      parent.insertChildElement(firstIndex + index, childCopy);
    }
  });
  return childCopies;
}));


// returns the resulting element (a copy), or null for nothing done
function expandSumInProductToSumParts(elem) {
  if (elem instanceof mathElems.Sum) {
    return elem.getChildElements().map(el => el.copy());
  }
  if (!(elem instanceof mathElems.Product)) {
    return null;
  }

  const firstSumIndex = elem.getChildElements().findIndex(child => (child instanceof mathElems.Sum));
  if (firstSumIndex === -1) {
    return null;
  }

  const before = elem.getChildElements().slice(0, firstSumIndex);
  const firstSum = elem.getChildElements()[firstSumIndex];
  const after = elem.getChildElements().slice(firstSumIndex+1);

  return firstSum.getChildElements()
    .map(el => [...before, el, ...after])
    .map(elArray => elArray.map( el => el.copy() ))
    .map(factorArray => new mathElems.Product(factorArray));
}

// TODO: should this work on elements of products instead of products themselves?
// that would allow expanding just (a+b)c of (a+b)cde
// at least this should behave similarly as factor!
ACTIONS.push(Action.ofSingleElement('Expand', 'E', elem => {
  let sumParts = null;

  // a(b + c)d  -->  abd + acd
  if (elem instanceof mathElems.Product) {
    sumParts = expandSumInProductToSumParts(elem);
  }
  // -(a+b)c --> -ac-bc
  else if (elem instanceof mathElems.Negation) {
    sumParts = expandSumInProductToSumParts(elem.inner);
    if (sumParts !== null) {
      sumParts = sumParts.map(part => new mathElems.Negation(part));
    }
  }

  if (sumParts === null) {
    return null;
  }

  const result = new mathElems.Sum(sumParts);
  elem.parent.replace(elem, result);
  return result;
}));


function getFactors(elem) {
  if (elem instanceof mathElems.Product) {
    return elem.getChildElements();
  }
  return [elem];
}

// returns a copy
function removeFactors(elem, badFactors) {
  const negated = elem instanceof mathElems.Negation;
  if (negated) {
    elem = elem.inner;
  }

  const factors = getFactors(elem);
  for (const bad of badFactors) {
    const index = factors.findIndex(factor => factor.equals(bad));
    if (index === -1) {
      throw new Error("bad factor not found");
    }
    factors.splice(index, 1);
  }

  const result = new mathElems.Product( factors.map(factor => factor.copy()) );
  return negated ? (new mathElems.Negation(result)) : result;
}


ACTIONS.push(Action.ofTwoOrMoreChildElements('Factor', 'F', (parent, children) => {
  if (!(parent instanceof mathElems.Sum)) {
    return null;
  }

  const factoringOutMinus = children.every(child => child instanceof mathElems.Negation);

  // values represent factors that have not been factored out yet  (*)
  // this is important when there are duplicate factors
  const factorArrays = new Map(children.map( child => [
    child, getFactors((child instanceof mathElems.Negation) ? child.inner : child)
  ] ));

  let commonFactors = [];
  for (const possibleCommonFactor of factorArrays.get(children[0]).slice()) {
    if ([... factorArrays.values() ].every(
          factorArray => factorArray.some(
            factor => factor.equals(possibleCommonFactor)))) {
      commonFactors.push(possibleCommonFactor);
      for (const factorArray of factorArrays.values()) {
        const i = factorArray.findIndex(factor => factor.equals(possibleCommonFactor));
        if (i === -1) {
          throw new Error("wut");
        }
        factorArray.splice(i, 1);   // (*)
      }
    }
  }

  if (commonFactors.length === 0 && !factoringOutMinus) {
    return null;
  }

  let sumTerms = children.map(child => removeFactors(child, commonFactors));
  if (factoringOutMinus) {
    sumTerms = sumTerms.map(term => {
      if (!(term instanceof mathElems.Negation)) {
        throw new Error("wut");
      }
      return term.inner.copy();
    });
  }

  let factored = new mathElems.Product([
    new mathElems.Sum(sumTerms),
    ... commonFactors.map(factor => factor.copy())
  ]);
  if (factoringOutMinus) {
    factored = new mathElems.Negation(factored);
  }

  parent.replace(children[0], factored);
  parent.removeChildElements(children.slice(1));
  return factored;
}));


ACTIONS.push(Action.ofSingleElement('Bring minus to front', 'B', elem => {
  if ( !(elem instanceof mathElems.Product)) {
    return null;
  }

  const children = elem.getChildElements();
  const firstMinusIndex = children.findIndex(el => (el instanceof mathElems.Negation));
  if (firstMinusIndex === -1) {
    return null;
  }

  elem.replace(children[firstMinusIndex], children[firstMinusIndex].inner.copy());
  const newNegation = new mathElems.Negation(elem.copy());
  elem.parent.replace(elem, newNegation);
  return newNegation;
}));


ACTIONS.push(Action.ofSingleElement('Undo bringing minus to front', 'Shift+B', elem => {
  if (!( (elem instanceof mathElems.Negation) && (elem.inner instanceof mathElems.Product) )) {
    return null;
  }

  const getsMinus = elem.inner.getChildElements()[0];
  elem.inner.replace(getsMinus, new mathElems.Negation(getsMinus.copy()));
  const productCopy = elem.inner.copy();
  elem.parent.replace(elem, productCopy);
  return productCopy;
}));


ACTIONS.push(Action.ofNChildElements('Swap', 'S', 2, (parent, child1, child2) => {
  if (!(parent instanceof mathElems.List)) {
    return null;
  }

  const tempChild1 = new mathElems.IntConstant(0);
  const tempChild2 = new mathElems.IntConstant(0);
  parent.replace(child1, tempChild1);
  parent.replace(child2, tempChild2);
  parent.replace(tempChild1, child2);
  parent.replace(tempChild2, child1);
  return [child1, child2];
}));


function minWithKey(array, key) {
  if (array.length === 0) {
    throw new Error("cannot find min element of []");
  }
  return array.reduce((a,b) => ( key(a)<key(b) ? a : b ), array[0]);
}

ACTIONS.push(Action.ofNChildElements('Cancel', 'C', 2, (parent, child1, child2) => {
  if (parent instanceof mathElems.Sum) {
    if (!( ((child1 instanceof mathElems.Negation) && child1.inner.equals(child2)) ||
           ((child2 instanceof mathElems.Negation) && child2.inner.equals(child1)) )) {
      return null;
    }
  } else {    // TODO: division canceling
    return null;
  }

  // try to find a neighbor element to select after removing
  const childArray = parent.getChildElements();
  const i1 = childArray.indexOf(child1);
  const i2 = childArray.indexOf(child2);
  const neighbors = new Set( [i1,i2].flatMap(i => [childArray[i-1], childArray[i+1]]) );
  neighbors.delete(undefined);
  neighbors.delete(child1);
  neighbors.delete(child2);

  const toSelect = (neighbors.size === 0) ? [] :
    minWithKey(Array.from(neighbors), child=>childArray.indexOf(child));
  parent.removeChildElements([ child1, child2 ]);
  return toSelect;
}));


ACTIONS.push(Action.ofSingleElementReally('Manual edit', 'M', async(elem) => {
  const dialog = new ModalDialog("Manual edit", ["Apply", "Cancel"]);
  const applyButton = dialog.buttons["Apply"];

  dialog.contentDiv.innerHTML = '<input class="asciimath-edit"></input>';
  const input = dialog.contentDiv.firstElementChild;
  input.value = elem.toAsciiMath();
  const renderer = new Renderer();

  function onChanged() {
    if (!dialog.contentDiv.lastElementChild.classList.contains('asciimath-edit')) {
      dialog.contentDiv.removeChild(dialog.contentDiv.lastElementChild);
    }

    let parsed;
    try {
      parsed = asciiMathParser.parse(input.value);
    } catch(e) {
      if (!(e instanceof asciiMathParser.ParsingError)) {
        throw e;
      }

      const p = document.createElement('p');
      p.classList.add('asciimath-edit-error-message');
      p.textContent = "Cannot parse math:\n" + e.message;
      dialog.contentDiv.appendChild(p);
      applyButton.disabled = true;
      return;
    }

    applyButton.disabled = false;
    dialog.contentDiv.appendChild(renderer.render(parsed));
  }

  input.addEventListener('input', onChanged);
  input.addEventListener('keypress', event => {
    if (event.key === 'Enter') {
      dialog.pressButton("Apply");
      event.preventDefault();
    }
    console.log(event.key);
  });
  onChanged();

  // no idea why a timeout is needed, but it won't work without this :D
  window.setTimeout(() => {
    input.focus();
    input.select();
  }, 50);

  if ((await dialog.run()) === "Apply") {
    const replacingElement = asciiMathParser.parse(input.value);
    elem.parent.replace(elem, replacingElement);
    return replacingElement;
  }
  return null;
}));
