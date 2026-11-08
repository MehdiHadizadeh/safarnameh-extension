const test = require("node:test");
const assert = require("node:assert");
const A = require("../assets/analyze.js");

const ride = (id, at, over = {}) => Object.assign({
  human_readable_id: id, created_at: at, updated_at: at, latest_ride_status: 5,
  final_price: 100000, vehicle_model: "Tiba", driver_name: "d" + id,
  origin: { lat: 35.70, lng: 51.40, formatted_address: "شهر تهران، الف" },
  destination: { lat: 35.75, lng: 51.45, formatted_address: "شهر تهران، ب" },
}, over);

test("g2j: Nowruz 1403 and a leap boundary", () => {
  assert.deepStrictEqual(A.g2j(2024, 3, 20), { jy: 1403, jm: 1, jd: 1 });
  assert.deepStrictEqual(A.g2j(2025, 3, 20), { jy: 1403, jm: 12, jd: 30 });
  assert.deepStrictEqual(A.g2j(2025, 3, 21), { jy: 1404, jm: 1, jd: 1 });
});

test("rides with unparseable created_at are skipped, not fatal", () => {
  const rides = [1, 2, 3].map((i) => ride(i, `2025-05-0${i} 10:00:00`));
  rides.push(ride(9, "garbage"));
  assert.strictEqual(A.analyze({ rides }).meta.records, 3);
});

test("zero first-period fare gives mult 0, not Infinity/NaN", () => {
  const rides = [];
  for (let i = 1; i <= 4; i++) rides.push(ride(i, `2025-01-0${i} 10:00:00`, { final_price: 0 }));
  for (let i = 5; i <= 8; i++) rides.push(ride(i, `2025-09-0${i} 10:00:00`));
  assert.strictEqual(A.analyze({ rides }).thesis.mult, 0);
});

test("prototype-like keys in untrusted strings do not corrupt counts", () => {
  const rides = ["constructor", "__proto__", "toString"].map((v, i) =>
    ride(i + 1, `2025-05-0${i + 1} 10:00:00`, { vehicle_model: v }));
  const m = A.analyze({ rides });
  assert.deepStrictEqual(m.vehicles.map((kv) => kv[1]), [1, 1, 1]);
});

test("input with no usable rides throws", () => {
  assert.throws(() => A.analyze({ rides: [] }));
});

test("serviceStats folds Snapp service names into car and bike, finished rides only", () => {
  const rides = [
    ...[1, 2, 3, 4].map((i) => ride(i, `2025-05-0${i} 10:00:00`, { service_type_name: "اسنپ", final_price: 400000 })),
    ride(5, "2025-05-05 10:00:00", { service_type_name: "بین شهری", final_price: 400000 }),
    ...[6, 7].map((i) => ride(i, `2025-05-0${i} 10:00:00`, { service_type_name: i === 6 ? "اسنپ بایک" : "اسنپ بایک پلاس", final_price: 200000 })),
    ride(8, "2025-05-08 10:00:00", { service_type_name: "اسنپ بایک", latest_ride_status: 6 }),
    ride(9, "2025-05-09 10:00:00", { final_price: 100000 }),
  ];
  const s = A.serviceStats({ rides });
  assert.deepStrictEqual(s.map((x) => [x.name, x.n]), [["خودرو", 6], ["بایک", 2]]);
  assert.strictEqual(s[1].total, 40000);
  assert.strictEqual(s[1].perKm, null, "fewer than 3 rides: no per-km figure");
  assert.strictEqual(A.serviceGroup("اسنپ بایک پلاس"), "بایک");
  assert.strictEqual(A.serviceGroup(undefined), "خودرو");
});

test("a route ridden once or twice never becomes the headline route", () => {
  const far = { origin: { lat: 35.7, lng: 51.4, formatted_address: "شهر تهران، الف" }, destination: { lat: 35.9, lng: 51.9, formatted_address: "شهر تهران، ج" } };
  const rides = [1, 2].map((i) => ride(i, `2025-05-0${i} 10:00:00`)).concat([3].map((i) => ride(i, "2025-09-03 10:00:00", far)));
  assert.strictEqual(A.analyze({ rides }).thesis, null);
});
