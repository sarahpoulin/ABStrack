import { crypto } from './crypto.js';

describe('crypto', () => {
  it('should work', () => {
    expect(crypto()).toEqual('crypto');
  });
});
