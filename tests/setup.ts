import '@testing-library/jest-dom';

// Mock Tauri APIs for unit testing
const mockInvoke = vi.fn();
const mockListen = vi.fn(() => Promise.resolve(() => {}));
const mockOpen = vi.fn();
const mockSave = vi.fn();

vi.mock('@tauri-apps/api/tauri', () => ({ invoke: mockInvoke }));
vi.mock('@tauri-apps/api/event', () => ({ listen: mockListen }));
vi.mock('@tauri-apps/api/dialog', () => ({ open: mockOpen, save: mockSave }));

export { mockInvoke, mockListen, mockOpen, mockSave };
