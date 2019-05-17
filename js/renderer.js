import * as core from './core.js';


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
    // keys are core elements, values are dom elements
    this._renderedElements = new Map();
    this._parenElements = new Map();
  }

  renderWithParensIfNeeded(coreParentElem, coreChildElem) {
    const domChildElem = this.render(coreChildElem);
    if (core.needsParens(coreParentElem, coreChildElem)) {
      return createParenContainer(domChildElem);
    }
    return domChildElem;
  }

  render(coreElem) {
    let domElem;

    if (coreElem instanceof core.Product) {
      domElem = document.createElement('div');
      coreElem.getChildElements()
        .map(coreChildElem => this.renderWithParensIfNeeded(coreElem, coreChildElem))
        .forEach(childDom => domElem.appendChild(childDom));
    }

    else if (coreElem instanceof core.Sum) {
      domElem = document.createElement('div');
      coreElem.getChildElementsAndSigns()
        .flatMap(elemSign => [
          createSumSignSpan(elemSign.sign),
          this.renderWithParensIfNeeded(coreElem, elemSign.elem),
        ])
        .forEach(childDom => domElem.appendChild(childDom));
    }

    else if (coreElem instanceof core.Symbol) {
      domElem = document.createElement('span');
      domElem.textContent = coreElem.name;
    }

    else if (coreElem instanceof core.IntConstant) {
      domElem = document.createElement('span');
      domElem.textContent = coreElem.jsNumber+'';
    }

    else if (coreElem instanceof core.Power) {
      domElem = document.createElement('div');
      domElem.appendChild(this.renderWithParensIfNeeded(coreElem, coreElem.base));
      domElem.appendChild(this.renderWithParensIfNeeded(coreElem, coreElem.exponent));
    }

    else {
      throw new Error("unknown element type: " + coreElem.constructor.name);
    }

    domElem.classList.add('math-elem');
    domElem.classList.add('math-elem-' + coreElem.constructor.name);
    this._renderedElements.set(coreElem, domElem);
    return domElem;
  }
}
