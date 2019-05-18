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


function getParentsRecursive(elem) {
  const result = [];
  for (let el = elem; el !== null; el = el.parent) {
    result.push(el);
  }
  return result;
}


// this is thrown for errors that can be caused by the user
// plain Error is used for other, "unexpected" errors
export class SelectError extends Error {
  constructor(message) {
    super(message);
    this.name = this.constructor.name;
  }
}


function cleanUpElementArray(array) {
  // remove duplicates and nested elements, sort consistently
  const result = Array.from(new Set(array));
  const nestedInsideSomethingElseThatIsAlsoSelected = new Set();

  result.sort((a, b) => {
    const aParents = getParentsRecursive(a);
    const bParents = getParentsRecursive(b);
    let commonParent;
    while (aParents[aParents.length - 1] === bParents[bParents.length - 1]) {
      // aParents.pop() and bParents.pop() return the same thing
      commonParent = aParents.pop();
      bParents.pop();
    }

    if (aParents.length === 0 && bParents.length === 0) {
      throw new Error("duplicates didn't get removed");
    }

    // if these run, then indexOf will return -1 at the end for either a or b, but not both
    // this creates a consistent ordering: nonNegative - (-1) > 0, (-1) - nonNegative < 0
    if (aParents.length === 0) {
      nestedInsideSomethingElseThatIsAlsoSelected.add(b);
    }
    if (bParents.length === 0) {
      nestedInsideSomethingElseThatIsAlsoSelected.add(a);
    }

    const children = commonParent.getChildElements();
    if (children.indexOf(undefined) !== -1) {
      throw new Error("there is an 'undefined' child element");
    }

    const aParent = aParents[aParents.length - 1];    // may be undefined
    const bParent = bParents[bParents.length - 1];    // may be undefined
    return children.indexOf(aParent) - children.indexOf(bParent);
  });

  return result.filter(elem => !nestedInsideSomethingElseThatIsAlsoSelected.has(elem));
}


export class Selection extends EventTarget {
  constructor(parentOfEverythingElement) {
    super();
    if (parentOfEverythingElement.parent !== null) {
      throw new Error("expected the parent-of-everything element, but got " + parentOfEverythingElement);
    }
    this._parentOfEverythingElement = parentOfEverythingElement;

    this._selectedElements = null;
    this.select([]);
  }

  getSelectedElements() {
    return this._selectedElements.slice();   // copy it
  }

  select(elementArray) {
    // usually i don't add type checks, but this one feels like it's easy to get wrong
    if (!(elementArray instanceof Array)) {
      throw new Error("expected an array");
    }

    this._selectedElements = cleanUpElementArray(elementArray);
    this.dispatchEvent(new CustomEvent('Select'));
  }

  // runs callback(each selected element) and selects the elements it returns instead
  // the callback should return an element, or an array of elements
  selectionMap(callback) {
    this.select(this._selectedElements.flatMap(callback));
  }

  selectParentOfEverythingElement() {
    this.select([this._parentOfEverythingElement]);
  }

  _selectSomething() {
    if (this._selectedElements.length === 0) {
      this.selectParentOfEverythingElement();
    }
  }

  selectChild() {
    this._selectSomething();
    this.selectionMap(element => {
      const children = element.getChildElements();
      if (children.length === 0) {
        return element;
      }
      return children[0];
    });
  }

  selectParent() {
    this._selectSomething();
    this.selectionMap(element => (element.parent === null) ? element : element.parent);
  }

  selectPreviousOrNextSibling(plusMinus1, onlyForThisElement = null, selectMoreInsteadOfReplacing = false) {
    this._selectSomething();

    if (selectMoreInsteadOfReplacing) {
      if (onlyForThisElement !== null) {
        throw new Error("onlyForThisElement must be null when using selectMoreInsteadOfReplacing");
      }
      if (plusMinus1 === -1) {
        onlyForThisElement = this._selectedElements[0];
      } else {
        onlyForThisElement = this._selectedElements[this._selectedElements.length - 1];
      }
    }

    this.selectionMap(element => {
      if (element.parent === null || (onlyForThisElement !== null && element !== onlyForThisElement)) {
        return element;
      }

      const siblingArray = element.parent.getChildElements();
      const currentIndex = siblingArray.indexOf(element);
      if (currentIndex === -1) {
        throw new Error("issues with .parent and .getChildElements()");
      }

      const newIndex = currentIndex + plusMinus1;
      if (newIndex < 0 || newIndex >= siblingArray.length) {
        return element;
      }

      if (selectMoreInsteadOfReplacing) {
        return [ element, siblingArray[newIndex] ];
      }
      return siblingArray[newIndex];
    });
  }
}


// this thing does what happens when control is pressed and left,right arrow keys are used
export class SelectMoreSiblingsManager {
  constructor(selection) {
    this._selection = selection;
    this._moreMode = false;   // whether control is pressed
    this._moreModeElement = null;
  }

  // ctrl pressed
  beginMoreMode() {
    console.log('begin more mode');
    this._moreMode = true;
    this._moreModeElement = null;
  }

  // ctrl released
  endMoreMode() {
    console.log('end more mode');
    this._moreMode = false;
    this._moreModeElement = null;
  }

  selectPreviousOrNextSibling(plusMinus1) {
    if (!this._moreMode) {
      this._selection.selectPreviousOrNextSibling(plusMinus1);
      return;
    }

    const selectedBefore = new Set(this._selection.getSelectedElements());
    this._selection.selectPreviousOrNextSibling(plusMinus1, this._moreModeElement, (this._moreModeElement === null));
    const selectedAfter = this._selection.getSelectedElements();

    const addedToSelection = selectedAfter.filter(elem => !selectedBefore.has(elem));
    if (addedToSelection.length !== 0) {
      [this._moreModeElement] = addedToSelection;
      console.log(this._moreModeElement + '');
    }
  }
}
