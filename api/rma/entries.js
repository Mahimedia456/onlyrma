await fetch(`${API}/api/rma/entries`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  credentials: "include",
  body: JSON.stringify({
    entry_date: "2025-10-03",
    rma_type: "Warranty",
    category: "warranty",
    quantity: 1,
    // ...other fields...
  }),
});

const res = await fetch(`${API}/api/rma/entries?month=2025-10&page=1&pageSize=50`, { credentials: "include" });
const data = await res.json();
await fetch(`${API}/api/rma/entries/123`, {
  method: "PUT",
  headers: { "Content-Type": "application/json" },
  credentials: "include",
  body: JSON.stringify({ stock_type: "Refurbished", quantity: 3 }),
});
