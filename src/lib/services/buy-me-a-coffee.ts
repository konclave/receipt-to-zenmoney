const BUY_ME_A_COFFEE_SCRIPT_SRC =
  'https://cdnjs.buymeacoffee.com/1.0.0/button.prod.min.js';

export function renderBuyMeACoffeeButton(host: HTMLElement): HTMLScriptElement {
  host.replaceChildren();

  const script = document.createElement('script');
  script.type = 'text/javascript';
  script.src = BUY_ME_A_COFFEE_SCRIPT_SRC;
  script.dataset.name = 'bmc-button';
  script.dataset.slug = 'konclave';
  script.dataset.color = '#FFDD00';
  script.dataset.emoji = '';
  script.dataset.font = 'Cookie';
  script.dataset.text = 'Buy me a coffee';
  script.dataset.outlineColor = '#000000';
  script.dataset.fontColor = '#000000';
  script.dataset.coffeeColor = '#ffffff';

  host.append(script);

  return script;
}
