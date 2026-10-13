import { useEffect, useState } from 'react';
import { getMap } from '../state/store';
import Panel from './Panel';

interface Period { name: string; startTime: string; temperature: number; temperatureUnit: string; windSpeed: string; windDirection: string; shortForecast: string; probabilityOfPrecipitation?: { value: number | null }; isDaytime: boolean }

async function forecast(lon: number, lat: number) {
  const p = await fetch(`https://api.weather.gov/points/${lat.toFixed(4)},${lon.toFixed(4)}`, { headers: { Accept: 'application/geo+json' } });
  if (!p.ok) throw new Error('No forecast for this spot.');
  const pj = await p.json();
  const [h, d] = await Promise.all([fetch(pj.properties.forecastHourly), fetch(pj.properties.forecast)]);
  if (!h.ok || !d.ok) throw new Error('The weather service is busy. Try again in a minute.');
  const hj = await h.json(), dj = await d.json();
  return { where: `${pj.properties.relativeLocation?.properties?.city || ''}${pj.properties.relativeLocation ? ', ' : ''}${pj.properties.relativeLocation?.properties?.state || ''}`,
    hourly: (hj.properties.periods as Period[]).slice(0, 12), daily: (dj.properties.periods as Period[]).slice(0, 8) };
}

/** Weather for the map center (or a spot), the way onX's Weather card works — NWS, no key, hourly + week. */
export default function WeatherCard({ onClose, at }: { onClose: () => void; at?: [number, number] }) {
  const [data, setData] = useState<Awaited<ReturnType<typeof forecast>> | null>(null);
  const [err, setErr] = useState('');
  useEffect(() => {
    const map = getMap(); const c = at || (map ? [map.getCenter().lng, map.getCenter().lat] : null);
    if (!c) return;
    setData(null); setErr('');
    forecast(c[0], c[1]).then(setData).catch((e) => setErr(e.message));
  }, [at]);
  return (
    <Panel title="Weather" eyebrow={data?.where || (at ? 'At this spot' : 'At the map center')} onClose={onClose}>
      {err && <p className="fine">{err}</p>}
      {!data && !err && <p className="fine">Loading the forecast…</p>}
      {data && <>
        <div className="eyebrow">Next 12 hours</div>
        <div className="hours">
          {data.hourly.map((p) => (
            <div key={p.startTime} className="hour">
              <small>{new Date(p.startTime).toLocaleTimeString([], { hour: 'numeric' })}</small>
              <b>{p.temperature}°</b>
              <small>{p.windSpeed.replace(' mph', '')} {p.windDirection}</small>
              {p.probabilityOfPrecipitation?.value ? <small className="rain">{p.probabilityOfPrecipitation.value}%</small> : <small>&nbsp;</small>}
            </div>
          ))}
        </div>
        <div className="eyebrow">This week</div>
        <div className="list">
          {data.daily.map((p) => (
            <div key={p.startTime} className="item column">
              <strong>{p.name} · {p.temperature}°{p.temperatureUnit}</strong>
              <small>{p.shortForecast} · wind {p.windSpeed} {p.windDirection}{p.probabilityOfPrecipitation?.value ? ` · ${p.probabilityOfPrecipitation.value}% precip` : ''}</small>
            </div>
          ))}
        </div>
        <p className="fine">National Weather Service. Mountain weather changes fast — read the whole afternoon, not just the morning.</p>
      </>}
    </Panel>
  );
}
