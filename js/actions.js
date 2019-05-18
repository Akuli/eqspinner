import * as mathElems from  './math-elems.js';


// the functions return a new Selection.select() array, or null for nothing done

function unnest(elem) {
  if (!( (elem.parent instanceof mathElems.List) && (elem instanceof elem.parent.constructor) )) {
    return null;
  }

  const first = elem.getChildElements()[0];
  const rest = elem.getChildElements().slice(1);
  const parent = elem.parent;
  const firstIndex = parent.getChildElements().indexOf(elem);

  parent.replace(elem, first.copy());
  rest.forEach((notFirst, indexOffset) => {
    parent.insertChildElement(firstIndex + 1 + indexOffset, notFirst.copy());
  });
  return [parent];
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


export const ACTIONS = [
  {
    name: "Expand",
    keyBinding: 'e',
    callback: selection => {
      if (selection.getSelectedElements().length !== 1) {
        return false;
      }
      return expand(selection.getSelectedElements()[0]);
    },
  },
  {
    name: "Unnest",
    keyBinding: 'u',
    callback: selection => {
      if (selection.getSelectedElements().length !== 1) {
        return false;
      }
      return unnest(selection.getSelectedElements()[0]);
    },
  },
];
