import * as mathElems from './math-elems.js';


function createSumSignSpan(sign) {
  const span = document.createElement('span');
  span.classList.add('math-sign');
  if (sign === '+') {
    span.classList.add('math-sign-plus');
    span.textContent = '+';
  } else if (sign === '-') {
    span.classList.add('math-sign-minus');
    span.innerHTML = '&minus;';   // looks better than the ascii "-" character
  } else {
    throw new Error("unknown sign: " + sign);
  }
  return span;
}

function createParenContainer(wrappedElement) {
  const containerDiv = document.createElement('div');
  containerDiv.classList.add('math-paren-container');

  const lParen = document.createElement('span');
  const rParen = document.createElement('span');
  lParen.classList.add('math-lparen');
  rParen.classList.add('math-rparen');
  lParen.textContent = '(';
  rParen.textContent = ')';

  containerDiv.appendChild(lParen);
  containerDiv.appendChild(wrappedElement);
  containerDiv.appendChild(rParen);

  return containerDiv;
}


export class Renderer {
  constructor() {
    // keys are mathElems elements, values are dom elements
    this._renderedElements = new Map();
    this._parenElements = new Map();
  }

  renderWithParensIfNeeded(mathElemsParentElem, mathElemsChildElem) {
    const domChildElem = this.render(mathElemsChildElem);
    if (mathElems.needsParens(mathElemsParentElem, mathElemsChildElem)) {
      return createParenContainer(domChildElem);
    }
    return domChildElem;
  }

  render(mathElemsElem) {
    let domElem;

    if (mathElemsElem instanceof mathElems.Product) {
      domElem = document.createElement('div');
      mathElemsElem.getChildElements()
        .map(mathElemsChildElem => this.renderWithParensIfNeeded(mathElemsElem, mathElemsChildElem))
        .forEach(childDom => domElem.appendChild(childDom));
    }

    else if (mathElemsElem instanceof mathElems.Sum) {
      domElem = document.createElement('div');
      mathElemsElem.getChildElementsAndSigns()
        .flatMap(elemSign => [
          createSumSignSpan(elemSign.sign),
          this.renderWithParensIfNeeded(mathElemsElem, elemSign.elem),
        ])
        .forEach(childDom => domElem.appendChild(childDom));
    }

    else if (mathElemsElem instanceof mathElems.Symbol) {
      domElem = document.createElement('span');
      domElem.textContent = mathElemsElem.name;
    }

    else if (mathElemsElem instanceof mathElems.IntConstant) {
      domElem = document.createElement('span');
      domElem.textContent = mathElemsElem.jsNumber+'';
    }

    else if (mathElemsElem instanceof mathElems.Power) {
      domElem = document.createElement('div');
      domElem.appendChild(this.renderWithParensIfNeeded(mathElemsElem, mathElemsElem.base));
      domElem.appendChild(this.renderWithParensIfNeeded(mathElemsElem, mathElemsElem.exponent));
    }

    else {
      throw new Error("unknown element type: " + mathElemsElem.constructor.name);
    }

    domElem.classList.add('math-elem');
    domElem.classList.add('math-elem-' + mathElemsElem.constructor.name);
    this._renderedElements.set(mathElemsElem, domElem);
    return domElem;
  }
}
