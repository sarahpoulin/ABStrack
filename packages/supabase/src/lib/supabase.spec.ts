import { supabase } from './supabase.js';

describe('supabase', () => {
  it('should work', () => {
    expect(supabase()).toEqual('supabase');
  });
});
