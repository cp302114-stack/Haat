// Sends many buyers after a few units at once, against a running server.
//   npm run race                    2 buyers, 1 unit
//   node scripts/race.js 25 3       25 buyers, 3 units
const [buyers = 2, units = 1] = process.argv.slice(2).map(Number);
const base = process.env.BASE_URL || 'http://localhost:3000';

const res = await fetch(`${base}/api/demo/race?buyers=${buyers}&units=${units}`, { method: 'POST' });
if (!res.ok) {
  console.error('Race failed:', res.status, await res.text());
  process.exit(1);
}
const out = await res.json();
const won = out.results.filter((r) => r.outcome === 'got it');
console.log(`${out.product.name} in ${out.product.city}: ${units} unit(s), ${buyers} buyers, settled in ${out.ms} ms`);
console.log(`  got it:   ${won.length} ${won.map((w) => w.order.number).join(' ')}`);
console.log(`  sold out: ${out.results.length - won.length}`);
process.exit(won.length === units ? 0 : 1);
