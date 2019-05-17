import * as mathElems from './math-elems.js';
import { Renderer } from './renderer.js';
import { Selection, SelectError } from './selection.js';

document.addEventListener('DOMContentLoaded', () => {

  const expression = new mathElems.Sum([
    {
      elem: new mathElems.Power(
        new mathElems.Power(new mathElems.Symbol('x'), new mathElems.IntConstant(2)),
        new mathElems.Power(new mathElems.Symbol('y'), new mathElems.IntConstant(2)),
      ),
      sign: '+',
    },
    {
      elem: new mathElems.Product([ new mathElems.IntConstant(2), new mathElems.Symbol('x') ]),
      sign: '-',
    },
    {
      elem: new mathElems.Sum([
        {
          elem: new mathElems.Power(new mathElems.Symbol('x'), new mathElems.IntConstant(2)),
          sign: '+',
        },
        {
          elem: new mathElems.Power(new mathElems.IntConstant(1), new mathElems.IntConstant(2)),
          sign: '-',
        },
      ]),
      sign: '-',
    },
    {
      elem: new mathElems.Product([
        new mathElems.Sum([
          {
            elem: new mathElems.Symbol('x'),
            sign: '+',
          },
          {
            elem: new mathElems.Symbol('y'),
            sign: '+',
          },
        ]),
        new mathElems.Sum([
          {
            elem: new mathElems.Symbol('x'),
            sign: '+',
          },
          {
            elem: new mathElems.Symbol('y'),
            sign: '-',
          },
        ]),
      ]),
      sign: '+',
    },
  ]);
  console.log(expression.toString());

  const simpleSum = expression.getChildElements()[2];
  simpleSum.replace(simpleSum.getChildElements()[0], new mathElems.Symbol('y'));
  console.log(simpleSum+'');

  const div = document.getElementById('equation');
  const renderer = new Renderer(div);
  div.appendChild(renderer.render(expression));

  const selection = new Selection(expression);
  selection.addEventListener('Select', () => renderer.setSelectedElements(selection.getSelectedElements()));
  renderer.setSelectedElements(selection.getSelectedElements());

  document.addEventListener('keydown', event => {
    try {
      switch(event.key) {
        case 'ArrowUp':
          selection.selectChild();
          break;
        case 'ArrowDown':
          selection.selectParent();
          break;
        case 'ArrowLeft':
          selection.selectPreviousOrNextSibling(-1);
          break;
        case 'ArrowRight':
          selection.selectPreviousOrNextSibling(1);
          break;
        default:
          break;
      }
    } catch(e) {
      if (e instanceof SelectError) {
        console.log(e.message);
      } else {
        throw e;
      }
    }
  });
});
