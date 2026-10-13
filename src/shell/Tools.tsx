import type { ReactElement } from 'react';
import { getMap, useApp, type ToolId } from '../state/store';
import { I } from './Icons';

const TOOLS: Array<{ id: ToolId; label: string; icon: () => ReactElement }> = [
  { id: 'pin', label: 'Pin', icon: I.pin },
  { id: 'measure', label: 'Measure', icon: I.measure },
  { id: 'area', label: 'Area', icon: I.area },
  { id: 'route', label: 'Plan route', icon: I.route }
];

/** Right side: the Tools (onX: Waypoint, Line, Shape, Build Route) and zoom. */
export default function Tools() {
  const tool = useApp((s) => s.tool), setTool = useApp((s) => s.setTool);
  const session = useApp((s) => s.session), setPanel = useApp((s) => s.setPanel), toast = useApp((s) => s.showToast);
  const pick = (id: ToolId) => {
    if (!session && id !== 'measure' && id !== 'area') { setPanel('account'); toast('Sign in to drop pins and save routes.'); return; }
    setTool(id);
  };
  return (
    <div className="tools">
      <div className="tools-group">
        {TOOLS.map((t) => (
          <button key={t.id} type="button" className="tool-btn" aria-pressed={tool === t.id} onClick={() => pick(t.id)} title={t.label}>
            {t.icon()}<span>{t.label}</span>
          </button>
        ))}
      </div>
      <div className="tools-group zoom">
        <button type="button" className="tool-btn" onClick={() => getMap()?.zoomIn()} aria-label="Zoom in">{I.plus()}</button>
        <button type="button" className="tool-btn" onClick={() => getMap()?.zoomOut()} aria-label="Zoom out">{I.minus()}</button>
        <button type="button" className="tool-btn" onClick={() => getMap()?.easeTo({ bearing: 0, duration: 400 })} aria-label="Point north">{I.compass()}</button>
      </div>
    </div>
  );
}
