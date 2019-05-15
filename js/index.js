import * as core from './core.js';
import { Renderer } from './renderer.js';

document.addEventListener('DOMContentLoaded', () => {
  // x^(x^2) - 2x + x - 1
  const expression = new core.Sum([
    {
      elem: new core.Power(
        new core.Power(new core.Symbol('x'), new core.IntConstant(2)),
        new core.Power(new core.Symbol('y'), new core.IntConstant(2)),
      ),
      sign: '+',
    },
    {
      elem: new core.Product([ new core.IntConstant(2), new core.Symbol('x') ]),
      sign: '-',
    },
    {
      elem: new core.Sum([
        {
          elem: new core.Symbol('x'),
          sign: '+',
        },
        {
          elem: new core.IntConstant(1),
          sign: '-',
        },
      ]),
      sign: '-',
    },
    {
      elem: new core.Product([
        new core.Sum([
          {
            elem: new core.Symbol('x'),
            sign: '+',
          },
          {
            elem: new core.Symbol('y'),
            sign: '+',
          },
        ]),
        new core.Sum([
          {
            elem: new core.Symbol('x'),
            sign: '+',
          },
          {
            elem: new core.Symbol('y'),
            sign: '-',
          },
        ]),
      ]),
      sign: '+',
    },
  ]);
  console.log(expression.toString());

  const div = document.getElementById('equation');
  const renderer = new Renderer(div);
  div.appendChild(renderer.render(expression));
});
