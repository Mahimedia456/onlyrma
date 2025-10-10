import { ok, db } from '../../../_lib.js';
export const config = { runtime: 'nodejs' };

export default function handler(_req, res) {
  const DEVICE_NAMES = [
    "Ninja","Ninja V","Ninja V Plus","Ninja Ultra","Ninja Phone",
    "Shinobi II","Shinobi 7","Shinobi GO","Shogun Ultra","Shogun Connect",
    "Sumo 19SE","A-Eye PTZ camera","Sun Hood","Master Caddy III","Atomos Connect",
    "AtomX Battery","Ultrasync Blue","AtomFlex HDMI Cable","Atomos Creator Kit 5''",
  ];
  const found = [...new Set(db.emeaStock.map(s => s.device_name).filter(Boolean))];
  const devices = Array.from(new Set([...DEVICE_NAMES, ...found])).sort();
  return ok(res, { devices });
}
