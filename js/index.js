import * as mathElems from './math-elems.js';
import { Renderer } from './renderer.js';

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
});
