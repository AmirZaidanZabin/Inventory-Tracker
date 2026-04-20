
import fetch from "node-fetch";
async function check() {
  try {
    const res = await fetch("http://localhost:3000/api/health");
    console.log(await res.json());
  } catch (e) {
    console.error("Fetch failed:", e);
  }
}
check();
