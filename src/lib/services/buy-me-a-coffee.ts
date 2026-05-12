const BUY_ME_A_COFFEE_EMBED_PATH = '/bmc-button.html';

export function renderBuyMeACoffeeButton(host: HTMLElement): HTMLIFrameElement {
  host.replaceChildren();

  const frame = document.createElement('iframe');
  frame.src = BUY_ME_A_COFFEE_EMBED_PATH;
  frame.title = 'Buy me a coffee';
  frame.loading = 'lazy';
  frame.referrerPolicy = 'strict-origin-when-cross-origin';
  frame.style.width = '100%';
  frame.style.maxWidth = '240px';
  frame.style.height = '70px';
  frame.style.border = '0';
  frame.style.overflow = 'hidden';
  frame.style.background = 'transparent';

  host.append(frame);

  return frame;
}
