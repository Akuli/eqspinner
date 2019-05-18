import * as mathElems from './math-elems.js';
import { Renderer } from './renderer.js';
import { Selection, SelectMoreSiblingsManager } from './selection.js';
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

  const selection = new Selection(expression);
  selection.addEventListener('Select', () => renderer.setSelectedElements(selection.getSelectedElements()));

  function renderAgain() {
    div.innerHTML = '';
    div.appendChild(renderer.render(expression));
  }

  const ctrlPressHelper = new SelectMoreSiblingsManager(selection);
  const keyBindings = {
    'ArrowUp': () => selection.selectChild(),
    'ArrowDown': () => selection.selectParent(),
    'ArrowLeft': () => ctrlPressHelper.selectPreviousOrNextSibling(-1),
    'ArrowRight': () => ctrlPressHelper.selectPreviousOrNextSibling(+1),
    'r': () => renderAgain(),   // TODO: delete this?
  };

  document.addEventListener('keydown', event => {
    if (event.key === 'Control') {
      ctrlPressHelper.beginMoreMode();
    } else if (keyBindings[event.key] !== undefined) {
      keyBindings[event.key]();
    } else {
      const matchingActions = ACTIONS.filter(act => act.keyBinding === event.key);
      if (matchingActions.length > 2) {
        throw new Error("multiple actions have same key binding: " + event.key);
      }

      if (matchingActions.length === 1) {
        const toSelect = matchingActions[0].run(selection);
        if (toSelect === null) {
          console.log('nothing done');
        } else {
          console.log('it did something');
          renderAgain();
          selection.select(toSelect);
        }
      } else {
        console.log("unbound key: " + event.key);
        return;
      }
    }

    event.preventDefault();
  });

  document.addEventListener('keyup', event => {
    if (event.key === 'Control') {
      ctrlPressHelper.endMoreMode();
    } else {
      return;
    }

    event.preventDefault();
  });
});
