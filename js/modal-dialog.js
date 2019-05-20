let globalRunningDialogVar = null;   // MUHAHAHA

export function isShowing() {
  return (globalRunningDialogVar !== null);
}


export class ModalDialog {
  constructor(titleText, buttonTexts) {
    this._setupHtml();
    this._titleElement.textContent = titleText;

    this._onClose = () => this.pressButton(null);    // because javascript is awesome
    this._closeButton.addEventListener('click', this._onClose);

    this.buttons = {};
    for (const text of buttonTexts) {
      const button = document.createElement('button');
      button.textContent = text;
      button.addEventListener('click', () => this.pressButton(text));
      this._buttonArea.appendChild(button);
      this.buttons[text] = button;
    }

    this._runDoneCallback = null;
  }

  _setupHtml() {
    this._containerDiv = document.createElement('div');
    this._containerDiv.classList.add('modal-dialog-container');
    this._containerDiv.classList.add('hidden');
    this._containerDiv.innerHTML =
      '<div>' +
      '  <div class="modal-dialog-top-bar">' +
      '    <h2 class="modal-dialog-title"></h2>' +
      '    <button class="modal-dialog-close-button">&#x274C;</button>' +
      '  </div>' +
      '  <div class="modal-dialog-content"></div>' +
      '  <div class="modal-dialog-button-area"></div>' +
      '</div>';

    this._titleElement = this._containerDiv.querySelector('.modal-dialog-title');
    this._closeButton = this._containerDiv.querySelector('.modal-dialog-close-button');
    this.contentDiv = this._containerDiv.querySelector('.modal-dialog-content');
    this._buttonArea = this._containerDiv.querySelector('.modal-dialog-button-area');

    this._containerDiv.addEventListener('click', event => {
      if (event.target === this._containerDiv) {
        // close the dialog
        this.pressButton(null);
        event.preventDefault();
      }
    });

    document.body.appendChild(this._containerDiv);
  }

  // can be called to do exactly what pressing a button would do
  // pass null for what closing the dialog would do
  pressButton(buttonTextOrNull) {
    this._closeButton.removeEventListener('click', this._onClose);
    this._containerDiv.classList.add('hidden');
    globalRunningDialogVar = null;
    this._runDoneCallback(buttonTextOrNull);
  }

  run() {
    if (globalRunningDialogVar !== null) {
      throw new Error("another dialog is already running");
    }

    this._containerDiv.classList.remove('hidden');
    globalRunningDialogVar = this;
    return new Promise(resolve => {
      // i don't trust javascript enough for doing this without an arrow function
      this._runDoneCallback = ( result => resolve(result) );
    });
  }
}
