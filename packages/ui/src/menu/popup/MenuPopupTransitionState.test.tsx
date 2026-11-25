// Upstream runs this suite only in real browsers (`describe.skipIf(isJSDOM)`): it drives CSS
// transitions and `element.getAnimations()`, which jsdom doesn't implement.
describe.skip('Menu popup transition state', () => {
  it('starts each opening once', () => {});
});
