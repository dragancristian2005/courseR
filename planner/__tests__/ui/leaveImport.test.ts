import { router } from 'expo-router';
import { leaveImport } from '../../src/ui/leaveImport';

jest.mock('expo-router', () => ({
  router: { replace: jest.fn(), dismissAll: jest.fn(), canDismiss: jest.fn() },
}));

const mocked = router as unknown as {
  replace: jest.Mock;
  dismissAll: jest.Mock;
  canDismiss: jest.Mock;
};

beforeEach(() => jest.clearAllMocks());

describe('leaveImport', () => {
  it('dismisses the stack, then replaces with the destination', () => {
    mocked.canDismiss.mockReturnValue(true);
    leaveImport('/exams');
    expect(mocked.dismissAll).toHaveBeenCalledTimes(1);
    expect(mocked.replace).toHaveBeenCalledWith('/exams');
    expect(mocked.dismissAll.mock.invocationCallOrder[0]).toBeLessThan(
      mocked.replace.mock.invocationCallOrder[0],
    );
  });
  it('only replaces when there is nothing to dismiss', () => {
    mocked.canDismiss.mockReturnValue(false);
    leaveImport('/');
    expect(mocked.dismissAll).not.toHaveBeenCalled();
    expect(mocked.replace).toHaveBeenCalledWith('/');
  });
  it('still replaces when dismissAll throws', () => {
    mocked.canDismiss.mockReturnValue(true);
    mocked.dismissAll.mockImplementation(() => {
      throw new Error('no-op on web');
    });
    leaveImport('/');
    expect(mocked.replace).toHaveBeenCalledWith('/');
  });
});
