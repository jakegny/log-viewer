import { parseChunk } from './parseNDJSON';

describe('parseChunk', () => {
  it('parses complete NDJSON lines', () => {
    const chunk = '{"_time":1724323612592,"level":"info"}\n{"_time":1724323612593,"level":"error"}\n';
    const result = parseChunk(chunk, '');

    expect(result.events).toHaveLength(2);
    expect(result.events[0]._time).toBe(1724323612592);
    expect(result.events[0].level).toBe('info');
    expect(result.events[1]._time).toBe(1724323612593);
    expect(result.events[1].level).toBe('error');
    expect(result.remainder).toBe('');
    expect(result.malformedCount).toBe(0);
  });

  it('carries forward incomplete last line as remainder', () => {
    const chunk = '{"_time":1}\n{"_time":2,"na';
    const result = parseChunk(chunk, '');

    expect(result.events).toHaveLength(1);
    expect(result.events[0]._time).toBe(1);
    expect(result.remainder).toBe('{"_time":2,"na');
    expect(result.malformedCount).toBe(0);
  });

  it('prepends buffer from previous chunk to current chunk', () => {
    const buffer = '{"_time":2,"na';
    const chunk = 'me":"test"}\n';
    const result = parseChunk(chunk, buffer);

    expect(result.events).toHaveLength(1);
    expect(result.events[0]._time).toBe(2);
    expect(result.events[0].name).toBe('test');
    expect(result.remainder).toBe('');
  });

  it('handles CRLF line endings', () => {
    const chunk = '{"_time":1}\r\n{"_time":2}\r\n';
    const result = parseChunk(chunk, '');

    expect(result.events).toHaveLength(2);
    expect(result.events[0]._time).toBe(1);
    expect(result.events[1]._time).toBe(2);
    expect(result.remainder).toBe('');
  });

  it('skips empty lines', () => {
    const chunk = '{"_time":1}\n\n\n{"_time":2}\n';
    const result = parseChunk(chunk, '');

    expect(result.events).toHaveLength(2);
    expect(result.malformedCount).toBe(0);
  });

  it('skips malformed JSON lines and increments malformedCount', () => {
    const chunk = '{"_time":1}\nnot json\n{"_time":2}\n';
    const result = parseChunk(chunk, '');

    expect(result.events).toHaveLength(2);
    expect(result.events[0]._time).toBe(1);
    expect(result.events[1]._time).toBe(2);
    expect(result.malformedCount).toBe(1);
  });

  it('handles trailing newline without creating empty entry', () => {
    const chunk = '{"_time":1}\n';
    const result = parseChunk(chunk, '');

    expect(result.events).toHaveLength(1);
    expect(result.remainder).toBe('');
  });

  it('handles chunk with no newline (entirely incomplete)', () => {
    const chunk = '{"_time":1';
    const result = parseChunk(chunk, '');

    expect(result.events).toHaveLength(0);
    expect(result.remainder).toBe('{"_time":1');
  });

  it('returns empty events for empty input', () => {
    const result = parseChunk('', '');

    expect(result.events).toHaveLength(0);
    expect(result.remainder).toBe('');
    expect(result.malformedCount).toBe(0);
  });

  it('handles buffer-only input with no new chunk', () => {
    const result = parseChunk('', '{"_time":1}\n');

    expect(result.events).toHaveLength(1);
    expect(result.events[0]._time).toBe(1);
  });

  it('handles multiple malformed lines', () => {
    const chunk = 'bad1\nbad2\n{"_time":1}\nbad3\n';
    const result = parseChunk(chunk, '');

    expect(result.events).toHaveLength(1);
    expect(result.malformedCount).toBe(3);
  });

  it('counts JSON objects without numeric _time as malformed', () => {
    const chunk = '{"level":"info","message":"no time"}\n{"_time":"not-a-number"}\n{"_time":1}\n';
    const result = parseChunk(chunk, '');

    expect(result.events).toHaveLength(1);
    expect(result.events[0]._time).toBe(1);
    expect(result.malformedCount).toBe(2);
  });
});
