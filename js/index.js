import * as asciiMathParser from './asciimath-parser.js';
import * as mathElems from './math-elems.js';
import * as modalDialog from './modal-dialog.js';
import { Renderer } from './renderer.js';
import { Selection, SelectMoreSiblingsManager } from './selection.js';
import { ACTIONS } from './actions.js';


document.addEventListener('DOMContentLoaded', () => {

  const math = new mathElems.EverythingContainer(
    new mathElems.Sum([
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
    ])
  );
  console.log(math.toString());
  if (!math.equals(math)) {
    throw new Error("equals is broken");
  }
  if (!math.copy().equals(math)) {
    throw new Error("copy is broken");
  }

  const div = document.getElementById('equation');
  const renderer = new Renderer(div);
  div.appendChild(renderer.render(math));

  const selection = new Selection(math);
  selection.addEventListener('Select', () => renderer.setSelectedElements(selection.getSelectedElements()));

  function renderAgain() {
    // sanity check
    const everything = [];
    const recurser = mathElem => {
      everything.push(mathElem);
      mathElem.getChildElements().forEach(recurser);
    }
    recurser(math);
    if ( (new Set(everything)).size < everything.length ){
      throw new Error("OMG!!");
    }

    div.innerHTML = '';
    div.appendChild(renderer.render(math));
  }

  const ctrlPressHelper = new SelectMoreSiblingsManager(selection);
  const keyBindings = {
    'ArrowDown': () => selection.selectParent(),
    'ArrowUp': () => selection.selectChild(),
    'ArrowLeft': () => ctrlPressHelper.selectPreviousOrNextSibling(-1),
    'ArrowRight': () => ctrlPressHelper.selectPreviousOrNextSibling(+1),
    'Ctrl+ArrowLeft': () => ctrlPressHelper.selectPreviousOrNextSibling(-1),
    'Ctrl+ArrowRight': () => ctrlPressHelper.selectPreviousOrNextSibling(+1),
    'Control': () => ctrlPressHelper.beginMoreMode(),
    'Control up': () => ctrlPressHelper.endMoreMode(),
    'Home': () => selection.selectFirstOrLastSibling(false),
    'End': () => selection.selectFirstOrLastSibling(true),
    'I': () => selection.selectAllChildren(),
 };

  async function handleEvent(upBool, event) {
    if (modalDialog.isShowing()) {
      return;
    }

    let key;
    if (event.key === event.key.toLowerCase()) {  // e.g. 'a'
      key = event.key.toUpperCase();
    } else if (event.key === event.key.toUpperCase()) {   // e.g. 'A'
      key = 'Shift+' + event.key;
    } else {    // e.g. 'ArrowUp'
      key = event.key;
    }

    if (event.ctrlKey && key !== 'Control') {
      key = 'Ctrl+' + key;
    }
    if (upBool) {
      key = key + ' up';
    }

    if (keyBindings[key] !== undefined) {
      keyBindings[key]();
    } else {
      const matchingActions = ACTIONS.filter(act => (act.keyBinding === key));
      if (matchingActions.length > 2) {
        throw new Error("multiple actions have same key binding: " + key);
      }

      if (matchingActions.length === 1) {
        const toSelect = await matchingActions[0].run(selection);
        if (toSelect === null) {
          console.log('nothing done');
        } else {
          console.log('it did something');
          renderAgain();
          selection.select(toSelect);
        }
      } else {
        if (!upBool) {
          console.log("unbound key: " + key);
        }
        return;
      }
    }

    event.preventDefault();
  }

  document.addEventListener('keydown', event => { handleEvent(false, event); });
  document.addEventListener('keyup', event => { handleEvent(true, event); });
});
