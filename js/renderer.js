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
  }

  _renderWithParensIfNeeded(mathElem) {
    const dom = this.render(mathElem);
    if (mathElem.parent.childNeedsParens(mathElem)) {
      return createParenContainer(dom);
    }
    return dom;
  }

  unrender() {
    this._renderedElements.clear();
  }

  render(mathElem) {
    let domElem;

    if (mathElem instanceof mathElems.Product) {
      domElem = document.createElement('div');
      mathElem.getChildElements()
        .map(mathChildElem => this._renderWithParensIfNeeded(mathChildElem))
        .forEach(childDom => domElem.appendChild(childDom));
    }

    else if (mathElem instanceof mathElems.Sum) {
      domElem = document.createElement('div');
      mathElem.getChildElements().forEach(( elem, index ) => {
        let sign, displayedElem;
        if (elem instanceof mathElems.Negation) {
          sign = '-';
          displayedElem = elem.inner;
        } else {
          sign = '+';
          displayedElem = elem;
        }

        const div = document.createElement('div');
        div.appendChild(createSumSignSpan(sign));
        div.appendChild(this._renderWithParensIfNeeded(displayedElem));
        domElem.appendChild(div);

        if (elem instanceof mathElems.Negation) {
          this._renderedElements.set(elem, div);
        }
      });
    }

    else if (mathElem instanceof mathElems.Negation) {
      domElem = document.createElement('div');
      domElem.appendChild(createSumSignSpan('-'));
      domElem.appendChild(this._renderWithParensIfNeeded(mathElem.inner));
    }

    else if (mathElem instanceof mathElems.Symbol) {
      domElem = document.createElement('span');
      domElem.textContent = mathElem.name;
    }

    else if (mathElem instanceof mathElems.IntConstant) {
      domElem = document.createElement('span');
      domElem.textContent = mathElem.jsNumber+'';
    }

    else if (mathElem instanceof mathElems.Power) {
      domElem = document.createElement('div');
      domElem.appendChild(this._renderWithParensIfNeeded(mathElem.base));
      domElem.appendChild(this._renderWithParensIfNeeded(mathElem.exponent));
    }

    else {
      throw new Error("unknown element type: " + mathElem.constructor.name);
    }

    domElem.classList.add('math-elem');
    domElem.classList.add('math-elem-' + mathElem.constructor.name);
    this._renderedElements.set(mathElem, domElem);
    return domElem;
  }

  setSelectedElements(coreElements) {
    for (const domElem of this._renderedElements.values()) {
      domElem.classList.remove('math-elem-selected');
    }

    for (const coreElem of coreElements) {
      this._renderedElements.get(coreElem).classList.add('math-elem-selected');
    }
  }
}
