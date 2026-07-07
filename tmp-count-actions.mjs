import { readFileSync } from 'node:fs';

const raw = JSON.parse(readFileSync('./tests/fixtures/noct.json', 'utf8'));
const d = raw.data ?? raw;

const cat = (t) => (t === 1 ? 'action' : t === 3 ? 'bonus' : t === 4 ? 'reaction' : 'other');
const arr = (v) => (Array.isArray(v) ? v : v == null ? [] : Object.values(v).flat());

const list = [];
for (const it of arr(d.inventory)) {
  if (it?.displayAsAttack === true && it?.definition?.name) list.push('action');
}
if (d.actions) {
  for (const group of Object.values(d.actions)) {
    for (const a of arr(group)) {
      if (a?.name) list.push(cat(a?.activation?.activationType));
    }
  }
}
const by = {};
for (const x of list) by[x] = (by[x] ?? 0) + 1;
console.log('total', list.length);
console.log('byCategory', by);
console.log('populatedGroups', Object.keys(by).length);
