import { describe, it, expect } from 'vitest';
import { mentionSpans } from '@/app/app/components/Messages';

// Splitting a message body into plain text and the handles named in it.
//
// The arithmetic here is the whole reason this is tested. The pattern matches
// the character BEFORE the @ so that an email address does not read as a
// mention — which means `m.index` points at that character, not at the @. Add
// the boundary's own length or every mention swallows the space in front of it,
// and the sentence loses a character per mention with nothing to show for it.
//
// The other rule under test: only handles the SERVER listed are marked. That
// list is already filtered against the member list, so a message naming someone
// who is not here renders as plain text — which is the truth. Nobody was told.

describe('mentionSpans', () => {
  it('marks a handle in the middle and keeps the space before it', () => {
    const parts = mentionSpans('hey @magy888 look', ['magy888']);
    expect(parts).toEqual([
      { text: 'hey ' },
      { text: '@magy888', handle: 'magy888' },
      { text: ' look' },
    ]);
  });

  it('marks a handle at the very start, where the boundary is empty', () => {
    expect(mentionSpans('@magy888 hi', ['magy888'])).toEqual([
      { text: '@magy888', handle: 'magy888' },
      { text: ' hi' },
    ]);
  });

  it('marks two handles in one message', () => {
    expect(mentionSpans('@a1 and @b2', ['a1', 'b2'])).toEqual([
      { text: '@a1', handle: 'a1' },
      { text: ' and ' },
      { text: '@b2', handle: 'b2' },
    ]);
  });

  it('matches case-insensitively but keeps what was typed', () => {
    // The service lowercases when it notifies; the screen shows the sentence as
    // written. Rewriting someone's capitalisation is not this function's job.
    expect(mentionSpans('hi @MAGY888', ['magy888'])).toEqual([
      { text: 'hi ' },
      { text: '@MAGY888', handle: 'magy888' },
    ]);
  });

  it('leaves a handle the server did NOT list as plain text', () => {
    // Not a member — nobody was notified, so nothing is highlighted.
    expect(mentionSpans('hi @stranger', ['magy888'])).toEqual([{ text: 'hi @stranger' }]);
  });

  it('does not mark the domain of an email address', () => {
    expect(mentionSpans('mail me at a@magy888', ['magy888'])).toEqual([
      { text: 'mail me at a@magy888' },
    ]);
  });

  it('returns the body untouched when nothing was mentioned', () => {
    expect(mentionSpans('plain text', [])).toEqual([{ text: 'plain text' }]);
    expect(mentionSpans('plain text', undefined)).toEqual([{ text: 'plain text' }]);
  });

  it('rebuilds the original text exactly', () => {
    // The property that actually matters: whatever the split does, joining the
    // pieces must give back the sentence the person wrote. A dropped character
    // is invisible in a screenshot and permanent in the transcript.
    const body = '@a1 hello @b2 — see @a1 again';
    expect(mentionSpans(body, ['a1', 'b2']).map((p) => p.text).join('')).toBe(body);
  });

  it('handles an empty body without throwing', () => {
    expect(mentionSpans('', ['a1'])).toEqual([{ text: '' }]);
  });
});
