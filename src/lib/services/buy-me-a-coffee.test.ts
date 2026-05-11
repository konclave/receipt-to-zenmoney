import { describe, expect, it } from 'vitest';

import { renderBuyMeACoffeeButton } from './buy-me-a-coffee';

describe('renderBuyMeACoffeeButton', () => {
  it('renders the configured Buy Me a Coffee script into the host', () => {
    const host = document.createElement('div');

    renderBuyMeACoffeeButton(host);

    const script = host.querySelector('script');
    expect(script).not.toBeNull();
    expect(script?.src).toBe(
      'https://cdnjs.buymeacoffee.com/1.0.0/button.prod.min.js',
    );
    expect(script?.dataset.name).toBe('bmc-button');
    expect(script?.dataset.slug).toBe('konclave');
    expect(script?.dataset.text).toBe('Buy me a coffee');
  });

  it('replaces existing host content with a single script instance', () => {
    const host = document.createElement('div');
    host.append(document.createElement('span'));

    renderBuyMeACoffeeButton(host);
    renderBuyMeACoffeeButton(host);

    expect(host.childElementCount).toBe(1);
    expect(host.firstElementChild?.tagName).toBe('SCRIPT');
  });
});
