import { fireEvent, render, screen } from '@testing-library/react-native';
import { Platform } from 'react-native';
import { DateField, TimeField } from '../../src/ui/FormBits';

type Node = { type: unknown; props: Record<string, any>; children?: Node[] | null };

function inputs(json: unknown, out: Node[] = []): Node[] {
  const n = json as Node | Node[] | null;
  if (!n) return out;
  if (Array.isArray(n)) {
    n.forEach((c) => inputs(c, out));
    return out;
  }
  if (n.type === 'input') out.push(n);
  (n.children ?? []).forEach((c) => typeof c !== 'string' && inputs(c, out));
  return out;
}

// Jest resolves the native PickerInput; the web build resolves PickerInput.web.
jest.mock('../../src/ui/PickerInput', () => require('../../src/ui/PickerInput.web'));

describe('DateField / TimeField on the web', () => {
  const original = Platform.OS;
  beforeAll(() => {
    Platform.OS = 'web';
  });
  afterAll(() => {
    Platform.OS = original;
  });

  it.each([
    ['date', DateField, '2026-11-12'],
    ['time', TimeField, '09:40'],
  ] as const)('renders an input of type %s with value and label', async (type, Comp, value) => {
    const onChangeText = jest.fn();
    const onBlur = jest.fn();
    const { toJSON } = await render(
      <Comp label="When" value={value} onChangeText={onChangeText} onBlur={onBlur} />,
    );
    const [input] = inputs(toJSON());
    expect(input.props.type).toBe(type);
    expect(input.props.value).toBe(value);
    expect(input.props['aria-label']).toBe('When');
    expect(screen.getByText('When')).toBeTruthy();
    expect(inputs(toJSON())).toHaveLength(1);
    expect(input.props.style.minHeight).toBe('44px');
    expect(input.props.style.fontSize).toBe('16px');
  });

  it.each([
    ['date', DateField, '2026-11-12'],
    ['time', TimeField, '09:40'],
  ] as const)('%s input reports changes, allows empty, and blurs', async (_t, Comp, value) => {
    const onChangeText = jest.fn();
    const onBlur = jest.fn();
    const { toJSON } = await render(
      <Comp label="When" value={value} onChangeText={onChangeText} onBlur={onBlur} />,
    );
    const [input] = inputs(toJSON());
    input.props.onChange({ target: { value: '' } });
    expect(onChangeText).toHaveBeenLastCalledWith('');
    input.props.onInput({ target: { value } });
    expect(onChangeText).toHaveBeenLastCalledWith(value);
    input.props.onBlur();
    expect(onBlur).toHaveBeenCalled();
  });

  it('shows the error line', async () => {
    await render(<DateField label="D" value="" onChangeText={() => {}} error="Bad date" />);
    expect(screen.getByText('Bad date')).toBeTruthy();
  });
});

describe('optional pickers on the web', () => {
  const original = Platform.OS;
  beforeAll(() => {
    Platform.OS = 'web';
  });
  afterAll(() => {
    Platform.OS = original;
  });

  it('Clear gives an empty value', async () => {
    const onChangeText = jest.fn();
    await render(
      <DateField optional label="Due date" value="2026-11-12" onChangeText={onChangeText} />,
    );
    await fireEvent.press(screen.getByLabelText('Clear Due date'));
    expect(onChangeText).toHaveBeenCalledWith('');
  });

  it('has no Clear when required or already empty', async () => {
    await render(
      <>
        <TimeField label="Req" value="09:40" onChangeText={() => {}} />
        <TimeField optional label="Opt" value="" onChangeText={() => {}} />
      </>,
    );
    expect(screen.queryByLabelText('Clear Req')).toBeNull();
    expect(screen.queryByLabelText('Clear Opt')).toBeNull();
  });

  it('removes native appearance and left-aligns', async () => {
    const { toJSON } = await render(<DateField label="D" value="" onChangeText={() => {}} />);
    const [input] = inputs(toJSON());
    expect(input.props.style.appearance).toBe('none');
    expect(input.props.style.textAlign).toBe('left');
  });
});

describe('DateField / TimeField on native', () => {
  it('stay TextInputs', async () => {
    const onChangeText = jest.fn();
    await render(
      <>
        <DateField label="D" value="2026-11-12" onChangeText={onChangeText} />
        <TimeField label="T" value="09:40" onChangeText={onChangeText} />
      </>,
    );
    expect(screen.getByLabelText('D').type).toBe('TextInput');
    expect(screen.getByLabelText('T').type).toBe('TextInput');
    await fireEvent.changeText(screen.getByLabelText('D'), '2026-11-13');
    expect(onChangeText).toHaveBeenCalledWith('2026-11-13');
  });
});
