import { render, screen } from '@testing-library/react';
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
});
