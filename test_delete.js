
async function testDelete() {
    const res = await fetch('/api/test_collection/test_id', { method: 'DELETE' });
    console.log('Delete status:', res.status);
    const data = await res.json();
    console.log('Delete body:', data);
}
testDelete();
