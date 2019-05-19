let globalIsShowingVar = false;   // MUHAHAHA

export function isShowing() {
  return globalIsShowingVar;
}


function setupHtml() {
  if (document.getElementById('modal-dialog-container') === null) {
    const div = document.createElement('div');
    div.id = 'modal-dialog-container';
    div.classList.add('hidden');
    div.innerHTML =
      '<div>' +
      '  <div id="modal-dialog-top-bar">' +
      '    <h2 id="modal-dialog-title"></h2>' +
      '    <button id="modal-dialog-close-button">&#x274C;</button>' +
      '  </div>' +
      '  <div id="modal-dialog-content"></div>' +
      '  <div id="modal-dialog-button-area"></div>' +
      '</div>';
    document.body.appendChild(div);
  }
}


function showDialogWithCallback(titleText, dom, buttonTexts, callback) {
  setupHtml();

  const titleElement = document.getElementById('modal-dialog-title');
  const containerDiv = document.getElementById('modal-dialog-container');
  const closeButton = document.getElementById('modal-dialog-close-button');
  const contentDiv = document.getElementById('modal-dialog-content');
  const buttonArea = document.getElementById('modal-dialog-button-area');

  titleElement.textContent = titleText;
  contentDiv.innerHTML = '';
  contentDiv.appendChild(dom);

  function onClickOrClose(buttonTextOrNull) {
    closeButton.removeEventListener('click', onClose);
    containerDiv.classList.add('hidden');
    globalIsShowingVar = false;
    callback(buttonTextOrNull);
  }

  function onClose() {
    console.log('on close');
    onClickOrClose(null);
  }

  closeButton.addEventListener('click', onClose);

  buttonArea.innerHTML = '';
  for (const text of buttonTexts) {
    const button = document.createElement('button');
    button.textContent = text;
    button.addEventListener('click', () => onClickOrClose(text));
    buttonArea.appendChild(button);
  }

  containerDiv.classList.remove('hidden');
  globalIsShowingVar = true;
}


export async function showDialog(titleText, dom, buttonTexts) {
  return new Promise(resolve => showDialogWithCallback(titleText, dom, buttonTexts, resolve));
}
