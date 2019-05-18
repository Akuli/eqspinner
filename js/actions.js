import * as mathElems from  './math-elems.js';


export const ActionKind = {
  SINGLE_ELEM: 1,
};


class Action {
  constructor(name, keyBinding, kind, callback) {
    this.name = name;
    this.keyBinding = keyBinding;
    this._kind = kind;
    this._callback = callback;
  }

  // returns a Selection.select() argument array, or null for nothing done
  run(selection) {
    if (this._kind === ActionKind.SINGLE_ELEM) {
      let somethingDone = false;
      const toSelect = selection.getSelectedElements().map(elem => {
        const callbackResult = this._callback(elem);
        if (callbackResult === null) {
          return [elem];
        }

        somethingDone = true;
        return callbackResult;
      }).flat(1);

      if (!somethingDone) {
        // toSelect should have same content as selection.getSelectedElements()
        return null;
      }
      return toSelect;
    }

    throw new Error("unknown kind " + this._kind);
  }
}


const expand = new Action('Expand', 'e', ActionKind.SINGLE_ELEM, elem => {
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


const unnest = new Action('Unnest', 'u', ActionKind.SINGLE_ELEM, elem => {
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


const bringMinusToFront = new Action('Bring minus to front', 'b', ActionKind.SINGLE_ELEM, elem => {
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


export const ACTIONS = [
  expand,
  unnest,
  bringMinusToFront,
];
