// this syntax is probably NOT 100% compatible with real asciimath (asciimath.org)
// but it works ok most of the time
// creating the asciimath is implemented in math-elems.js as .toAsciiMath() methods

// things that are known to behave differently with this vs real asciimath:
//    * f(x) / g[x]
//    * sin(x)
//    * alpha
//    * Delta y / Delta x
//    * dy/dx
//    * |x|
//    * a +- b
//
// TODO: decide to do with these and do whatever is decided

import * as mathElems from './math-elems.js';


const TOKEN_SPEC = [
  { name: 'unsignedInt', regex: /^[0-9]+\./ },
  { name: 'var', regex: /^\w/ },
  // [a+b]/{c+d} is same as (a+b)/(c+d) in asciimath
  { name: 'operator', regex: /^[+\-*/^()\[\]\{\}]/ },
  { name: 'space', regex: /^\s/ },
];
const LPARENS = ['(', '[', '{'];
const RPARENS = [')', ']', '}'];


export class ParsingError extends Error {
  constructor(message) {
    super(message);
    this.name = this.constructor.name;
  }
}


function* tokenizeExpression(mathString) {
  while (mathString !== '') {
    const matchingSpec = TOKEN_SPEC.find(spec => spec.regex.test(mathString));
    if (matchingSpec === undefined) {
      throw new ParsingError("cannot tokenize: " + mathString);
    }

    let string = matchingSpec.regex.exec(mathString)[0];
    mathString = mathString.slice(string.length);
    if (matchingSpec.name === 'operator' && LPARENS.includes(string)) {
      string = '(';
    }

    if (matchingSpec.name !== 'space') {
      yield { type: matchingSpec.name, value: string };
    }
  }
}


function tokenMatches(token, props) {
  return Object.getOwnPropertyNames(props).every(key => token[key] === props[key]);
}


class TokenIterator {
  constructor(generator) {
    this._generator = generator;
    this._comingSoon = null;
  }

  _callNext(errorOnEOF) {
    const next = this._generator.next();
    if (next.done) {
      if (errorOnEOF) {
        throw new ParsingError("unexpected end of math");
      }
      return null;
    }
    if (next.value === null) {
      throw new Error("unexpected null");
    }
    return next.value;
  }

  eof() {
    if (this._comingSoon !== null) {
      return false;
    }
    this._comingSoon = this._callNext(false);
    return (this._comingSoon === null);
  }

  comingUp(props) {
    if (this._comingSoon === null) {
      this._comingSoon = this._callNext(true);
    }
    return tokenMatches(this._comingSoon, props);
  }

  nextToken(props) {
    let result;
    if (this._comingSoon === null) {
      result = this._callNext(true);
    } else {
      result = this._comingSoon;
      this._comingSoon = null;
    }

    if (!tokenMatches(result, props)) {
      throw new ParsingError("unexpected token: " + result.value);
    }
    return result;
  }
}


class FakeZero { }

class Parser {
  constructor(tokenGenerator) {
    this.iter = new TokenIterator(tokenGenerator);
  }

  expressionComingUp() {
    return [
      { type: 'operator', value: '+' },
      { type: 'operator', value: '-' },
      { type: 'var' },
      { type: 'operator', value: '(' },
      { type: 'unsignedInt' },
    ].some(spec => this.iter.comingUp(spec));
  }

  parseExpressionWithoutBinaryOperators() {
    if (this.iter.comingUp({ type: 'var' })) {
      return new mathElems.Symbol(this.iter.nextToken({ type: 'var' }).value);
    }

    if (this.iter.comingUp({ type: 'unsignedInt' })) {
      return new mathElems.IntConstant(+ this.iter.nextToken({ type: 'unsignedInt' }).value);
    }

    if (this.iter.comingUp({ type: 'operator', value: '(' })) {
      this.iter.nextToken({ type: 'operator', value: '(' });
      const result = this.parseExpression();
      this.iter.nextToken({ type: 'operator', value: ')' });
      return result;
    }

    throw new ParsingError("don't know how to parse " + this.iter.nextToken({}).value);
  }

  binaryOperatorComingUp() {
    return [...'+-*/^'].some(op => this.iter.comingUp({ type: 'operator', value: op }))
  }

  parseExpression() {
    // this must be here and NOT in parseExpressionWithoutBinaryOperators
    // because -x^2-y must be always 0-x^2-y; that is, 0-(x^2)-y
    // the 0 will be removed later, it is a FakeZero object
    // this is the most robust way to ensure it i could think of
    let minusing = false;
    if (this.iter.comingUp({ type: 'operator', value: '+'})) {
      this.iter.nextToken({ type: 'operator', value: '+' });
    } else if (this.iter.comingUp({ type: 'operator', value: '-'})) {
      this.iter.nextToken({ type: 'operator', value: '-' });
      minusing = true;
    }

    // things with even indexes are mathElems or FakeZeros
    // things with odd indexes are operator strings
    const funnyStuff = [ this.parseExpressionWithoutBinaryOperators() ];

    if (minusing) {
      funnyStuff.splice(0, 0, new FakeZero(), '-');
    }

    while ( !this.iter.eof() && (this.expressionComingUp() || this.binaryOperatorComingUp()) ) {
      if (this.binaryOperatorComingUp()) {
        funnyStuff.push(this.iter.nextToken({ type: 'operator' }).value);
      } else {
        funnyStuff.push('*');
      }
      funnyStuff.push(this.parseExpressionWithoutBinaryOperators());
    }

    for (const operators of ['^', '/', '*', '+-']) {
      while (true) {
        const firstOpIndex = funnyStuff.findIndex(opOrMathElem => [...operators].includes(opOrMathElem));
        if (firstOpIndex === -1) {
          break;
        }

        let lastOpIndex = firstOpIndex;
        let result;

        const Class = {
          '^': mathElems.Power,
          '/': mathElems.Fraction,
          '*': mathElems.Product,
          '+-': mathElems.Sum,    // Negation is added manually
        }[operators];

        if (operators === '*' || operators === '+-') {
          while( lastOpIndex+2 < funnyStuff.length && [...operators].includes(funnyStuff[lastOpIndex+2]) ) {
            lastOpIndex += 2;
          }

          const elems = [];
          for (let elemIndex = firstOpIndex-1; elemIndex <= lastOpIndex+1; elemIndex += 2) {
            if (funnyStuff[elemIndex] instanceof FakeZero) {
              continue;
            }

            let opIndex = elemIndex-1;
            if (opIndex >= 0 && funnyStuff[opIndex] === '-' && operators === '+-') {
              console.log('adding another negation to: ' + funnyStuff[elemIndex] + ' (' + operators + ')');
              console.log(firstOpIndex, lastOpIndex, funnyStuff.map(x => x+''));
              elems.push( new mathElems.Negation(funnyStuff[elemIndex]) );
            } else {
              elems.push(funnyStuff[elemIndex]);
            }
          }
          result = new Class(elems);
        } else {
          result = new Class(funnyStuff[firstOpIndex - 1], funnyStuff[firstOpIndex + 1]);
        }

        const howManyItems = lastOpIndex - firstOpIndex + 3;  // 3 items, if firstOpIndex === lastOpIndex
        funnyStuff.splice(firstOpIndex - 1, howManyItems, result);
      }
    }

    if (funnyStuff.length !== 1) {
      throw new Error("something weird happened");
    }
    return funnyStuff[0];
  }
}


export function parse(mathString) {
  const parser = new Parser(tokenizeExpression(mathString));
  const result = parser.parseExpression();
  if (!parser.iter.eof()) {
    throw new ParsingError("the math contains something invalid at the end");
  }
  return result;
}
