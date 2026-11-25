// Upstream runs this suite only in real browsers: it relies on CSS transitions and
// `element.getAnimations()`, which jsdom doesn't implement.
describe.skip('Popover popup transition state', () => {
  it('starts each opening once when the popup is kept mounted', () => {});
});
