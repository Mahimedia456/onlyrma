import { config, store, ok } from '../../_shared.js';
export { config };

const DEVICE_NAMES = [
  "Ninja","Ninja V","Ninja V Plus","Ninja Ultra","Ninja Phone",
  "Shinobi II","Shinobi 7","Shinobi GO","Shogun Ultra","Shogun Connect",
  "Sumo 19SE","A-Eye PTZ camera","Sun Hood","Master Caddy III","Atomos Connect",
  "AtomX Battery","Ultrasync Blue","AtomFlex HDMI Cable","Atomos Creator Kit 5''",
];

export default function handler(_req, res) {
  const found = [...new Set(store.emeaStock.map(s => s.device_name).filter(Boolean))];
  const devices = Array.from(new Set([...DEVICE_NAMES, ...found])).sort();
  return ok(res, { devices });
}
