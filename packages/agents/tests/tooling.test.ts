import {describe, expect, it} from 'vitest';
import * as z from 'zod';
import {Tool, tool} from '../src/tooling.js';

const WeatherParameters = z.object({
  city: z.string(),
  unit: z.enum(['celsius', 'fahrenheit']).default('celsius'),
});

function getWeather({city, unit}: z.output<typeof WeatherParameters>) {
  return `${city}: sunny, in ${unit}`;
}

describe('Tool', () => {
  const weather = tool(getWeather, {
    description: 'Get the weather for a city.',
    parameters: WeatherParameters,
  });

  it('is named after its function', () => {
    expect(weather.name).toBe('getWeather');
    expect(String(weather)).toBe('<Tool name=getWeather params=[city, unit]>');
  });

  it('describes its arguments as JSON Schema', () => {
    expect(weather.toJSON()).toEqual({
      type: 'function',
      function: {
        name: 'getWeather',
        description: 'Get the weather for a city.',
        parameters: {
          type: 'object',
          properties: {
            city: {type: 'string'},
            unit: {
              type: 'string',
              enum: ['celsius', 'fahrenheit'],
              default: 'celsius',
            },
          },
          required: ['city'],
          additionalProperties: false,
        },
      },
    });
  });

  it('fills in defaults when called', () => {
    expect(weather.call({city: 'Paris'})).toBe('Paris: sunny, in celsius');
  });

  it('rejects arguments that do not match the schema', () => {
    expect(() => weather.call({city: 3} as never)).toThrow(z.ZodError);
  });

  it('needs a name for an anonymous function', () => {
    expect(() => tool(() => 0, {parameters: z.object({})})).toThrow(
      /needs a name/,
    );
  });

  it('rejects types that JSON Schema cannot represent', () => {
    function stamp() {
      return 0;
    }
    expect(() => Tool.fromFunc(stamp, z.object({when: z.date()}))).toThrow(
      /cannot be represented/,
    );
  });
});
