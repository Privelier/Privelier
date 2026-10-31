import { clearUnsentDrafts, getUnsentDraft, setUnsentDraft } from '../unsentDrafts';

describe('unsentDrafts', () => {
  afterEach(() => clearUnsentDrafts());

  it('keeps a draft per room until it is sent or cleared', () => {
    setUnsentDraft('room-1', 'See you at ten');
    setUnsentDraft('room-2', 'Running late');

    expect(getUnsentDraft('room-1')).toBe('See you at ten');
    expect(getUnsentDraft('room-2')).toBe('Running late');

    setUnsentDraft('room-1', '   ');
    expect(getUnsentDraft('room-1')).toBe('');
  });

  it('forgets every draft on sign-out', () => {
    setUnsentDraft('room-1', 'Private note');
    clearUnsentDrafts();

    expect(getUnsentDraft('room-1')).toBe('');
  });
});
