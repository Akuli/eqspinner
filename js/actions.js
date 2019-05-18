import * as mathElems from  './math-elems.js';


export const ActionKind = {
  SINGLE_ELEM: 1,
};


// the functions return a new Selection.select() array, or null for nothing done

function unnest(elem) {
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
}


function expand(elem) {
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
}


class Action {
  constructor(name, keyBinding, kind, callback) {
    this.name = name;
    this.keyBinding = keyBinding;
    this._kind = kind;
    this._callback = callback;
  }

  run(selection) {
    if (this._kind === ActionKind.SINGLE_ELEM) {
      const toSelect = selection.getSelectedElements()
        .map(this._callback)
        .filter(callbackResult => callbackResult !== null)
        .flat(1);
      if (toSelect.length === 0) {
        return null;
      }
      return toSelect;
    }

    throw new Error("unknown kind " + this._kind);
  }
}


export const ACTIONS = [
  new Action('Expand', 'e', ActionKind.SINGLE_ELEM, expand),
  new Action('Unnest', 'u', ActionKind.SINGLE_ELEM, unnest),
];
