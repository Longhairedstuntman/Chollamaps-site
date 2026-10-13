import { BASES, type BaseId } from '../lib/config';
import { GROUPS, LAYERS, layerById, type LayerId } from '../map/layers';
import { useApp } from '../state/store';
import { I } from '../shell/Icons';
import Panel from './Panel';

function Legend({ id }: { id: LayerId }) {
  const l = layerById(id);
  if (!l.legend) return null;
  return (
    <div className="legend">
      {l.legend.map((k) => (
        <span key={k.label}><i className={'sw ' + (k.kind || 'fill')} style={{ background: k.kind === 'dashed' ? undefined : k.swatch, borderColor: k.kind === 'dashed' ? k.swatch : undefined }} />{k.label}</span>
      ))}
    </div>
  );
}

/** Basemaps on top, map layers as tiles grouped by category, Details per layer — onX's Layers menu, with a legend. */
export default function LayersPanel({ onClose }: { onClose: () => void }) {
  const base = useApp((s) => s.base), setBase = useApp((s) => s.setBase);
  const layers = useApp((s) => s.layers), toggle = useApp((s) => s.toggleLayer);
  const detail = useApp((s) => s.layerDetail), setDetail = useApp((s) => s.setLayerDetail);
  const signedIn = useApp((s) => !!s.session), toast = useApp((s) => s.showToast);

  if (detail) {
    const l = layerById(detail);
    return (
      <Panel title={l.label} eyebrow="Layer details" onClose={onClose} onBack={() => setDetail(null)}>
        <p className="fine">{l.source}{l.cadence ? ' · ' + l.cadence : ''}</p>
        <p>{l.details}</p>
        <Legend id={l.id} />
        {l.live && <p className="fine">Live layer: needs a connection and isn’t part of the phone’s offline downloads.</p>}
        {l.minzoom && <p className="fine">Shows from zoom {l.minzoom}.</p>}
        {!l.soon && <button type="button" className="btn primary" onClick={() => toggle(l.id)}>{layers.has(l.id) ? 'Turn off' : 'Turn on'}</button>}
      </Panel>
    );
  }

  return (
    <Panel title="Layers" onClose={onClose}>
      <div className="eyebrow">Base map</div>
      <div className="basemaps">
        {(Object.keys(BASES) as BaseId[]).map((k) => (
          <button key={k} type="button" className={'basemap ' + k} aria-pressed={base === k} onClick={() => setBase(k)}>
            <b>{BASES[k].label}</b><small>{BASES[k].blurb}</small>
          </button>
        ))}
      </div>
      {GROUPS.map((g) => (
        <div key={g.id}>
          <div className="eyebrow">{g.label}</div>
          <div className="tiles">
            {LAYERS.filter((l) => l.group === g.id).map((l) => {
              const on = layers.has(l.id);
              return (
                <div key={l.id} className={'tile' + (on ? ' on' : '') + (l.soon ? ' soon' : '')}>
                  <button type="button" className="tile-main" aria-pressed={on} disabled={l.soon} onClick={() => {
                    if (l.signIn && !signedIn) return toast('Sign in to see rider-reported conditions.');
                    toggle(l.id);
                  }}>
                    <span className="tile-check">{on ? I.check({ width: 14, height: 14 }) : null}</span>
                    <b>{l.label}</b>
                    <small>{l.soon ? 'On the build board' : l.source}</small>
                  </button>
                  <button type="button" className="tile-info" onClick={() => setDetail(l.id)} aria-label={'About ' + l.label}>{I.info({ width: 16, height: 16 })}</button>
                </div>
              );
            })}
          </div>
        </div>
      ))}
      <div className="eyebrow">Legend</div>
      {[...layers].filter((id) => layerById(id).legend).map((id) => (
        <div key={id} className="legend-block"><small>{layerById(id).label}</small><Legend id={id} /></div>
      ))}
      <p className="fine">Click anything on the map for its source and date. Live layers reload while they’re on.</p>
    </Panel>
  );
}
