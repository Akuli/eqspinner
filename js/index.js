import * as mathElems from './math-elems.js';
import { Renderer } from './renderer.js';
import { Selection, SelectError } from './selection.js';
import { ACTIONS } from './actions.js';


document.addEventListener('DOMContentLoaded', () => {

  const expression = new mathElems.Sum([
    new mathElems.Power(
      new mathElems.Power(new mathElems.Symbol('x'), new mathElems.IntConstant(2)),
      new mathElems.Power(new mathElems.Symbol('y'), new mathElems.IntConstant(2)),
    ),
    new mathElems.Negation(
      new mathElems.Product([ new mathElems.IntConstant(2), new mathElems.Symbol('x') ]),
    ),
    new mathElems.Negation(
      new mathElems.Sum([
        new mathElems.Power(new mathElems.Symbol('x'), new mathElems.IntConstant(2)),
        new mathElems.Negation(
          new mathElems.Power(new mathElems.IntConstant(1), new mathElems.IntConstant(-2)),
        ),
      ]),
    ),
    new mathElems.Product([
      new mathElems.Sum([
        new mathElems.Symbol('x'),
        new mathElems.Symbol('y'),
      ]),
      new mathElems.Sum([
        new mathElems.Symbol('x'),
        new mathElems.Negation(new mathElems.Symbol('y')),
      ]),
    ]),
  ]);
  console.log(expression.toString());
  if (!expression.equals(expression)) {
    throw new Error("equals is broken");
  }
  if (!expression.copy().equals(expression)) {
    throw new Error("copy is broken");
  }

  const div = document.getElementById('equation');
  const renderer = new Renderer(div);
  div.appendChild(renderer.render(expression));

  let selection = new Selection(expression);
  selection.addEventListener('Select', () => renderer.setSelectedElements(selection.getSelectedElements()));
  renderer.setSelectedElements(selection.getSelectedElements());

  function renderAgain() {
    div.innerHTML = '';
    div.appendChild(renderer.render(expression));

    for (const possibleNewSelection of selection.parentySelections) {
      try {
        selection.select(possibleNewSelection);
        console.log('renderAgain done');
        return;
      } catch(e) {
        if (!(e instanceof SelectError)) {
          throw e;
        }
      }
    }

    throw new Error("cannot select anything for some reason");
  }

  function createSelecterCallback(func) {
    return () => {
      try {
        func();
      } catch(e) {
        if (!(e instanceof SelectError)) {
          throw e;
        }
      }
    };
  }

  const keyBindings = {
    'ArrowUp': createSelecterCallback(() => selection.selectChild()),
    'ArrowDown': createSelecterCallback(() => selection.selectParent()),
    'ArrowLeft': createSelecterCallback(() => selection.selectPreviousOrNextSibling(-1)),
    'ArrowRight': createSelecterCallback(() => selection.selectPreviousOrNextSibling(+1)),
    'r': () => renderAgain(),
  };

  document.addEventListener('keydown', event => {
    if (keyBindings[event.key] !== undefined) {
      keyBindings[event.key]();
      event.preventDefault();
      return;
    }

    const matchingActions = ACTIONS.filter(act => act.keyBinding === event.key);
    if (matchingActions.length > 2) {
      throw new Error("multiple actions have same key binding: " + event.key);
    }
    if (matchingActions.length === 1) {
      const cbResult = matchingActions[0].callback(selection);
      if (cbResult === null) {
        console.log('nothing done');
      } else {
        console.log('it did something');
        renderAgain();
        selection.select(cbResult);
      }
      return;
    }

    console.log("unbound key: " + event.key);
  });
});
