import { act, fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MapCanvas } from './MapCanvas';
import { createMapStyleProvider } from '@/src/features/map/map-style';

const mock = vi.hoisted(() => ({ construct: vi.fn(), remove: vi.fn(), control: vi.fn() }));
vi.mock('maplibre-gl', () => ({
  Map: class { constructor() { return mock.construct(); } },
  NavigationControl: class {}, Marker: class {}, setWorkerUrl: vi.fn(),
}));

describe('map initialization recovery', () => {
  beforeEach(() => { mock.construct.mockReset(); mock.remove.mockReset(); mock.control.mockReset(); });
  const show = () => render(<MapCanvas shops={[]} selectedShopId={null}
    initialViewport={{ bounds: { west: 103, east: 104, south: 1, north: 2 }, zoom: 10 }}
    styleProvider={createMapStyleProvider()} cameraTarget={null}
    onSelectShop={vi.fn()} onCameraSettled={vi.fn()} />);

  it('keeps the fallback when the constructor throws', () => {
    mock.construct.mockImplementation(() => { throw new Error('No WebGL'); });
    show();
    expect(screen.getByText('Map unavailable')).toBeVisible();
  });

  it('recovers a partially initialized instance and tolerates incomplete teardown', () => {
    mock.construct.mockReturnValue({ remove: mock.remove });
    mock.remove.mockImplementation(() => { throw new Error('No handlers'); });
    const view = show();
    expect(screen.getByText(/Every result stays/)).toBeVisible();
    expect(mock.remove).toHaveBeenCalledOnce();
    expect(screen.getByTestId('map-canvas')).toBeEmptyDOMElement();
    expect(() => view.unmount()).not.toThrow();
  });

  it('cleans up a control setup failure before publishing the instance', () => {
    mock.construct.mockReturnValue({ touchZoomRotate: {disableRotation: vi.fn()}, addControl: mock.control, remove: mock.remove });
    mock.control.mockImplementation(() => { throw new Error('Control setup failed'); });
    show();
    expect(screen.getByText('Map unavailable')).toBeVisible();
    expect(mock.remove).toHaveBeenCalledOnce();
  });

  it('keeps a user pinch searchable when browser chrome resizes mid-gesture', () => {
    const handlers = new Map<string, Array<(event?: unknown) => void>>();
    const moving = { current: true };
    const stop = vi.fn(() => { for (const handler of handlers.get('moveend') ?? []) handler(); });
    const fitBounds = vi.fn();
    mock.construct.mockReturnValue({
      stop, fitBounds,
      touchZoomRotate: { disableRotation: vi.fn() }, addControl: vi.fn(), remove: mock.remove,
      on: (name: string, handler: (event?: unknown) => void) => {
        handlers.set(name, [...(handlers.get(name) ?? []), handler]);
      },
      isMoving: () => moving.current,
      getBounds: () => ({ getWest: () => 103, getEast: () => 104, getSouth: () => 1, getNorth: () => 2 }),
      getZoom: () => 10.2,
    });
    const settled = vi.fn(); const start = vi.fn();
    const props = { shops: [], selectedShopId: null,
      initialViewport: { bounds: { west: 103, east: 104, south: 1, north: 2 }, zoom: 10 },
      styleProvider: createMapStyleProvider(), onSelectShop: vi.fn(), onCameraSettled: settled, onUserMoveStart: start };
    const view = render(<MapCanvas {...props}
      cameraTarget={null} />);
    const emit = (name: string, event = {}) => act(() => {
      for (const handler of handlers.get(name) ?? []) handler(event);
    });
    fireEvent.wheel(screen.getByTestId('map-canvas'));
    emit('movestart'); // Renderer dropped originalEvent.
    expect(start).toHaveBeenCalledOnce();
    emit('resize');
    expect(settled).not.toHaveBeenCalled();
    moving.current = false;
    emit('moveend');
    expect(settled).toHaveBeenLastCalledWith(expect.objectContaining({ zoom: 10.2 }), 'user');
    emit('resize');
    expect(settled).toHaveBeenLastCalledWith(expect.anything(), 'resize');
    settled.mockClear();
    view.rerender(<MapCanvas {...props} cameraTarget={{ viewport: props.initialViewport, token: 2 }} />);
    expect(stop).toHaveBeenCalledOnce();
    expect(fitBounds).toHaveBeenCalledOnce();
    expect(settled).not.toHaveBeenCalled(); // Old flight's synchronous moveend.
    emit('moveend');
    expect(settled).toHaveBeenLastCalledWith(expect.anything(), 'programmatic');
  });
});
