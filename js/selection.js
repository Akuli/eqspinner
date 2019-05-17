/*
there are 3 kinds of selections:
  * 1 element selected
  * 2 child elements of same parent element selected
  * 3 or more ADJACENT child elements (they are all next to each other) selected
*/

function containsDuplicates(array) {
  return (new Set(array)).size < array.length;
}

function allElementsAreSame(array) {
  return (new Set(array)).size < 2;
}

function arrayEquals(array1, array2) {
  return array1.length === array2.length && array1.every((elem1, i) => (elem1 === array2[i]));
}


// this is thrown for errors that can be caused by the user
// plain Error is used for other, "unexpected" errors
export class SelectError extends Error { }

export class Selection extends EventTarget {
  constructor(parentOfEverythingElement) {
    super();
    if (parentOfEverythingElement.parent !== null) {
      throw new Error("expected the parent-of-everything element, but got " + parentOfEverythingElement);
    }
    this._parentOfEverythingElement = parentOfEverythingElement;
    this._selectedElements = [parentOfEverythingElement];
  }

  getSelectedElements() {
    return this._selectedElements.slice();   // copy it
  }

  // returns a valid array
  _validateElementArray(array) {
    if (array.includes(null)) {
      throw new Error("unexpected null");
    }

    if (array.length === 0) {
      throw new SelectError("can't select []");
    }

    if (array[0].parent === null &&
        !(array.length === 1 && array[0] === this._parentOfEverythingElement)) {
      throw new SelectError(array[0] + " is not the parent-of-everything element or a child of another element");
    }
    if (array.length === 1) {
      return array.slice();   // make copy
    }

    if (containsDuplicates(array)) {
      throw new SelectError("selection array contains duplicate elements");
    }
    if (!allElementsAreSame(array.map(elem => elem.parent))) {
      throw new SelectError("selection elements have different parents");
    }

    // if the array is not adjacent, then see if it can be rearranged to make it adjacent
    // TODO: test this shit!
    const theParent = array[0].parent;  // same for all elements, checked above
    const childrenOfTheParent = theParent.getChildElements();   // superstitious optimization
    const indexArray = array.map(child => childrenOfTheParent.indexOf(child));
    if (indexArray.includes(-1) || containsDuplicates(indexArray)) {
      throw new Error("oopsie doopsie woopsie hoopsie! something went wrong! ding dang dong!");
    }
    indexArray.sort((a,b) => (a-b));    // sort by numeric value, default would put '10' before '2'

    if (array.length > 2) {
      // check if indexArray is like [2,3,4] and not like [2,4,5] or something
      // by looping over pairs
      const pairs = indexArray.slice(0, -1).map((i, indexOfIndexLolThisIsMeta) => [ i, indexArray[indexOfIndexLolThisIsMeta+1] ]);
      if (!pairs.every( ([i,j]) => i+1 === j )) {
        throw new SelectError("elements are not adjacent");
      }
    }

    const nicelySorted = indexArray.map(i => childrenOfTheParent[i]);

    if (arrayEquals(nicelySorted, theParent.getChildElements())) {
      // all child elements are selected
      return [theParent];
    }
    return nicelySorted;
  }

  select(elementArray) {
    // usually i don't add type checks, but this one feels like it's easy to get wrong
    if (!(elementArray instanceof Array)) {
      throw new Error("expected an array");
    }

    this._selectedElements = this._validateElementArray(elementArray);
    this.dispatchEvent(new CustomEvent('Select'));
  }

  selectChild() {
    const children = this.getSelectedElements()[0].getChildElements();
    if (children.length === 0) {
      throw new SelectError("cannot go 'deeper'");
    }
    this.select([ children[0] ]);
  }

  selectParent() {
    const parentToSelect = this.getSelectedElements()[0].parent;
    if (parentToSelect === null) {
      throw new SelectError("parentmost element is already selected");
    }
    this.select([parentToSelect]);
  }

  selectPreviousOrNextSibling(plusMinus1, addInsteadOfReplacing = false) {
    const currentlySelected = this.getSelectedElements()[0];    // TODO: don't hard-code 0
    if (currentlySelected.parent === null) {
      throw new SelectError("no siblings");
    }

    const siblingArray = currentlySelected.parent.getChildElements();
    const currentIndex = siblingArray.indexOf(currentlySelected);
    if (currentIndex === -1) {
      throw new Error("issues with .parent and .getChildElements()");
    }

    const newIndex = currentIndex + plusMinus1;
    if (newIndex < 0 || newIndex >= siblingArray.length) {
      throw new SelectError("already selected all the way to an end (don't know how to explain better)");
    }

    if (addInsteadOfReplacing) {
      this.select([ currentlySelected, siblingArray[newIndex] ]);
    } else {
      this.select([ siblingArray[newIndex] ]);
    }
  }
}
