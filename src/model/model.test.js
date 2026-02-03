const { Role } = require('./model.js');

describe('Role', () => {
  test('should have correct role values', () => {
    expect(Role.Diner).toBe('diner');
    expect(Role.Franchisee).toBe('franchisee');
    expect(Role.Admin).toBe('admin');
  });
});
