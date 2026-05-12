import { describe, expect, it } from 'vitest';

import { renderBuyMeACoffeeButton } from './buy-me-a-coffee';

describe('renderBuyMeACoffeeButton', () => {
  it('renders the official Buy Me a Coffee iframe into the host', () => {
    const host = document.createElement('div');

    renderBuyMeACoffeeButton(host);

    const frame = host.querySelector('iframe');

    expect(frame).not.toBeNull();
    expect(frame?.src).toBe('http://localhost/bmc-button.html');
    expect(frame?.title).toBe('Buy me a coffee');
    expect(frame?.loading).toBe('lazy');
    expect(frame?.referrerPolicy).toBe('strict-origin-when-cross-origin');
    expect(frame?.style.maxWidth).toBe('240px');
    expect(frame?.style.height).toBe('70px');
  });

  it('replaces existing host content with a single iframe instance', () => {
    const host = document.createElement('div');
    host.append(document.createElement('span'));

    renderBuyMeACoffeeButton(host);
    renderBuyMeACoffeeButton(host);

    expect(host.childElementCount).toBe(1);
    expect(host.firstElementChild?.tagName).toBe('IFRAME');
  });
});
