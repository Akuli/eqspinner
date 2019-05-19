import * as mathElems from  './math-elems.js';


// in this code, callbackResult means one of:
//    * null:                       nothing done
//    * a math element:             same as wrapping it in an array of 1 element
//    * an array of math elements:  something was done, these elements should be selected
//
// the callbacks can return any of these
class Action {
  constructor(kind, name, keyBinding, callback) {
    this._kind = kind;
    this.name = name;
    this.keyBinding = keyBinding;
    this._callback = callback;
  }

  static ofSingleElement(name, keyBinding, callback) {
    return new this({ id: 'singleElement' }, name, keyBinding, callback);
  }

  static ofNChildElements(name, keyBinding, n, callback) {
    return new this({ id: 'nChildElements', n: n }, name, keyBinding, callback);
  }

  // returns a Selection.select() argument array, or null for nothing done
  run(selection) {
    if (this._kind.id === 'singleElement') {
      let somethingDone = false;
      const toSelect = selection.getSelectedElements().flatMap(elem => {
        const callbackResult = this._callback(elem);
        if (callbackResult === null) {
          return elem;
        }

        somethingDone = true;
        return callbackResult;
      });

      if (!somethingDone) {
        // toSelect should have same content as selection.getSelectedElements()
        return null;
      }
      return toSelect;
    }

    if (this._kind.id === 'nChildElements') {
      const selected = selection.getSelectedElements();

      // TODO: if user wants to swap x and y of xy, and has selected the whole xy
      //       handle that correctly, and figure out how it generalizes for n > 2
      if (selected.length !== this._kind.n) {
        return null;
      }

      const parentSet = new Set(selected.map(el => el.parent));
      if (parentSet.size !== 1) {
        return null;
      }

      const callbackResult = this._callback(...parentSet, ...selected);
      if (callbackResult === null) {
        return null;
      }
      return [].concat(callbackResult);
    }

    throw new Error("unknown action kind: " + this._kind.id);
  }
}


const expand = Action.ofSingleElement('Expand', 'E', elem => {
  // a(b + c)d  -->  abd + acd
  if (elem instanceof mathElems.Product) {
    const firstSumIndex = elem.getChildElements().findIndex(child => (child instanceof mathElems.Sum));
    if (firstSumIndex === -1) {
      return null;
    }

    const before = elem.getChildElements().slice(0, firstSumIndex);
    const firstSum = elem.getChildElements()[firstSumIndex];
    const after = elem.getChildElements().slice(firstSumIndex+1);

    const newElem = new mathElems.Sum(
      firstSum.getChildElements()
        .map(el => [...before, el, ...after])
        .map(elArray => elArray.map( el => el.copy() ))
        .map(factorArray => new mathElems.Product(factorArray))
    );
    elem.parent.replace(elem, newElem);
    return [newElem];
  }

  return null;
});


const unnest = Action.ofSingleElement('Unnest', 'U', elem => {
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
});


const bringMinusToFront = Action.ofSingleElement('Bring minus to front', 'B', elem => {
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
});


const bringMinusInside = Action.ofSingleElement('Undo bringing minus to front', 'Shift+B', elem => {
  if (!( (elem instanceof mathElems.Negation) && (elem.inner instanceof mathElems.Product) )) {
    return null;
  }

  const getsMinus = elem.inner.getChildElements()[0];
  elem.inner.replace(getsMinus, new mathElems.Negation(getsMinus.copy()));
  const productCopy = elem.inner.copy();
  elem.parent.replace(elem, productCopy);
  return productCopy;
});


const swap = Action.ofNChildElements('Swap', 'S', 2, (parent, child1, child2) => {
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
});


function minWithKey(array, key) {
  // TODO: more efficient implementation without sorting the whole shit with a key function?
  return array.slice().sort((a,b) => key(a) - key(b))[0];
}

const cancel = Action.ofNChildElements('Cancel', 'C', 2, (parent, child1, child2) => {
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
});


export const ACTIONS = [
  expand,
  unnest,
  bringMinusToFront,
  bringMinusInside,
  swap,
  cancel,
];
